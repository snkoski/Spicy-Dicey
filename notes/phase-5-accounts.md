# Phase 5 — Accounts & persistence (working notes)

Deliverables/acceptance: plan §1 Phase 5; schema: plan §3; decision 6 (upgrade carry-over/backfill).

## Kickoff breakdown (module slices)

1. [ ] `phase-5/db` — Drizzle schema for users / guest_sessions / games / game_players / strategies / simulations / simulation_results (plan §3, with the three mandated indexes), SQLite (dev/test) + Postgres (prod/CI service) from one schema; DB-backed session store implementing the Phase-4 `SessionStore` interface; guest-session expiry + purge job (interval, in-process).
2. [ ] `phase-5/accounts` — signup/login/logout with bcrypt; guest→full upgrade: same live socket identity keeps the seat, finished guest games re-attributed to the new user (backfill); game persistence hook on `Room` end; stats endpoint (wins/gamesPlayed/avgScore/farkleRate) + paginated history; strategies + simulations CRUD with contracts schemas.
3. [ ] `phase-5/client-accounts` — auth forms (guest upgrade prompt), stats + history via TanStack Query, saved strategies backed by the API when signed in (localStorage remains the anonymous fallback).

## Decisions & surprises (append as they happen)

- **bcryptjs over argon2**: plan allows either; bcryptjs avoids a native build dependency in CI/Railway. Cost factor 10 for tests, 12 in prod via env.
- **Postgres testing runs in CI** (service container) — locally the suite runs on SQLite; the dialect-parity acceptance criterion is enforced by the CI matrix, not by requiring a local Postgres.
