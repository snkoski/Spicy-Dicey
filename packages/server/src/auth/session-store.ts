import { randomBytes, randomUUID } from 'node:crypto';

export interface SessionIdentity {
  /** Stable identity for sockets/rooms (plan §4 handshake auth). */
  guestSessionId: string;
  displayName: string;
}

/**
 * Stateful session store (decision 16). In-memory for Phase 4; Phase 5
 * swaps in the DB-backed implementation behind this same interface.
 */
export interface SessionStore {
  createGuest(displayName: string): { token: string; identity: SessionIdentity };
  resolve(token: string): SessionIdentity | null;
  revoke(token: string): void;
}

export function createInMemorySessionStore(): SessionStore {
  const sessions = new Map<string, SessionIdentity>();
  return {
    createGuest(displayName) {
      const identity: SessionIdentity = { guestSessionId: `guest-${randomUUID()}`, displayName };
      const token = randomBytes(32).toString('base64url');
      sessions.set(token, identity);
      return { token, identity };
    },
    resolve(token) {
      return sessions.get(token) ?? null;
    },
    revoke(token) {
      sessions.delete(token);
    },
  };
}
