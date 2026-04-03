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
        clan: user.clan ?? null,
      };

      // Cache for 60s to reduce DB load from viral sharing
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      res.json({ profile: publicProfile });
    } catch (err) {
      logger.error({ err }, 'Error fetching public player profile');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/public/clan/:tag
   * Returns public information about a clan.
   */
  app.get('/api/public/clan/:tag', publicLimiter, async (req: Request, res: Response) => {
    try {
      const { tag } = req.params;
      const { getClanByTag, getClanMembers } = await import('../db/clans');

      if (!tag || tag.length < 2 || tag.length > 5) {
        return res.status(400).json({ error: 'Invalid clan tag' });
      }

      const clan = await getClanByTag(tag);
      if (!clan) {
        return res.status(404).json({ error: 'Clan not found' });
      }

      const members = await getClanMembers(clan.id);

      // Map to safe public structure
      const publicClan = {
        id: clan.id,
        tag: clan.tag,
        name: clan.name,
        description: clan.description,
        emblem: clan.emblem,
        xp: clan.xp,
        level: clan.level,
        memberCount: members.length,
        createdAt: clan.createdAt,
        members: members.map((m: any) => ({
          username: m.username,
          avatarUrl: m.avatarUrl,
          activeFrame: m.activeFrame,
          role: m.role,
          xpContributed: m.xpContributed,
          joinedAt: m.joinedAt,
        })),
      };

      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      res.json({ clan: publicClan });
    } catch (err) {
      logger.error({ err }, 'Error fetching public clan profile');
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}
