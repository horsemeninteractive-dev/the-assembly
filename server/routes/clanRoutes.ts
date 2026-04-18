/**
 * server/routes/clanRoutes.ts
 *
 * REST endpoints for the Clans feature.
 * Follows the exact pattern of friendRoutes.ts.
 */

import { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { RouteContext } from './types';
import { requireAuth, sanitizeUser } from './shared';
import { getSocketId } from '../redis';
import { logger } from '../logger';
import {
  createClan,
  getClanById,
  getClanByTag,
  getClanByUserId,
  getClanMembers,
  searchClans,
  updateClan,
  disbandClan,
  addClanMember,
  removeClanMember,
  updateMemberRole,
  transferClanOwnership,
  createClanInvite,
  getPendingInvitesForUser,
  respondToInvite,
  getClanLeaderboard,
  computeClanLevel,
  saveClanChallenges,
} from '../db/clans';
import { getUserById } from '../supabaseService';
import { refreshClanChallenges, enrichClanChallenges } from '../game/clanChallenges';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const createClanSchema = z.object({
  tag: z
    .string()
    .min(2)
    .max(5)
    .regex(/^[A-Za-z0-9]+$/, 'Tag must be alphanumeric'),
  name: z
    .string()
    .min(2)
    .max(32)
    .regex(/^[A-Za-z0-9 _\-'\.]+$/, 'Name contains invalid characters'),
  description: z.string().max(200).optional().default(''),
  emblem: z.object({
    iconId: z.string().min(1),
    iconColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    bgColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  }),
});

const updateClanSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(32)
    .regex(/^[A-Za-z0-9 _\-'\.]+$/)
    .optional(),
  description: z.string().max(200).optional(),
  emblem: z.object({
    iconId: z.string().min(1).optional(),
    iconColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    bgColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  }).optional(),
});

const inviteSchema = z.object({ targetUserId: z.string().min(1) });
const respondSchema = z.object({
  inviteId: z.string().uuid(),
  accept: z.boolean(),
});
const roleSchema = z.object({
  role: z.enum(['officer', 'member']),
});
const transferSchema = z.object({ newOwnerId: z.string().min(1) });

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_MEMBERS = 16;
const CLAN_XP_PER_LEVEL_BASE = 500; // level N costs N*500 XP

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerClanRoutes({ app, io, userSockets }: RouteContext): void {
  const clanLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    keyGenerator: (req) => (req as any).user?.id || req.ip,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many clan requests. Please slow down.' },
  });

  // ── GET /api/clans/leaderboard ───────────────────────────────────────────
  app.get('/api/clans/leaderboard', requireAuth, async (_req: Request, res: Response) => {
    try {
      const clans = await getClanLeaderboard(50);
      res.json({ clans });
    } catch (err) {
      logger.error({ err }, 'getClanLeaderboard failed');
      res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
  });

  // ── GET /api/clans/mine ──────────────────────────────────────────────────
  app.get('/api/clans/mine', requireAuth, async (req: Request, res: Response) => {
    const user = req.user!;
    try {
      const clan = await getClanByUserId(user.id);
      if (!clan) return res.json({ clan: null });
      const members = await getClanMembers(clan.id);
      res.json({ clan, members });
    } catch (err) {
      logger.error({ err }, 'getClanMine failed');
      res.status(500).json({ error: 'Failed to fetch your clan' });
    }
  });

  // ── GET /api/clans/invites ───────────────────────────────────────────────
  app.get('/api/clans/invites', requireAuth, async (req: Request, res: Response) => {
    const user = req.user!;
    try {
      const invites = await getPendingInvitesForUser(user.id);
      res.json({ invites });
    } catch (err) {
      logger.error({ err }, 'getPendingInvites failed');
      res.status(500).json({ error: 'Failed to fetch invites' });
    }
  });

  // ── GET /api/clans/mine/challenges ───────────────────────────────────────
  app.get('/api/clans/mine/challenges', requireAuth, async (req: Request, res: Response) => {
    const user = req.user!;
    try {
      const clan = await getClanByUserId(user.id);
      if (!clan) return res.status(404).json({ error: 'You are not in a clan' });

      // Fetch live config to know the active season bounds
      const { getSystemConfig } = await import('../db/config');
      const config = await getSystemConfig();

      // Refresh if periods expired
      const refreshed = refreshClanChallenges(clan.challenges, config);
      if (JSON.stringify(refreshed) !== JSON.stringify(clan.challenges)) {
        await saveClanChallenges(clan.id, refreshed);
      }

      const enriched = enrichClanChallenges(refreshed, config.currentSeasonEndsAt);
      res.json(enriched);
    } catch (err) {
      logger.error({ err }, 'getClanChallenges failed');
      res.status(500).json({ error: 'Failed to fetch clan challenges' });
    }
  });


  // ── GET /api/clans/search ────────────────────────────────────────────────
  app.get('/api/clans/search', requireAuth, async (req: Request, res: Response) => {
    const q = (req.query.q as string) ?? '';
    if (!q || q.length < 2) return res.json({ clans: [] });
    try {
      const clans = await searchClans(q, 20);
      res.json({ clans });
    } catch (err) {
      logger.error({ err }, 'searchClans failed');
      res.status(500).json({ error: 'Failed to search clans' });
    }
  });

  // ── GET /api/clans/:clanId ───────────────────────────────────────────────
  app.get('/api/clans/:clanId', requireAuth, async (req: Request, res: Response) => {
    try {
      const clan = await getClanById(req.params.clanId);
      if (!clan) return res.status(404).json({ error: 'Clan not found' });
      const members = await getClanMembers(clan.id);
      res.json({ clan, members });
    } catch (err) {
      logger.error({ err }, 'getClanById route failed');
      res.status(500).json({ error: 'Failed to fetch clan' });
    }
  });

  // ── POST /api/clans ──────────────────────────────────────────────────────
  app.post('/api/clans', requireAuth, clanLimiter, async (req: Request, res: Response) => {
    const user = req.user!;
    try {
      // Must not already be in a clan
      const existing = await getClanByUserId(user.id);
      if (existing) return res.status(400).json({ error: 'You are already in a clan. Leave it first.' });

      const result = createClanSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.issues[0]?.message ?? 'Invalid input' });
      }
      const { tag, name, description, emblem } = result.data;

      // Tag uniqueness
      const tagTaken = await getClanByTag(tag);
      if (tagTaken) return res.status(400).json({ error: 'That tag is already taken.' });

      const clan = await createClan(user.id, tag, name, description!, emblem);
      if (!clan) return res.status(500).json({ error: 'Failed to create clan' });

      res.status(201).json({ clan });
    } catch (err) {
      logger.error({ err }, 'createClan route failed');
      res.status(500).json({ error: 'Failed to create clan' });
    }
  });

  // ── PATCH /api/clans/:clanId ─────────────────────────────────────────────
  app.patch('/api/clans/:clanId', requireAuth, clanLimiter, async (req: Request, res: Response) => {
    const user = req.user!;
    const { clanId } = req.params;
    try {
      const clan = await getClanById(clanId);
      if (!clan) return res.status(404).json({ error: 'Clan not found' });
      if (clan.ownerId !== user.id) return res.status(403).json({ error: 'Only the clan owner can edit it' });

      const result = updateClanSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json({ error: 'Invalid input' });

      await updateClan(clanId, result.data);
      res.json({ success: true });
    } catch (err) {
      logger.error({ err }, 'updateClan route failed');
      res.status(500).json({ error: 'Failed to update clan' });
    }
  });

  // ── DELETE /api/clans/:clanId ─────────────────────────────────────────────
  app.delete('/api/clans/:clanId', requireAuth, clanLimiter, async (req: Request, res: Response) => {
    const user = req.user!;
    const { clanId } = req.params;
    try {
      const clan = await getClanById(clanId);
      if (!clan) return res.status(404).json({ error: 'Clan not found' });
      if (clan.ownerId !== user.id) return res.status(403).json({ error: 'Only the owner can disband the clan' });

      await disbandClan(clanId);
      res.json({ success: true });
    } catch (err) {
      logger.error({ err }, 'disbandClan route failed');
      res.status(500).json({ error: 'Failed to disband clan' });
    }
  });

  // ── POST /api/clans/:clanId/invite ───────────────────────────────────────
  app.post('/api/clans/:clanId/invite', requireAuth, clanLimiter, async (req: Request, res: Response) => {
    const user = req.user!;
    const { clanId } = req.params;
    try {
      const result = inviteSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json({ error: 'Invalid input' });
      const { targetUserId } = result.data;

      const clan = await getClanById(clanId);
      if (!clan) return res.status(404).json({ error: 'Clan not found' });

      // Must be officer or owner to invite
      const members = await getClanMembers(clanId);
      const senderMember = members.find(m => m.userId === user.id);
      if (!senderMember || (senderMember.role !== 'owner' && senderMember.role !== 'officer')) {
        return res.status(403).json({ error: 'Only officers and the owner can invite players' });
      }

      // Max members check
      if (members.length >= MAX_MEMBERS) {
        return res.status(400).json({ error: `Clan is full (max ${MAX_MEMBERS} members)` });
      }

      // Target must not already be in a clan
      const targetClan = await getClanByUserId(targetUserId);
      if (targetClan) return res.status(400).json({ error: 'That player is already in a clan' });

      const targetUser = await getUserById(targetUserId);
      if (!targetUser) return res.status(404).json({ error: 'Player not found' });

      const invite = await createClanInvite(
        clanId, clan.name, clan.tag,
        user.id, user.username,
        targetUserId
      );
      if (!invite) return res.status(400).json({ error: 'An invite to this player is already pending' });

      // Real-time notification
      const targetSocketId = await getSocketId(targetUserId, userSockets);
      if (targetSocketId) {
        io.to(targetSocketId).emit('clanInviteReceived', {
          inviteId: invite.id,
          clanId: clan.id,
          clanName: clan.name,
          clanTag: clan.tag,
          fromUsername: user.username,
        });
      }

      res.json({ success: true });
    } catch (err) {
      logger.error({ err }, 'clanInvite route failed');
      res.status(500).json({ error: 'Failed to send invite' });
    }
  });

  // ── POST /api/clans/invites/respond ─────────────────────────────────────
  app.post('/api/clans/invites/respond', requireAuth, clanLimiter, async (req: Request, res: Response) => {
    const user = req.user!;
    try {
      const result = respondSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json({ error: 'Invalid input' });
      const { inviteId, accept } = result.data;

      const invite = await respondToInvite(inviteId, user.id, accept);
      if (!invite) return res.status(404).json({ error: 'Invite not found or already responded' });

      if (accept) {
        // Check they're not already in a clan (race condition guard)
        const existingClan = await getClanByUserId(user.id);
        if (existingClan) {
          return res.status(400).json({ error: 'You are already in a clan' });
        }

        const clan = await getClanById(invite.clanId);
        if (!clan) return res.status(404).json({ error: 'Clan no longer exists' });

        const members = await getClanMembers(invite.clanId);
        if (members.length >= MAX_MEMBERS) {
          return res.status(400).json({ error: 'Clan is now full' });
        }

        await addClanMember(invite.clanId, user.id);

        // Notify clan members that someone joined
        for (const member of members) {
          const memberSocketId = await getSocketId(member.userId, userSockets);
          if (memberSocketId) {
            io.to(memberSocketId).emit('clanMemberJoined', {
              clanId: invite.clanId,
              userId: user.id,
              username: user.username,
            });
          }
        }
      }

      res.json({ success: true, accepted: accept });
    } catch (err) {
      logger.error({ err }, 'respondToInvite route failed');
      res.status(500).json({ error: 'Failed to respond to invite' });
    }
  });

  // ── DELETE /api/clans/:clanId/leave ──────────────────────────────────────
  app.delete('/api/clans/:clanId/leave', requireAuth, clanLimiter, async (req: Request, res: Response) => {
    const user = req.user!;
    const { clanId } = req.params;
    try {
      const clan = await getClanById(clanId);
      if (!clan) return res.status(404).json({ error: 'Clan not found' });

      // Owner must transfer before leaving
      if (clan.ownerId === user.id) {
        return res.status(400).json({
          error: 'Transfer ownership to another member before leaving, or disband the clan.',
        });
      }

      await removeClanMember(clanId, user.id);
      res.json({ success: true });
    } catch (err) {
      logger.error({ err }, 'leaveClan route failed');
      res.status(500).json({ error: 'Failed to leave clan' });
    }
  });

  // ── DELETE /api/clans/:clanId/members/:userId ────────────────────────────
  app.delete('/api/clans/:clanId/members/:userId', requireAuth, clanLimiter, async (req: Request, res: Response) => {
    const user = req.user!;
    const { clanId, userId } = req.params;
    try {
      const clan = await getClanById(clanId);
      if (!clan) return res.status(404).json({ error: 'Clan not found' });

      const members = await getClanMembers(clanId);
      const actorMember = members.find(m => m.userId === user.id);
      if (!actorMember || (actorMember.role !== 'owner' && actorMember.role !== 'officer')) {
        return res.status(403).json({ error: 'Only officers and the owner can kick members' });
      }
      // Officers cannot kick officers or the owner
      const targetMember = members.find(m => m.userId === userId);
      if (!targetMember) return res.status(404).json({ error: 'Member not found' });
      if (actorMember.role === 'officer' && (targetMember.role === 'officer' || targetMember.role === 'owner')) {
        return res.status(403).json({ error: 'Officers cannot kick other officers or the owner' });
      }

      await removeClanMember(clanId, userId);
      res.json({ success: true });
    } catch (err) {
      logger.error({ err }, 'kickMember route failed');
      res.status(500).json({ error: 'Failed to kick member' });
    }
  });

  // ── PATCH /api/clans/:clanId/members/:userId/role ────────────────────────
  app.patch('/api/clans/:clanId/members/:userId/role', requireAuth, clanLimiter, async (req: Request, res: Response) => {
    const user = req.user!;
    const { clanId, userId } = req.params;
    try {
      const clan = await getClanById(clanId);
      if (!clan) return res.status(404).json({ error: 'Clan not found' });
      if (clan.ownerId !== user.id) return res.status(403).json({ error: 'Only the owner can change roles' });

      const result = roleSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json({ error: 'Role must be officer or member' });

      await updateMemberRole(clanId, userId, result.data.role);
      res.json({ success: true });
    } catch (err) {
      logger.error({ err }, 'updateMemberRole route failed');
      res.status(500).json({ error: 'Failed to update role' });
    }
  });

  // ── POST /api/clans/:clanId/transfer ──────────────────────────────────────
  app.post('/api/clans/:clanId/transfer', requireAuth, clanLimiter, async (req: Request, res: Response) => {
    const user = req.user!;
    const { clanId } = req.params;
    try {
      const clan = await getClanById(clanId);
      if (!clan) return res.status(404).json({ error: 'Clan not found' });
      if (clan.ownerId !== user.id) return res.status(403).json({ error: 'Only the owner can transfer ownership' });

      const result = transferSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json({ error: 'Invalid input' });

      const members = await getClanMembers(clanId);
      const target = members.find(m => m.userId === result.data.newOwnerId);
      if (!target) return res.status(404).json({ error: 'Target is not a member of this clan' });

      await transferClanOwnership(clanId, result.data.newOwnerId, user.id);
      res.json({ success: true });
    } catch (err) {
      logger.error({ err }, 'transferOwnership route failed');
      res.status(500).json({ error: 'Failed to transfer ownership' });
    }
  });
}
