import { describe, expect, it } from 'vitest';
import { createChatFilter } from '../src/chat/filter.js';

describe('createChatFilter', () => {
  const filter = createChatFilter();

  it('passes clean text through untouched', () => {
    expect(filter.apply('nice roll!')).toEqual({ text: 'nice roll!', filtered: false });
  });

  it('censors profanity and flags the message', () => {
    const result = filter.apply('that was fucking lucky');
    expect(result.filtered).toBe(true);
    expect(result.text).not.toContain('fucking');
  });

  it('catches basic obfuscation', () => {
    const result = filter.apply('sh1t happens');
    expect(result.filtered).toBe(true);
    expect(result.text.toLowerCase()).not.toContain('sh1t');
  });
});
