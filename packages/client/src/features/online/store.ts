import { create } from 'zustand';
import type {
  ChatMessage,
  RoomCreateInput,
  RoomJoinInput,
  RoomStateSnapshot,
} from '@spicy-dicey/contracts';
import type { GameLogEvent } from '@spicy-dicey/core-engine';

/** Anything that can reach the server — the socket in production, a
 * scripted fake in tests. */
export interface OnlineTransport {
  emitWithAck(event: string, payload?: unknown): Promise<Record<string, unknown>>;
  on<T>(event: string, handler: (payload: T) => void): void;
  disconnect(): void;
}

interface OnlineState {
  transport: OnlineTransport | null;
  selfId: string | null;
  roomCode: string | null;
  room: RoomStateSnapshot | null;
  chat: ChatMessage[];
  lastBanner: string | null;
  lastError: string | null;
  selectedIndices: number[];

  attach(transport: OnlineTransport, selfId: string): void;
  createRoom(input: RoomCreateInput): Promise<void>;
  joinRoom(input: RoomJoinInput): Promise<void>;
  send(event: string, payload?: unknown): Promise<void>;
  toggleDie(index: number): void;
  clearSelection(): void;
  reset(): void;
}

export const useOnlineStore = create<OnlineState>((set, get) => ({
  transport: null,
  selfId: null,
  roomCode: null,
  room: null,
  chat: [],
  lastBanner: null,
  lastError: null,
  selectedIndices: [],

  attach(transport, selfId) {
    set({ transport, selfId });
    transport.on('room:state', (room: RoomStateSnapshot) =>
      set({ room, selectedIndices: [], lastError: null }),
    );
    transport.on('chat:message', (message: ChatMessage) =>
      set((s) => ({ chat: [...s.chat, message] })),
    );
    transport.on('game:events', (events: GameLogEvent[]) => {
      const nameOf = (id: string) =>
        get().room?.members.find((m) => m.playerId === id)?.displayName ?? id;
      const banner = bannerFor(events, nameOf);
      if (banner) {
        set({ lastBanner: banner });
      }
    });
    transport.on('error', (payload: { message?: string }) =>
      set({ lastError: payload.message ?? 'server error' }),
    );
  },

  async createRoom(input) {
    const ack = await get().transport!.emitWithAck('room:create', input);
    if (typeof ack.roomCode === 'string') {
      set({ roomCode: ack.roomCode, lastError: null });
    } else {
      set({ lastError: String(ack.error ?? 'could not create the room') });
    }
  },

  async joinRoom(input) {
    const ack = await get().transport!.emitWithAck('room:join', input);
    if (ack.error) {
      set({ lastError: String(ack.error) });
    } else {
      set({ roomCode: input.roomCode, lastError: null });
    }
  },

  async send(event, payload) {
    const ack = await get().transport!.emitWithAck(event, payload);
    if (ack.error) {
      set({ lastError: String(ack.error) });
    }
  },

  toggleDie(index) {
    set((s) => ({
      selectedIndices: s.selectedIndices.includes(index)
        ? s.selectedIndices.filter((i) => i !== index)
        : [...s.selectedIndices, index],
    }));
  },

  clearSelection() {
    set({ selectedIndices: [] });
  },

  reset() {
    get().transport?.disconnect();
    set({
      transport: null,
      selfId: null,
      roomCode: null,
      room: null,
      chat: [],
      lastBanner: null,
      lastError: null,
      selectedIndices: [],
    });
  },
}));

function bannerFor(events: GameLogEvent[], nameOf: (id: string) => string): string | null {
  for (const event of [...events].reverse()) {
    switch (event.type) {
      case 'game-ended':
        return `Game over — ${event.winnerId ? nameOf(event.winnerId) : 'nobody'} wins!`;
      case 'final-round-triggered':
        return `${nameOf(event.playerId)} triggered the final round!`;
      case 'farkled':
        return `Farkle! ${nameOf(event.playerId)} loses ${event.pointsLost}.`;
      case 'turn-forfeited':
        return `${nameOf(event.playerId)} ran out of time.`;
      default:
        break;
    }
    if (event.type === 'selected' && event.hotDice) {
      return `Hot dice! ${nameOf(event.playerId)} rolls all six again.`;
    }
  }
  return null;
}
