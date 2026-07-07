import { randomBytes, randomUUID } from 'node:crypto';

export interface SessionIdentity {
  /** Stable identity for sockets/rooms (plan §4 handshake auth). */
  guestSessionId: string;
  displayName: string;
}

/**
 * Stateful session store (decision 16). Async because the production
 * implementation is DB-backed; the in-memory variant remains for tests.
 */
export interface SessionStore {
  createGuest(displayName: string): Promise<{ token: string; identity: SessionIdentity }>;
  resolve(token: string): Promise<SessionIdentity | null>;
  revoke(token: string): Promise<void>;
}

export function createInMemorySessionStore(): SessionStore {
  const sessions = new Map<string, SessionIdentity>();
  return {
    createGuest(displayName) {
      const identity: SessionIdentity = { guestSessionId: `guest-${randomUUID()}`, displayName };
      const token = randomBytes(32).toString('base64url');
      sessions.set(token, identity);
      return Promise.resolve({ token, identity });
    },
    resolve(token) {
      return Promise.resolve(sessions.get(token) ?? null);
    },
    revoke(token) {
      sessions.delete(token);
      return Promise.resolve();
    },
  };
}
