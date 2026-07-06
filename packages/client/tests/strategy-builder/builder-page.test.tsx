import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { BuilderPage } from '../../src/features/strategy-builder/BuilderPage';
import { listCustomStrategies } from '../../src/features/strategy-builder/lib/storage';

describe('BuilderPage', () => {
  beforeEach(() => localStorage.clear());

  it('builds and saves a bank rule with a threshold condition', () => {
    render(<BuilderPage />);

    fireEvent.change(screen.getByLabelText(/strategy name/i), {
      target: { value: 'Bank Early' },
    });

    fireEvent.click(screen.getByRole('button', { name: /add bank rule/i }));
    fireEvent.click(screen.getByRole('button', { name: /add condition/i }));

    // defaults: subject turnScore, cmp gte; set the threshold and action
    fireEvent.change(screen.getByLabelText(/value/i), { target: { value: '250' } });
    fireEvent.change(screen.getByLabelText(/action/i), { target: { value: 'bank' } });

    fireEvent.click(screen.getByRole('button', { name: /save strategy/i }));

    const saved = listCustomStrategies();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      id: 'custom-bank-early',
      name: 'Bank Early',
      bankPolicy: [
        {
          condition: { type: 'comparison', subject: 'turnScore', cmp: 'gte', value: 250 },
          action: 'bank',
        },
      ],
      keepPolicy: [],
    });
  });

  it('refuses to save without a name', () => {
    render(<BuilderPage />);
    fireEvent.click(screen.getByRole('button', { name: /save strategy/i }));
    expect(listCustomStrategies()).toEqual([]);
    expect(screen.getByText(/name is required/i)).toBeDefined();
  });

  it('supports reordering rules (first match wins)', () => {
    render(<BuilderPage />);
    fireEvent.change(screen.getByLabelText(/strategy name/i), { target: { value: 'Two Rules' } });

    fireEvent.click(screen.getByRole('button', { name: /add bank rule/i }));
    fireEvent.click(screen.getByRole('button', { name: /add bank rule/i }));

    const actions = screen.getAllByLabelText(/action/i);
    fireEvent.change(actions[0]!, { target: { value: 'bank' } });
    fireEvent.change(actions[1]!, { target: { value: 'roll' } });

    // move the second rule up via its keyboard-accessible button
    fireEvent.click(screen.getAllByRole('button', { name: /move rule up/i })[1]!);
    fireEvent.click(screen.getByRole('button', { name: /save strategy/i }));

    const saved = listCustomStrategies()[0]!;
    expect(saved.bankPolicy.map((r) => r.action)).toEqual(['roll', 'bank']);
  });
});
