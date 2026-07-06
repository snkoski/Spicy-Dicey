export type NOfAKindScaling = 'flat' | 'doubling';
export type EndGameVariant = 'instant' | 'final-round';
export type FarklePenaltyVariant = 'turn-points-only' | 'three-consecutive-penalty';

/**
 * Every scoring value, toggle, and threshold the engine uses (plan Appendix
 * A.1.1 plus the base scoring values from A.1). Scoring code reads from this
 * config exclusively — no literals in the rules logic.
 */
export interface RulesetConfig {
  /** A single kept 1 (only 1s and 5s score as singles). */
  singleOneValue: number;
  /** A single kept 5. */
  singleFiveValue: number;
  /** A.1.1 #1 — three 1s (the special-cased triple). */
  threeOnesValue: number;
  /** Three Ns = N × this, for faces 2–6. */
  threeOfAKindFaceMultiplier: number;
  /** A.1.1 #2 — how 4/5/6-of-a-kind scale. */
  nOfAKindScaling: NOfAKindScaling;
  /** Flat-scaling values (used when nOfAKindScaling === 'flat'). */
  fourOfAKindFlatValue: number;
  fiveOfAKindFlatValue: number;
  sixOfAKindFlatValue: number;
  /** A.1.1 #3 — straight 1–6. */
  straightValue: number;
  /** A.1.1 #4 — three distinct pairs. */
  threePairsValue: number;
  /** A.1.1 #5 — two triplets toggle + value. */
  twoTripletsEnabled: boolean;
  twoTripletsValue: number;
  /** A.1.1 #6 — minimum first bank to get "on the board". */
  onTheBoardEnabled: boolean;
  onTheBoardMinimum: number;
  /** A.1.1 #7 — score that triggers end-game. */
  targetScore: number;
  /** A.1.1 #8 — what happens when someone hits the target. */
  endGameVariant: EndGameVariant;
  /** A.1.1 #9 — Farkle penalty variant + its cost (§6 decision 18). */
  farklePenaltyVariant: FarklePenaltyVariant;
  farkleConsecutivePenalty: number;
}
