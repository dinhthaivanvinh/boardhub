import type { FastifyInstance } from 'fastify';
import type { LeaderboardEntry, LiveRoom } from '@bg/protocol';
import type { AuthService } from '../auth/auth-service';
import { HubError } from '../errors';
import { toUserRating, type RatingRepo } from '../ratings/rating-service';
import type { LiveStore } from '../store/live-store';
import type { UserRepo } from '../store/repos';

/** Players need this many ranked games before they appear on the leaderboard. */
export const LEADERBOARD_MIN_GAMES = 5;

export function registerCompetitiveRoutes(
  app: FastifyInstance,
  deps: {
    auth: AuthService;
    ratings: RatingRepo;
    users: UserRepo;
    store: LiveStore;
    games: Record<string, unknown>;
  },
) {
  app.get<{ Params: { gameId: string }; Querystring: { limit?: string } }>(
    '/api/leaderboard/:gameId',
    async (req) => {
      if (!deps.games[req.params.gameId]) throw new HubError('game.not_found');
      const limit = Math.min(Math.max(Number(req.query.limit ?? 50) || 50, 1), 100);
      const rows = await deps.ratings.top(req.params.gameId, limit, LEADERBOARD_MIN_GAMES);
      const users = new Map(
        (await deps.users.findManyByIds(rows.map((r) => r.userId))).map((u) => [u.id, u]),
      );
      const entries: LeaderboardEntry[] = rows.map((r, i) => ({
        ...toUserRating(r),
        rank: i + 1,
        userId: r.userId,
        name: users.get(r.userId)?.displayName ?? '?',
      }));
      return { gameId: req.params.gameId, minGames: LEADERBOARD_MIN_GAMES, entries };
    },
  );

  app.get('/api/me/ratings', async (req) => {
    const header = req.headers.authorization;
    const user = await deps.auth.authenticate(header?.startsWith('Bearer ') ? header.slice(7) : undefined);
    if (!user) throw new HubError('auth.required');
    return { ratings: (await deps.ratings.forUser(user.id)).map(toUserRating) };
  });

  // Public games being played now, newest first (spectating, FR-ROOM-06).
  app.get('/api/live', async () => {
    const rooms: LiveRoom[] = [];
    for (const id of await deps.store.liveRoomIds()) {
      const room = await deps.store.getRoom(id);
      const match = room?.matchId ? await deps.store.getMatch(room.matchId) : null;
      if (!room || !match || room.status !== 'playing') {
        await deps.store.setLive(id, false); // stale entry (room expired or finished)
        continue;
      }
      rooms.push({
        roomId: room.id,
        code: room.code,
        gameId: room.gameId,
        ranked: room.ranked,
        startedAt: match.startedAt,
        spectatorCount: room.spectators.length,
        players: room.seats.slice(0, match.players).map((s, seat) => ({
          seat,
          name: s?.kind === 'user' ? s.name : '?',
          rating: s?.kind === 'user' ? (s.rating ?? null) : null,
        })),
      });
    }
    rooms.sort((a, b) => b.startedAt - a.startedAt);
    return { rooms };
  });
}
