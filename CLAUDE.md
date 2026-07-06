# Spicy-Dicey — CLAUDE.md

Farkle / Hot Dice platform. The full spec — phased roadmap, acceptance criteria, DB schema, API/socket contracts, and the decision log — lives in `spicy-dicey-project-plan.md` at the repo root. Consult it for *what* to build. This file is for *how to operate* in this repo, every session.

## Core invariant (never violate)

`core-engine` is the sole source of truth for dice, scoring, and strategy evaluation. It is consumed identically by the simulator and the live server. No dice/scoring/RNG logic exists anywhere else in the repo — not in `server`, not in `client`. If you find yourself duplicating rules logic outside `core-engine`, stop and refactor instead of continuing.

See `packages/core-engine/CLAUDE.md` for that package's stricter rules.

## Tech stack

- pnpm workspaces + Turborepo, TypeScript `strict: true` everywhere
- Vitest (unit/integration), Playwright (e2e), fast-check (property-based tests)
- ESLint (flat config) + Prettier
- Fastify (Express is an acceptable low-risk swap) + Socket.io
- Zod schemas shared from `contracts`, consumed by both `client` and `server`
- Drizzle ORM — SQLite in dev/test, Postgres in prod
- React client: Vite build; R3F + drei (3D dice), Zustand (state), TanStack Query, Tailwind + shadcn/ui, Recharts (sim charts), Framer Motion (non-dice UI motion)
- Deploy target: Railway (long-running process — Socket.io rules out serverless)

## Repo layout

```
packages/
  core-engine/   # pure TS, no framework, no I/O — see its own CLAUDE.md
  contracts/     # Zod schemas + inferred types, shared client/server
  server/        # Fastify + Socket.io; handlers stay thin, delegate to game/
  client/        # React, feature-first folders
```
Full tree with subfolders: plan §2.

## Build & test

```
pnpm install
pnpm turbo run typecheck lint test
```
This must pass locally before every commit. CI runs the same command and blocks merge on failure — don't rely on CI to catch what you could've caught first.

## Test discipline

- Strict TDD: write the failing test first, for every unit, no exceptions.
- Never weaken or delete a test to force a pass. A test that looks wrong is a discussion, not a silent edit.
- Coverage: ~100% on `core-engine` scoring/strategy logic, 90% floor repo-wide, ratcheting up per phase.
- Phases are strictly sequential. A phase isn't "done" until its acceptance criteria (plan, per-phase section) pass in CI. Don't start Phase N+1 work before Phase N is green.

## Git workflow

- **Commit on every red→green cycle** — as soon as a failing test passes, commit. Don't batch multiple unrelated test cycles into one commit.
- Conventional commit messages: `feat:`, `fix:`, `test:`, `refactor:`, `chore:`, `docs:`. Scope by package/module where it adds clarity, e.g. `test(core-engine/scoring): straight detection`.
- Work on a branch per phase, or per module for large phases (Phase 1 especially — e.g. `phase-1/scoring`, `phase-1/strategy-engine`). Never commit directly to `main`.
- Push regularly — don't let a branch sit local-only for a whole session.
- Open a PR (`gh pr create`) once a phase's acceptance criteria — or a sensible module-level slice of a large phase — are met.
- **You may merge your own PR once CI is green** (unless the developer has asked to review a specific PR first), provided you do both of these — they are not optional:
  - **Never delete the branch after merging.** Leave every phase/module branch intact on the remote so the developer can inspect the work later.
  - **Tag the milestone.** Create an annotated tag on the merge commit — `phase-N-complete`, or `phase-N/<module>` for a module slice — and push it. These tags are how the developer walks the project phase-by-phase, so a merge without its tag is incomplete.
- Prefer a merge commit (not squash) so the per-red→green-cycle history from the branch survives on `main`.
- Never force-push over existing remote history; never delete a branch or tag that you or a prior session created.

## Working notes

- Each phase gets a running notes file at `notes/phase-N-<name>.md`, created when the phase starts. Append to it *as you work* — design decisions and why an approach was chosen over an alternative, edge cases discovered, anything that surprised you or deviated from the plan. Write these in the moment, not as a single end-of-phase summary.
- Do not duplicate deliverables or acceptance criteria here — those stay in the plan; reference the relevant section instead.
- Commit notes alongside the code they describe.

## Phase kickoff

- Before starting a phase's work, break its deliverables (plan, per-phase section) into a concrete step-by-step to-do list. Don't wait for approval — write the list, then proceed through it.
- Record the breakdown as the first entry in that phase's notes file (see "Working notes"), and update status there as steps complete or change. Do not use Plan Mode's blocking approval for this — write and go.

## What lives in the plan instead of here

The phased roadmap, per-phase acceptance criteria, DB schema, API/socket contracts, and the decision log (plan §6) are spec, not standing instructions — they're detailed and change at phase boundaries, so they stay in the plan file rather than get duplicated here. Open the plan at the start of each phase.
