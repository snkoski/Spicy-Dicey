import { create } from 'zustand';
import {
  createCryptoRandom,
  matchCanBank,
  matchDecide,
  matchRoll,
  matchSelect,
  rollDice,
  scoreSelection,
  startMatch,
  type DieValue,
  type GameLogEvent,
  type MatchState,
  type RandomSource,
  type RulesetConfig,
} from '@spicy-dicey/core-engine';

/**
 * Hot-seat orchestration only: every rule decision comes from the engine's
 * match reducer. Player display names double as player ids (seat-unique).
 */
interface HotSeatState {
  match: MatchState | null;
  rng: RandomSource;
  /** Indices into the current roll the active player has tapped. */
  selectedIndices: number[];
  /** Max-interpretation score of the tapped dice, or null if illegal. */
  selectionScore: number | null;
  lastBanner: string | null;
  log: GameLogEvent[];
  currentPlayerName: string | null;

  startGame(names: string[], ruleset: RulesetConfig, rng?: RandomSource): void;
  roll(): void;
  rollAgain(): void;
  toggleDie(index: number): void;
  confirmSelection(): void;
  bank(): void;
  canBankNow(): boolean;
  reset(): void;
}

export const useHotSeatStore = create<HotSeatState>((set, get) => {
  const applyTransition = (transition: { state: MatchState; events: GameLogEvent[] }) => {
    const banner = bannerFor(transition.events);
    set((prev) => ({
      match: transition.state,
      log: [...prev.log, ...transition.events],
      selectedIndices: [],
      selectionScore: null,
      ...(banner !== undefined ? { lastBanner: banner } : {}),
      currentPlayerName: transition.state.players[transition.state.currentSeat]!.id,
    }));
  };

  return {
    match: null,
    rng: createCryptoRandom(),
    selectedIndices: [],
    selectionScore: null,
    lastBanner: null,
    log: [],
    currentPlayerName: null,

    startGame(names, ruleset, rng = createCryptoRandom()) {
      const transition = startMatch({ playerIds: names, ruleset });
      set({ rng, log: [], lastBanner: null });
      applyTransition(transition);
    },

    roll() {
      const { match, rng } = get();
      applyTransition(matchRoll(match!, rollDice(rng, match!.turn.diceToRoll)));
    },

    rollAgain() {
      const { match, rng } = get();
      const decided = matchDecide(match!, 'roll');
      const rolled = matchRoll(decided.state, rollDice(rng, decided.state.turn.diceToRoll));
      applyTransition({ state: rolled.state, events: [...decided.events, ...rolled.events] });
    },

    toggleDie(index) {
      const { match, selectedIndices } = get();
      const roll = match?.turn.roll;
      if (!roll || index < 0 || index >= roll.length) {
        return;
      }
      const next = selectedIndices.includes(index)
        ? selectedIndices.filter((i) => i !== index)
        : [...selectedIndices, index];
      const dice = next.map((i) => roll[i]!);
      set({
        selectedIndices: next,
        selectionScore: dice.length === 0 ? null : scoreSelection(dice, match.ruleset),
      });
    },

    confirmSelection() {
      const { match, selectedIndices } = get();
      const dice = selectedIndices.map((i) => match!.turn.roll![i]!) as DieValue[];
      applyTransition(matchSelect(match!, dice));
    },

    bank() {
      applyTransition(matchDecide(get().match!, 'bank'));
    },

    canBankNow() {
      const { match } = get();
      return match !== null && matchCanBank(match);
    },

    reset() {
      set({
        match: null,
        rng: createCryptoRandom(),
        selectedIndices: [],
        selectionScore: null,
        lastBanner: null,
        log: [],
        currentPlayerName: null,
      });
    },
  };
});

/** Human-facing banner for the most notable event of a transition. */
function bannerFor(events: GameLogEvent[]): string | undefined {
  for (const event of [...events].reverse()) {
    switch (event.type) {
      case 'game-ended':
        return `Game over — ${event.winnerId ?? 'nobody'} wins!`;
      case 'final-round-triggered':
        return `${event.playerId} triggered the final round!`;
      case 'farkled':
        return `Farkle! ${event.playerId} loses ${event.pointsLost}${
          event.penaltyApplied ? ` and a ${event.penaltyApplied} penalty` : ''
        }.`;
      default:
        break;
    }
    if (event.type === 'selected' && event.hotDice) {
      return `Hot dice! ${event.playerId} rolls all six again.`;
    }
  }
  return undefined;
}
