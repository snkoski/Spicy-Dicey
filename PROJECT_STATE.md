# PROJECT_STATE — Spicy Dicey

Orientation document for agents and LLMs joining this repo. It records what was
built, the load-bearing decisions made _during_ implementation (beyond the plan's
own decision log), and the operational knowledge that cost real debugging time to
learn. Read this after `CLAUDE.md` (how to operate) and before diving into
`spicy-dicey-project-plan.md` (the original spec).

**Status: the plan is fully implemented.** All six phases shipped, merged via
PRs #1–#19, and tagged (`phase-0-complete` … `phase-6-complete`, `v1.0.0`,
plus `phase-N/<module>` slice tags). Every phase's acceptance criteria pass in
CI. What remains is developer-side deployment (see "What still needs a human").

---

## 1. The one architectural fact that explains everything

There is exactly **one implementation of the game**, layered as pure functions
in `core-engine`, and every consumer drives the same stack:

```
scoring (scoreSelection / enumerateLegalSelections / isFarkle)
  └─ turn state machine (startTurn / applyRoll / applySelection / chooseRoll / bank)
      └─ match reducer (startMatch / matchRoll / matchSelect / matchDecide / matchForfeit)
          ├─ runGame            — strategy autopilot (simulator, tests)
          ├─ hot-seat store     — client/src/features/game/store.ts (humans, one screen)
          └─ server Room        — server/src/game/room.ts (authoritative multiplayer)
```

The match reducer was extracted in Phase 3 specifically so game flow (seat
rotation, final round, on-the-board, penalties, winner detection) would never
exist twice. When `runGame` was refactored onto it, all 210 pre-existing engine
tests — including 1000× byte-identical determinism — passed **unchanged**. If
you change match/turn semantics, that determinism suite is your tripwire.

Randomness follows the same discipline: the engine never chooses its RNG.
`createMulberry32(seed)` (sims/tests) and `createCryptoRandom()` (live games)
both implement `RandomSource`; `rollDice(rng, n)` is the only roll path. There
is no `Math.random()` anywhere, including the 3D dice animation (per-die
orientation is derived from the die index).

## 2. Package map — where things actually live

```
packages/
├─ core-engine/          # pure TS, no I/O; ~100% coverage target; its own CLAUDE.md
│  ├─ src/rng/           # RandomSource, mulberry32 (seeded), crypto (CSPRNG)
│  ├─ src/dice/          # rollDice — the only way dice happen
│  ├─ src/scoring/       # max-interpretation scoring, subset enumeration, farkle
│  ├─ src/ruleset/       # RulesetConfig (all A.1.1 toggles + base values), DEFAULT_RULESET
│  ├─ src/turn/          # pure single-turn machine; takes rolled values as INPUT
│  ├─ src/match/         # interactive multi-player reducer (the shared game flow)
│  ├─ src/strategy/      # condition→action engine, v1 selection chooser, built-ins
│  ├─ src/game/          # runGame (reducer + strategy autopilot), GameLogEvent types
│  ├─ src/simulation/    # runSimulation + analytics (moved here in Phase 6 so the
│  │                     #   browser worker and the backend job share one function)
│  └─ tools/compute-ev.ts# value-iteration DP that generated the EV-optimal tables
├─ contracts/            # Zod schemas shared client/server: strategy rules,
│                        #   ruleset wire shape, socket payloads/event names,
│                        #   chat message (moderation-ready), RoomStateSnapshot
├─ server/
│  ├─ src/app.ts         # buildApp({db|database, mailer, captcha, ...}) — DB-backed,
│  │                     #   everything external injected; routes register in app.after()
│  ├─ src/auth/          # session-store iface, identity resolver (one cookie path), captcha
│  ├─ src/accounts/      # signup/login/upgrade/stats service (bcryptjs)
│  ├─ src/db/            # dual-dialect Drizzle schemas + migrations + session store,
│  │                     #   guest purge job, game persistence
│  ├─ src/game/          # Room (authoritative), RoomManager
│  ├─ src/socket/        # thin handlers: cookie handshake → Zod validate → Room
│  ├─ src/chat/          # obscenity filter behind an interface
│  ├─ src/email/         # mailer interface: capture (dev/test) / Resend (prod)
│  ├─ src/routes/        # auth, accounts, strategies CRUD, simulations job
│  └─ src/observability/ # env-gated Sentry + error handler
└─ client/
   ├─ src/features/game/     # hot-seat (Zustand store over match reducer)
   ├─ src/features/dice/     # value→face mappings (pure, tested sans R3F), 2D pips,
   │                         #   R3F 3D dice + canvas pip textures, reduced-motion setting
   ├─ src/features/online/   # multiplayer store (transport-injectable), lobby/game/chat UI,
   │                         #   mid-game guest→account upgrade box
   ├─ src/features/simulator/# control UI, results/charts, replay; worker protocol in
   │                         #   src/workers/ (pure handler + thin .worker.ts shell)
   ├─ src/features/strategy-builder/ # dnd-kit rule lists → engine StrategyDefinition
   ├─ src/features/account/  # TanStack Query stats/history, auth forms, email-token flows
   └─ e2e/                   # Playwright: hot-seat, simulator, multiplayer multi-context
```

## 3. Decisions made during implementation (not in the plan's decision log)

These were resolved while building; each is documented in `notes/phase-N-*.md`
in more detail.

- **Config surface exceeds A.1.1.** `RulesetConfig` also carries
  `singleOneValue`, `singleFiveValue`, `threeOfAKindFaceMultiplier` because the
  engine's CLAUDE.md forbids _any_ hardcoded scoring value.
- **Max interpretation includes same-face partitions.** Four kept 1s score as
  three-1s plus a single 1 (1100), beating flat 4-of-a-kind (1000). Found while
  designing the property-test oracle; the oracle
  (`tests/scoring/properties.test.ts`) checks engine == brute-force best
  partition, not just an upper bound.
- **Three pairs is strictly three distinct face-pairs** (2/2/2). A 4-oak + pair
  is not three pairs; making it one later is a new config toggle.
- **Greedy never banks**, so the game runner/match reducer has a
  `maxTurnsPerPlayer` stalemate valve (default 1000) returning
  `finished: false, winnerId: null`.
- **EV-optimal is real math, not folklore.** `tools/compute-ev.ts` runs value
  iteration over (diceToRoll, turnScore) for the default ruleset within the v1
  action space. Derived: bank at 350/250/450/1050/3100 for 1–5 dice, never at 6;
  decline lone 5s at (r=3, s<250), (r=4, s<750), (r≥5); decline lone **1s** at
  (r=4, s<450), (r=5, s<1800). The whole policy fit the Appendix-B rule
  language, so EV-optimal is plain data like every other strategy. Regenerate
  with the tool if default scoring ever changes.
- **Socket contract consolidation.** Instead of the plan §4's separate
  `turn:rolled`/`turn:selected`/… server events, the server broadcasts the
  engine's `GameLogEvent[]` as `game:events` plus full `room:state` snapshots.
  Same information, single source of truth, no per-event schema drift. Named
  events remain for `game:started/ended`, `turn:timedOut`, presence, chat.
- **Identity model.** One httpOnly cookie (`sd_session`) for guests and
  accounts; `app.identity.resolve()` tries account sessions then guest
  sessions. The stable key rooms/sockets use is `guestSessionId` when one
  exists (so an upgraded account keeps its live seat) else `user-<id>`.
  `/auth/guest` **reuses** a valid presented cookie rather than minting a new
  identity — that is what makes reconnect-after-reload work.
- **Post-upgrade attribution at write time.** Rooms keep keying seats by guest
  id after an upgrade, so `persistFinishedGame` resolves
  `guest_sessions.upgradedUserId` when writing `game_players` — a game
  _finishing after_ the upgrade still lands on the account.
- **Turn timeout/absence = `matchForfeit`** (engine action, `turn-forfeited`
  log event): turn points lost, farkle counter untouched, seat advances.
- **Decision 9 refinement.** Runs >5000 games _attempt_ `POST /simulations`
  and silently fall back to the Web Worker for anonymous users, custom-only
  strategies, or an unavailable backend — preserving the Phase-2 "10k in the
  worker" behavior for guests while signed-in users offload.
- **Dual-dialect Drizzle strategy.** Two schema files (sqlite/pg) with a parity
  test asserting identical table/column names, plus a CI job running the DB
  suite against real Postgres 16. Repository code uses only Drizzle's `await`
  API — the sync sqlite calls (`.run()/.get()/.all()`) are forbidden because
  they don't exist on the pg driver.
- **Everything external is env-gated behind an interface** (mailer, CAPTCHA,
  Sentry): offline capture/pass-through/no-op implementations by default, real
  providers when env vars are set. CI needs no secrets.
- **Internal-packages pattern:** workspace packages export TS source directly
  (`exports: "./src/index.ts"`); Vite/Vitest/tsx compile just-in-time. There is
  no build step except the client's production `vite build`.
- **zod is pinned to ^3.25 in all three packages.** A v3/v4 split breaks
  cross-package schema composition with a confusing "expected a Zod schema"
  error at runtime.

## 4. Testing & CI topology

| Layer                  | What                                                                                                                                                                                                           | Where                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Engine unit + property | table-driven per combo/toggle; fast-check vs independent partition oracle; 1000× determinism                                                                                                                   | `core-engine/tests/**`   |
| Property-run budget    | `FC_NUM_RUNS` env knob — 2000 on PR CI, 100000 in the nightly workflow (`.github/workflows/nightly.yml`)                                                                                                       | plan §5 budget           |
| Server                 | Vitest incl. in-process Socket.io integration (real server+client sockets), fake-timer room tests (timeouts/grace), supertest-style `app.inject` for REST                                                      | `server/tests/**`        |
| DB dialect parity      | same suite on SQLite (in-memory, default) and Postgres (CI service container via `TEST_DATABASE_URL`)                                                                                                          | `server-postgres` CI job |
| Client                 | RTL with jsdom (stores, pages, builder), worker protocol as a pure function                                                                                                                                    | `client/tests/**`        |
| E2e                    | Playwright: full hot-seat games (both end-game variants), simulator 10k worker run with responsiveness probe, multi-context multiplayer (full game, sync, chat filter, spectator, reconnect, mid-game upgrade) | `client/e2e/**`          |

CI (`.github/workflows/ci.yml`): `checks` (typecheck→lint→test→format-check),
`e2e` (boots server + vite via Playwright webServer array), `server-postgres`.
All block merges. Slow-runner rule of thumb: any test doing >1000 games needs
an explicit vitest timeout — the 5s default has failed on CI three separate
times.

## 5. Operational gotchas (each cost a debugging cycle)

- `gh` CLI must run **outside** the command sandbox (macOS keychain); sandboxed
  `gh auth status` falsely reports an invalid token.
- CI runs `prettier --check .` over everything including markdown/notes. Run
  `pnpm exec prettier --write .` before pushing, always.
- Tags share names with kept branches (`phase-1/rng-dice` is both). Push tags
  as explicit refspecs: `git push origin refs/tags/<name>`.
- Playwright locally reuses running dev servers (`reuseExistingServer`). After
  changing server routes, kill stale `tsx src/main.ts` / `vite --port 5199`
  processes or e2e talks to an old API.
- All Radix tab panels are **force-mounted** (a running simulation must survive
  tab switches). Consequences: e2e selectors must scope to
  `getByRole('tabpanel', { name: ... })` (hidden duplicates exist in the DOM),
  and per-tab data refresh hooks on tab activation, not remount.
- The Vite dev proxy must list every API prefix (`/auth`, `/users`,
  `/strategies`, `/simulations`, `/socket.io`); a missing prefix returns the
  SPA's index.html with a 200 and fails _silently_ downstream.
- Turbo strict env strips `TMPDIR`; `globalPassThroughEnv: ["TMPDIR"]` in
  `turbo.json` keeps Playwright working under the local sandbox.
- Fastify: routes must register inside `app.after()` so plugin onRoute hooks
  (rate limiting) see them; registered earlier, limits silently never attach.
- pnpm 11 requires `allowBuilds` entries in `pnpm-workspace.yaml` for
  postinstall scripts (`esbuild`, `better-sqlite3`).

## 6. Running and deploying

Local dev (two processes; the client proxies to the server):

```
pnpm install
pnpm --filter @spicy-dicey/server dev      # API + sockets on :3000
pnpm --filter @spicy-dicey/client dev      # Vite on :5173
```

Full verification: `pnpm exec prettier --check . && pnpm turbo run typecheck lint test`
(e2e: `pnpm --filter @spicy-dicey/client run e2e`).

Production is one process: the server serves the built client (`main.ts` +
`@fastify/static`). `Dockerfile`, `railway.json`, and `DEPLOY.md` are ready.

### What still needs a human

1. Create the Railway project + Postgres and set env vars (`DATABASE_URL`,
   `RESEND_API_KEY`, `MAIL_FROM`, `APP_URL`, `TURNSTILE_SECRET`, `SENTRY_DSN`,
   `VITE_SENTRY_DSN`, `VITE_TURNSTILE_SITE_KEY`) — steps in `DEPLOY.md`.
   Without keys the app runs its offline dev modes by design.
2. Replace the placeholder ToS/Privacy copy
   (`client/src/features/legal/LegalPages.tsx`).

## 7. Post-v1 extension points (sequenced by the plan, not started)

- **Physics dice**: `@react-three/rapier` with a settle-snap onto the engine
  value — slot into `features/dice/` beside `Die3D`; the value→face mapping and
  accessible-overlay pattern already isolate rendering from results.
- **Full subset control for strategies** (declining triples, 3-of-4): extend
  `chooseStrategySelection` + the builder; engine enumeration already supports it.
- **Per-variant EV tables**: rerun `tools/compute-ev.ts` per ruleset config.
- **Server-side AI bots**: strategies already evaluate against generic
  turn/match state (plan decision 15); a bot is a server loop calling the same
  `chooseStrategySelection`/`evaluateBankPolicy` against a Room.
- **Scaling out**: add `@socket.io/redis-adapter` and move Room state to Redis;
  identity-keyed routing means no contract changes (see `DEPLOY.md`).
- **Turnstile widget**: the server gate exists; the client currently omits the
  token (pass-through in dev). Render the widget when `VITE_TURNSTILE_SITE_KEY`
  is set and pass `captchaToken` through signup.

## 8. Reading order for a new session

1. `CLAUDE.md` (operating rules — TDD, commit cadence, git/tag workflow)
2. This file
3. `spicy-dicey-project-plan.md` (spec + decision log §6 + scoring Appendix A)
4. `notes/phase-N-*.md` for whichever subsystem you're touching — the notes
   record why each non-obvious choice was made at the moment it was made.
