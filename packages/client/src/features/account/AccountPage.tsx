import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { accountApi } from './api';

export function AccountPage({ active = true }: { active?: boolean }) {
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: accountApi.me });
  // Tab panels stay mounted; refresh account data whenever the tab opens.
  useEffect(() => {
    if (active) {
      void queryClient.invalidateQueries();
    }
  }, [active, queryClient]);
  if (me.isLoading) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }
  return me.data?.kind === 'user' ? (
    <ProfileView displayName={me.data.displayName} />
  ) : (
    <AuthForms />
  );
}

function AuthForms() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const done = async () => {
    setError(null);
    await queryClient.invalidateQueries();
  };
  const fail = (e: unknown) => setError(e instanceof Error ? e.message : String(e));

  const signup = useMutation({
    mutationFn: () => accountApi.signup(email, password, displayName || email.split('@')[0]!),
    onSuccess: done,
    onError: fail,
  });
  const login = useMutation({
    mutationFn: () => accountApi.login(email, password),
    onSuccess: done,
    onError: fail,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <p className="text-sm text-slate-500">
          Create an account to keep your stats, history, and saved strategies.
        </p>
      </CardHeader>
      <CardContent className="max-w-sm space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="acct-email">Email</Label>
          <Input
            id="acct-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="acct-password">Password</Label>
          <Input
            id="acct-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="acct-name">Display name</Label>
          <Input
            id="acct-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-3">
          <Button type="button" onClick={() => signup.mutate()}>
            Sign up
          </Button>
          <Button type="button" variant="secondary" onClick={() => login.mutate()}>
            Log in
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ProfileView({ displayName }: { displayName: string }) {
  const queryClient = useQueryClient();
  const stats = useQuery({ queryKey: ['stats'], queryFn: accountApi.stats });
  const games = useQuery({ queryKey: ['games'], queryFn: accountApi.games });
  const logout = useMutation({
    mutationFn: accountApi.logout,
    onSuccess: () => queryClient.invalidateQueries(),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Signed in as {displayName}</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => logout.mutate()}>
              Log out
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {stats.data && (
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-slate-500">Games played</dt>
                <dd className="text-2xl font-semibold">{stats.data.gamesPlayed}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Wins</dt>
                <dd className="text-2xl font-semibold">{stats.data.wins}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Win rate</dt>
                <dd className="text-2xl font-semibold">
                  {stats.data.gamesPlayed === 0
                    ? '—'
                    : `${((stats.data.wins / stats.data.gamesPlayed) * 100).toFixed(1)}%`}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Farkle rate</dt>
                <dd className="text-2xl font-semibold">
                  {(stats.data.farkleRate * 100).toFixed(1)}%
                </dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Game history</CardTitle>
        </CardHeader>
        <CardContent>
          {games.data?.games.length ? (
            <ul className="space-y-1 text-sm">
              {games.data.games.map((g) => (
                <li key={g.id} className="flex justify-between border-b py-1 last:border-0">
                  <span>{g.placement === 1 ? '🏆 Won' : `#${g.placement ?? '—'}`}</span>
                  <span className="tabular-nums">{g.finalScore ?? '—'}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No finished games yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
