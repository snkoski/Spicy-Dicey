import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountPage } from '../../src/features/account/AccountPage';

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AccountPage />
    </QueryClientProvider>,
  );
}

type FetchArgs = [input: RequestInfo | URL, init?: RequestInit];

function stubFetch(routes: Record<string, (init?: RequestInit) => unknown>) {
  const calls: FetchArgs[] = [];
  vi.stubGlobal('fetch', (...args: FetchArgs) => {
    calls.push(args);
    const url = String(args[0]);
    const handler = Object.entries(routes).find(([key]) => url.endsWith(key))?.[1];
    if (!handler) {
      return Promise.resolve(new Response(JSON.stringify({ error: 'nope' }), { status: 404 }));
    }
    const body = handler(args[1]);
    if (body instanceof Response) {
      return Promise.resolve(body);
    }
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('AccountPage', () => {
  it('offers signup and login when not signed in', async () => {
    stubFetch({ '/users/me': () => new Response('', { status: 401 }) });
    renderPage();
    await waitFor(() => screen.getByRole('button', { name: /^sign up$/i }));
    expect(screen.getByRole('button', { name: /^log in$/i })).toBeDefined();
  });

  it('shows stats and history for a signed-in user', async () => {
    stubFetch({
      '/users/me': () => ({ kind: 'user', displayName: 'Ann', userId: 'u1', guestSessionId: null }),
      '/users/me/stats': () => ({ gamesPlayed: 4, wins: 3, avgScore: 9500, farkleRate: 0.12 }),
      '/users/me/games': () => ({
        games: [{ id: 'gp1', finalScore: 10_000, placement: 1 }],
        nextCursor: null,
      }),
    });
    renderPage();
    await waitFor(() => screen.getByText(/signed in as ann/i));
    await waitFor(() => expect(screen.getByText('4')).toBeDefined()); // games played
    expect(screen.getByText('75.0%')).toBeDefined(); // win rate
    await waitFor(() => expect(screen.getByText(/10000/)).toBeDefined()); // history score
  });

  it('signs up through the form', async () => {
    const calls = stubFetch({
      '/users/me': () => new Response('', { status: 401 }),
      '/auth/signup': () => ({ user: { id: 'u1' } }),
    });
    renderPage();
    await waitFor(() => screen.getByLabelText(/^email$/i));
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'ann@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'hunter22' } });
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Ann' } });
    fireEvent.click(screen.getByRole('button', { name: /^sign up$/i }));
    await waitFor(() =>
      expect(calls.some(([url]) => String(url).endsWith('/auth/signup'))).toBe(true),
    );
  });
});
