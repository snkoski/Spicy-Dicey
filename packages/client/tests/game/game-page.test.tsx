import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_RULESET, type DieValue, type RandomSource } from '@spicy-dicey/core-engine';
import { GamePage } from '../../src/features/game/GamePage';
import { useHotSeatStore } from '../../src/features/game/store';

const dealer = (faces: DieValue[]): RandomSource => {
  let i = 0;
  return { next: () => ((faces[i++] ?? 1) - 0.5) / 6 };
};

const rules = {
  ...DEFAULT_RULESET,
  onTheBoardEnabled: false,
  targetScore: 1000,
  endGameVariant: 'instant' as const,
};

describe('GamePage', () => {
  beforeEach(() => useHotSeatStore.getState().reset());

  it('shows the setup form first and starts a game from it', () => {
    render(<GamePage />);
    fireEvent.change(screen.getByLabelText(/player 1/i), { target: { value: 'Ann' } });
    fireEvent.change(screen.getByLabelText(/player 2/i), { target: { value: 'Ben' } });
    fireEvent.click(screen.getByRole('button', { name: /start game/i }));
    expect(screen.getByRole('button', { name: /^roll$/i })).toBeDefined();
    expect(screen.getAllByText(/ann/i).length).toBeGreaterThan(0);
  });

  it('plays a winning turn: roll, tap dice, keep, bank', () => {
    useHotSeatStore.getState().startGame(['Ann', 'Ben'], rules, dealer([1, 1, 1, 2, 3, 4]));
    render(<GamePage />);

    fireEvent.click(screen.getByRole('button', { name: /^roll$/i }));
    const dice = screen.getAllByRole('button', { name: /die showing/i });
    expect(dice).toHaveLength(6);

    fireEvent.click(dice[0]!);
    fireEvent.click(dice[1]!);
    fireEvent.click(dice[2]!);
    expect(screen.getByText(/selection: 1000/i)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /keep selection/i }));
    fireEvent.click(screen.getByRole('button', { name: /^bank/i }));

    expect(screen.getByText(/game over — ann wins/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /play again/i })).toBeDefined();
  });

  it('disables keeping while the tapped set is illegal', () => {
    useHotSeatStore.getState().startGame(['Ann', 'Ben'], rules, dealer([1, 2, 3, 4, 6, 6]));
    render(<GamePage />);
    fireEvent.click(screen.getByRole('button', { name: /^roll$/i }));
    fireEvent.click(screen.getAllByRole('button', { name: /die showing/i })[1]!); // the 2
    expect(screen.getByRole('button', { name: /keep selection/i })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('shows the farkle banner and passes the turn', () => {
    useHotSeatStore.getState().startGame(['Ann', 'Ben'], rules, dealer([2, 3, 4, 6, 6, 2]));
    render(<GamePage />);
    fireEvent.click(screen.getByRole('button', { name: /^roll$/i }));
    expect(screen.getByText(/farkle!/i)).toBeDefined();
    expect(screen.getByText(/ben.*turn/i)).toBeDefined();
  });

  it('gates the bank button by the on-the-board minimum', () => {
    useHotSeatStore
      .getState()
      .startGame(['Ann', 'Ben'], { ...rules, onTheBoardEnabled: true }, dealer([1, 5, 2, 3, 4, 6]));
    render(<GamePage />);
    fireEvent.click(screen.getByRole('button', { name: /^roll$/i }));
    const dice = screen.getAllByRole('button', { name: /die showing/i });
    fireEvent.click(dice[0]!); // 100 points — below the 500 minimum
    fireEvent.click(screen.getByRole('button', { name: /keep selection/i }));
    expect(screen.getByRole('button', { name: /^bank/i })).toHaveProperty('disabled', true);
  });

  it('the dice mode toggle flips without touching the match state', () => {
    useHotSeatStore.getState().startGame(['Ann', 'Ben'], rules, dealer([1, 5, 2, 3, 4, 6]));
    render(<GamePage />);
    fireEvent.click(screen.getByRole('button', { name: /^roll$/i }));
    const before = useHotSeatStore.getState().match;
    fireEvent.click(screen.getByRole('checkbox', { name: /3d dice/i }));
    expect(useHotSeatStore.getState().match).toBe(before);
    // dice still visible and correct
    expect(screen.getAllByRole('button', { name: /die showing/i })).toHaveLength(6);
  });
});
