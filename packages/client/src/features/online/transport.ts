import { io } from 'socket.io-client';
import type { OnlineTransport } from './store';

/**
 * Production connection path: obtain a guest identity (httpOnly cookie),
 * then open the socket — same-origin via the Vite dev proxy in development.
 */
export async function connectAsGuest(
  displayName: string,
): Promise<{ transport: OnlineTransport; selfId: string }> {
  const res = await fetch('/auth/guest', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ displayName }),
  });
  if (!res.ok) {
    throw new Error('could not create a guest session');
  }
  const { guestId } = (await res.json()) as { guestId: string };

  const socket = io({ withCredentials: true, transports: ['websocket'] });
  await new Promise<void>((resolve, reject) => {
    socket.on('connect', () => resolve());
    socket.on('connect_error', (err) => reject(err));
  });

  return {
    selfId: guestId,
    transport: {
      emitWithAck: (event, payload) =>
        socket.emitWithAck(event, payload) as Promise<Record<string, unknown>>,
      on: (event, handler) => void socket.on(event, handler as (...args: unknown[]) => void),
      disconnect: () => void socket.disconnect(),
    },
  };
}
