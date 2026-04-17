import { Request, Response } from 'express';
import { RouteContext } from './types';
import { requireAuth, sanitizeUser } from './shared';
import { adminDb, withRetry, saveUser, createSeasonSnapshot, getUserById } from '../supabaseService';
import { logger } from '../logger';
import { getCurrentSeasonPeriod } from '../game/challenges';
import { RANK_TIERS, RANK_REWARDS } from '../../src/sharedConstants';
import { UserInternal } from '../../shared/types';

function getTierForElo(elo: number): string {
  if (elo >= RANK_TIERS.ELITE.minElo) return 'ELITE';
  if (elo >= RANK_TIERS.PLATINUM.minElo) return 'PLATINUM';
  if (elo >= RANK_TIERS.GOLD.minElo) return 'GOLD';
  if (elo >= RANK_TIERS.SILVER.minElo) return 'SILVER';
  return 'BRONZE';
}

export function registerSeasonRoutes({ app, engine, userSockets }: RouteContext): void {
  /**
   * Admin-only endpoint to trigger a season rollover.
   * This clones current standings into season_snapshots and resets ranked stats.
   * 
   * Expects: { seasonPeriod: "Season 1", secret: "..." }
   */
  app.post('/api/season/rollover', async (req: Request, res: Response) => {
    const { seasonPeriod, secret } = req.body;
    
    if (secret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: 'Unauthorized rollover attempt' });
    }

    if (!seasonPeriod) {
      return res.status(400).json({ error: 'seasonPeriod is required' });
    }

    try {
      logger.info({ seasonPeriod }, 'Starting seasonal rollover process...');

      // 1. Fetch all users who have played ranked games
      const { data: usersData, error } = await adminDb
        .from('users')
        .select('*')
        .gt('stats->rankedGames', 0);

      if (error) throw error;

      const users = (usersData || []) as any[];
      logger.info({ count: users.length }, 'Found users for rollover');

      let processedCount = 0;

      for (const userData of users) {
        const stats = userData.stats;
        const currentElo = stats.elo || 1000;
        const peakElo = userData.peak_elo || stats.peakElo || currentElo;
        const tier = getTierForElo(peakElo) as keyof typeof RANK_REWARDS;
        const rewards = RANK_REWARDS[tier];

        // 2. Create Snapshot
        await createSeasonSnapshot({
          userId: userData.id,
          seasonPeriod,
          eloAtEnd: currentElo,
          peakElo: peakElo,
          rankedWins: stats.rankedWins || 0,
          rankedGames: stats.rankedGames || 0,
          rankTier: tier,
          rewardsClaimed: true, // Rewards are granted immediately in this implementation
        });

        // 3. Grant Rewards & Reset Stats
        const newElo = Math.floor(currentElo * 0.75 + 1200 * 0.25);
        
        const updatedStats = {
          ...stats,
          elo: newElo,
          rankedWins: 0,
          rankedGames: 0,
          points: (stats.points || 0) + rewards.ip,
        };

        const { error: updateError } = await adminDb
          .from('users')
          .update({
            stats: updatedStats,
            cabinet_points: (userData.cabinet_points || 0) + rewards.cp,
          })
          .eq('id', userData.id);

        if (updateError) {
          logger.error({ userId: userData.id, err: updateError }, 'Failed to update user during rollover');
        } else {
          processedCount++;
          
          // 4. Notify active players via socket
          const socketId = userSockets.get(userData.id);
          if (socketId) {
            engine.io.to(socketId).emit('seasonRewardGranted', {
              tier,
              ipReward: rewards.ip,
              cpReward: rewards.cp,
              seasonPeriod
            });
            
            // Refresh their local user object
            const freshUser = await getUserById(userData.id);
            if (freshUser) {
              engine.io.to(socketId).emit('userUpdate', sanitizeUser(freshUser));
            }
          }
        }
      }

      logger.info({ processedCount }, 'Season rollover complete');
      res.json({ success: true, processedCount });
    } catch (err: any) {
      logger.error({ err }, 'Season rollover failed');
      res.status(500).json({ error: 'Rollover failed', details: err.message });
    }
  });

  /**
   * Returns a list of all unique seasons recorded in snapshots
   */
  app.get('/api/seasons', async (_req: Request, res: Response) => {
    try {
      const { data, error } = await adminDb
        .from('season_snapshots')
        .select('season_period')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      const unique = Array.from(new Set((data || []).map((r: any) => r.season_period)));
      res.json(unique);
    } catch (err) {
      res.json([]);
    }
  });
}
