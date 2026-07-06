import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as clientIo, type Socket } from 'socket.io-client';
import { CLIENT_EVENTS, SERVER_EVENTS } from '@spicy-dicey/contracts';
import { DEFAULT_RULESET } from '@spicy-dicey/core-engine';
import { buildApp } from '../src/app.js';
import { attachSockets } from '../src/socket/index.js';

let app: ReturnType<typeof buildApp>;
let baseUrl: string;

async function guestSocket(displayName: string): Promise<{ socket: Socket; guestId: string }> {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/guest',
    payload: { displayName },
  });
  const token = res.cookies.find((c) => c.name === 'sd_session')!.value;
  const socket = clientIo(baseUrl, {
    extraHeaders: { cookie: `sd_session=${token}` },
    transports: ['websocket'],
  });
  await new Promise<void>((resolve, reject) => {
    socket.on('connect', () => resolve());
    socket.on('connect_error', reject);
  });
  return { socket, guestId: (res.json() as { guestId: string }).guestId };
}

const emitAck = <T>(socket: Socket, event: string, payload: unknown): Promise<T> =>
  new Promise((resolve) => socket.emit(event, payload, (response: T) => resolve(response)));

const waitFor = <T>(socket: Socket, event: string): Promise<T> =>
  new Promise((resolve) => socket.once(event, (payload: T) => resolve(payload)));

beforeAll(async () => {
  app = buildApp();
  attachSockets(app);
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  baseUrl = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
});

afterAll(async () => {
  await app.close();
});

describe('socket multiplayer', { timeout: 30_000 }, () => {
  it('rejects unauthenticated connections', async () => {
    const socket = clientIo(baseUrl, { transports: ['websocket'] });
    const error = await new Promise<Error>((resolve) => socket.on('connect_error', resolve));
    expect(error.message).toMatch(/auth/i);
    socket.close();
  });

  it('runs a full authoritative exchange between two clients', async () => {
    const ann = await guestSocket('Ann');
    const ben = await guestSocket('Ben');

    const created = await emitAck<{ roomCode?: string; error?: string }>(
      ann.socket,
      CLIENT_EVENTS.roomCreate,
      {
        rulesetConfig: { ...DEFAULT_RULESET, onTheBoardEnabled: false },
        maxPlayers: 4,
        turnTimerSec: null,
        spectatorChatEnabled: true,
        displayName: 'Ann',
      },
    );
    expect(created.roomCode).toMatch(/^[A-Z0-9]{6}$/);

    const joined = await emitAck<{ ok?: boolean; error?: string }>(
      ben.socket,
      CLIENT_EVENTS.roomJoin,
      { roomCode: created.roomCode, displayName: 'Ben', asSpectator: false },
    );
    expect(joined.ok).toBe(true);

    const benSeesStart = waitFor(ben.socket, SERVER_EVENTS.gameStarted);
    await emitAck(ann.socket, CLIENT_EVENTS.gameStart, {});
    await benSeesStart;

    // Ann rolls: BOTH clients receive identical authoritative dice
    const annState = waitFor<{ match: { turn: { roll: number[] } } }>(
      ann.socket,
      SERVER_EVENTS.roomState,
    );
    const benState = waitFor<{ match: { turn: { roll: number[] } } }>(
      ben.socket,
      SERVER_EVENTS.roomState,
    );
    await emitAck(ann.socket, CLIENT_EVENTS.turnRoll, {});
    const [annView, benView] = await Promise.all([annState, benState]);
    expect(annView.match.turn.roll).toHaveLength(6);
    expect(benView.match.turn.roll).toEqual(annView.match.turn.roll);

    // Ben cannot act out of turn
    const rejected = await emitAck<{ error?: string }>(ben.socket, CLIENT_EVENTS.turnRoll, {});
    expect(rejected.error).toMatch(/turn/i);

    // A fabricated dice payload is rejected by schema (values, not indices)
    const forged = await emitAck<{ error?: string }>(ann.socket, CLIENT_EVENTS.turnSelect, {
      diceValues: [1, 1, 1, 1, 1, 1],
    });
    expect(forged.error).toBeDefined();

    // chat round-trips with the moderation shape
    const benChat = waitFor<{ text: string; filtered: boolean; senderId: string }>(
      ben.socket,
      SERVER_EVENTS.chatMessage,
    );
    await emitAck(ann.socket, CLIENT_EVENTS.chatSend, { text: 'good luck!' });
    const chat = await benChat;
    expect(chat).toMatchObject({ text: 'good luck!', filtered: false, senderId: ann.guestId });

    ann.socket.close();
    ben.socket.close();
  });

  it('spectators receive state but cannot act', async () => {
    const host = await guestSocket('Host');
    const p2 = await guestSocket('P2');
    const watcher = await guestSocket('Watcher');

    const { roomCode } = await emitAck<{ roomCode: string }>(
      host.socket,
      CLIENT_EVENTS.roomCreate,
      {
        rulesetConfig: DEFAULT_RULESET,
        maxPlayers: 2,
        turnTimerSec: null,
        spectatorChatEnabled: false,
        displayName: 'Host',
      },
    );
    await emitAck(p2.socket, CLIENT_EVENTS.roomJoin, {
      roomCode,
      displayName: 'P2',
      asSpectator: false,
    });
    const watcherJoin = await emitAck<{ ok?: boolean }>(watcher.socket, CLIENT_EVENTS.roomJoin, {
      roomCode,
      displayName: 'Watcher',
      asSpectator: true,
    });
    expect(watcherJoin.ok).toBe(true);

    const watcherSeesState = waitFor<{ status: string }>(watcher.socket, SERVER_EVENTS.roomState);
    await emitAck(host.socket, CLIENT_EVENTS.gameStart, {});
    expect((await watcherSeesState).status).toBe('active');

    const denied = await emitAck<{ error?: string }>(watcher.socket, CLIENT_EVENTS.turnRoll, {});
    expect(denied.error).toMatch(/spectator|turn|member/i);

    const chatDenied = await emitAck<{ error?: string }>(watcher.socket, CLIENT_EVENTS.chatSend, {
      text: 'hi',
    });
    expect(chatDenied.error).toMatch(/spectator/i);

    host.socket.close();
    p2.socket.close();
    watcher.socket.close();
  });
});
