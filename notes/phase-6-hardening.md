# Phase 6 — Production hardening & deploy (working notes)

Deliverables/acceptance: plan §1 Phase 6; decisions 7 (in-process job), 9 (5k client/backend threshold).

## Kickoff breakdown (module slices)

1. [ ] `phase-6/hardening` (server) — pluggable mailer (in-memory capture for dev/test, Resend via env in prod) + email verification + password reset flows; `@fastify/rate-limit` on auth endpoints; Turnstile verification behind an interface (mock verifier in dev/test, real endpoint with `TURNSTILE_SECRET`); backend simulation job endpoint (`POST /simulations` → in-process worker, `GET /simulations/:id`, `/results`, `/export`); Sentry server init behind `SENTRY_DSN`.
2. [ ] `phase-6/client-hardening` — verify-email + reset-password UI, signup passes a Turnstile token (auto-passes in dev via the mock), large sim runs (>5000 games, decision 9) routed to the backend job with polling, ToS/Privacy pages, Sentry browser init behind env.
3. [ ] `phase-6/deploy` — server serves the built client in production (single Railway process), Dockerfile + railway.json, deploy docs. The actual Railway project/provider keys are developer actions — flagged at handoff.

## Decisions & surprises (append as they happen)

- **External services are env-gated behind interfaces** (mailer, CAPTCHA verifier, Sentry): CI and dev run fully offline with capture/mock implementations, so the acceptance flows (verification round-trip, reset round-trip, gated signup) are e2e-testable without provider accounts — pointing the env vars at real providers changes no code.
