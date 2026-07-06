import {
  RegExpMatcher,
  TextCensor,
  englishDataset,
  englishRecommendedTransformers,
} from 'obscenity';

export interface ChatFilter {
  apply(text: string): { text: string; filtered: boolean };
}

/**
 * Obfuscation-aware English profanity filter (decision 12), kept behind
 * this interface so lists/locales can be swapped without touching the
 * socket contract.
 */
export function createChatFilter(): ChatFilter {
  const matcher = new RegExpMatcher({
    ...englishDataset.build(),
    ...englishRecommendedTransformers,
  });
  const censor = new TextCensor();
  return {
    apply(text) {
      const matches = matcher.getAllMatches(text);
      if (matches.length === 0) {
        return { text, filtered: false };
      }
      return { text: censor.applyTo(text, matches), filtered: true };
    },
  };
}
