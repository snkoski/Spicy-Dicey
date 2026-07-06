/** Socket.io event names (plan §4) — one authoritative list, no string literals scattered. */
export const CLIENT_EVENTS = {
  roomCreate: 'room:create',
  roomJoin: 'room:join',
  roomLeave: 'room:leave',
  gameStart: 'game:start',
  turnRoll: 'turn:roll',
  turnSelect: 'turn:select',
  turnBank: 'turn:bank',
  chatSend: 'chat:send',
} as const;

export const SERVER_EVENTS = {
  roomState: 'room:state',
  roomPlayerJoined: 'room:playerJoined',
  roomPlayerLeft: 'room:playerLeft',
  gameStarted: 'game:started',
  gameEvents: 'game:events',
  gameEnded: 'game:ended',
  turnTimedOut: 'turn:timedOut',
  playerDisconnected: 'player:disconnected',
  playerReconnected: 'player:reconnected',
  chatMessage: 'chat:message',
  error: 'error',
} as const;
