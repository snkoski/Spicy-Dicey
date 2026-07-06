import { describe, expect, it } from 'vitest';
import { DEFAULT_RULESET } from '@spicy-dicey/core-engine';
import {
  chatMessageSchema,
  chatSendSchema,
  roomCreateSchema,
  roomJoinSchema,
  rulesetConfigSchema,
  turnSelectSchema,
} from '../src/index.js';

describe('rulesetConfigSchema', () => {
  it('accepts the engine default ruleset verbatim', () => {
    expect(rulesetConfigSchema.parse(DEFAULT_RULESET)).toEqual(DEFAULT_RULESET);
  });

  it('rejects out-of-domain values', () => {
    expect(
      rulesetConfigSchema.safeParse({ ...DEFAULT_RULESET, nOfAKindScaling: 'tripling' }).success,
    ).toBe(false);
    expect(rulesetConfigSchema.safeParse({ ...DEFAULT_RULESET, targetScore: -5 }).success).toBe(
      false,
    );
  });
});

describe('room payloads', () => {
  it('room:create validates config, player cap, and timer choices (decision 4)', () => {
    const good = {
      rulesetConfig: DEFAULT_RULESET,
      maxPlayers: 4,
      turnTimerSec: 60,
      spectatorChatEnabled: true,
      displayName: 'Ann',
    };
    expect(roomCreateSchema.parse(good)).toEqual(good);
    expect(roomCreateSchema.safeParse({ ...good, maxPlayers: 9 }).success).toBe(false);
    expect(roomCreateSchema.safeParse({ ...good, maxPlayers: 1 }).success).toBe(false);
    expect(roomCreateSchema.safeParse({ ...good, turnTimerSec: 45 }).success).toBe(false);
    // off = null
    expect(roomCreateSchema.parse({ ...good, turnTimerSec: null }).turnTimerSec).toBeNull();
  });

  it('room:join validates the code shape', () => {
    expect(roomJoinSchema.parse({ roomCode: 'ABCD42', displayName: 'Ben' })).toMatchObject({
      roomCode: 'ABCD42',
      asSpectator: false,
    });
    expect(roomJoinSchema.safeParse({ roomCode: 'ab', displayName: 'Ben' }).success).toBe(false);
  });
});

describe('turn payloads', () => {
  it('turn:select carries dice indices only — clients never send dice values', () => {
    expect(turnSelectSchema.parse({ diceIndices: [0, 2, 5] })).toEqual({ diceIndices: [0, 2, 5] });
    expect(turnSelectSchema.safeParse({ diceIndices: [] }).success).toBe(false);
    expect(turnSelectSchema.safeParse({ diceIndices: [6] }).success).toBe(false);
    expect(turnSelectSchema.safeParse({ diceValues: [1, 5] }).success).toBe(false);
  });
});

describe('chat payloads (moderation-ready — plan §4)', () => {
  it('chat:send is bounded text', () => {
    expect(chatSendSchema.parse({ text: 'hello' })).toEqual({ text: 'hello' });
    expect(chatSendSchema.safeParse({ text: '' }).success).toBe(false);
    expect(chatSendSchema.safeParse({ text: 'x'.repeat(501) }).success).toBe(false);
  });

  it('chat:message carries id, sender, timestamp, and filtered flag', () => {
    const message = {
      messageId: 'm-1',
      senderId: 'guest-1',
      displayName: 'Ann',
      text: 'gg',
      ts: 1751846400000,
      filtered: false,
    };
    expect(chatMessageSchema.parse(message)).toEqual(message);
    expect(chatMessageSchema.safeParse({ ...message, filtered: undefined }).success).toBe(false);
  });
});
