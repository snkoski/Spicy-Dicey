# core-engine — CLAUDE.md

This package is pure TypeScript: no framework, no network, no I/O. If an import needs a DOM, a socket, or a database, it does not belong here.

## Non-negotiables

- **No `Math.random()` anywhere.** Every dice roll flows through the injected RNG. In tests and the simulator that RNG is a **seedable PRNG** (same seed ⇒ identical dice sequence, forever); the **live server injects a CSPRNG** (plan §6 decision 14). The engine never picks the source itself.
- **No hardcoded magic numbers.** Every scoring value, toggle, and threshold reads from the typed ruleset config (Appendix A.1.1 in the plan). A new rule variant means adding a config field, not an if-statement with a literal baked in.
- **v1 strategies decide only lone 1s/5s** in the keep policy, and always take complete combos. Full subset control (declining a triple, keeping 3-of-4) is available to human players via the UI only — don't build it into strategy logic yet; that's a post-v1 extension.

## Test discipline (stricter than the repo default)

- Write the failing test first, for every unit, no exceptions — this is the most heavily tested package in the repo.
- Table-driven tests for every scoring combo and every A.1.1 ruleset variant toggle, with expected values from the plan's default scoring table (Appendix A.1).
- Property-based tests (fast-check) are required, not optional:
  - Across ≥100k random rolls: a scored selection never exceeds the theoretical max for its multiset, and never scores non-scoring dice.
  - Re-scoring a selection is idempotent; disjoint valid selections' scores sum correctly.
- Determinism test: identical `(seed, ruleset, strategies)` ⇒ byte-identical game log, verified across 1000 runs. If this ever flakes, treat it as a correctness bug, not a test bug.
- Coverage target: ~100% on scoring and strategy logic. This is the floor other packages are held to, not the other way around.

## Commit granularity

Same rule as root, applied more literally here: every red→green cycle is its own commit. In this package that often means one commit per scoring combo or per ruleset variant — that's expected, not excessive.
