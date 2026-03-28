import { z } from 'zod';

export const statsSchema = z.object({
  gamesPlayed: z.number().int().min(0),
  wins: z.number().int().min(0),
  losses: z.number().int().min(0),
  civilGames: z.number().int().min(0),
  stateGames: z.number().int().min(0),
  overseerGames: z.number().int().min(0),
  kills: z.number().int().min(0),
  deaths: z.number().int().min(0),
  elo: z.number().int().min(0),
  points: z.number().int().min(0),
  xp: z.number().int().min(0),
  agendasCompleted: z.number().int().min(0),
  civilWins: z.number().int().min(0),
  stateWins: z.number().int().min(0),
  overseerWins: z.number().int().min(0),
  rankedWins: z.number().int().min(0),
  rankedGames: z.number().int().min(0),
  casualWins: z.number().int().min(0),
  casualGames: z.number().int().min(0),
  classicWins: z.number().int().min(0),
  classicGames: z.number().int().min(0),
});

export const adminUpdateUserSchema = z.object({
  userId: z.string(),
  updates: z.object({
    stats: statsSchema.partial().optional(),
    cabinetPoints: z.number().int().min(0).optional(),
    isBanned: z.boolean().optional(),
  }),
});

export const joinRoomSchema = z.object({
  roomId: z.string().min(1).max(40),
  name: z.string(),
  userId: z.string().optional(),
  activeFrame: z.string().optional(),
  activePolicyStyle: z.string().optional(),
  activeVotingStyle: z.string().optional(),
  maxPlayers: z.number().int().min(5).max(10).optional(),
  actionTimer: z.number().int().min(0).max(120).optional(),
  mode: z.enum(['Casual', 'Ranked', 'Classic']).optional(),
  isSpectator: z.boolean().optional(),
  privacy: z.enum(['public', 'private', 'friends']).optional(),
  inviteCode: z.string().optional(),
  avatarUrl: z.string().url().max(2048).optional(),
});

export const joinQueueSchema = z.object({
  name: z.string().min(1).max(32),
  userId: z.string().optional(),
  avatarUrl: z.string().url().max(2048).optional(),
  activeFrame: z.string().optional(),
  activePolicyStyle: z.string().optional(),
  activeVotingStyle: z.string().optional(),
});

export const registerSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: z.string().min(8),
  email: z.string().email('Invalid email address'),
  avatarUrl: z.string().url('Invalid avatar URL').max(2048).optional(),
});

export const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export const updateEmailSchema = z.object({
  email: z.string().email(),
});

export const updateUsernameSchema = z.object({
  newUsername: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().uuid(),
  newPassword: z.string().min(8),
});
