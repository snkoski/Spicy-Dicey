import type { AccountService } from '../accounts/service.js';
import type { SessionStore } from './session-store.js';

/**
 * One resolution path for both cookie kinds (decision 16): account tokens
 * first, then guest tokens. `key` is the stable identity rooms and sockets
 * use — for upgraded accounts it stays the original guestSessionId so live
 * seats survive the upgrade.
 */
export interface ResolvedIdentity {
  key: string;
  displayName: string;
  kind: 'user' | 'guest';
  userId: string | null;
  guestSessionId: string | null;
  emailVerified: boolean;
}

export interface IdentityResolver {
  resolve(token: string): Promise<ResolvedIdentity | null>;
}

export function createIdentityResolver(
  guests: SessionStore,
  accounts: AccountService,
): IdentityResolver {
  return {
    async resolve(token) {
      const account = await accounts.resolveSession(token);
      if (account) {
        return {
          key: account.guestSessionId ?? account.userId,
          displayName: account.displayName,
          kind: 'user',
          userId: account.userId,
          guestSessionId: account.guestSessionId,
          emailVerified: account.emailVerified,
        };
      }
      const guest = await guests.resolve(token);
      if (guest) {
        return {
          key: guest.guestSessionId,
          displayName: guest.displayName,
          kind: 'guest',
          userId: null,
          guestSessionId: guest.guestSessionId,
          emailVerified: false,
        };
      }
      return null;
    },
  };
}
