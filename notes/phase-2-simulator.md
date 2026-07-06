# Phase 2 — Strategy Simulator (working notes)

Deliverables/acceptance: plan §1 Phase 2. Strategy catalog: Appendix B.

## Kickoff breakdown (module slices)

1. [ ] `phase-2/sim-core` — pure simulation logic in `client/src/features/simulator/lib`: batch orchestration over `runGame`, per-strategy analytics (win rate, avg final score, avg turns, avg farkles, score distribution), head-to-head + round-robin pairing with ranking (win rate → avg score → head-to-head, decision 8), CSV/JSON export + re-import, seed handling (same seed ⇒ identical results). All Vitest, no DOM.
2. [ ] `phase-2/worker` — Web Worker running batches off the main thread with progress messages; deterministic under a given seed; vitest integration via worker module import (logic split so the worker shell is thin).
3. [ ] `phase-2/strategy-builder` — two draggable ordered rule lists (keep + bank policies) with AND/OR condition composition over the Appendix-B catalog; serializes to the engine's `StrategyDefinition` (round-trip test); shadcn/ui form components.
4. [ ] `phase-2/sim-ui` — control UI (2+ strategies, game count, ruleset variant, mode), Recharts analytics, CSV/JSON export buttons, step-through replay over the Phase-1 game log; e2e: 3×10k games without UI freeze; same-seed reproducibility.

## Decisions & surprises (append as they happen)

- **Analytics live in the client, not core-engine** — win rates and distributions are simulator domain, not dice rules; the core invariant (no rules outside the engine) stays intact because analytics only _aggregate_ `GameResult`s.
- **Client test/UI stack:** Tailwind v4 + shadcn/ui, Zustand for sim state, dnd-kit for the draggable rule lists, Recharts for charts. Worker logic is a pure function (`runSimulation`) wrapped by a ~10-line worker shell so determinism and analytics are unit-testable without a Worker runtime.
- **Radix TabsContent unmounts by default** — caught by the e2e "UI stays responsive during a 10k run" spec: switching to the builder tab mid-run destroyed the simulator's state (and the in-flight run's results). Fixed with `forceMount` + `data-[state=inactive]:hidden` so panels keep state.
- **Native `<select>` over Radix Select** for form dropdowns: accessible by default, and jsdom-testable without portal gymnastics; the visual kit still matches.
- **Rule reordering is dual-path:** dnd-kit pointer drag _and_ keyboard-accessible up/down buttons — the buttons double as the jsdom-testable path.
- **Zustand deferred to Phase 3** — simulator page state is plain useState; nothing here is shared across features yet, so a store would be ceremony. Game state (Phase 3) is where Zustand earns its keep.
- 3 strategies × 10k games completes in a few seconds inside the worker (engine ~0.2ms/game); progress posts throttled to ~100 messages.
