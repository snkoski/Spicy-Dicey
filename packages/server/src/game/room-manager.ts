import { customAlphabet } from 'nanoid';
import { createCryptoRandom, type RandomSource } from '@spicy-dicey/core-engine';
import type { RoomCreateInput } from '@spicy-dicey/contracts';
import { Room, type RoomOutbox } from './room.js';

const generateCode = customAlphabet('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 6);

/**
 * All live rooms, in-memory on this instance (decision 7). No per-process
 * assumptions leak elsewhere: everything routes through identities, so a
 * Redis adapter can layer in later without contract changes.
 */
export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  private readonly memberIndex = new Map<string, string>(); // identity -> roomCode
  private readonly makeRng: () => RandomSource;

  constructor(makeRng: () => RandomSource = createCryptoRandom) {
    this.makeRng = makeRng;
  }

  create(
    hostIdentity: string,
    config: RoomCreateInput,
    outboxFor: (code: string) => RoomOutbox,
  ): Room {
    let code = generateCode();
    while (this.rooms.has(code)) {
      code = generateCode();
    }
    const room = new Room(code, hostIdentity, config, outboxFor(code), { rng: this.makeRng() });
    this.rooms.set(code, room);
    return room;
  }

  get(code: string): Room | null {
    return this.rooms.get(code.toUpperCase()) ?? null;
  }

  track(identity: string, roomCode: string): void {
    this.memberIndex.set(identity, roomCode);
  }

  untrack(identity: string): void {
    this.memberIndex.delete(identity);
  }

  roomOf(identity: string): Room | null {
    const code = this.memberIndex.get(identity);
    return code ? this.get(code) : null;
  }
}
