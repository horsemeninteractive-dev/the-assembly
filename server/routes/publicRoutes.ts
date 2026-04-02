import { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { RouteContext } from './types';
import { getUser } from '../supabaseService';
import { logger } from '../logger';

export function registerPublicRoutes({ app }: RouteContext): void {
  const publicLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down.' },
  });

  /**
   * GET /api/public/player/:username
   * No authentication required — returns a safe public subset of user data.
   */
  app.get('/api/public/player/:username', publicLimiter, async (req: Request, res: Response) => {
    try {
      const { username } = req.params;

      if (!username || username.length < 2 || username.length > 30 || !/^[a-zA-Z0-9_\-. ]+$/.test(username)) {
        return res.status(400).json({ error: 'Invalid username' });
      }

      const user = await getUser(username);

      if (!user || user.isBanned) {
        return res.status(404).json({ error: 'Player not found' });
      }

      // Only expose fields safe for public consumption
      const publicProfile = {
        username: user.username,
        avatarUrl: user.avatarUrl ?? null,
        createdAt: user.createdAt ?? null,
        stats: user.stats,
        pinnedAchievements: user.pinnedAchievements ?? [],
        earnedAchievementsCount: (user.earnedAchievements ?? []).length,
        activeFrame: user.activeFrame ?? null,
        activeBackground: user.activeBackground ?? null,
      };

      // Cache for 60s to reduce DB load from viral sharing
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      res.json({ profile: publicProfile });
    } catch (err) {
      logger.error({ err }, 'Error fetching public player profile');
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}
