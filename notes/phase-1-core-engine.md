# Phase 1 — core-engine (working notes)

Deliverables/acceptance: plan §1 Phase 1; scoring values: plan Appendix A.1/A.1.1; strategy catalog: Appendix B. Package rules: `packages/core-engine/CLAUDE.md`.

## Kickoff breakdown (module slices, one branch/PR/tag each)

1. [x] `phase-1/rng-dice` — `RandomSource` interface, seedable mulberry32, `rollDice(rng, n)`. Tests: same seed ⇒ identical sequence; values uniform-ish and in [0,1); dice values 1–6 only, driven by injected RNG. Replaced the Phase-0 placeholder export/smoke test with the real public API.
2. [ ] `phase-1/scoring` — ruleset config (all A.1.1 toggles + singles values, defaults from A.1) + scoring: `scoreSelection` (max interpretation, null if any kept die doesn't contribute), `enumerateLegalSelections`, Farkle detection. Table-driven tests for every combo × every toggle; fast-check property tests (≥100k runs nightly knob).
3. [ ] `phase-1/turn` — pure turn state machine: roll → select → (roll|bank), Farkle/hot-dice transitions, on-the-board gating hooks, running turn score. Machine consumes rolled values (rolling itself stays in dice/game layers so the server can inject CSPRNG rolls).
4. [ ] `phase-1/strategy` — condition→action rule engine (keep policy + bank policy, first-match-wins, AND/OR), evaluation context (turn state + score differential vs leader + hot-dice streak), built-ins: bank-at-300, greedy, value-aware, EV-optimal (default ruleset table — decision 1).
5. [ ] `phase-1/game` — single-game runner (K strategies, ruleset, injected RNG) → structured replayable `GameLog`; determinism test (1000× byte-identical); end-game variants.
6. [ ] Coverage ratchet: core-engine thresholds → ~100% on scoring/strategy.

## Decisions & surprises (append as they happen)

- **Config surface beyond A.1.1:** package CLAUDE.md forbids _any_ hardcoded scoring value, so the config also carries `singleOneValue` (100), `singleFiveValue` (50), and `threeOfAKindFaceMultiplier` (100 — three Ns = N×100 for faces 2–6) alongside the nine A.1.1 toggles. Defaults match Appendix A.1 exactly.
- **Three pairs = exactly three distinct face-pairs** (counts pattern 2/2/2 over 6 dice). A 4-of-a-kind + pair does **not** count as three pairs — the 4-oak interpretation already exists, and A.1 doesn't sanction 4+2; if a variant wants it later, it's a new config toggle, not a reinterpretation.
- **Turn machine is pure and takes rolled values as input** (`applyRoll(state, dice)`), never an RNG. Rolling happens in the game runner (sim/tests: seeded PRNG) or the server (CSPRNG) via the same `rollDice` — keeps the "give me N dice" consumption identical for both per plan §6 risk 3.
- **Greedy never banks voluntarily** ("roll until forced to stop" taken literally), so a greedy-vs-greedy game could never finish; the game runner gets a `maxTurns` safety valve (default generous, configurable) and reports an unfinished result rather than looping forever.
- **Bank-policy fallthrough = `roll`; keep-policy fallthrough = `keep`** (plan: default keep policy is "keep everything (greedy)"). Built-ins add explicit catch-alls where behavior matters.
- **Max interpretation includes same-face partitions:** four kept 1s = three-1s + single 1 = 1100, beating flat 4-of-a-kind (1000). Caught while designing the property-test oracle; two just-written table expectations ([1,1,1,1] = 1000, [1,1,1,1,5] = 1050) were wrong per the "maximum interpretation" rule and were corrected red→green in the same cycle, before any consumer existed. Faces other than 1 never benefit (their leftovers don't score); 5s never benefit under sane configs but the per-face partition search handles them uniformly anyway.
