import { create } from 'zustand';

export type DiceMode = '2d' | '3d';

/**
 * prefers-reduced-motion auto-selects 2D (plan §1 Phase 3); the user can
 * override manually at any time — including mid-turn, since rendering mode
 * lives entirely outside match state.
 */
function defaultMode(): DiceMode {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return '2d';
    }
  }
  return '3d';
}

interface DiceSettings {
  mode: DiceMode;
  setMode(mode: DiceMode): void;
}

export const useDiceSettings = create<DiceSettings>((set) => ({
  mode: defaultMode(),
  setMode: (mode) => set({ mode }),
}));
