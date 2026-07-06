import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { SimulatorPage } from '../../src/features/simulator/SimulatorPage';
import { runSimulation } from '../../src/features/simulator/lib/run-simulation';
import type { SimRunner } from '../../src/features/simulator/SimulatorPage';

// Synchronous stand-in for the worker: same function the worker itself runs.
const syncRunner: SimRunner = (config, onProgress) =>
  Promise.resolve(runSimulation(config, onProgress));

async function runBasicSim() {
  fireEvent.click(screen.getByRole('checkbox', { name: /always bank at 300/i }));
  fireEvent.click(screen.getByRole('checkbox', { name: /ev-optimal/i }));
  fireEvent.change(screen.getByLabelText(/games/i), { target: { value: '25' } });
  fireEvent.change(screen.getByLabelText(/seed/i), { target: { value: '5' } });
  fireEvent.click(screen.getByRole('button', { name: /run simulation/i }));
  await waitFor(() => screen.getByRole('table'));
}

describe('SimulatorPage', () => {
  beforeEach(() => localStorage.clear());

  it('runs a simulation and renders per-strategy results', async () => {
    render(<SimulatorPage runner={syncRunner} />);
    await runBasicSim();

    const table = screen.getByRole('table');
    expect(table.textContent).toContain('always-bank-at-300');
    expect(table.textContent).toContain('ev-optimal');
    expect(table.textContent).toMatch(/25/); // games played
  });

  it('same seed reproduces identical displayed results', async () => {
    const { unmount } = render(<SimulatorPage runner={syncRunner} />);
    await runBasicSim();
    const first = screen.getByRole('table').textContent;
    unmount();

    render(<SimulatorPage runner={syncRunner} />);
    await runBasicSim();
    expect(screen.getByRole('table').textContent).toBe(first);
  });

  it('needs at least two strategies before running', () => {
    render(<SimulatorPage runner={syncRunner} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /greedy/i }));
    expect(screen.getByRole('button', { name: /run simulation/i })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('steps through the sample game replay forward and back', async () => {
    render(<SimulatorPage runner={syncRunner} />);
    await runBasicSim();

    fireEvent.click(screen.getByRole('button', { name: /replay sample game/i }));
    const indicator = () => screen.getByTestId('replay-step').textContent;
    expect(indicator()).toMatch(/^1 \//);
    fireEvent.click(screen.getByRole('button', { name: /next step/i }));
    fireEvent.click(screen.getByRole('button', { name: /next step/i }));
    expect(indicator()).toMatch(/^3 \//);
    fireEvent.click(screen.getByRole('button', { name: /previous step/i }));
    expect(indicator()).toMatch(/^2 \//);
  });

  it('offers CSV and JSON export once results exist', async () => {
    render(<SimulatorPage runner={syncRunner} />);
    await runBasicSim();
    expect(screen.getByRole('button', { name: /export csv/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /export json/i })).toBeDefined();
  });
});
