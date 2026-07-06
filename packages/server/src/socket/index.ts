import { Server } from 'socket.io';
import {
  CLIENT_EVENTS,
  chatSendSchema,
  roomCreateSchema,
  roomJoinSchema,
  turnSelectSchema,
} from '@spicy-dicey/contracts';
import type { FastifyInstance } from 'fastify';
import { RoomManager } from '../game/room-manager.js';
import type { RoomOutbox } from '../game/room.js';
import { SESSION_COOKIE } from '../routes/auth.js';

type Ack = (response: Record<string, unknown>) => void;

declare module 'socket.io' {
  interface SocketData {
    identity: string;
    displayName: string;
  }
}

/**
 * Thin socket layer (plan §2): authenticate once in the handshake from the
 * httpOnly session cookie (decision 16), validate every payload with the
 * shared Zod schemas, authorize against the stable identity, delegate to
 * the Room — no rules logic here.
 */
export function attachSockets(app: FastifyInstance, rooms = new RoomManager()): Server {
  const io = new Server(app.server, { cors: { origin: true, credentials: true } });

  io.use((socket, next) => {
    const token = parseCookie(socket.handshake.headers.cookie)[SESSION_COOKIE];
    const identity = token ? app.sessions.resolve(token) : null;
    if (!identity) {
      next(new Error('authentication required'));
      return;
    }
    socket.data.identity = identity.guestSessionId;
    socket.data.displayName = identity.displayName;
    next();
  });

  const outboxFor = (roomCode: string): RoomOutbox => ({
    broadcast: (event, payload) => void io.to(`room:${roomCode}`).emit(event, payload),
    toIdentity: (identity, event, payload) => void io.to(`id:${identity}`).emit(event, payload),
  });

  io.on('connection', (socket) => {
    const identity = socket.data.identity;
    void socket.join(`id:${identity}`);

    // Reconnection: the same cookie re-presents the same identity — if a
    // room still holds this seat, re-attach and replay the state.
    const held = rooms.roomOf(identity);
    if (held) {
      void socket.join(`room:${held.code}`);
      guard(() => {
        held.onReconnect(identity);
        held.sendStateTo(identity);
      });
    }

    const on = <T>(
      event: string,
      schema: { parse(input: unknown): T } | null,
      handler: (input: T) => void,
    ) => {
      socket.on(event, (payload: unknown, ack?: Ack) => {
        try {
          const input = schema ? schema.parse(payload) : (undefined as T);
          handler(input);
          ack?.({ ok: true });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (ack) {
            ack({ error: message });
          } else {
            socket.emit('error', { code: 'bad-request', message });
          }
        }
      });
    };

    socket.on(CLIENT_EVENTS.roomCreate, (payload: unknown, ack?: Ack) => {
      try {
        const input = roomCreateSchema.parse(payload);
        const room = rooms.create(identity, input, outboxFor);
        void socket.join(`room:${room.code}`);
        room.join(identity, input.displayName, false);
        rooms.track(identity, room.code);
        ack?.({ roomCode: room.code });
      } catch (error) {
        ack?.({ error: error instanceof Error ? error.message : String(error) });
      }
    });

    on(CLIENT_EVENTS.roomJoin, roomJoinSchema, (input) => {
      const room = rooms.get(input.roomCode);
      if (!room) {
        throw new Error('room not found');
      }
      void socket.join(`room:${room.code}`);
      room.join(identity, input.displayName, input.asSpectator);
      rooms.track(identity, room.code);
      room.sendStateTo(identity);
    });

    on(CLIENT_EVENTS.roomLeave, null, () => {
      const room = rooms.roomOf(identity);
      if (room) {
        room.leave(identity);
        rooms.untrack(identity);
        void socket.leave(`room:${room.code}`);
      }
    });

    on(CLIENT_EVENTS.gameStart, null, () => requireRoom().start(identity));

    on(CLIENT_EVENTS.turnRoll, null, () => {
      const room = requireRoom();
      if (room.currentPhase() === 'awaiting-decision') {
        room.rollAgain(identity);
      } else {
        room.roll(identity);
      }
    });

    on(CLIENT_EVENTS.turnSelect, turnSelectSchema, (input) =>
      requireRoom().select(identity, input.diceIndices),
    );

    on(CLIENT_EVENTS.turnBank, null, () => requireRoom().bank(identity));

    on(CLIENT_EVENTS.chatSend, chatSendSchema, (input) => requireRoom().chat(identity, input.text));

    socket.on('disconnect', () => {
      // Only treat it as a real absence when no other socket for this
      // identity remains (multi-tab safety).
      const remaining = io.sockets.adapter.rooms.get(`id:${identity}`)?.size ?? 0;
      if (remaining === 0) {
        rooms.roomOf(identity)?.onDisconnect(identity);
      }
    });

    function requireRoom() {
      const room = rooms.roomOf(identity);
      if (!room) {
        throw new Error('not in a room');
      }
      return room;
    }

    function guard(fn: () => void) {
      try {
        fn();
      } catch {
        // reconnect race: seat already released
      }
    }
  });

  return io;
}

function parseCookie(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header?.split(';') ?? []) {
    const eq = part.indexOf('=');
    if (eq > 0) {
      out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return out;
}
