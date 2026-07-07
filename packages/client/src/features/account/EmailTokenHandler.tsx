import { useEffect, useState } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

/**
 * Handles the links from transactional emails:
 *   /#/verify-email?token=...   and   /#/reset-password?token=...
 */
export function EmailTokenHandler() {
  const [mode, setMode] = useState<'verify' | 'reset' | null>(null);
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash;
    const match = /^#\/(verify-email|reset-password)\?token=([^&]+)/.exec(hash);
    if (!match) {
      return;
    }
    setToken(decodeURIComponent(match[2]!));
    if (match[1] === 'verify-email') {
      setMode('verify');
      void fetch('/auth/verify-email', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: decodeURIComponent(match[2]!) }),
      }).then((res) =>
        setMessage(
          res.ok ? 'Email verified — you are all set!' : 'This link is invalid or expired.',
        ),
      );
    } else {
      setMode('reset');
    }
  }, []);

  if (mode === null) {
    return null;
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        {mode === 'verify' && <p className="text-sm">{message ?? 'Verifying…'}</p>}
        {mode === 'reset' && message === null && (
          <div className="flex max-w-md items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="reset-new-password">New password</Label>
              <Input
                id="reset-new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button
              type="button"
              onClick={() => {
                void fetch('/auth/reset-password', {
                  method: 'POST',
                  credentials: 'include',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ token, newPassword: password }),
                }).then((res) =>
                  setMessage(
                    res.ok
                      ? 'Password updated — log in with your new password.'
                      : 'This link is invalid or expired.',
                  ),
                );
              }}
            >
              Set password
            </Button>
          </div>
        )}
        {mode === 'reset' && message && <p className="text-sm">{message}</p>}
      </CardContent>
    </Card>
  );
}
