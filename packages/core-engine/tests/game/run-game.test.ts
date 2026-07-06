import { describe, expect, it } from 'vitest';
import { createMulberry32 } from '../../src/rng/mulberry32.js';
import { DEFAULT_RULESET } from '../../src/ruleset/defaults.js';
import { getBuiltinStrategy } from '../../src/strategy/builtins.js';
import { runGame } from '../../src/game/run-game.js';
import type { GameConfig } from '../../src/game/types.js';

const twoPlayers = (rulesetOverrides = {}): GameConfig => ({
  players: [
    { id: 'alice', strategy: getBuiltinStrategy('always-bank-at-300') },
    { id: 'bob', strategy: getBuiltinStrategy('ev-optimal') },
  ],
  ruleset: { ...DEFAULT_RULESET, ...rulesetOverrides },
});

describe('runGame', () => {
  it('plays a full game to completion and declares the top scorer the winner', () => {
    const result = runGame(twoPlayers(), createMulberry32(7));
    expect(result.finished).toBe(true);
    expect(['alice', 'bob']).toContain(result.winnerId);
    expect(result.placements[0]).toBe(result.winnerId);
    const scores = Object.values(result.finalScores);
    expect(Math.max(...scores)).toBeGreaterThanOrEqual(DEFAULT_RULESET.targetScore);
    expect(result.finalScores[result.winnerId!]).toBe(Math.max(...scores));
  });

  it(
    'is byte-identical across 1000 runs for the same (seed, ruleset, strategies)',
    { timeout: 120_000 }, // 1000 full games outrun the 5s default on slow CI runners
    () => {
      const reference = JSON.stringify(runGame(twoPlayers(), createMulberry32(123)));
      for (let i = 0; i < 1000; i += 1) {
        expect(JSON.stringify(runGame(twoPlayers(), createMulberry32(123)))).toBe(reference);
      }
    },
  );

  it('different seeds produce different games', () => {
    const a = JSON.stringify(runGame(twoPlayers(), createMulberry32(1)).log);
    const b = JSON.stringify(runGame(twoPlayers(), createMulberry32(2)).log);
    expect(a).not.toBe(b);
  });

  it('instant variant: the game ends the moment a bank reaches the target', () => {
    const result = runGame(twoPlayers({ endGameVariant: 'instant' }), createMulberry32(11));
    const events = result.log;
    const winningBank = events.findIndex(
      (e) => e.type === 'banked' && e.newTotal >= DEFAULT_RULESET.targetScore,
    );
    expect(winningBank).toBeGreaterThan(-1);
    // nothing but game-ended after the winning bank
    expect(events.slice(winningBank + 1).map((e) => e.type)).toEqual(['game-ended']);
  });

  it('final-round variant: every other player gets exactly one more turn', () => {
    const result = runGame(twoPlayers({ endGameVariant: 'final-round' }), createMulberry32(11));
    const events = result.log;
    const trigger = events.findIndex((e) => e.type === 'final-round-triggered');
    expect(trigger).toBeGreaterThan(-1);
    const turnsAfter = events.slice(trigger + 1).filter((e) => e.type === 'turn-started');
    expect(turnsAfter).toHaveLength(1); // 2 players -> 1 final turn
    // the winner is whoever ends highest, not necessarily the trigger
    const scores = result.finalScores;
    expect(result.finalScores[result.winnerId!]).toBe(Math.max(...Object.values(scores)));
  });

  it('greedy vs greedy never finishes and trips the maxTurns valve', () => {
    const config: GameConfig = {
      players: [
        { id: 'g1', strategy: getBuiltinStrategy('greedy') },
        { id: 'g2', strategy: getBuiltinStrategy('greedy') },
      ],
      ruleset: DEFAULT_RULESET,
      maxTurnsPerPlayer: 50,
    };
    const result = runGame(config, createMulberry32(5));
    expect(result.finished).toBe(false);
    expect(result.winnerId).toBeNull();
    expect(result.finalScores).toEqual({ g1: 0, g2: 0 });
  });

  it('the log replays to the final scores (banked points minus penalties)', () => {
    for (const seed of [3, 17, 99]) {
      const result = runGame(
        twoPlayers({ farklePenaltyVariant: 'three-consecutive-penalty' }),
        createMulberry32(seed),
      );
      const replayed: Record<string, number> = { alice: 0, bob: 0 };
      for (const event of result.log) {
        if (event.type === 'banked') {
          replayed[event.playerId] = event.newTotal;
        } else if (event.type === 'farkled' && event.penaltyApplied > 0) {
          replayed[event.playerId]! -= event.penaltyApplied;
        }
      }
      expect(replayed).toEqual(result.finalScores);
    }
  });

  it('counts turns and farkles per player from the log', () => {
    const result = runGame(twoPlayers(), createMulberry32(21));
    for (const id of ['alice', 'bob']) {
      expect(result.turnsTaken[id]).toBe(
        result.log.filter((e) => e.type === 'turn-started' && e.playerId === id).length,
      );
      expect(result.farkleCounts[id]).toBe(
        result.log.filter((e) => e.type === 'farkled' && e.playerId === id).length,
      );
    }
  });

  it('rejects fewer than two players', () => {
    expect(() =>
      runGame(
        {
          players: [{ id: 'solo', strategy: getBuiltinStrategy('greedy') }],
          ruleset: DEFAULT_RULESET,
        },
        createMulberry32(1),
      ),
    ).toThrow(/players/i);
  });
});
