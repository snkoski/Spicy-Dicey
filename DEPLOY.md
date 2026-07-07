# Deploying Spicy Dicey (Railway)

One long-running Node process (Fastify + Socket.io) serves the API, the
sockets, and the built client. Serverless platforms are not viable —
Socket.io needs a persistent process (plan §1 Phase 6).

## Steps

1. Create a Railway project and connect this GitHub repo. `railway.json`
   points at the `Dockerfile`; git-push deploys from `main`.
2. Add a **PostgreSQL** service and expose its URL to the app service as
   `DATABASE_URL` (`${{Postgres.DATABASE_URL}}`). Migrations run on boot.
3. Environment variables on the app service:
   - `DATABASE_URL` — Postgres connection string (required in prod)
   - `RESEND_API_KEY`, `MAIL_FROM`, `APP_URL` — transactional email
     (without a key the capture mailer is used: fine for staging, no real mail)
   - `TURNSTILE_SECRET` — Cloudflare Turnstile secret (without it the
     CAPTCHA gate passes everything: dev behavior)
   - `SENTRY_DSN` — server error tracking (optional)
   - `VITE_SENTRY_DSN`, `VITE_TURNSTILE_SITE_KEY` — client equivalents,
     set at build time
4. Client and API are same-origin in this setup, so the `sd_session`
   cookie needs no cross-site configuration (plan §6 decision 16).

## Scaling note

Room state lives in-process (plan §6 decision 7). One instance is the
supported launch topology; when scaling out, add
`@socket.io/redis-adapter` and move live room state to Redis — request
handling is already stateless and identity-keyed, so no contract changes.
