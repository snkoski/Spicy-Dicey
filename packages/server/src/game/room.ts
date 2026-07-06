import { randomUUID } from 'node:crypto';
import {
  matchCanBank,
  matchDecide,
  matchForfeit,
  matchRoll,
  matchSelect,
  rollDice,
  startMatch,
  type DieValue,
  type GameLogEvent,
  type MatchState,
  type MatchTransition,
  type RandomSource,
} from '@spicy-dicey/core-engine';
import type { ChatMessage, RoomCreateInput } from '@spicy-dicey/contracts';
import { createChatFilter, type ChatFilter } from '../chat/filter.js';

export const DISCONNECT_GRACE_MS = 90_000; // decision 5

/** How a room reaches its clients — the socket layer implements this. */
export interface RoomOutbox {
  broadcast(event: string, payload: unknown): void;
  toIdentity(identity: string, event: string, payload: unknown): void;
}

interface RoomMember {
  identity: string;
  displayName: string;
  role: 'player' | 'spectator';
  connected: boolean;
  graceTimer: NodeJS.Timeout | null;
}

interface RoomDeps {
  rng: RandomSource;
  chatFilter?: ChatFilter;
  now?: () => number;
}

/**
 * One live room: membership, chat, and the authoritative game — a MatchState
 * advanced only by the shared engine reducer, rolled only from the injected
 * server RNG (CSPRNG in production, seeded in tests). Handlers stay thin;
 * everything stateful happens here.
 */
export class Room {
  readonly code: string;
  readonly hostIdentity: string;
  readonly config: RoomCreateInput;
  private readonly outbox: RoomOutbox;
  private readonly rng: RandomSource;
  private readonly chatFilter: ChatFilter;
  private readonly now: () => number;
  private readonly members = new Map<string, RoomMember>();
  private match: MatchState | null = null;
  private turnTimer: NodeJS.Timeout | null = null;
  private turnDeadline: number | null = null;

  constructor(
    code: string,
    hostIdentity: string,
    config: RoomCreateInput,
    outbox: RoomOutbox,
    deps: RoomDeps,
  ) {
    this.code = code;
    this.hostIdentity = hostIdentity;
    this.config = config;
    this.outbox = outbox;
    this.rng = deps.rng;
    this.chatFilter = deps.chatFilter ?? createChatFilter();
    this.now = deps.now ?? Date.now;
  }

  /** Current turn phase, for thin handlers routing roll vs roll-again. */
  currentPhase(): string | null {
    return this.match?.turn.phase ?? null;
  }

  get status(): 'lobby' | 'active' | 'ended' {
    if (this.match === null) {
      return 'lobby';
    }
    return this.match.status === 'active' ? 'active' : 'ended';
  }

  join(identity: string, displayName: string, asSpectator: boolean): void {
    const existing = this.members.get(identity);
    if (existing) {
      this.onReconnect(identity);
      return;
    }
    if (!asSpectator) {
      if (this.match !== null) {
        throw new Error('the game has already started — join as a spectator');
      }
      const playerCount = [...this.members.values()].filter((m) => m.role === 'player').length;
      if (playerCount >= this.config.maxPlayers) {
        throw new Error('the room is full');
      }
    }
    this.members.set(identity, {
      identity,
      displayName,
      role: asSpectator ? 'spectator' : 'player',
      connected: true,
      graceTimer: null,
    });
    this.outbox.broadcast('room:playerJoined', { playerId: identity, displayName, asSpectator });
    this.broadcastState();
  }

  leave(identity: string): void {
    const member = this.requireMember(identity);
    this.members.delete(identity);
    if (member.graceTimer) {
      clearTimeout(member.graceTimer);
    }
    this.outbox.broadcast('room:playerLeft', { playerId: identity });
    this.broadcastState();
  }

  start(identity: string): void {
    if (identity !== this.hostIdentity) {
      throw new Error('only the host can start the game');
    }
    if (this.match !== null) {
      throw new Error('a game is already in progress');
    }
    const players = [...this.members.values()].filter((m) => m.role === 'player');
    if (players.length < 2) {
      throw new Error('need at least two players');
    }
    const started = startMatch({
      playerIds: players.map((p) => p.identity),
      ruleset: this.config.rulesetConfig,
    });
    this.match = started.state;
    this.outbox.broadcast('game:started', {
      turnOrder: players.map((p) => p.identity),
      firstPlayer: players[0]!.identity,
    });
    this.afterTransition(started.events);
  }

  roll(identity: string): void {
    this.requireCurrentPlayer(identity);
    const dice = rollDice(this.rng, this.match!.turn.diceToRoll);
    this.applyTransition(matchRoll(this.match!, dice));
  }

  select(identity: string, diceIndices: number[]): void {
    this.requireCurrentPlayer(identity);
    const roll = this.match!.turn.roll;
    if (!roll) {
      throw new Error('there is no roll to select from');
    }
    const unique = new Set(diceIndices);
    if (unique.size !== diceIndices.length) {
      throw new Error('duplicate dice indices');
    }
    const dice: DieValue[] = diceIndices.map((i) => {
      const value = roll[i];
      if (value === undefined) {
        throw new Error(`no die at index ${i}`);
      }
      return value;
    });
    this.applyTransition(matchSelect(this.match!, dice));
  }

  bank(identity: string): void {
    this.requireCurrentPlayer(identity);
    if (this.match!.turn.phase === 'awaiting-decision' && !matchCanBank(this.match!)) {
      throw new Error('cannot bank below the on-the-board minimum');
    }
    this.applyTransition(matchDecide(this.match!, 'bank'));
  }

  rollAgain(identity: string): void {
    this.requireCurrentPlayer(identity);
    const decided = matchDecide(this.match!, 'roll');
    this.match = decided.state;
    const dice = rollDice(this.rng, this.match.turn.diceToRoll);
    const rolled = matchRoll(this.match, dice);
    this.applyTransition({
      state: rolled.state,
      events: [...decided.events, ...rolled.events],
    });
  }

  chat(identity: string, text: string): void {
    const member = this.requireMember(identity);
    if (member.role === 'spectator' && !this.config.spectatorChatEnabled) {
      throw new Error('spectator chat is disabled in this room');
    }
    const { text: filteredText, filtered } = this.chatFilter.apply(text);
    const message: ChatMessage = {
      messageId: randomUUID(),
      senderId: identity,
      displayName: member.displayName,
      text: filteredText,
      ts: this.now(),
      filtered,
    };
    this.outbox.broadcast('chat:message', message);
  }

  onDisconnect(identity: string): void {
    const member = this.members.get(identity);
    if (!member) {
      return;
    }
    member.connected = false;
    this.outbox.broadcast('player:disconnected', {
      playerId: identity,
      graceSecRemaining: DISCONNECT_GRACE_MS / 1000,
    });
    if (member.graceTimer) {
      clearTimeout(member.graceTimer);
    }
    member.graceTimer = setTimeout(() => {
      member.graceTimer = null;
      // grace expired mid-turn: auto-pass their live turn
      if (this.isCurrentPlayer(identity) && this.match?.status === 'active') {
        this.applyTransition(matchForfeit(this.match));
      }
    }, DISCONNECT_GRACE_MS);
  }

  onReconnect(identity: string): void {
    const member = this.requireMember(identity);
    member.connected = true;
    if (member.graceTimer) {
      clearTimeout(member.graceTimer);
      member.graceTimer = null;
    }
    this.outbox.broadcast('player:reconnected', { playerId: identity });
    this.broadcastState();
  }

  remove(byIdentity: string, targetIdentity: string): void {
    if (byIdentity !== this.hostIdentity) {
      throw new Error('only the host can remove players');
    }
    const target = this.requireMember(targetIdentity);
    if (target.connected) {
      throw new Error('only disconnected players can be removed');
    }
    this.leave(targetIdentity);
  }

  snapshot() {
    return {
      code: this.code,
      status: this.status,
      hostId: this.hostIdentity,
      maxPlayers: this.config.maxPlayers,
      turnTimerSec: this.config.turnTimerSec,
      spectatorChatEnabled: this.config.spectatorChatEnabled,
      ruleset: this.config.rulesetConfig,
      members: [...this.members.values()].map((m) => ({
        playerId: m.identity,
        displayName: m.displayName,
        role: m.role,
        connected: m.connected,
      })),
      turnDeadline: this.turnDeadline,
      match: this.match && {
        status: this.match.status,
        winnerId: this.match.winnerId,
        currentPlayerId:
          this.match.status === 'active' ? this.match.players[this.match.currentSeat]!.id : null,
        players: this.match.players.map((p) => ({
          id: p.id,
          total: p.total,
          onTheBoard: p.onTheBoard,
          farkles: p.farkles,
        })),
        turn: {
          phase: this.match.turn.phase,
          roll: this.match.turn.roll,
          diceToRoll: this.match.turn.diceToRoll,
          turnScore: this.match.turn.turnScore,
          hotDiceStreak: this.match.turn.hotDiceStreak,
        },
      },
    };
  }

  sendStateTo(identity: string): void {
    this.outbox.toIdentity(identity, 'room:state', this.snapshot());
  }

  private applyTransition(transition: MatchTransition): void {
    this.match = transition.state;
    this.afterTransition(transition.events);
  }

  private afterTransition(events: GameLogEvent[]): void {
    this.outbox.broadcast('game:events', events);
    if (events.some((e) => e.type === 'turn-forfeited')) {
      this.outbox.broadcast('turn:timedOut', {
        playerId: events.find((e) => e.type === 'turn-forfeited')!.playerId,
      });
    }
    this.armTurnTimer(events);
    this.broadcastState();
    if (this.match?.status === 'ended') {
      const ended = events.find((e) => e.type === 'game-ended');
      if (ended?.type === 'game-ended') {
        this.outbox.broadcast('game:ended', {
          winnerId: ended.winnerId,
          finalScores: ended.finalScores,
          placements: ended.placements,
        });
      }
    }
  }

  /** New turn (or game end) re-arms/cancels the timer; absent players forfeit immediately. */
  private armTurnTimer(events: GameLogEvent[]): void {
    const turnStarted = events.some((e) => e.type === 'turn-started');
    if (!turnStarted && this.match?.status === 'active') {
      return; // same turn continues on the running clock
    }
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
      this.turnDeadline = null;
    }
    if (this.match?.status !== 'active') {
      return;
    }
    const current = this.match.players[this.match.currentSeat]!;
    const member = this.members.get(current.id);
    if (member && !member.connected && member.graceTimer === null) {
      // grace already expired: auto-pass immediately
      this.applyTransition(matchForfeit(this.match));
      return;
    }
    if (this.config.turnTimerSec !== null) {
      this.turnDeadline = this.now() + this.config.turnTimerSec * 1000;
      this.turnTimer = setTimeout(() => {
        if (this.match?.status === 'active') {
          this.applyTransition(matchForfeit(this.match));
        }
      }, this.config.turnTimerSec * 1000);
    }
  }

  private broadcastState(): void {
    this.outbox.broadcast('room:state', this.snapshot());
  }

  private requireMember(identity: string): RoomMember {
    const member = this.members.get(identity);
    if (!member) {
      throw new Error('not a member of this room');
    }
    return member;
  }

  private isCurrentPlayer(identity: string): boolean {
    return (
      this.match !== null &&
      this.match.status === 'active' &&
      this.match.players[this.match.currentSeat]!.id === identity
    );
  }

  private requireCurrentPlayer(identity: string): void {
    const member = this.requireMember(identity);
    if (member.role === 'spectator') {
      throw new Error('spectators cannot act');
    }
    if (this.match === null) {
      throw new Error('the game has not started');
    }
    if (!this.isCurrentPlayer(identity)) {
      throw new Error('not your turn');
    }
  }
}
