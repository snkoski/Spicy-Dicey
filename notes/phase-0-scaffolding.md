# Phase 0 — Monorepo scaffolding & CI (working notes)

Deliverables/acceptance: plan §1 Phase 0. This file tracks the step breakdown and in-the-moment decisions.

## Kickoff breakdown

1. [x] Root workspace: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.gitignore`, `.prettierrc`, ESLint flat config
2. [x] `packages/contracts` — minimal Zod schema + one passing Vitest spec
3. [x] `packages/core-engine` — empty public API + one passing Vitest spec
4. [x] `packages/server` — minimal Fastify app factory + one passing Vitest spec
5. [x] `packages/client` — Vite + React shell + one passing Vitest spec; Playwright installed with a single trivial spec
6. [x] Coverage wired (low initial thresholds; ratchet per plan §6 Q11)
7. [x] `.github/workflows/ci.yml` — typecheck → lint → test → coverage, blocking
8. [x] Verify locally: `pnpm install && pnpm turbo run typecheck lint test` (13/13 tasks green incl. e2e + format:check)
9. [x] Verify the gate gates locally: a deliberately failing test failed the run; a missing-types type error failed typecheck. Re-verify in CI once remote exists.
10. [ ] PR, merge when green, tag `phase-0-complete` — blocked on remote/auth

## Decisions & surprises (append as they happen)

- **Blocked on remote:** no git remote configured and `gh` keyring token is invalid at session start. Working on local branch `phase-0/scaffolding`; push/PR/CI-verification deferred until the developer re-auths (`gh auth refresh -h github.com`) and a repo exists.
- Playwright's trivial spec lives in `packages/client/e2e/` and runs as a separate turbo task (`e2e`), not inside `test` — keeps the required `typecheck lint test` pipeline browser-free and fast. CI runs `e2e` as its own job.
- **Internal-packages pattern (no build step):** workspace packages export TS source directly (`exports: "./src/index.ts"`); Vite/Vitest/tsx compile just-in-time. Avoids `tsc` build orchestration in Phase 0; a `build` task can be added when the server needs a production bundle (Phase 6).
- **Vitest 2 → 3:** vitest 2.x pins vite 5, which type-clashes with the client's vite 6 plugin array under `exactOptionalPropertyTypes`. Bumped vitest/@vitest/coverage-v8 to ^3 everywhere instead of downgrading vite.
- **Turbo strict env vs Playwright:** turbo 2 strips `TMPDIR` from task env; under the local command sandbox Playwright then tries `/tmp` and EPERMs. Added `globalPassThroughEnv: ["TMPDIR"]` — harmless in CI, required locally.
- pnpm 11 requires explicit `allowBuilds` for postinstall scripts; allowed `esbuild` only.
- Coverage thresholds start at 50% per package (plan says "low initially"); ratchet to 90/100 as phases land.
- ESLint: root flat config, non-type-checked `tseslint.configs.recommended` for Phase 0 speed; consider `recommendedTypeChecked` ratchet later.
