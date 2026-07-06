import { rollDice } from '../dice/roll.js';
import type { RandomSource } from '../rng/types.js';
import { chooseStrategySelection } from '../strategy/select.js';
import { evaluateBankPolicy } from '../strategy/policies.js';
import { applyRoll, applySelection, bank, canBank, chooseRoll, startTurn } from '../turn/turn.js';
import { applyFarkleToBank } from './farkle-penalty.js';
import type { GameConfig, GameLogEvent, GameResult } from './types.js';

const DEFAULT_MAX_TURNS_PER_PLAYER = 1000;

interface PlayerState {
  id: string;
  total: number;
  onTheBoard: boolean;
  consecutiveFarkles: number;
  turns: number;
  farkles: number;
}

/** Plays one full game between K strategies. The sole RNG consumer is
 * rollDice — the simulator injects a seeded PRNG, the live server a CSPRNG.
 */
export function runGame(config: GameConfig, rng: RandomSource): GameResult {
  if (config.players.length < 2) {
    throw new Error(`a game needs at least two players, got ${config.players.length}`);
  }
  const { ruleset } = config;
  const maxTurns = config.maxTurnsPerPlayer ?? DEFAULT_MAX_TURNS_PER_PLAYER;
  const log: GameLogEvent[] = [];
  const players: PlayerState[] = config.players.map((p) => ({
    id: p.id,
    total: 0,
    onTheBoard: false,
    consecutiveFarkles: 0,
    turns: 0,
    farkles: 0,
  }));

  let finalRoundTriggeredBy: number | null = null;
  let finished = false;
  let turnIndex = 0;

  outer: while (!finished) {
    for (let seat = 0; seat < players.length; seat += 1) {
      const player = players[seat]!;
      if (finalRoundTriggeredBy === seat) {
        // everyone else has had their last turn
        finished = true;
        break outer;
      }
      if (player.turns >= maxTurns) {
        break outer; // stalemate valve; finished stays false
      }

      player.turns += 1;
      log.push({ type: 'turn-started', playerId: player.id, turnIndex });
      turnIndex += 1;
      playTurn(player, seat);

      if (finalRoundTriggeredBy === null && player.total >= ruleset.targetScore) {
        if (ruleset.endGameVariant === 'instant') {
          finished = true;
          break outer;
        }
        finalRoundTriggeredBy = seat;
        log.push({ type: 'final-round-triggered', playerId: player.id });
      }
    }
  }

  function playTurn(player: PlayerState, seat: number): void {
    const bestOther = Math.max(...players.filter((_, i) => i !== seat).map((p) => p.total));
    let state = startTurn();
    for (;;) {
      if (state.phase === 'awaiting-roll') {
        const dice = rollDice(rng, state.diceToRoll);
        state = applyRoll(state, dice, ruleset);
        log.push({ type: 'rolled', playerId: player.id, dice });
      } else if (state.phase === 'farkled') {
        const outcome = applyFarkleToBank(
          { consecutiveFarkles: player.consecutiveFarkles, bankedTotal: player.total },
          ruleset,
        );
        player.consecutiveFarkles = outcome.consecutiveFarkles;
        player.total = outcome.bankedTotal;
        player.farkles += 1;
        log.push({
          type: 'farkled',
          playerId: player.id,
          pointsLost: state.turnScore,
          penaltyApplied: outcome.penaltyApplied,
        });
        return;
      } else if (state.phase === 'awaiting-selection') {
        const before = state;
        const selection = chooseStrategySelection(
          state.roll!,
          ruleset,
          config.players[seat]!.strategy.keepPolicy,
          {
            turnScoreBeforeSelection: state.turnScore,
            scoreDifferential: player.total - bestOther,
            hotDiceStreak: state.hotDiceStreak,
          },
        );
        state = applySelection(state, selection, ruleset);
        log.push({
          type: 'selected',
          playerId: player.id,
          dice: selection,
          score: state.turnScore - before.turnScore,
          turnScore: state.turnScore,
          hotDice: state.hotDiceStreak > before.hotDiceStreak,
        });
      } else {
        // awaiting-decision
        const wantsBank =
          evaluateBankPolicy(config.players[seat]!.strategy.bankPolicy, {
            turnScore: state.turnScore,
            diceRemaining: state.diceToRoll,
            scoreDifferential: player.total - bestOther,
            hotDiceStreak: state.hotDiceStreak,
          }) === 'bank';
        const context = { onTheBoard: player.onTheBoard };
        if (wantsBank && canBank(state, context, ruleset)) {
          state = bank(state, context, ruleset);
          player.total += state.turnScore;
          player.onTheBoard =
            player.onTheBoard ||
            !ruleset.onTheBoardEnabled ||
            state.turnScore >= ruleset.onTheBoardMinimum;
          player.consecutiveFarkles = 0;
          log.push({
            type: 'banked',
            playerId: player.id,
            pointsAdded: state.turnScore,
            newTotal: player.total,
            onTheBoard: player.onTheBoard,
          });
          return;
        }
        log.push({
          type: 'decision',
          playerId: player.id,
          decision: 'roll',
          diceToRoll: state.diceToRoll,
        });
        state = chooseRoll(state);
      }
    }
  }

  const placements = [...players]
    .map((p, seat) => ({ id: p.id, total: p.total, seat }))
    .sort((a, b) => b.total - a.total || a.seat - b.seat)
    .map((p) => p.id);
  const finalScores = Object.fromEntries(players.map((p) => [p.id, p.total]));
  const winnerId = finished ? placements[0]! : null;

  log.push({ type: 'game-ended', winnerId, finalScores, placements });

  return {
    finished,
    winnerId,
    finalScores,
    placements,
    turnsTaken: Object.fromEntries(players.map((p) => [p.id, p.turns])),
    farkleCounts: Object.fromEntries(players.map((p) => [p.id, p.farkles])),
    log,
  };
}
