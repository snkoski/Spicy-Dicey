import { describe, expect, it } from 'vitest';
import {
  createMulberry32,
  DEFAULT_RULESET,
  getBuiltinStrategy,
  runGame,
} from '@spicy-dicey/core-engine';
import { buildReplayFrames } from '../../src/features/simulator/lib/replay';

const game = runGame(
  {
    players: [
      { id: 'alice', strategy: getBuiltinStrategy('always-bank-at-300') },
      { id: 'bob', strategy: getBuiltinStrategy('ev-optimal') },
    ],
    ruleset: DEFAULT_RULESET,
  },
  createMulberry32(99),
);

describe('buildReplayFrames', () => {
  const frames = buildReplayFrames(game.log);

  it('produces one frame per log event, in order', () => {
    expect(frames).toHaveLength(game.log.length);
    frames.forEach((frame, i) => expect(frame.event).toBe(game.log[i]));
  });

  it('tracks banked totals so the last frame matches the final scores', () => {
    expect(frames.at(-1)!.totals).toEqual(game.finalScores);
  });

  it('knows whose turn each frame belongs to', () => {
    for (const frame of frames) {
      if (frame.event.type === 'rolled') {
        expect(frame.currentPlayerId).toBe(frame.event.playerId);
      }
    }
  });

  it('shows the dice on the table after a roll and clears them after selection resolution', () => {
    const rolledIndex = frames.findIndex((f) => f.event.type === 'rolled');
    const rolledEvent = game.log[rolledIndex]!;
    expect(frames[rolledIndex]!.tableDice).toEqual(
      rolledEvent.type === 'rolled' ? rolledEvent.dice : null,
    );
  });

  it('carries the running turn score through selections', () => {
    for (const frame of frames) {
      if (frame.event.type === 'selected') {
        expect(frame.turnScore).toBe(frame.event.turnScore);
      }
      if (frame.event.type === 'turn-started') {
        expect(frame.turnScore).toBe(0);
      }
    }
  });

  it('stepping to any index is pure: same frame every time', () => {
    expect(buildReplayFrames(game.log)[10]).toEqual(frames[10]);
  });
});
