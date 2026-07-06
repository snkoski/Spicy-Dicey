import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_RULESET, type DieValue, type RandomSource } from '@spicy-dicey/core-engine';
import { useHotSeatStore } from '../../src/features/game/store';

/** RandomSource that deals exact die faces in order. */
const dealer = (faces: DieValue[]): RandomSource => {
  let i = 0;
  return {
    next: () => {
      const face = faces[i++];
      if (face === undefined) {
        throw new Error('dealer ran out of faces');
      }
      return (face - 0.5) / 6;
    },
  };
};

const rules = (overrides = {}) => ({
  ...DEFAULT_RULESET,
  onTheBoardEnabled: false,
  targetScore: 1000,
  endGameVariant: 'instant' as const,
  ...overrides,
});

describe('useHotSeatStore', () => {
  beforeEach(() => useHotSeatStore.getState().reset());

  it('plays a full two-player game to a win', () => {
    const store = useHotSeatStore.getState();
    store.startGame(['Ann', 'Ben'], rules(), dealer([1, 1, 1, 2, 3, 4]));

    let s = useHotSeatStore.getState();
    expect(s.match!.status).toBe('active');
    expect(s.currentPlayerName).toBe('Ann');

    s.roll();
    s = useHotSeatStore.getState();
    expect(s.match!.turn.roll).toEqual([1, 1, 1, 2, 3, 4]);

    // tap the three 1s
    s.toggleDie(0);
    s.toggleDie(1);
    s.toggleDie(2);
    s = useHotSeatStore.getState();
    expect(s.selectionScore).toBe(1000);

    s.confirmSelection();
    s = useHotSeatStore.getState();
    expect(s.match!.turn.turnScore).toBe(1000);

    s.bank();
    s = useHotSeatStore.getState();
    expect(s.match!.status).toBe('ended');
    expect(s.match!.winnerId).toBe('Ann');
  });

  it('an illegal tap set cannot be confirmed', () => {
    const store = useHotSeatStore.getState();
    store.startGame(['Ann', 'Ben'], rules(), dealer([1, 2, 3, 4, 6, 6]));
    store.roll();
    useHotSeatStore.getState().toggleDie(1); // the 2 — not scoring
    const s = useHotSeatStore.getState();
    expect(s.selectionScore).toBeNull();
    expect(() => s.confirmSelection()).toThrow();
  });

  it('a farkle advances to the next player and surfaces a banner', () => {
    const store = useHotSeatStore.getState();
    store.startGame(['Ann', 'Ben'], rules(), dealer([2, 3, 4, 6, 6, 2]));
    store.roll();
    const s = useHotSeatStore.getState();
    expect(s.lastBanner).toMatch(/farkle/i);
    expect(s.currentPlayerName).toBe('Ben');
  });

  it('hot dice keeps the turn going with six fresh dice', () => {
    const store = useHotSeatStore.getState();
    store.startGame(['Ann', 'Ben'], rules(), dealer([2, 2, 2, 3, 3, 3]));
    store.roll();
    [0, 1, 2, 3, 4, 5].forEach((i) => useHotSeatStore.getState().toggleDie(i));
    useHotSeatStore.getState().confirmSelection();
    const s = useHotSeatStore.getState();
    expect(s.lastBanner).toMatch(/hot dice/i);
    expect(s.match!.turn.diceToRoll).toBe(6);
    expect(s.match!.turn.turnScore).toBe(2500);
  });

  it('rolling again after a partial keep uses the remaining dice', () => {
    const store = useHotSeatStore.getState();
    store.startGame(['Ann', 'Ben'], rules(), dealer([1, 5, 2, 3, 4, 6, 5, 5, 5, 2]));
    store.roll();
    useHotSeatStore.getState().toggleDie(0); // keep the 1
    useHotSeatStore.getState().toggleDie(1); // and the 5
    useHotSeatStore.getState().confirmSelection();
    useHotSeatStore.getState().rollAgain();
    const s = useHotSeatStore.getState();
    expect(s.match!.turn.roll).toEqual([5, 5, 5, 2]);
  });

  it('final-round variant lets the second player answer', () => {
    const store = useHotSeatStore.getState();
    store.startGame(
      ['Ann', 'Ben'],
      rules({ endGameVariant: 'final-round' }),
      dealer([1, 1, 1, 2, 3, 4, 2, 3, 4, 6, 6, 2]),
    );
    store.roll();
    [0, 1, 2].forEach((i) => useHotSeatStore.getState().toggleDie(i));
    useHotSeatStore.getState().confirmSelection();
    useHotSeatStore.getState().bank(); // Ann hits 1000 -> final round
    let s = useHotSeatStore.getState();
    expect(s.lastBanner).toMatch(/final round/i);
    expect(s.match!.status).toBe('active');
    expect(s.currentPlayerName).toBe('Ben');

    s.roll(); // Ben farkles -> game over
    s = useHotSeatStore.getState();
    expect(s.match!.status).toBe('ended');
    expect(s.match!.winnerId).toBe('Ann');
  });

  it('supports up to eight seats', () => {
    const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    useHotSeatStore.getState().startGame(names, rules(), dealer([2, 3, 4, 6, 6, 2]));
    expect(useHotSeatStore.getState().match!.players).toHaveLength(8);
  });
});
