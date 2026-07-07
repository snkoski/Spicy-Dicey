import { beforeEach, describe, expect, it } from 'vitest';
import type { ChatMessage, RoomStateSnapshot } from '@spicy-dicey/contracts';
import { DEFAULT_RULESET } from '@spicy-dicey/core-engine';
import { useOnlineStore, type OnlineTransport } from '../../src/features/online/store';

/** Scripted fake server: records emits, lets tests push server events. */
function fakeTransport() {
  const listeners = new Map<string, (payload: unknown) => void>();
  const emitted: Array<{ event: string; payload: unknown }> = [];
  const transport: OnlineTransport = {
    emitWithAck: (event, payload) => {
      emitted.push({ event, payload });
      if (event === 'room:create') {
        return Promise.resolve({ roomCode: 'ABC123' });
      }
      if (event === 'turn:roll' && (payload as { fail?: boolean } | undefined)?.fail) {
        return Promise.resolve({ error: 'not your turn' });
      }
      return Promise.resolve({ ok: true });
    },
    on: (event, handler) => void listeners.set(event, handler as (payload: unknown) => void),
    disconnect: () => {},
  };
  const push = (event: string, payload: unknown) => listeners.get(event)?.(payload);
  return { transport, emitted, push };
}

const snapshot = (over: Partial<RoomStateSnapshot> = {}): RoomStateSnapshot => ({
  code: 'ABC123',
  status: 'lobby',
  hostId: 'me',
  maxPlayers: 4,
  turnTimerSec: 60,
  spectatorChatEnabled: true,
  ruleset: DEFAULT_RULESET,
  members: [{ playerId: 'me', displayName: 'Ann', role: 'player', connected: true }],
  turnDeadline: null,
  match: null,
  ...over,
});

describe('useOnlineStore', () => {
  beforeEach(() => useOnlineStore.getState().reset());

  it('creates a room and tracks the returned code', async () => {
    const { transport } = fakeTransport();
    useOnlineStore.getState().attach(transport, 'me');
    await useOnlineStore.getState().createRoom({
      rulesetConfig: DEFAULT_RULESET,
      maxPlayers: 4,
      turnTimerSec: 60,
      spectatorChatEnabled: true,
      displayName: 'Ann',
    });
    expect(useOnlineStore.getState().roomCode).toBe('ABC123');
  });

  it('applies room:state snapshots from the server', () => {
    const { transport, push } = fakeTransport();
    useOnlineStore.getState().attach(transport, 'me');
    push('room:state', snapshot());
    expect(useOnlineStore.getState().room?.code).toBe('ABC123');
    expect(useOnlineStore.getState().room?.status).toBe('lobby');
  });

  it('collects chat messages', () => {
    const { transport, push } = fakeTransport();
    useOnlineStore.getState().attach(transport, 'me');
    const message: ChatMessage = {
      messageId: 'm1',
      senderId: 'other',
      displayName: 'Ben',
      text: 'hi',
      ts: 1,
      filtered: false,
    };
    push('chat:message', message);
    push('chat:message', { ...message, messageId: 'm2', text: 'again' });
    expect(useOnlineStore.getState().chat.map((m) => m.messageId)).toEqual(['m1', 'm2']);
  });

  it('surfaces server errors from acks', async () => {
    const { transport } = fakeTransport();
    useOnlineStore.getState().attach(transport, 'me');
    await useOnlineStore.getState().send('turn:roll', { fail: true });
    expect(useOnlineStore.getState().lastError).toMatch(/not your turn/i);
  });

  it('derives banners from game:events', () => {
    const { transport, push } = fakeTransport();
    useOnlineStore.getState().attach(transport, 'me');
    push('game:events', [
      { type: 'farkled', playerId: 'other', pointsLost: 300, penaltyApplied: 0 },
    ]);
    expect(useOnlineStore.getState().lastBanner).toMatch(/farkle/i);
  });
});
