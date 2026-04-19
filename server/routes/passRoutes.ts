import { Request, Response } from 'express';
import { RouteContext } from './types';
import { requireAuth, sanitizeUser } from './shared';
import { logger } from '../logger';
import { SEASON_PASS_CONTENT, DEFAULT_ITEMS } from '../../src/sharedConstants';
import { getLevelFromXp } from '../../src/utils/xp';
import { saveUser } from '../supabaseService';
import { getSystemConfig } from '../db/config';

export function registerPassRoutes({ app }: RouteContext): void {
  /**
   * POST /api/pass/claim
   * Claims a reward from the current season pass.
   */
  app.post('/api/pass/claim', requireAuth, async (req: Request, res: Response) => {
    const { rewardId } = req.body;
    const user = req.user!;
    const config = await getSystemConfig();
    const season = config.currentSeasonNumber;

    if (user.claimedRewards.includes(rewardId)) {
      return res.status(400).json({ error: 'Reward already claimed.' });
    }

    // Find the reward in configuration
    const seasonPass = SEASON_PASS_CONTENT[season];
    if (!seasonPass) return res.status(404).json({ error: 'Season pass content not found.' });

    const reward = seasonPass.find(r => r.rewardId === rewardId);
    if (!reward) return res.status(404).json({ error: 'Invalid reward ID for current season.' });

    // Validate level
    const currentLevel = getLevelFromXp(user.stats.xp);
    if (currentLevel < reward.level) {
      return res.status(403).json({ error: `Requires Level ${reward.level}. Current level: ${currentLevel}` });
    }

    // Validate premium status
    if (reward.isPremium && !user.premiumPassSeasons?.includes(season)) {
      return res.status(403).json({ error: 'This reward requires the Premium Pass.' });
    }

    // Grant CP
    if (reward.cp) {
      user.cabinetPoints = (user.cabinetPoints ?? 0) + reward.cp;
    }

    // Grant Item
    if (reward.itemId) {
      if (!user.ownedCosmetics.includes(reward.itemId)) {
        user.ownedCosmetics.push(reward.itemId);
      }
    }

    // Mark as claimed
    user.claimedRewards.push(rewardId);
    await saveUser(user);

    logger.info({ userId: user.id, rewardId, season }, 'User claimed pass reward');
    res.json({ user: sanitizeUser(user) });
  });

  /**
   * POST /api/pass/unlock-premium
   * Unlocks the premium tier for the specified season.
   */
  app.post('/api/pass/unlock-premium', requireAuth, async (req: Request, res: Response) => {
    const { season } = req.body;
    const user = req.user!;
    const config = await getSystemConfig();
    const COST = 1000;

    // Safety checks
    if (season === 0) {
      return res.status(400).json({ error: 'Premium Pass is not available for Season 0.' });
    }
    if (season !== config.currentSeasonNumber) {
      return res.status(400).json({ error: 'You can only unlock the pass for the current active season.' });
    }
    if (user.premiumPassSeasons?.includes(season)) {
      return res.status(400).json({ error: 'Premium Pass already unlocked for this season.' });
    }
    if (user.cabinetPoints < COST) {
      return res.status(400).json({ error: `Insufficient Cabinet Points. Need ${COST} CP.` });
    }

    // Deduct and Unlock
    user.cabinetPoints -= COST;
    if (!user.premiumPassSeasons) user.premiumPassSeasons = [];
    user.premiumPassSeasons.push(season);

    await saveUser(user);

    logger.info({ userId: user.id, season }, 'User unlocked Premium Pass');
    res.json({ user: sanitizeUser(user) });
  });
}
