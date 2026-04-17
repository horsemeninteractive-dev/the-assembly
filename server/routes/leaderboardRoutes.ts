import { Request, Response } from 'express';
import { RouteContext } from './types';
import { sanitizeUser } from './shared';
import { getLeaderboard, getSeasonLeaderboard } from '../supabaseService';
import { getCurrentSeasonPeriod } from '../game/challenges';
import { UserInternal } from '../../shared/types';
import rateLimit from 'express-rate-limit';

export function registerLeaderboardRoutes({ app }: RouteContext): void {
  const leaderboardLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests' },
  });

  /**
   * Returns top 50 for the current active season (live data from users table)
   */
  app.get('/api/leaderboard/season/current', leaderboardLimiter, async (req: Request, res: Response) => {
    try {
      const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
      const offset = Math.max(0, parseInt(req.query.offset as string) || 0);
      
      const leaderboard = await getLeaderboard('Ranked', limit, offset);
      const safe = leaderboard.map(u => sanitizeUser(u as UserInternal));
      res.json(safe);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch current season leaderboard' });
    }
  });

  /**
   * Returns historical top 50 for a past season period from snapshots
   */
  app.get('/api/leaderboard/season/:seasonPeriod', leaderboardLimiter, async (req: Request, res: Response) => {
    try {
      const { seasonPeriod } = req.params;
      const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
      const offset = Math.max(0, parseInt(req.query.offset as string) || 0);

      const leaderboard = await getSeasonLeaderboard(seasonPeriod, limit, offset);
      res.json(leaderboard);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch historical season leaderboard' });
    }
  });
}
