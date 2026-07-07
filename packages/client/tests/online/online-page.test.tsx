import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_RULESET } from '@spicy-dicey/core-engine';
import type { RoomStateSnapshot } from '@spicy-dicey/contracts';
import { OnlinePage } from '../../src/features/online/OnlinePage';
import { useOnlineStore, type OnlineTransport } from '../../src/features/online/store';

function fakeConnection() {
  const listeners = new Map<string, (payload: unknown) => void>();
  const emitted: Array<{ event: string; payload: unknown }> = [];
  const transport: OnlineTransport = {
    emitWithAck: (event, payload) => {
      emitted.push({ event, payload });
      return Promise.resolve(event === 'room:create' ? { roomCode: 'XYZ789' } : { ok: true });
    },
    on: (event, handler) => void listeners.set(event, handler as (payload: unknown) => void),
    disconnect: () => {},
  };
  return {
    emitted,
    push: (event: string, payload: unknown) => listeners.get(event)?.(payload),
    connect: () => Promise.resolve({ transport, selfId: 'me' }),
  };
}

const activeSnapshot = (): RoomStateSnapshot => ({
  code: 'XYZ789',
  status: 'active',
  hostId: 'me',
  maxPlayers: 4,
  turnTimerSec: 60,
  spectatorChatEnabled: true,
  ruleset: DEFAULT_RULESET,
  members: [
    { playerId: 'me', displayName: 'Ann', role: 'player', connected: true },
    { playerId: 'ben', displayName: 'Ben', role: 'player', connected: true },
  ],
  turnDeadline: null,
  match: {
    status: 'active',
    winnerId: null,
    currentPlayerId: 'me',
    players: [
      { id: 'me', total: 150, onTheBoard: true, farkles: 0 },
      { id: 'ben', total: 0, onTheBoard: false, farkles: 1 },
    ],
    turn: {
      phase: 'awaiting-selection',
      roll: [1, 5, 2, 3, 4, 6],
      diceToRoll: 6,
      turnScore: 0,
      hotDiceStreak: 0,
    },
  },
});

describe('OnlinePage', () => {
  beforeEach(() => useOnlineStore.getState().reset());

  it('creates a room from the lobby form and shows the code', async () => {
    const fake = fakeConnection();
    render(<OnlinePage connect={fake.connect} />);
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Ann' } });
    fireEvent.click(screen.getByRole('button', { name: /create room/i }));
    await waitFor(() => expect(screen.getByText(/XYZ789/)).toBeDefined());
    expect(fake.emitted.some((e) => e.event === 'room:create')).toBe(true);
  });

  it('joining sends the room code and spectator flag', async () => {
    const fake = fakeConnection();
    render(<OnlinePage connect={fake.connect} />);
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Ben' } });
    fireEvent.change(screen.getByLabelText(/room code/i), { target: { value: 'xyz789' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /join as spectator/i }));
    fireEvent.click(screen.getByRole('button', { name: /join room/i }));
    await waitFor(() =>
      expect(fake.emitted.find((e) => e.event === 'room:join')?.payload).toMatchObject({
        roomCode: 'XYZ789',
        asSpectator: true,
      }),
    );
  });

  it('renders the active game from the snapshot and sends selected indices', async () => {
    const fake = fakeConnection();
    render(<OnlinePage connect={fake.connect} />);
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Ann' } });
    fireEvent.click(screen.getByRole('button', { name: /create room/i }));
    await waitFor(() => screen.getByText(/XYZ789/));

    fake.push('room:state', activeSnapshot());
    await waitFor(() => screen.getAllByRole('button', { name: /die showing/i }));

    // tap the 1 (index 0) and the 5 (index 1), then keep
    const dice = screen.getAllByRole('button', { name: /die showing/i });
    fireEvent.click(dice[0]!);
    fireEvent.click(dice[1]!);
    fireEvent.click(screen.getByRole('button', { name: /keep selection/i }));

    await waitFor(() =>
      expect(fake.emitted.find((e) => e.event === 'turn:select')?.payload).toEqual({
        diceIndices: [0, 1],
      }),
    );
  });

  it('sends chat and renders incoming messages', async () => {
    const fake = fakeConnection();
    render(<OnlinePage connect={fake.connect} />);
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Ann' } });
    fireEvent.click(screen.getByRole('button', { name: /create room/i }));
    await waitFor(() => screen.getByText(/XYZ789/));

    fake.push('chat:message', {
      messageId: 'm1',
      senderId: 'ben',
      displayName: 'Ben',
      text: 'hello there',
      ts: 1,
      filtered: false,
    });
    await waitFor(() => expect(screen.getByText(/hello there/)).toBeDefined());

    fireEvent.change(screen.getByLabelText(/chat message/i), { target: { value: 'hi Ben' } });
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }));
    await waitFor(() =>
      expect(fake.emitted.find((e) => e.event === 'chat:send')?.payload).toEqual({
        text: 'hi Ben',
      }),
    );
  });
});
