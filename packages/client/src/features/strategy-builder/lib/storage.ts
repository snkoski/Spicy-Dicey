import { strategyDefinitionSchema, type StrategyDefinitionInput } from '@spicy-dicey/contracts';
import { z } from 'zod';

/**
 * Pre-account persistence for custom strategies (Phase 5 moves this to the
 * API; the stored shape is already the shared contract schema).
 */
const STORAGE_KEY = 'spicy-dicey.custom-strategies';

const storedSchema = z.array(strategyDefinitionSchema);

export function listCustomStrategies(): StrategyDefinitionInput[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) {
    return [];
  }
  try {
    return storedSchema.parse(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveCustomStrategy(strategy: StrategyDefinitionInput): void {
  const validated = strategyDefinitionSchema.parse(strategy);
  const others = listCustomStrategies().filter((s) => s.id !== validated.id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...others, validated]));
}

export function deleteCustomStrategy(id: string): void {
  const remaining = listCustomStrategies().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
}
