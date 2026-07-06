# Phase 3 — Local / hot-seat game (working notes)

Deliverables/acceptance: plan §1 Phase 3.

## Kickoff breakdown (module slices)

1. [ ] `phase-3/match-engine` — new `core-engine/src/match`: a pure interactive multi-player match reducer (roll/select/bank actions from _outside_, unlike `runGame` which drives itself from strategies). Handles seat rotation, on-the-board, farkle penalties, both end-game variants, winner/placements, and emits the same `GameLogEvent` stream. Refactor `runGame` to drive this reducer — the 1000× byte-identical determinism test and every existing game test must pass **unchanged**; they are the refactor's safety net. Rationale: without this, game-flow sequencing would live three times (runGame, hot-seat store, Phase-4 server rooms).
2. [ ] `phase-3/hotseat-ui` — setup screen (2–8 seats, names, ruleset variants), game screen driving the match reducer via a Zustand store: roll button, tap-to-select dice with legal-selection feedback (from `enumerateLegalSelections`), bank button gated by `canBank`, farkle/hot-dice banners, live scores, final-round banner, winner screen. 2D dice first with `prefers-reduced-motion` auto-detection + manual 2D/3D toggle plumbing.
3. [ ] `phase-3/dice-3d` — R3F rounded-box dice, canvas-drawn pip textures, procedural rotation-keyframe tumble that lands exactly on the engine values; the value→face-rotation mapping is a pure module tested without R3F. Toggle switches mid-turn without disturbing match state (state lives in the store, rendering is pure view).

## Decisions & surprises (append as they happen)

- **Match reducer lives in core-engine, not the client.** It is game-flow (whose turn, what transition), not UI — and it must be identical for hot-seat and the authoritative server. `runGame` becomes "match reducer + strategy autopilot", proving engine/simulator/live-server all share one flow.
- **runGame refactor landed with zero test edits** — all 210 pre-existing core-engine tests (incl. 1000× byte-identical determinism) passed unchanged on the first run after swapping runGame's internals for the match reducer. Event ordering subtleties that had to match exactly: farkle bookkeeping before its event, final-round-triggered after the banked event, stalemate check at seat-advance time.
