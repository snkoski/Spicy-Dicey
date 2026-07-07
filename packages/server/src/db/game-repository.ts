import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import type { FinishedGameSummary } from '../game/room.js';
import { schema, type AppDb } from './client.js';

/**
 * Records a finished online game (plan §3). Identity keys are attributed
 * by shape: `user-...` fills user_id, anything else guest_session_id —
 * the plan's exactly-one-of constraint. Guest rows are re-attributed on
 * upgrade and purged with their session otherwise (decision 6).
 */
export async function persistFinishedGame(
  db: AppDb,
  summary: FinishedGameSummary,
): Promise<string> {
  const gameId = `game-${randomUUID()}`;
  // A guest who upgraded mid-game gets the result attributed to the new
  // account (decision 6): resolve upgradedUserId for guest identities.
  const guestIds = summary.players
    .map((p) => p.identity)
    .filter((id) => !id.startsWith('user-'));
  const upgradedBy = new Map(
    guestIds.length === 0
      ? []
      : (
          await db
            .select({
              id: schema.guestSessions.id,
              upgradedUserId: schema.guestSessions.upgradedUserId,
            })
            .from(schema.guestSessions)
            .where(inArray(schema.guestSessions.id, guestIds))
        ).map((row) => [row.id, row.upgradedUserId]),
  );
  const attributedUserId = (identity: string): string | null => {
    if (identity.startsWith('user-')) {
      return identity;
    }
    return upgradedBy.get(identity) ?? null;
  };
  const playerRows = summary.players.map((p) => ({
    id: `gp-${randomUUID()}`,
    gameId,
    userId: attributedUserId(p.identity),
    guestSessionId: attributedUserId(p.identity) ? null : p.identity,
    seatIndex: p.seatIndex,
    displayName: p.displayName,
    isSpectator: false,
    finalScore: p.finalScore,
    placement: p.placement,
    farkleCount: p.farkleCount,
    turnCount: p.turnCount,
  }));
  const winnerRow = playerRows.find(
    (row) => (row.userId ?? row.guestSessionId) === summary.winnerId,
  );
  await db.insert(schema.games).values({
    id: gameId,
    roomCode: summary.roomCode,
    rulesetConfig: JSON.stringify(summary.rulesetConfig),
    status: 'finished',
    targetScore: summary.rulesetConfig.targetScore,
    endGameVariant: summary.rulesetConfig.endGameVariant,
    turnTimerSec: summary.turnTimerSec,
    spectatorChatEnabled: summary.spectatorChatEnabled,
    createdBy: summary.createdBy,
    winnerGamePlayerId: winnerRow?.id ?? null,
    startedAt: null,
    finishedAt: summary.finishedAt,
    createdAt: summary.finishedAt,
  });
  await db.insert(schema.gamePlayers).values(playerRows);
  return gameId;
}
