import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { createCaptureMailer } from '../../src/email/mailer.js';

function appWithMailer() {
  const mailer = createCaptureMailer();
  const app = buildApp({ database: ':memory:', mailer });
  return { app, mailer };
}

const cookieOf = (res: { cookies: Array<{ name: string; value: string }> }) =>
  res.cookies.find((c) => c.name === 'sd_session')!.value;

describe('email verification', () => {
  it('signup sends a verification email; the token verifies the account', async () => {
    const { app, mailer } = appWithMailer();
    const signup = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: 'ann@example.com', password: 'hunter22', displayName: 'Ann' },
    });
    expect(signup.statusCode).toBe(200);

    const sent = mailer.sent.find((m) => m.to === 'ann@example.com' && m.kind === 'verify');
    expect(sent).toBeDefined();

    const verify = await app.inject({
      method: 'POST',
      url: '/auth/verify-email',
      payload: { token: sent!.token },
    });
    expect(verify.statusCode).toBe(200);

    const me = await app.inject({
      method: 'GET',
      url: '/users/me',
      cookies: { sd_session: cookieOf(signup) },
    });
    expect((me.json() as { emailVerified: boolean }).emailVerified).toBe(true);
  });

  it('rejects a bogus verification token', async () => {
    const { app } = appWithMailer();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/verify-email',
      payload: { token: 'bogus' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('password reset', () => {
  it('round-trips: request -> email token -> reset -> old password dead, new works', async () => {
    const { app, mailer } = appWithMailer();
    await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: 'ann@example.com', password: 'hunter22', displayName: 'Ann' },
    });

    const request = await app.inject({
      method: 'POST',
      url: '/auth/request-password-reset',
      payload: { email: 'ann@example.com' },
    });
    expect(request.statusCode).toBe(200);
    const sent = mailer.sent.find((m) => m.kind === 'reset');
    expect(sent).toBeDefined();

    const reset = await app.inject({
      method: 'POST',
      url: '/auth/reset-password',
      payload: { token: sent!.token, newPassword: 'brand-new-pass' },
    });
    expect(reset.statusCode).toBe(200);

    const oldLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'ann@example.com', password: 'hunter22' },
    });
    expect(oldLogin.statusCode).toBe(401);
    const newLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'ann@example.com', password: 'brand-new-pass' },
    });
    expect(newLogin.statusCode).toBe(200);
  });

  it('does not reveal whether an email exists', async () => {
    const { app, mailer } = appWithMailer();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/request-password-reset',
      payload: { email: 'nobody@example.com' },
    });
    expect(res.statusCode).toBe(200); // same answer either way
    expect(mailer.sent).toHaveLength(0);
  });

  it('reset tokens are single-use', async () => {
    const { app, mailer } = appWithMailer();
    await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: 'ann@example.com', password: 'hunter22', displayName: 'Ann' },
    });
    await app.inject({
      method: 'POST',
      url: '/auth/request-password-reset',
      payload: { email: 'ann@example.com' },
    });
    const token = mailer.sent.find((m) => m.kind === 'reset')!.token;
    await app.inject({
      method: 'POST',
      url: '/auth/reset-password',
      payload: { token, newPassword: 'first-new-pass' },
    });
    const again = await app.inject({
      method: 'POST',
      url: '/auth/reset-password',
      payload: { token, newPassword: 'second-new-pass' },
    });
    expect(again.statusCode).toBe(400);
  });
});

describe('captcha gate (Turnstile behind an interface)', () => {
  it('a failing verifier blocks signup', async () => {
    const app = buildApp({
      database: ':memory:',
      captcha: { verify: () => Promise.resolve(false) },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: {
        email: 'bot@example.com',
        password: 'hunter22',
        displayName: 'Bot',
        captchaToken: 'nope',
      },
    });
    expect(res.statusCode).toBe(403);
  });
});
