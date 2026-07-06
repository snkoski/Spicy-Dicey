import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createMulberry32 } from '../../src/rng/mulberry32.js';
import { rollDice } from '../../src/dice/roll.js';
import { DEFAULT_RULESET } from '../../src/ruleset/defaults.js';
import { enumerateLegalSelections } from '../../src/scoring/enumerate.js';
import { applyRoll, applySelection, chooseRoll, startTurn } from '../../src/turn/turn.js';

const NUM_RUNS = Number(process.env['FC_NUM_RUNS'] ?? 2000);

describe('turn properties (fast-check)', { timeout: 300_000 }, () => {
  it('the turn score is always the exact sum of the kept selections (disjoint selections sum)', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer({ min: 0, max: 1000 }), (seed, pickSalt) => {
        const rng = createMulberry32(seed);
        let state = startTurn();
        let expectedSum = 0;

        // Walk one full turn, always choosing to keep rolling until it ends.
        for (let step = 0; step < 20 && state.phase !== 'farkled'; step += 1) {
          if (state.phase === 'awaiting-roll') {
            state = applyRoll(state, rollDice(rng, state.diceToRoll), DEFAULT_RULESET);
          } else if (state.phase === 'awaiting-selection') {
            const options = enumerateLegalSelections(state.roll!, DEFAULT_RULESET);
            const pick = options[(pickSalt + step) % options.length]!;
            expectedSum += pick.score;
            state = applySelection(state, pick.dice, DEFAULT_RULESET);
            expect(state.turnScore).toBe(expectedSum);
          } else {
            state = chooseRoll(state);
          }
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
