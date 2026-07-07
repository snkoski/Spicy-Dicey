import type { UserStats } from './types';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

const post = (url: string, body: unknown) =>
  fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

export interface Me {
  kind: 'user' | 'guest';
  displayName: string;
  userId: string | null;
  guestSessionId: string | null;
}

export const accountApi = {
  me: async (): Promise<Me | null> => {
    const res = await fetch('/users/me', { credentials: 'include' });
    return res.ok ? ((await res.json()) as Me) : null;
  },
  signup: (email: string, password: string, displayName: string) =>
    json<{ user: unknown }>(post('/auth/signup', { email, password, displayName })).then(
      () => undefined,
    ),
  login: (email: string, password: string) =>
    json<{ user: unknown }>(post('/auth/login', { email, password })).then(() => undefined),
  logout: () => json<{ ok: boolean }>(post('/auth/logout', {})).then(() => undefined),
  upgrade: (email: string, password: string) =>
    json<{ user: unknown }>(post('/auth/upgrade', { email, password })).then(() => undefined),
  stats: () =>
    fetch('/users/me/stats', { credentials: 'include' }).then((r) => json<UserStats>(r)),
  games: () =>
    fetch('/users/me/games', { credentials: 'include' }).then((r) =>
      json<{ games: Array<{ id: string; finalScore: number | null; placement: number | null }> }>(
        r,
      ),
    ),
};
