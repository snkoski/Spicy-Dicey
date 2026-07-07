/**
 * Transactional email behind an interface (plan §1 Phase 6): dev/test use
 * the capture mailer (tokens are observable, everything runs offline);
 * production points RESEND_API_KEY at the real provider — no code change.
 */
export interface MailMessage {
  to: string;
  kind: 'verify' | 'reset';
  token: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

export interface CaptureMailer extends Mailer {
  sent: MailMessage[];
}

export function createCaptureMailer(): CaptureMailer {
  const sent: MailMessage[] = [];
  return {
    sent,
    send(message) {
      sent.push(message);
      return Promise.resolve();
    },
  };
}

const SUBJECTS: Record<MailMessage['kind'], string> = {
  verify: 'Verify your Spicy Dicey email',
  reset: 'Reset your Spicy Dicey password',
};

/** Resend-backed mailer for production (sandbox/test mode works too). */
export function createResendMailer(apiKey: string, from: string, appUrl: string): Mailer {
  return {
    async send(message) {
      const path = message.kind === 'verify' ? 'verify-email' : 'reset-password';
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          from,
          to: message.to,
          subject: SUBJECTS[message.kind],
          text: `Open ${appUrl}/#/${path}?token=${message.token} to continue. If you didn't request this, ignore this email.`,
        }),
      });
      if (!res.ok) {
        throw new Error(`mailer failed (${res.status})`);
      }
    },
  };
}

export function createMailerFromEnv(): Mailer {
  const apiKey = process.env['RESEND_API_KEY'];
  if (apiKey) {
    return createResendMailer(
      apiKey,
      process.env['MAIL_FROM'] ?? 'Spicy Dicey <noreply@spicy-dicey.app>',
      process.env['APP_URL'] ?? 'http://localhost:5173',
    );
  }
  return createCaptureMailer();
}
