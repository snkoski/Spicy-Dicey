export type { RandomSource } from './rng/types.js';
export { createMulberry32 } from './rng/mulberry32.js';
export { createCryptoRandom } from './rng/crypto.js';
export type { DieValue } from './dice/types.js';
export { DIE_FACES } from './dice/types.js';
export { rollDice } from './dice/roll.js';
export type {
  RulesetConfig,
  NOfAKindScaling,
  EndGameVariant,
  FarklePenaltyVariant,
} from './ruleset/types.js';
export { DEFAULT_RULESET } from './ruleset/defaults.js';
export { scoreSelection } from './scoring/score-selection.js';
export { enumerateLegalSelections, isFarkle } from './scoring/enumerate.js';
export type { ScoredSelection } from './scoring/enumerate.js';
export type { TurnPhase, TurnState } from './turn/types.js';
export type { TurnContext } from './turn/turn.js';
export { startTurn, applyRoll, applySelection, chooseRoll, canBank, bank } from './turn/turn.js';
export type {
  Comparator,
  ConditionSubject,
  ComparisonCondition,
  CompositeCondition,
  AlwaysCondition,
  StrategyCondition,
  KeepRule,
  BankRule,
  StrategyDefinition,
  ConditionContext,
} from './strategy/types.js';
export { evaluateCondition } from './strategy/conditions.js';
export { evaluateBankPolicy, evaluateKeepPolicy } from './strategy/policies.js';
export { chooseStrategySelection } from './strategy/select.js';
export type { StrategyTurnContext } from './strategy/select.js';
export { BUILTIN_STRATEGIES, getBuiltinStrategy } from './strategy/builtins.js';
export type { GameConfig, GamePlayerConfig, GameLogEvent, GameResult } from './game/types.js';
export type { MatchConfig, MatchPlayer, MatchState } from './match/types.js';
export type { MatchTransition } from './match/match.js';
export { startMatch, matchRoll, matchSelect, matchDecide, matchCanBank } from './match/match.js';
export { runGame } from './game/run-game.js';
export { applyFarkleToBank } from './game/farkle-penalty.js';
export type { FarkleBankState, FarkleBankResult } from './game/farkle-penalty.js';
