/**
 * Cloudflare Turnstile behind an interface (plan §1 Phase 6): dev/test use
 * the pass-through verifier; production sets TURNSTILE_SECRET.
 */
export interface CaptchaVerifier {
  verify(token: string | undefined, ip?: string): Promise<boolean>;
}

export const passThroughCaptcha: CaptchaVerifier = {
  verify: () => Promise.resolve(true),
};

export function createTurnstileVerifier(secret: string): CaptchaVerifier {
  return {
    async verify(token, ip) {
      if (!token) {
        return false;
      }
      const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ secret, response: token, remoteip: ip }),
      });
      if (!res.ok) {
        return false;
      }
      const body = (await res.json()) as { success: boolean };
      return body.success;
    },
  };
}

export function createCaptchaFromEnv(): CaptchaVerifier {
  const secret = process.env['TURNSTILE_SECRET'];
  return secret ? createTurnstileVerifier(secret) : passThroughCaptcha;
}
