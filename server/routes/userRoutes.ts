import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { RouteContext } from './types';
import { requireAuth, sanitizeUser, JWT_SECRET } from './shared';
import { logger } from '../logger';
import { updateEmailSchema, updateUsernameSchema } from '../game/schemas';
import { getUser, getUserByEmail, saveUser, getMatchHistory, getMatchById, processDailyLogin } from '../supabaseService';
import { refreshChallenges, buildChallengesResponse } from '../db/challenges';
import { ACHIEVEMENT_MAP } from '../../src/utils/achievements';

export function registerUserRoutes({ app, engine }: RouteContext): void {
  const profileLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    keyGenerator: (req) => (req as any).user?.id || req.ip,
    message: { error: 'Too many profile updates. Please slow down.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.post('/api/logout', requireAuth, async (req: Request, res: Response) => {
    const user = req.user!;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await saveUser(user);
    res.json({ success: true, message: 'Logged out' });
  });

  app.get('/api/me', requireAuth, async (req: Request, res: Response) => {
    const user = req.user!;
    const loginReward = await processDailyLogin(user);
    const userWithoutPassword = sanitizeUser(user);
    res.json({ user: userWithoutPassword, loginReward });
  });

  app.post('/api/user/update-email', requireAuth, profileLimiter, async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const result = updateEmailSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: 'Invalid email address' });
      }
      const { email } = result.data;

      const existingUser = await getUserByEmail(email);
      if (existingUser && existingUser.id !== user.id) {
        return res.status(400).json({ error: 'Email already in use' });
      }

      user.email = email;
      await saveUser(user);

      const safe = sanitizeUser(user);
      res.json({ success: true, user: safe });
    } catch (err: any) {
      logger.error({ err }, 'Update email error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/user/update-username', requireAuth, profileLimiter, async (req: Request, res: Response) => {
    const result = updateUsernameSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Username must be 3-20 alphanumeric characters' });
    }
    const { newUsername } = result.data;

    try {
      const user = req.user!;

      if (user.username === newUsername) {
        return res.status(400).json({ error: 'New username must be different' });
      }

      const existing = await getUser(newUsername);
      if (existing) {
        return res.status(400).json({ error: 'Username already taken' });
      }

      user.username = newUsername;
      await saveUser(user);

      const newToken = jwt.sign({ userId: user.id, tokenVersion: user.tokenVersion }, JWT_SECRET!, {
        expiresIn: '30d',
      });

      const safe = sanitizeUser(user);
      res.json({ user: safe, token: newToken });
    } catch (err: any) {
      logger.error({ err }, 'Username update failed');
      res.status(500).json({ error: err.message || 'Failed to update username' });
    }
  });

  app.post('/api/tutorial-complete', requireAuth, async (req: Request, res: Response) => {
    const user = req.user!;
    if (!user.claimedRewards.includes('tutorial-complete')) {
      user.claimedRewards.push('tutorial-complete');
      await saveUser(user);
    }
    const safe = sanitizeUser(user);
    res.json({ user: safe });
  });

  app.get('/api/match-history/:userId', requireAuth, async (req: Request, res: Response) => {
    const user = req.user!;

    if (user.id !== req.params.userId && !user.isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = Math.max(0, parseInt(req.query.offset as string) || 0);

    const history = await getMatchHistory(req.params.userId, limit, offset);
    res.json({ history });
  });

  app.get('/api/matches/:matchId', requireAuth, async (req: Request, res: Response) => {
    try {
      const match = await getMatchById(req.params.matchId);
      if (!match) {
        return res.status(404).json({ error: 'Match not found' });
      }
      res.json(match);
    } catch (err) {
      logger.error({ err }, 'GET /api/matches/:id error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/pass/claim', requireAuth, async (req: Request, res: Response) => {
    const { rewardId, itemId } = req.body;
    const user = req.user!;
    if (user.claimedRewards.includes(rewardId)) {
      return res.status(400).json({ error: 'Already claimed' });
    }
    if (itemId && !user.ownedCosmetics.includes(itemId)) {
      user.ownedCosmetics.push(itemId);
    }
    if (rewardId === 'pass-0-lvl30') {
      user.cabinetPoints = (user.cabinetPoints ?? 0) + 500;
    }
    user.claimedRewards.push(rewardId);
    await saveUser(user);
    const safe = sanitizeUser(user);
    res.json({ user: safe });
  });

  app.post('/api/achievements/pin', requireAuth, async (req: Request, res: Response) => {
    const user = req.user!;

    const { pinnedAchievements } = req.body;
    if (!Array.isArray(pinnedAchievements) || pinnedAchievements.length > 3) {
      return res.status(400).json({ error: 'pinnedAchievements must be an array of up to 3 IDs' });
    }

    const earned = new Set(
      (user.earnedAchievements ?? []).map((a: any) => (typeof a === 'string' ? a : a.id))
    );

    for (const id of pinnedAchievements) {
      if (typeof id !== 'string') return res.status(400).json({ error: 'Achievement IDs must be strings' });
      if (!ACHIEVEMENT_MAP.has(id)) return res.status(400).json({ error: `Unrecognized achievement ID: ${id}` });
      if (!earned.has(id)) return res.status(400).json({ error: `You have not earned achievement: ${id}` });
    }

    user.pinnedAchievements = pinnedAchievements.slice(0, 3);
    await saveUser(user);
    const safe = sanitizeUser(user);
    res.json({ user: safe });
  });

  app.get('/api/recently-played', requireAuth, async (req: Request, res: Response) => {
    res.json({ recentlyPlayedWith: req.user!.recentlyPlayedWith ?? [] });
  });

  app.post('/api/profile/frame', requireAuth, async (req: Request, res: Response) => {
    const { frameId, policyStyle, votingStyle, music, soundPack, backgroundId } = req.body;
    const user = req.user!;

    const PASS_ITEM_LEVELS: { [key: string]: number } = {
      'bg-pass-0': 10,
      'vote-pass-0': 20,
      'music-pass-0': 40,
      'frame-pass-0': 50,
    };

    const isItemUnlocked = (itemId: string) => {
      if (user.ownedCosmetics.includes(itemId)) return true;
      const requiredLevel = PASS_ITEM_LEVELS[itemId];
      if (requiredLevel) {
        const userLevel = Math.floor(user.stats.gamesPlayed / 5) + 1;
        return userLevel >= requiredLevel;
      }
      return false;
    };

    if (frameId !== undefined) {
      if (frameId && !isItemUnlocked(frameId)) return res.status(400).json({ error: 'Not owned' });
      user.activeFrame = frameId;
    }
    if (policyStyle !== undefined) {
      if (policyStyle && !isItemUnlocked(policyStyle)) return res.status(400).json({ error: 'Not owned' });
      user.activePolicyStyle = policyStyle;
    }
    if (votingStyle !== undefined) {
      if (votingStyle && !isItemUnlocked(votingStyle)) return res.status(400).json({ error: 'Not owned' });
      user.activeVotingStyle = votingStyle;
    }
    if (music !== undefined) {
      if (music && !isItemUnlocked(music)) return res.status(400).json({ error: 'Not owned' });
      user.activeMusic = music;
    }
    if (soundPack !== undefined) {
      if (soundPack && !isItemUnlocked(soundPack)) return res.status(400).json({ error: 'Not owned' });
      user.activeSoundPack = soundPack;
    }
    if (backgroundId !== undefined) {
      if (backgroundId && !isItemUnlocked(backgroundId)) return res.status(400).json({ error: 'Not owned' });
      user.activeBackground = backgroundId;
    }

    await saveUser(user);

    for (const room of engine.rooms.values()) {
      let changed = false;
      for (const p of room.players) {
        if (p.userId === user.id) {
          if (frameId !== undefined) p.activeFrame = frameId;
          if (policyStyle !== undefined) p.activePolicyStyle = policyStyle;
          if (votingStyle !== undefined) p.activeVotingStyle = votingStyle;
          changed = true;
        }
      }
      if (changed) engine.broadcastState(room.roomId);
    }

    const userWithoutPassword = sanitizeUser(user);
    res.json({ user: userWithoutPassword });
  });

  // ── Challenges ────────────────────────────────────────────────────────────

  app.get('/api/challenges', requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const freshData = refreshChallenges(user);

      const periodsChanged =
        !user.challengeData ||
        user.challengeData.dailyPeriod !== freshData.dailyPeriod ||
        user.challengeData.weeklyPeriod !== freshData.weeklyPeriod ||
        user.challengeData.seasonPeriod !== freshData.seasonPeriod;

      if (periodsChanged) {
        user.challengeData = freshData;
        await saveUser(user);
      }

      res.json(buildChallengesResponse(freshData));
    } catch (err) {
      logger.error({ err }, 'GET /api/challenges error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}

