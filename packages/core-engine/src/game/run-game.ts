import { rollDice } from '../dice/roll.js';
import type { RandomSource } from '../rng/types.js';
import { matchCanBank, matchDecide, matchRoll, matchSelect, startMatch } from '../match/match.js';
import type { MatchState } from '../match/types.js';
import { chooseStrategySelection } from '../strategy/select.js';
import { evaluateBankPolicy } from '../strategy/policies.js';
import type { GameConfig, GameLogEvent, GameResult } from './types.js';

/**
 * Plays one full game between K strategies: the shared match reducer plus a
 * strategy autopilot. The sole RNG consumer is rollDice — the simulator
 * injects a seeded PRNG, the live server a CSPRNG.
 */
export function runGame(config: GameConfig, rng: RandomSource): GameResult {
  if (config.players.length < 2) {
    throw new Error(`a game needs at least two players, got ${config.players.length}`);
  }
  const log: GameLogEvent[] = [];
  const started = startMatch({
    playerIds: config.players.map((p) => p.id),
    ruleset: config.ruleset,
    ...(config.maxTurnsPerPlayer !== undefined
      ? { maxTurnsPerPlayer: config.maxTurnsPerPlayer }
      : {}),
  });
  log.push(...started.events);
  let state = started.state;

  while (state.status === 'active') {
    const transition = nextTransition(state, config, rng);
    log.push(...transition.events);
    state = transition.state;
  }

  return {
    finished: state.finished,
    winnerId: state.winnerId,
    finalScores: Object.fromEntries(state.players.map((p) => [p.id, p.total])),
    placements: lastPlacements(log),
    turnsTaken: Object.fromEntries(state.players.map((p) => [p.id, p.turns])),
    farkleCounts: Object.fromEntries(state.players.map((p) => [p.id, p.farkles])),
    log,
  };
}

function nextTransition(state: MatchState, config: GameConfig, rng: RandomSource) {
  const seat = state.currentSeat;
  const strategy = config.players[seat]!.strategy;
  const player = state.players[seat]!;
  const bestOther = Math.max(...state.players.filter((_, i) => i !== seat).map((p) => p.total));
  const scoreDifferential = player.total - bestOther;

  if (state.turn.phase === 'awaiting-roll') {
    return matchRoll(state, rollDice(rng, state.turn.diceToRoll));
  }
  if (state.turn.phase === 'awaiting-selection') {
    const selection = chooseStrategySelection(
      state.turn.roll!,
      state.ruleset,
      strategy.keepPolicy,
      {
        turnScoreBeforeSelection: state.turn.turnScore,
        scoreDifferential,
        hotDiceStreak: state.turn.hotDiceStreak,
      },
    );
    return matchSelect(state, selection);
  }
  const wantsBank =
    evaluateBankPolicy(strategy.bankPolicy, {
      turnScore: state.turn.turnScore,
      diceRemaining: state.turn.diceToRoll,
      scoreDifferential,
      hotDiceStreak: state.turn.hotDiceStreak,
    }) === 'bank';
  return matchDecide(state, wantsBank && matchCanBank(state) ? 'bank' : 'roll');
}

function lastPlacements(log: GameLogEvent[]): string[] {
  const ended = log.at(-1);
  return ended?.type === 'game-ended' ? ended.placements : [];
}
