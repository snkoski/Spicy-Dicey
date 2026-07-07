import { useState } from 'react';
import { DEFAULT_RULESET } from '@spicy-dicey/core-engine';
import type { RoomStateSnapshot } from '@spicy-dicey/contracts';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';
import { cn } from '../../lib/utils';
import { Die2D } from '../dice/Die2D';
import { connectAsGuest } from './transport';
import { useOnlineStore, type OnlineTransport } from './store';

type Connect = (displayName: string) => Promise<{ transport: OnlineTransport; selfId: string }>;

export function OnlinePage({ connect = connectAsGuest }: { connect?: Connect }) {
  const roomCode = useOnlineStore((s) => s.roomCode);
  return roomCode === null ? <ConnectForm connect={connect} /> : <RoomView />;
}

function ConnectForm({ connect }: { connect: Connect }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [asSpectator, setAsSpectator] = useState(false);
  const [timer, setTimer] = useState<'30' | '60' | '90' | 'off'>('60');
  const [target, setTarget] = useState(String(DEFAULT_RULESET.targetScore));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastError = useOnlineStore((s) => s.lastError);

  const withConnection = async (fn: () => Promise<void>) => {
    if (name.trim() === '') {
      setError('Enter your name first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { transport, selfId } = await connect(name.trim());
      useOnlineStore.getState().attach(transport, selfId);
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Play online</CardTitle>
        <p className="text-sm text-slate-500">Private rooms, 2–8 players, spectators welcome.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-w-xs space-y-1.5">
          <Label htmlFor="online-name">Your name</Label>
          <Input id="online-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="online-target">Target score</Label>
            <Input
              id="online-target"
              type="number"
              step={500}
              className="w-28"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="online-timer">Turn timer</Label>
            <Select
              id="online-timer"
              value={timer}
              onChange={(e) => setTimer(e.target.value as typeof timer)}
            >
              <option value="30">30s</option>
              <option value="60">60s</option>
              <option value="90">90s</option>
              <option value="off">Off</option>
            </Select>
          </div>
          <Button
            type="button"
            disabled={busy}
            onClick={() =>
              void withConnection(() =>
                useOnlineStore.getState().createRoom({
                  rulesetConfig: {
                    ...DEFAULT_RULESET,
                    targetScore: Number(target) || DEFAULT_RULESET.targetScore,
                    onTheBoardEnabled: Number(target) >= 1000,
                  },
                  maxPlayers: 8,
                  turnTimerSec: timer === 'off' ? null : (Number(timer) as 30 | 60 | 90),
                  spectatorChatEnabled: true,
                  displayName: name.trim(),
                }),
              )
            }
          >
            Create room
          </Button>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="online-code">Room code</Label>
            <Input
              id="online-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              className="w-32 font-mono uppercase"
            />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={asSpectator}
              onChange={(e) => setAsSpectator(e.target.checked)}
              aria-label="join as spectator"
            />
            Join as spectator
          </label>
          <Button
            type="button"
            variant="secondary"
            disabled={busy || code.length !== 6}
            onClick={() =>
              void withConnection(() =>
                useOnlineStore.getState().joinRoom({
                  roomCode: code,
                  displayName: name.trim(),
                  asSpectator,
                }),
              )
            }
          >
            Join room
          </Button>
        </div>

        {(error ?? lastError) && <p className="text-sm text-red-600">{error ?? lastError}</p>}
      </CardContent>
    </Card>
  );
}

function RoomView() {
  const room = useOnlineStore((s) => s.room);
  const roomCode = useOnlineStore((s) => s.roomCode);
  const selfId = useOnlineStore((s) => s.selfId);
  const banner = useOnlineStore((s) => s.lastBanner);
  const lastError = useOnlineStore((s) => s.lastError);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>
            Room <span className="font-mono">{roomCode}</span>
          </CardTitle>
          {banner && <p className="text-sm font-medium text-amber-700">{banner}</p>}
          {lastError && <p className="text-sm text-red-600">{lastError}</p>}
        </CardHeader>
        <CardContent className="space-y-4">
          {room?.status === 'lobby' && <LobbyPanel room={room} selfId={selfId} />}
          {room?.status !== 'lobby' && room?.match && <GamePanel room={room} selfId={selfId} />}
          {!room && <p className="text-sm text-slate-500">Waiting for the room state…</p>}
        </CardContent>
      </Card>
      <ChatPanel />
    </div>
  );
}

function LobbyPanel({ room, selfId }: { room: RoomStateSnapshot; selfId: string | null }) {
  const send = useOnlineStore((s) => s.send);
  const players = room.members.filter((m) => m.role === 'player');
  return (
    <div className="space-y-3">
      <ul className="space-y-1 text-sm">
        {room.members.map((m) => (
          <li key={m.playerId}>
            {m.displayName}
            {m.playerId === room.hostId ? ' (host)' : ''}
            {m.role === 'spectator' ? ' — spectator' : ''}
            {!m.connected ? ' — disconnected' : ''}
          </li>
        ))}
      </ul>
      {selfId === room.hostId ? (
        <Button type="button" disabled={players.length < 2} onClick={() => void send('game:start')}>
          Start game ({players.length} players)
        </Button>
      ) : (
        <p className="text-sm text-slate-500">Waiting for the host to start…</p>
      )}
    </div>
  );
}

function GamePanel({ room, selfId }: { room: RoomStateSnapshot; selfId: string | null }) {
  const send = useOnlineStore((s) => s.send);
  const selectedIndices = useOnlineStore((s) => s.selectedIndices);
  const toggleDie = useOnlineStore((s) => s.toggleDie);
  const match = room.match!;
  const myTurn = match.currentPlayerId === selfId && match.status === 'active';
  const phase = match.turn.phase;
  const nameOf = (id: string) => room.members.find((m) => m.playerId === id)?.displayName ?? id;

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">
        {match.status === 'ended'
          ? `Game over — ${match.winnerId ? nameOf(match.winnerId) : 'nobody'} wins!`
          : myTurn
            ? 'Your turn'
            : `${nameOf(match.currentPlayerId ?? '')}'s turn`}
      </p>

      {match.turn.roll && (
        <div className="flex flex-wrap gap-3" aria-label="dice tray">
          {match.turn.roll.map((value, i) => (
            <Die2D
              key={i}
              value={value}
              selected={selectedIndices.includes(i)}
              disabled={!myTurn || phase !== 'awaiting-selection'}
              onClick={() => toggleDie(i)}
            />
          ))}
        </div>
      )}

      {myTurn && (
        <div className="flex flex-wrap items-center gap-3">
          {phase === 'awaiting-roll' && (
            <Button type="button" onClick={() => void send('turn:roll')}>
              Roll
            </Button>
          )}
          {phase === 'awaiting-selection' && (
            <Button
              type="button"
              disabled={selectedIndices.length === 0}
              onClick={() =>
                void send('turn:select', {
                  diceIndices: [...selectedIndices].sort((a, b) => a - b),
                })
              }
            >
              Keep selection
            </Button>
          )}
          {phase === 'awaiting-decision' && (
            <>
              <span className="text-sm">
                Turn score: <strong>{match.turn.turnScore}</strong>
              </span>
              <Button type="button" onClick={() => void send('turn:roll')}>
                Roll again ({match.turn.diceToRoll})
              </Button>
              <Button type="button" variant="secondary" onClick={() => void send('turn:bank')}>
                Bank {match.turn.turnScore}
              </Button>
            </>
          )}
        </div>
      )}

      <ul className="space-y-1 text-sm">
        {match.players.map((p) => (
          <li
            key={p.id}
            className={cn(
              'flex justify-between rounded px-2 py-1',
              p.id === match.currentPlayerId &&
                match.status === 'active' &&
                'bg-blue-50 font-medium',
            )}
          >
            <span>
              {nameOf(p.id)}
              {match.winnerId === p.id ? ' 🏆' : ''}
            </span>
            <span className="tabular-nums">{p.total}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChatPanel() {
  const chat = useOnlineStore((s) => s.chat);
  const send = useOnlineStore((s) => s.send);
  const [text, setText] = useState('');

  const submit = () => {
    if (text.trim() === '') {
      return;
    }
    void send('chat:send', { text: text.trim() });
    setText('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chat</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
          {chat.map((m) => (
            <li key={m.messageId}>
              <span className="font-medium">{m.displayName}:</span> {m.text}
              {m.filtered && <span className="ml-1 text-xs text-slate-400">(filtered)</span>}
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Input
            aria-label="chat message"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          <Button type="button" onClick={submit}>
            Send
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
