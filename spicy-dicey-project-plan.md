# Spicy-Dicey a Farkle / Hot Dice Platform — Build Plan

*Derived from the planning prompt. Requirements are treated as settled; anything genuinely underspecified is surfaced in §6 rather than guessed at.*

This plan covers the six requested outputs: (1) a phased roadmap with acceptance criteria, (2) repo/package structure, (3) database schema sketch, (4) API + Socket.io contracts, (5) a per-phase test strategy, and (6) open questions/risks.

The single load-bearing decision that shapes everything else: **the `core-engine` package is the sole source of truth for dice, scoring, and strategy evaluation, and it is consumed identically by the simulator and the live server.** Build it first, test it hardest, and never let a second copy of the rules exist anywhere in the codebase.

---

## 1. Phased Build Roadmap

Phases are strictly ordered — each one is only "done" when its acceptance criteria pass in CI. The sequence deliberately front-loads the pure logic (no UI, no network) so that by the time you're wiring sockets, the rules themselves are already trustworthy.

### Phase 0 — Monorepo scaffolding & CI (foundation)

**Goal:** A green, empty pipeline before any feature code exists.

**Deliverables**
- pnpm workspace + Turborepo with `core-engine`, `contracts`, `server`, `client` packages (see §2).
- Shared `tsconfig.base.json`, ESLint (flat config), Prettier, `strict: true` TS everywhere.
- Vitest wired per package; Playwright installed but with a single trivial passing spec.
- GitHub Actions CI: `typecheck → lint → test → coverage` on every PR, blocking merge.
- Coverage reporting turned on (threshold set low initially, raised as phases land — see §6 Q11).

**Acceptance criteria**
- `pnpm install && pnpm turbo run typecheck lint test` passes locally and in CI.
- A deliberately failing test fails CI (verify the gate actually gates).
- A commit that breaks types blocks the PR.

---

### Phase 1 — `core-engine` (pure logic, fully TDD, no UI, no network)

This is the heart of the product. Every rule, variant, and strategy behavior lives here. **Write the failing test first for every unit.**

**Deliverables**
- **Injectable RNG** — a seedable PRNG (e.g. mulberry32/xorshift) for tests and the simulator (same seed ⇒ identical dice sequence forever); the live server injects a CSPRNG instead (see §6 decision 14). No `Math.random()` anywhere in the engine, and the engine never chooses the RNG source — it is always injected.
- **Dice module** — roll N dice from the injected RNG.
- **Scoring module** — given a roll, enumerate **all legal set-aside subsets** (including partial combos, e.g. keeping three of four matching dice and re-rolling the fourth), and score any chosen subset at its **maximum interpretation**. A subset is legal only if every kept die contributes to a scoring combo and at least one scoring die is kept. Must handle every combo in the default ruleset: singles (1/5), three-of-a-kind (incl. three 1s), four/five/six-of-a-kind, straight, three pairs, two triplets, and correct Farkle / hot-dice detection.
- **Ruleset config** — a typed config object exposing every A.1.1 toggle (**Appendix A.1.1**, defaults included) (three-1s value, N-of-a-kind scaling flat-vs-doubling, straight value, three-pairs value, two-triplets on/off + value, on-the-board min on/off + threshold, target score, end-game behavior, Farkle-penalty variant). Scoring reads from this config; there are no hardcoded magic numbers.
- **Turn state machine** — models a single turn: roll → **player/strategy chooses which scoring dice to set aside (may decline scoring dice, e.g. keep the 1 and re-roll a lone 5)** → (roll again | bank) → Farkle/hot-dice transitions, "on the board" gating, running turn score.
- **Strategy rule engine** — a strategy is **two** ordered `condition → action` rule lists, each evaluated top-to-bottom, first match wins:
  - **Keep policy** — decides which *discretionary* scoring dice to set aside (primarily lone 1s and 5s; a lone 5 is often declined to preserve dice for re-rolling). Conditions can reference the candidate die value, current turn score, and the dice-remaining that keeping-vs-skipping would produce. Default: keep everything (greedy).
  - **Bank policy** — decides `bank` vs `roll` on the *post-selection* state. Conditions: turn-score thresholds, dice-remaining thresholds, AND/OR combinations, score-differential-vs-opponents, and a bounded "streak" counter (consecutive hot-dice this turn).
  Full non-single subset control (declining a triple, keeping 3-of-4) is available to human players; **v1 strategies decide only lone 1s/5s and always take complete combos** — full subset control for strategies is a post-v1 extension.
- **Built-in reference strategies** — at minimum "always bank at 300" (keep all, bank at ≥300), "greedy" (keep all, roll until forced to stop), "value-aware" (declines lone 5s when ≥2 dice would remain — demonstrates the keep policy), and "EV-optimal" (which must weigh the keep decision too — see §6 Q1 for the EV caveat).
- **Single-game runner** — plays one full game between K strategies under a given ruleset + seed, returning a structured, replayable game log.

**Acceptance criteria**
- Table-driven tests cover every scoring combo and every A.1.1 variant toggle, with expected point values from the default scoring table (**Appendix A.1**).
- **Property test (`fast-check`):** across ≥100k random rolls, a scored selection never exceeds the theoretical maximum for that multiset, and never scores non-scoring dice.
- **Property test:** re-scoring the same selection is idempotent; disjoint valid selections' scores sum correctly.
- Determinism test: identical `(seed, ruleset, strategies)` ⇒ byte-identical game log, run 1000× .
- Strategy engine: given a hand-authored ruleset, each built-in strategy produces the documented bank/roll decision at a set of known decision points.
- The single-game runner produces a log detailed enough to drive step-through replay (Phase 2 depends on this shape).
- Coverage on `core-engine` is the highest in the repo (target ~100% of scoring/strategy logic).

---

### Phase 2 — Strategy Simulator (UI + Web Worker + analytics)

First consumer of `core-engine`. No server required yet — sims run client-side.

**Deliverables**
- **Simulation control UI:** pick 2+ strategies (built-in or custom), set game count, choose ruleset variant, choose head-to-head vs round-robin.
- **Custom strategy builder:** two draggable ordered rule lists — a **keep policy** (which discretionary dice to set aside) and a **bank policy** (bank vs roll) — with first-match-wins and AND/OR condition composition, all condition types from the strategy catalog (**Appendix B**), built with shadcn/ui form components for accessibility.
- **Web Worker execution:** batches run off the main thread; UI stays responsive with progress feedback. Same seeded RNG ⇒ reproducible runs.
- **Analytics + charts (Recharts):** per-strategy win rate, avg final score, avg turns/game, avg Farkles/game, score distribution.
- **Export:** results to CSV and JSON.
- **Step-through replay:** walk one simulated game roll-by-roll using the Phase-1 game log.

**Acceptance criteria**
- Selecting 3 strategies × 10k games completes without freezing the UI (worker offload verified).
- Same seed + same config ⇒ identical results table and identical charts.
- A custom strategy built entirely in the UI serializes to the same rule format the engine consumes, round-trips through save/load, and runs.
- Round-robin produces a complete NxN result matrix; head-to-head produces the pairwise result.
- CSV and JSON exports re-import to the same numbers.
- Replay steps forward/back and matches the engine's authoritative log exactly.

---

### Phase 3 — Local / hot-seat game (single machine, no network)

Proves the full game *loop and UI* — including dice rendering — before adding the complexity of sockets. Multiple players share one screen/device.

**Deliverables**
- Full interactive game UI driving the Phase-1 turn state machine: roll, set aside dice, bank, Farkle handling, hot-dice re-roll, on-the-board gating, end-game (instant-win vs final-round variant), win detection.
- **Dice rendering:**
  - **2D fallback first** — simplest correct rendering; wire it to `prefers-reduced-motion` and expose a manual toggle. This unblocks the game loop immediately.
  - **3D dice (React Three Fiber + drei):** procedural rounded-box geometry with canvas-drawn pip textures (no external assets). Default animation = **procedural rotation-keyframe "tumble"** that lands precisely on the engine-provided face values. The animation is a *visual layer only* — it never determines the result.
- Live per-player running score display.

**Acceptance criteria**
- A complete hot-seat game between 2–8 seats plays start-to-finish and declares the correct winner under both end-game variants.
- Every on-screen die face always equals the engine value; the 3D layer cannot alter a result (asserted by testing the value→face mapping independently of R3F).
- `prefers-reduced-motion` auto-selects 2D; the manual toggle switches modes without breaking a turn in progress.
- Farkle, hot-dice, and on-the-board edge cases behave per the active ruleset.

**Sequenced as a stretch goal (not a v1 blocker):** a true physics engine (`@react-three/rapier`) with a corrective "settle snap" onto the authoritative face. Meaningfully more effort for a subtle visual gain — do it only after everything else ships.

---

### Phase 4 — Real-time multiplayer + chat (server = authoritative)

Introduce the network. The server runs `core-engine` as the **only** source of truth; clients render what they're told.

**Deliverables**
- Fastify (Express is an acceptable, low-risk swap) + Socket.io server with room support.
- Private room codes; 2–8 players configurable per room; host configures the ruleset before start.
- Server-authoritative turns: **all** rolls, set-asides, banks, Farkle/hot-dice, and turn transitions are computed server-side and broadcast to the room. Clients cannot submit dice values.
- Live running scores broadcast to everyone.
- Configurable turn timer; on timeout, auto-pass.
- Disconnect handling: hold the seat for a grace period, resume turn state on reconnect; auto-pass while absent; host can remove.
- Spectator mode (join as non-playing observer).
- Real-time room-scoped chat with a basic automated profanity filter. **No** persistence/report/mute/block in v1 — but the message schema and socket contract are shaped so moderation slots in later without a rewrite (message IDs, sender IDs, timestamps, a `filtered` flag — never a hardcoded "no moderation" assumption).
- Zod validation on every socket payload and REST body, with schemas shared from `contracts` (§2).

**Acceptance criteria**
- Two+ real browser contexts play a full game over a live socket; all clients stay in sync on scores and turn state.
- A client that fabricates a dice value or plays out of turn is rejected server-side; the tampered value never appears for anyone.
- Turn timeout auto-passes correctly and broadcasts the transition.
- Kill a client mid-turn: seat is held, state resumes on reconnect within the grace window, and auto-passes after it.
- Spectators receive full game state and cannot act.
- Profanity filter catches the configured word list; chat messages carry IDs/timestamps ready for future moderation.
- Request handling is stateless enough that a Redis Socket.io adapter *could* be added later (verified by not stashing game state in per-process globals that assume a single instance — see §6 Q7 caveat on where authoritative live state does live).

---

### Phase 5 — Accounts & persistence

**Deliverables**
- Guest login: instant temporary identity, no stats persisted beyond the session.
- Full accounts (email + password, argon2/bcrypt hashing).
- **Guest → full upgrade path** that carries over the in-progress game **and backfills this session's finished games into the new account's stats** (guest games are recorded against `guest_session_id`; on upgrade they're re-attributed to the new `user_id`; sessions that never upgrade are purged at expiry).
- Persistent historical stats: wins, average score, games played, Farkle rate, etc.
- Drizzle ORM schema (§3) targeting SQLite in dev/test and Postgres in prod.
- **Scheduled guest-session cleanup:** an in-process interval job purges expired, non-upgraded guest sessions and their orphaned `game_players` rows. This job is what actually enforces "no stats beyond the session" for non-upgraders (§6 decision 6) — without it the design is unenforced.
- Saved custom strategies and saved simulations tied to accounts.
- History and saved-strategy fetching via TanStack Query.

**Acceptance criteria**
- A non-upgrading guest's games are recorded against the session but excluded from every user's stats, and are purged when the session expires.
- Signup → email/password login → stats accumulate across games and match a recomputed-from-games ground truth.
- Upgrading mid-game preserves the live game, attributes the result to the new account, and backfills the session's already-finished games into the new account's stats.
- Drizzle migrations apply cleanly on both SQLite and Postgres with no per-dialect hand-editing of app code.
- Stats aggregation is correct under a property/fixture test (e.g. Farkle rate = Farkles / turns).

---

### Phase 6 — Production hardening & deploy

**Deliverables**
- Auth hardening: email verification + password reset via a transactional provider (Resend/Postmark), rate limiting on auth endpoints, Cloudflare Turnstile CAPTCHA on signup.
- Error tracking (Sentry) on client and server.
- Backend simulation job endpoint for very large runs (tens of thousands of games) — offloaded off the browser (execution model decision in §6 Q7).
- Terms of Service / Privacy Policy pages (legal text is out of scope per the prompt, but the pages ship as required deliverables).
- Deploy: **Railway** (Render as the close alternative) — a long-running Node process + managed Postgres + git-push deploys. Static client can deploy anywhere. **Note:** Socket.io needs a persistent process, so serverless functions (e.g. Vercel Functions) are *not* viable for the game server.
- Server kept horizontally-scalable-ready (stateless request handling) so `@socket.io/redis-adapter` can be added if one instance isn't enough — not required at launch.

**Acceptance criteria**
- Signup requires a passed CAPTCHA and a verified email before full-account features unlock.
- Password reset round-trips end-to-end against the email provider (test/sandbox mode).
- Auth endpoints rate-limit under a burst test.
- A client-forged dice payload in production config is still rejected (security regression guard).
- Large sim run completes via the backend endpoint without blocking the browser.
- Sentry captures a deliberately thrown error from both client and server.
- ToS/Privacy pages are linked and reachable; deploy from a clean git push succeeds.

---

## 2. Repo / Package Structure

pnpm workspaces + Turborepo. The prompt requires `core-engine`, `server`, `client` "at minimum"; a `contracts` package is added specifically to satisfy the "Zod schemas shared between client and server" requirement rather than duplicating them.

```
spicy-dicey/
├─ package.json
├─ pnpm-workspace.yaml
├─ turbo.json
├─ tsconfig.base.json
├─ .github/workflows/ci.yml
├─ packages/
│  ├─ core-engine/                  # pure TS, no framework, no I/O
│  │  ├─ src/
│  │  │  ├─ rng/                     # seeded PRNG + interface
│  │  │  ├─ dice/                    # rolling
│  │  │  ├─ scoring/                 # combos, selection enumeration, scoring
│  │  │  ├─ ruleset/                 # config type + all A.1.1 variants
│  │  │  ├─ turn/                    # single-turn state machine
│  │  │  ├─ strategy/                # condition→action engine + built-ins
│  │  │  ├─ game/                    # single-game runner + game log
│  │  │  └─ index.ts
│  │  └─ tests/
│  ├─ contracts/                     # Zod schemas + inferred types + socket event names
│  │  └─ src/{rest, socket, entities}/
│  ├─ server/
│  │  ├─ src/
│  │  │  ├─ app.ts
│  │  │  ├─ socket/                  # event handlers (thin; delegate to game/)
│  │  │  ├─ game/                    # room orchestration wrapping core-engine
│  │  │  ├─ routes/                  # auth, users/stats, strategies, simulations
│  │  │  ├─ auth/                    # hashing, sessions, verification, reset
│  │  │  ├─ jobs/                    # large-sim backend runner
│  │  │  ├─ db/                      # drizzle schema + migrations + queries
│  │  │  └─ chat/                    # filter + message shaping (moderation-ready)
│  │  └─ tests/
│  └─ client/
│     ├─ src/
│     │  ├─ features/
│     │  │  ├─ game/                 # live + hot-seat game loop
│     │  │  ├─ dice/                 # R3F 3D + 2D fallback (value→face mapping)
│     │  │  ├─ simulator/            # control UI + results/charts + replay
│     │  │  ├─ strategy-builder/     # draggable rule editor
│     │  │  ├─ chat/
│     │  │  └─ auth/                 # guest, signup, upgrade
│     │  ├─ components/ui/           # shadcn/ui
│     │  ├─ stores/                  # Zustand (game/UI state)
│     │  ├─ queries/                 # TanStack Query (history, strategies)
│     │  ├─ workers/                 # simulation web worker
│     │  └─ lib/
│     └─ tests/
```

**Keeping "small files / single responsibility" true as it grows (hard requirement):**
- One exported concept per file; a file that needs a second unrelated export is a signal to split.
- Socket handlers stay thin — they validate with Zod and delegate to `server/game`; no rules logic in handlers.
- No rules, scoring, or RNG anywhere outside `core-engine`. This is the guardrail that prevents the "two copies of the rules" failure mode.
- Feature-first folders on the client; shared primitives live in `components/ui` and `lib`, never inside a feature.

---

## 3. Database Schema Sketch

Drizzle ORM, one schema, SQLite (dev/test) + Postgres (prod). Portability notes: store variant/config blobs and rule lists as JSON (text in SQLite, `jsonb` in Postgres), use string IDs (UUID), and keep timestamps as a portable type. Chat is **not** persisted in v1. **No monetization anywhere in the schema** — no premium tiers, entitlements, or payment tables (prompt A.4). **Indexes (at minimum):** `game_players.user_id` (stats aggregation), `games.room_code` (room lookup/rejoin), `guest_sessions.expires_at` (purge scan).

**users**
`id (uuid, pk)`, `email (unique)`, `password_hash`, `display_name`, `email_verified (bool)`, `created_at`, `updated_at`

**guest_sessions**
`id (pk)`, `session_token (unique)`, `display_name`, `created_at`, `expires_at`, `upgraded_user_id (fk→users, nullable)` — set when a guest upgrades; supports the carry-over path.

**games**
`id (pk)`, `room_code`, `ruleset_config (json)`, `status (lobby|active|finished)`, `target_score`, `end_game_variant`, `turn_timer_sec`, `spectator_chat_enabled (bool)`, `created_by`, `winner_game_player_id (nullable)`, `started_at`, `finished_at`, `created_at`

**game_players** — a seat; belongs to either a user or a guest.
`id (pk)`, `game_id (fk→games)`, `user_id (fk→users, nullable)`, `guest_session_id (fk→guest_sessions, nullable)`, `seat_index`, `display_name (denormalized)`, `is_spectator (bool)`, `final_score`, `placement`, `farkle_count`, `turn_count`
*Constraint: exactly one of `user_id` / `guest_session_id` is set.*

**strategies**
`id (pk)`, `owner_user_id (fk→users, nullable)`, `name`, `description`, `rules (json — { schemaVersion, keepPolicy, bankPolicy }; each policy an ordered first-match-wins condition→action list)`, `is_builtin (bool)`, `created_at`, `updated_at`

**simulations**
`id (pk)`, `owner_user_id (nullable)`, `ruleset_config (json)`, `num_games`, `seed`, `mode (head_to_head|round_robin)`, `status`, `created_at`, `completed_at`

**simulation_results** — one row per strategy per simulation.
`id (pk)`, `simulation_id (fk→simulations)`, `strategy_id (fk→strategies)`, `games_played`, `games_won`, `win_rate`, `avg_final_score`, `avg_turns`, `avg_farkles`, `score_distribution (json)`

**Historical stats** (wins, avg score, games played, Farkle rate): computable by aggregating `game_players` for a `user_id`. Recommend an optional denormalized `user_stats` table (or materialized view in Postgres) if aggregation gets slow — flagged, not mandated.

**Key relationships:** `users 1—* game_players`, `games 1—* game_players`, `users 1—* strategies`, `simulations 1—* simulation_results`, `strategies 1—* simulation_results`, `guest_sessions 0..1—1 users` (via upgrade).

---

## 4. API & Socket.io Contracts (shapes/names, not implementation)

All payloads validated with Zod schemas defined once in `contracts` and imported by both sides.

### REST (Fastify)
```
POST   /auth/guest                 -> { guestId, token, displayName }
POST   /auth/signup                -> requires Turnstile token; sends verification
POST   /auth/login                 -> { user, session }
POST   /auth/logout
POST   /auth/verify-email          { token }
POST   /auth/request-password-reset{ email }
POST   /auth/reset-password        { token, newPassword }
POST   /auth/upgrade               { guestToken, email, password }  # carries in-progress game

GET    /users/me
GET    /users/me/stats             -> wins, gamesPlayed, avgScore, farkleRate, ...
GET    /users/me/games?limit&cursor-> paginated history (cursor-based)

GET    /strategies                 -> built-ins + owned
POST   /strategies                 { name, description, rules }   # rules = { schemaVersion, keepPolicy[], bankPolicy[] } — shared Zod schema in contracts, also used by PUT
GET    /strategies/:id
PUT    /strategies/:id
DELETE /strategies/:id

POST   /simulations                { strategyIds, rulesetConfig, numGames, seed, mode }  # large-run job
GET    /simulations/:id            -> status
GET    /simulations/:id/results
GET    /simulations/:id/export?format=csv|json
```

### Socket.io events

Guiding rule: **server is authoritative.** The client emits *intent*; the server computes and broadcasts *truth*. Clients never send dice values.

**Handshake authentication.** Every connection is authenticated once in an `io.use(...)` middleware from the httpOnly session cookie (guest or full account — same path), resolving a stable `identity` (`userId` | `guestSessionId`) onto `socket.data`. Every event then authorizes against that identity (e.g. `turn:*` require it to be the current turn's player). Room membership, seat ownership, and reconnection key off `identity`, **never `socket.id`** (which changes each reconnect) — a reconnecting client re-presents its cookie and the server re-attaches its held seat, replaying `room:state`. See §6 decision 16.

**Client → server**
```
room:create      { rulesetConfig, maxPlayers, turnTimerSec, spectatorChatEnabled }  -> ack { roomCode }
room:join        { roomCode, asSpectator? }
room:leave
game:start                                                     # host only
turn:roll                                                      # roll remaining dice
turn:select      { diceIndices }                               # set aside ANY legal scoring subset (may decline scoring dice, e.g. keep 1, re-roll 5)
turn:bank                                                      # end turn, commit turn score
chat:send        { text }
```

**Server → client** (broadcast to room unless noted)
```
room:state       { players, spectators, ruleset, status, scores }   # full snapshot on join
room:playerJoined / room:playerLeft
game:started     { turnOrder, firstPlayer }
turn:started     { playerId, diceRemaining, timerSec }
turn:rolled      { playerId, diceValues, availableCombos }          # values from server RNG
turn:selected    { playerId, keptDice, turnScore, diceRemaining }
turn:hotDice     { playerId }                                       # all 6 scored -> full re-roll
turn:farkled     { playerId, pointsLost }
turn:banked      { playerId, pointsAdded, newTotal, onTheBoard }
turn:timedOut    { playerId }
game:finalRound  { triggeredBy }                                    # final-round variant only
game:ended       { winnerId, finalScores, placements }
player:disconnected / player:reconnected  { playerId, graceSecRemaining? }
chat:message     { messageId, senderId, displayName, text, ts, filtered }
error            { code, message }
```

The `chat:message` shape (stable IDs, sender IDs, timestamps, `filtered` flag) is deliberately moderation-ready even though v1 only auto-filters and never persists.

---

## 5. Test Strategy per Phase

Strict TDD throughout: the failing test comes first, and tests are never weakened/deleted to force a pass — a wrong-looking test is a discussion, not a silent edit. CI gates every PR on typecheck + lint + full suite + coverage.

| Phase | Unit (Vitest) | Integration | E2E (Playwright) | Special |
|---|---|---|---|---|
| 0 | — | — | 1 smoke spec | Verify CI gate actually blocks |
| 1 `core-engine` | Every scoring combo + every A.1.1 variant (table-driven); strategy decisions; RNG determinism | — | — | **Property-based (`fast-check`)** on scoring invariants; the most heavily tested code in the repo |
| 2 Simulator | Analytics math; worker orchestration; strategy serialize/round-trip | Worker ↔ engine run; export re-import equality | — | Determinism: same seed ⇒ same results/charts |
| 3 Local game | Turn-loop UI (Testing Library); dice value→face mapping tested independently of R3F | Full hot-seat game via engine | — | `prefers-reduced-motion` selects 2D; mode toggle mid-turn |
| 4 Multiplayer | Socket payload validation (Zod); filter logic | Server socket integration (in-process clients); REST via Supertest | **Multi-browser-context** full game over real sockets; reconnect/grace; timeout auto-pass | Security: forged dice value rejected server-side |
| 5 Accounts | Stats aggregation correctness; hashing | Auth routes (Supertest); TanStack Query with MSW; Drizzle on SQLite **and** Postgres | Guest→full upgrade preserving in-progress game | Guest plays with zero persisted stats |
| 6 Hardening | Rate-limit + filter edge cases | Email verify/reset (sandbox); CAPTCHA (mocked); Sentry smoke | Signup gated by CAPTCHA + verification | Large-sim backend endpoint; prod-config forgery guard |

> **Property-test CI budget:** the ≥100k-run invariants (Phase 1) run at a reduced `numRuns` on every PR for fast feedback, and at the full ≥100k on a nightly / pre-merge-to-`main` job. This keeps PR CI quick without weakening the guarantee — the run count is a knob, never the invariant.

---

## 6. Decisions & Risks

Every open question the prompt left unresolved now has a recorded decision below, followed by the risks worth watching through the build.

**Resolved decisions (decision log — all prompt-level open questions closed):**

1. **"EV-optimal" strategy scope — DECIDED.** Ship a precomputed EV/threshold table for the **default ruleset only**, labeled "optimal for the default rules." Per-variant EV recomputation is a post-v1 enhancement. (Phase 1.)
2. **Dice selection = player/strategy choice — DECIDED.** Players and strategies choose *which* scoring dice to set aside and may decline scoring dice (keep a 1, re-roll a lone 5; keep three of four matching dice). The engine enumerates every legal set-aside subset; humans pick any via the UI, strategies pick via their keep policy. Once a subset is fixed it's scored at its **maximum interpretation** (four kept 2s = four-of-a-kind). v1 *strategies* make only the lone-1/lone-5 keep decision and always take complete combos; full subset control stays available to human players and is a post-v1 extension for strategies. (Phase 1.)
3. **Score differential vs opponents — DECIDED.** Defined as **vs the current leader** (own total minus the highest other total), so conditions read "leading/trailing by ≥X." "Vs field average" is a later alternate metric. (Phase 1/2.)
4. **Turn timer default — DECIDED.** 60s default, host-configurable (30 / 60 / 90 / off). (Phase 4.)
5. **Disconnect grace period — DECIDED.** 90s seat hold, then auto-pass while absent; host can remove. (Phase 4.)
6. **Guest→full upgrade carry-over — DECIDED.** Carry the in-progress game **and backfill this session's finished games into the new account's stats.** Design consequence: guest game results are recorded against `guest_session_id` during the session; on upgrade, those `game_players` rows are re-attributed to the new `user_id`; guest sessions that never upgrade are purged at expiry (so "no stats beyond the session" still holds for non-upgraders). (Phase 5.)
7. **Large-sim execution model — DECIDED.** Async backend job (POST to start, poll `GET /simulations/:id`), v1 using a **simple in-process background worker** — no Redis/BullMQ at launch; upgrade to a real queue only if concurrency demands it. Live authoritative game state stays in-memory on the single instance for now, moving to Redis alongside the socket adapter if/when scaling out. (Phase 4/6.)
8. **Round-robin ranking — DECIDED.** Rank by win rate (primary), tiebreak by average final score, then head-to-head record. (Phase 2.)
9. **In-browser vs backend sim threshold — DECIDED.** Client-side Web Worker up to ~5,000 games; above that, route to the backend job. Soft config, tunable after perf testing. (Phase 2/6.)
10. **Spectator chat — DECIDED.** Host toggles it per room. Adds a `spectatorChatEnabled` flag to room config (games table + `room:create` payload); spectators are gated on it. (Phase 4.)
11. **Coverage threshold — DECIDED.** ~100% on `core-engine` scoring + strategy, 90% repo-wide floor, ratcheting up per phase, enforced in CI. (Phase 0.)
12. **Profanity filter — DECIDED.** A maintained, obfuscation-aware filter library (e.g. `obscenity`), English-only for v1, kept pluggable behind the chat service so lists/locales can be swapped without touching the socket contract. (Phase 4.)
13. **Built-in strategies storage — DECIDED.** Defined in code (`core-engine`) as the source of truth, referenced by stable string IDs; optionally seeded into the `strategies` table (`is_builtin=true`, `owner_user_id=null`) via migration for clean foreign keys from `simulation_results`. (Phase 1/5.)
14. **Live-game RNG is *not* seed-deterministic — DECIDED.** The seedable PRNG is for the **simulator and tests only** (reproducibility + deterministic assertions). **Live multiplayer games inject a CSPRNG** (`crypto.getRandomValues`) and are made replayable by **recording every roll outcome in the persisted game log**, never by storing a re-derivable seed. Rationale: the engine PRNG (mulberry32/xorshift) is trivially predictable, so a leaked live-game seed would let a player compute all future rolls and cheat decisively. Security invariant: **no RNG seed for a live game is ever generated, stored, or sent to any client.** The engine's RNG stays injectable so the server supplies the CSPRNG source; the engine never picks it. (Phase 1 engine; Phase 4 server.)
15. **Strategy engine must be live-runnable (AI bots later) — NOTED.** Per prompt Part C, saved custom strategies should later be able to fill empty seats as AI opponents in live games. v1 ships no bots, but the strategy engine evaluates against a **generic turn/game state** (the same state the live turn machine exposes), not against sim-only structures — so adding server-side bots later is wiring, not a rewrite. (Phase 1 design constraint.)
16. **Socket authentication — DECIDED.** Every Socket.io connection authenticates **once** in a handshake middleware (`io.use`) via an **httpOnly, `SameSite` session cookie** backed by a **stateful session record** (DB/in-memory) — the identical mechanism for guests (`/auth/guest`) and full accounts. The middleware resolves a **stable identity** (`userId` or `guestSessionId`) onto `socket.data`; room membership, seat ownership, turn-ownership, and chat attribution all key off that identity, **never the socket id** (which changes each reconnect). Reconnection works by presenting the same cookie: the server finds the held seat within the grace window and re-attaches, replaying `room:state`. Deploy client + API same-origin (or sibling subdomains with `SameSite=None; Secure`) to keep the cookie path simple; stateful sessions give clean revocation for logout / host-remove / future bans. (Phase 4; guest issuance Phase 5.)
17. **`doubling` N-of-a-kind scaling — DECIDED.** The `doubling` option (A.1.1 toggle 2) is face-dependent and doubles up from the three-of-a-kind value: `nOfAKind(face, n) = threeOfAKind(face) × 2^(n − 3)` for n ∈ {4,5,6} — three-1s uses the configured `threeOnesValue` (default 1000), other faces use face × 100. This is the standard Farkle doubling variant. `flat` stays the default. (Phase 1; Appendix A.1.1.)
18. **Consecutive-Farkle penalty — DECIDED.** Under the `three-consecutive-penalty` variant (A.1.1 toggle 9), the penalty is `farkleConsecutivePenalty`, default **1000**. A per-player counter increments on each Farkle and resets whenever the player banks; on hitting 3 it deducts the penalty from the banked total (in addition to the turn's lost points) and resets, so it recurs every third consecutive Farkle. Scores may go negative; earned on-the-board status is sticky. Off by default. (Phase 1; Appendix A.1.1.)

*Remaining unknowns are perf-tuning values only (timer, grace period, sim thresholds) — adjustable after real-world testing without any design change.*

**Risks to watch:**

- **R3F/Three.js weight and low-end performance.** Mitigated by the 2D fallback, but bundle size and mobile GPU behavior need real-device testing. The `rapier` physics option is correctly sequenced as a stretch goal, not v1.
- **Solo-dev TDD velocity across the full stack.** The discipline pays off enormously in `core-engine`; the cost is heaviest in Phase 4's multi-context Playwright e2e. Budget time there specifically.
- **RNG determinism is a simulator property, not a live-game one (see decision 14).** The engine's RNG must stay injectable so the *simulator* gets a seeded, reproducible PRNG while the *live server* injects a CSPRNG; live replay/audit comes from the recorded outcome log, never a stored seed. The risk to watch is the two consumers drifting in how they *consume* rolls from the engine — the "give me N dice" API must be identical for both, differing only in the injected source.
- **Dual-dialect Drizzle drift.** SQLite vs Postgres JSON and type handling can diverge quietly; the schema test must run against both, not just SQLite.
- **Socket.io + Railway.** Confirm sticky sessions / single-instance assumptions early; the redis-adapter path is the escape hatch but shouldn't be needed at launch.

---

*Recommended first action:* start Phase 1 by writing the first failing test — beginning with **legal set-aside subset enumeration**, since both human selection and the strategy keep policy depend on it. The expected point values it asserts against live in **Appendix A**.

---

## Appendix A — Default Ruleset & Scoring (authoritative)

Carried over from the planning prompt (§A.1 / §A.1.1) so the engine has a self-contained source of truth — no external document required. These are the **default** values; every item marked configurable in A.1.1 is a field on the ruleset config, never a literal in the scoring code. Phase 1's table-driven tests assert against this table.

### A.1 — Default scoring table

| Roll | Points |
|---|---|
| Single 1 | 100 |
| Single 5 | 50 |
| Three 1s | 1000 |
| Three 2s | 200 |
| Three 3s | 300 |
| Three 4s | 400 |
| Three 5s | 500 |
| Three 6s | 600 |
| Four of a kind | 1000 |
| Five of a kind | 2000 |
| Six of a kind | 3000 |
| Straight (1–6) | 1500 |
| Three pairs | 1500 |
| Two triplets | 2500 |
| Minimum score to get "on the board" | 500 |
| Target score (triggers end-game) | 10,000 |

- **Only 1s and 5s score as singles** (100 / 50). A lone 2, 3, 4, or 6 is worth nothing — this is precisely what makes Farkle detection and legal-subset enumeration non-trivial.
- **Farkle:** a roll producing no scoring dice ⇒ lose all points accumulated *this turn*; the turn passes.
- **Hot dice:** scoring all 6 dice within a turn earns a full re-roll of all 6 while keeping the accumulated turn score.
- **Three-of-a-kind is face-valued** (three 4s = 400), with three 1s the special case (1000, not 100). **Four/five/six-of-a-kind are flat** in the default (1000 / 2000 / 3000), independent of face — subject to the scaling toggle below.

### A.1.1 — Configurable toggles (host sets before the game starts)

Every field below is exposed on the typed ruleset config. Defaults in **bold**.

| # | Toggle | Options | Default |
|---|---|---|---|
| 1 | Three-1s value | integer | **1000** |
| 2 | N-of-a-kind scaling | `flat` (4/5/6-oak = 1000/2000/3000) · `doubling` (each tier = 2× the previous tier) | **flat** |
| 3 | Straight value | integer | **1500** |
| 4 | Three-pairs value | integer | **1500** |
| 5 | Two-triplets | on/off + value | **on, 2500** |
| 6 | On-the-board minimum | on/off + threshold | **on, 500** |
| 7 | Target score | integer | **10,000** |
| 8 | End-game behavior | `instant` (ends the moment someone hits target) · `final-round` (every other player gets one last turn to beat the leader) | **final-round** |
| 9 | Farkle penalty | `turn-points-only` · `three-consecutive-penalty` (3 Farkles in a row costs a fixed penalty) | **turn-points-only** |

**Decided details** (were open in the prompt; now specified — §6 decisions 17–18):
- **2 · `doubling` scaling.** Face-dependent, doubling up from the three-of-a-kind value: `nOfAKind(face, n) = threeOfAKind(face) × 2^(n − 3)` for n ∈ {4, 5, 6}, where `threeOfAKind(1) = threeOnesValue` (default 1000) and `threeOfAKind(f) = f × 100` for f ∈ 2…6. E.g. with defaults: four 1s = 2000, five 1s = 4000, six 1s = 8000; four 5s = 1000, six 5s = 4000. `flat` remains the default; this applies only when the toggle is `doubling`.
- **9 · consecutive-Farkle penalty.** Config field `farkleConsecutivePenalty`, default **1000**, active only under the `three-consecutive-penalty` variant. A per-player counter increments on each Farkle turn and resets to 0 on any turn the player banks points. On the counter reaching 3, the player loses that turn's points (as always) **and** `farkleConsecutivePenalty` is deducted from their banked total, then the counter resets to 0 (so it recurs every third consecutive Farkle). The banked total may go negative; **on-the-board status, once earned, is never revoked by a penalty.**

---

## Appendix B — Strategy Condition Catalog (§B.2)

The condition types the strategy rule engine must support, carried over from the planning prompt §B.2. Both policy lists (keep, bank — see §1 and decision 2) compose their conditions from this catalog. Rule model: an **ordered list, evaluated top-to-bottom, first match wins**, reorderable in the UI.

**Conditions (composable with AND / OR):**
- **Turn-score threshold** — e.g. turn score ≥ 1000.
- **Dice-remaining threshold** — e.g. dice remaining ≤ 1.
- **Turn-score AND dice-remaining** — e.g. "500 pts + 1 die ⇒ stop", "500 pts + 4 dice ⇒ continue", "1500 pts + 4 dice ⇒ stop".
- **Score differential vs. opponents** — leading/trailing by ≥ N, defined as vs. the current leader (decision 3).
- **Streak counter** — consecutive hot-dice triggers this turn, as a bounded counter. Deliberately *not* raw roll history — dice have no memory, and the model reflects that honestly.
- **(Keep policy only)** the candidate die value, and the dice-remaining that keeping-vs-declining that die would produce (§1).

**Actions:**
- **Bank policy:** `bank` | `roll`.
- **Keep policy:** `keep` | `decline` the candidate discretionary die (v1: lone 1s / lone 5s only; always take complete combos — decision 2).

**Built-in reference strategies** ship as out-of-the-box benchmarks (§1): "always bank at 300", "greedy", "value-aware", and "EV-optimal" (default-ruleset table only — decision 1).
