import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_RULESET, createMulberry32 } from '@spicy-dicey/core-engine';
import { Room } from '../src/game/room.js';
import type { RoomOutbox } from '../src/game/room.js';

interface Sent {
  scope: 'room' | string;
  event: string;
  payload: unknown;
}

function recordingOutbox() {
  const sent: Sent[] = [];
  const outbox: RoomOutbox = {
    broadcast: (event, payload) => void sent.push({ scope: 'room', event, payload }),
    toIdentity: (identity, event, payload) => void sent.push({ scope: identity, event, payload }),
  };
  return { sent, outbox };
}

const config = {
  rulesetConfig: { ...DEFAULT_RULESET, onTheBoardEnabled: false, targetScore: 1000 },
  maxPlayers: 3,
  turnTimerSec: 60 as const,
  spectatorChatEnabled: false,
  displayName: 'Host',
};

function makeRoom(seed = 42) {
  const { sent, outbox } = recordingOutbox();
  const room = new Room('ABC123', 'host-id', config, outbox, {
    rng: createMulberry32(seed),
  });
  room.join('host-id', 'Host', false);
  return { room, sent };
}

const lastState = (sent: Sent[]) =>
  [...sent].reverse().find((s) => s.event === 'room:state')?.payload as {
    status: string;
    match: {
      currentPlayerId: string | null;
      turn: { phase: string; roll: number[] | null; turnScore: number };
      players: Array<{ id: string; total: number }>;
    } | null;
  };

describe('Room membership', () => {
  it('caps players at maxPlayers but admits spectators', () => {
    const { room } = makeRoom();
    room.join('p2', 'Two', false);
    room.join('p3', 'Three', false);
    expect(() => room.join('p4', 'Four', false)).toThrow(/full/i);
    expect(() => room.join('p4', 'Four', true)).not.toThrow(); // spectator
  });

  it('rejects joins after the game starts (players) but allows spectators', () => {
    const { room } = makeRoom();
    room.join('p2', 'Two', false);
    room.start('host-id');
    expect(() => room.join('late', 'Late', false)).toThrow(/started/i);
    expect(() => room.join('watcher', 'W', true)).not.toThrow();
  });

  it('only the host can start, and only with 2+ players', () => {
    const { room } = makeRoom();
    expect(() => room.start('host-id')).toThrow(/players/i);
    room.join('p2', 'Two', false);
    expect(() => room.start('p2')).toThrow(/host/i);
    room.start('host-id');
    expect(() => room.start('host-id')).toThrow(/progress|started/i);
  });
});

describe('Room authoritative turns', () => {
  let room: Room;
  let sent: Sent[];

  beforeEach(() => {
    vi.useFakeTimers();
    ({ room, sent } = makeRoom(7));
    room.join('p2', 'Two', false);
    room.start('host-id');
  });
  afterEach(() => vi.useRealTimers());

  it('all dice come from the server RNG and reach everyone', () => {
    room.roll('host-id');
    const state = lastState(sent);
    expect(state.match!.turn.roll).toHaveLength(6);
    for (const die of state.match!.turn.roll!) {
      expect(die).toBeGreaterThanOrEqual(1);
      expect(die).toBeLessThanOrEqual(6);
    }
  });

  it('rejects acting out of turn and by spectators', () => {
    room.join('watcher', 'W', true);
    expect(() => room.roll('p2')).toThrow(/turn/i);
    expect(() => room.roll('watcher')).toThrow(/spectator|player/i);
    expect(() => room.roll('stranger')).toThrow(/member/i);
  });

  it('select takes indices into the server-known roll — values cannot be forged', () => {
    room.roll('host-id');
    const roll = lastState(sent).match!.turn.roll!;
    // find a legal single keep: a 1 or a 5 by INDEX
    const idx = roll.findIndex((v) => v === 1 || v === 5);
    if (idx >= 0) {
      room.select('host-id', [idx]);
      expect(lastState(sent).match!.turn.turnScore).toBeGreaterThan(0);
    }
    // out-of-range index is rejected regardless
    expect(() => room.select('host-id', [17])).toThrow();
  });

  it('a full scripted exchange banks points and rotates the seat', () => {
    // deterministic seed 7: play until the first bank happens
    for (let guard = 0; guard < 50; guard += 1) {
      const state = lastState(sent);
      if (state.match!.players.some((p) => p.total > 0)) {
        break;
      }
      const current = state.match!.currentPlayerId!;
      const phase = state.match!.turn.phase;
      if (phase === 'awaiting-roll') {
        room.roll(current);
      } else if (phase === 'awaiting-selection') {
        const roll = lastState(sent).match!.turn.roll!;
        const keep = bestIndices(roll);
        if (keep.length === 0) {
          break; // farkled server-side already
        }
        room.select(current, keep);
      } else if (phase === 'awaiting-decision') {
        room.bank(current);
      }
    }
    expect(lastState(sent).match!.players.some((p) => p.total > 0)).toBe(true);
  });

  it('turn timer auto-passes (decision 4)', () => {
    room.roll('host-id');
    vi.advanceTimersByTime(60_000);
    const state = lastState(sent);
    expect(state.match!.currentPlayerId).toBe('p2');
    expect(sent.some((s) => s.event === 'turn:timedOut')).toBe(true);
  });
});

describe('Room disconnect handling (decision 5)', () => {
  let room: Room;
  let sent: Sent[];

  beforeEach(() => {
    vi.useFakeTimers();
    ({ room, sent } = makeRoom(7));
    room.join('p2', 'Two', false);
    room.start('host-id');
  });
  afterEach(() => vi.useRealTimers());

  it('holds the seat for the grace period, then auto-passes', () => {
    room.onDisconnect('host-id');
    expect(sent.some((s) => s.event === 'player:disconnected')).toBe(true);
    // within grace: still host's turn
    vi.advanceTimersByTime(30_000);
    expect(lastState(sent).match!.currentPlayerId).toBe('host-id');
    // grace expires -> auto-pass
    vi.advanceTimersByTime(60_001);
    expect(lastState(sent).match!.currentPlayerId).toBe('p2');
  });

  it('reconnecting within grace resumes the held seat', () => {
    room.roll('host-id');
    room.onDisconnect('host-id');
    vi.advanceTimersByTime(30_000);
    room.onReconnect('host-id');
    expect(sent.some((s) => s.event === 'player:reconnected')).toBe(true);
    const state = lastState(sent);
    expect(state.match!.currentPlayerId).toBe('host-id');
    expect(state.match!.turn.roll).toHaveLength(6); // turn state intact
  });

  it('turns are auto-passed while a player stays absent', () => {
    room.onDisconnect('p2');
    vi.advanceTimersByTime(90_001); // p2's grace expires (not their turn: no-op)
    // host banks nothing; forfeits via timeout to reach p2's turn
    vi.advanceTimersByTime(60_000);
    // p2 absent -> their turn is forfeited immediately back to host
    expect(lastState(sent).match!.currentPlayerId).toBe('host-id');
  });

  it('the host can remove a disconnected player', () => {
    room.onDisconnect('p2');
    room.remove('host-id', 'p2');
    expect(() => room.onReconnect('p2')).toThrow(/member/i);
  });
});

describe('Room chat', () => {
  it('filters profanity and carries the moderation-ready shape', () => {
    const { room, sent } = makeRoom();
    room.join('p2', 'Two', false);
    room.chat('p2', 'what the fuck');
    const message = sent.findLast((s) => s.event === 'chat:message')!.payload as {
      messageId: string;
      senderId: string;
      text: string;
      filtered: boolean;
      ts: number;
    };
    expect(message.filtered).toBe(true);
    expect(message.senderId).toBe('p2');
    expect(message.messageId).toMatch(/\S/);
    expect(message.text).not.toMatch(/fuck/i);
  });

  it('blocks spectator chat when the host disabled it (decision 10)', () => {
    const { room } = makeRoom();
    room.join('watcher', 'W', true);
    expect(() => room.chat('watcher', 'hi')).toThrow(/spectator/i);
  });
});

/** all 1s and 5s; else any face with 3+; else empty */
function bestIndices(roll: number[]): number[] {
  const singles = roll.flatMap((v, i) => (v === 1 || v === 5 ? [i] : []));
  if (singles.length > 0) {
    return singles;
  }
  for (const face of [2, 3, 4, 6]) {
    const idx = roll.flatMap((v, i) => (v === face ? [i] : []));
    if (idx.length >= 3) {
      return idx;
    }
  }
  return [];
}
