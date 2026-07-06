# Phase 4 — Real-time multiplayer + chat (working notes)

Deliverables/acceptance: plan §1 Phase 4; contracts: plan §4; decisions 4, 5, 7, 10, 12, 14, 16.

## Kickoff breakdown (module slices)

1. [ ] `phase-4/contracts-socket` — Zod schemas + event names for every client→server and server→client socket payload (plan §4), the moderation-ready chat message shape, room config, and the guest-auth REST bits Phase 4 needs.
2. [ ] `phase-4/server-core` — Fastify + Socket.io wiring; minimal guest identity (`POST /auth/guest`, httpOnly cookie, stateful in-memory session store — decision 16; full accounts arrive in Phase 5 on the same path); room manager (create/join/leave/start, host, 2–8, spectators, room codes); server-authoritative game loop over the shared match reducer with `createCryptoRandom` (decision 14); turn timer (decision 4: 60s default, 30/60/90/off) with auto-pass; disconnect grace (decision 5: 90s hold, auto-pass while absent, host removal); chat with `obscenity` filter behind a pluggable service (decision 12). Zod validation on every payload.
3. [ ] `phase-4/client-multiplayer` — lobby (create/join with code, spectator option), online game screen reusing the dice/board components, live scores, chat panel, timer display, reconnect handling.
4. [ ] `phase-4/e2e` — multi-browser-context Playwright: full game over real sockets; forged-payload rejection; timeout auto-pass; reconnect within grace; spectator view.

## Decisions & surprises (append as they happen)

- **Guest identity ships in Phase 4** (minimal `/auth/guest` + cookie sessions) because handshake auth (decision 16) is a Phase 4 deliverable; Phase 5 swaps the in-memory session store for the DB-backed one without touching the socket contract.
- **Authoritative state lives in a per-room `MatchState`** (in-memory on the single instance — decision 7), advanced only by the same engine reducer the hot-seat UI uses. Socket handlers stay thin: validate with Zod → authorize identity/turn → call the room service → broadcast.
