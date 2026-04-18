import { Request, Response } from 'express';
import { z } from 'zod';
import { RouteContext } from './types';
import { sanitizeUser } from './shared';
import { adminDb, withRetry, createSeasonSnapshot, getUserById } from '../supabaseService';
import { getSystemConfig, updateSystemConfig } from '../db/config';
import { logger } from '../logger';
import { RANK_TIERS, RANK_REWARDS } from '../../src/sharedConstants';
import { UserInternal } from '../../shared/types';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const rolloverBodySchema = z.object({
  secret: z.string().min(1),
  /**
   * Optional. If supplied the snapshot will be labelled with this period string.
   * If omitted the server auto-derives "Season N" where N is
   * currentSeasonNumber + 1 (the season that is being closed out).
   */
  seasonPeriod: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTierForElo(elo: number): string {
  if (elo >= RANK_TIERS.ELITE.minElo) return 'ELITE';
  if (elo >= RANK_TIERS.PLATINUM.minElo) return 'PLATINUM';
  if (elo >= RANK_TIERS.GOLD.minElo) return 'GOLD';
  if (elo >= RANK_TIERS.SILVER.minElo) return 'SILVER';
  return 'BRONZE';
}

/** Return the ISO timestamp exactly 3 months after `from`. */
function threeMonthsAfter(from: Date): string {
  const d = new Date(from);
  d.setUTCMonth(d.getUTCMonth() + 3);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export function registerSeasonRoutes({ app, engine, userSockets }: RouteContext): void {
  /**
   * POST /api/season/rollover
   *
   * Triggered automatically by Google Cloud Scheduler every 3 months, or
   * manually from AdminConfigPanel.
   *
   * Auth: { secret: process.env.ADMIN_SECRET }
   *
   * Body: { secret, seasonPeriod? }
   *   • If seasonPeriod is omitted the server reads the current SystemConfig,
   *     closes out currentSeasonNumber, and advances to N+1.
   */
  app.post('/api/season/rollover', async (req: Request, res: Response) => {
    // --- Auth ---
    const parsed = rolloverBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
    }

    const { secret, seasonPeriod: bodySeasonPeriod } = parsed.data;

    if (secret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: 'Unauthorized rollover attempt' });
    }

    try {
      // --- Derive season context ---
      const currentConfig = await getSystemConfig();
      const closingSeasonNumber = currentConfig.currentSeasonNumber;
      const closingSeasonPeriod = bodySeasonPeriod ?? currentConfig.currentSeasonPeriod;

      const newSeasonNumber = closingSeasonNumber + 1;
      const newSeasonPeriod = `Season ${newSeasonNumber}`;
      const rolloverAt = new Date();
      const newSeasonEndsAt = threeMonthsAfter(rolloverAt);

      logger.info(
        { closingSeasonPeriod, newSeasonPeriod, newSeasonEndsAt },
        'Starting seasonal rollover process...'
      );

      // --- 1. Fetch all users who have played ranked games ---
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

        // 2. Create snapshot for the CLOSING season
        await createSeasonSnapshot({
          userId: userData.id,
          seasonPeriod: closingSeasonPeriod,
          eloAtEnd: currentElo,
          peakElo: peakElo,
          rankedWins: stats.rankedWins || 0,
          rankedGames: stats.rankedGames || 0,
          rankTier: tier,
          rewardsClaimed: true, // Rewards granted immediately below
        });

        // 3. Grant rewards & soft-reset ELO (75% current + 25% baseline of 1200)
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
              seasonPeriod: closingSeasonPeriod,
            });

            // Refresh their local user object
            const freshUser = await getUserById(userData.id);
            if (freshUser) {
              engine.io.to(socketId).emit('userUpdate', sanitizeUser(freshUser as UserInternal));
            }
          }
        }
      }

      // --- 5. Advance SystemConfig to the NEW season ---
      const newConfig = await updateSystemConfig({
        currentSeasonNumber: newSeasonNumber,
        currentSeasonPeriod: newSeasonPeriod,
        currentSeasonEndsAt: newSeasonEndsAt,
      });

      // --- 6. Broadcast new config to ALL connected clients ---
      // This causes live countdowns + season labels to update for anyone online
      engine.io.emit('adminConfigUpdate', newConfig);

      logger.info(
        { processedCount, newSeasonPeriod, newSeasonEndsAt },
        'Season rollover complete'
      );

      res.json({
        success: true,
        processedCount,
        closingSeasonPeriod,
        newSeasonPeriod,
        newSeasonEndsAt,
      });
    } catch (err: any) {
      logger.error({ err }, 'Season rollover failed');
      res.status(500).json({ error: 'Rollover failed', details: err.message });
    }
  });

  /**
   * GET /api/seasons
   * Returns a list of all unique season period labels recorded in snapshots.
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
