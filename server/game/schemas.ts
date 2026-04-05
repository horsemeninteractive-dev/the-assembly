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
  crisisWins: z.number().int().min(0),
  crisisGames: z.number().int().min(0),
});

export const adminUpdateUserSchema = z.object({
  userId: z.string().uuid(),
  updates: z.object({
    username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/).optional(),
    isAdmin: z.boolean().optional(),
    isBanned: z.boolean().optional(),
    cabinetPoints: z.number().int().min(0).optional(),
    stats: statsSchema.partial().optional(),
  }).strict(),
}).strict();

export const joinRoomSchema = z.object({
  roomId: z.string().min(1).max(40),
  name: z.string(),
  userId: z.string().optional(),
  activeFrame: z.string().optional(),
  activePolicyStyle: z.string().optional(),
  activeVotingStyle: z.string().optional(),
  maxPlayers: z.number().int().min(5).max(10).optional(),
  actionTimer: z.number().int().min(0).max(120).optional(),
  mode: z.enum(['Casual', 'Ranked', 'Classic', 'Crisis']).optional(),
  isSpectator: z.boolean().optional(),
  privacy: z.enum(['public', 'private', 'friends']).optional(),
  inviteCode: z.string().optional(),
  avatarUrl: z.string().url().max(2048).optional(),
  isPractice: z.boolean().optional(),
  aiDifficulty: z.enum(['Casual', 'Normal', 'Elite']).optional(),
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
  ref: z.string().optional(),
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

export const declarePoliciesSchema = z.object({
  type: z.enum(['President', 'Chancellor']),
  civ: z.number().int().min(0).max(3),
  sta: z.number().int().min(0).max(3),
  drewCiv: z.number().int().min(0).max(3).optional(),
  drewSta: z.number().int().min(0).max(3).optional(),
}).refine(data => data.civ + data.sta <= 3, {
  message: "Declared policies cannot exceed 3",
  path: ["civ", "sta"]
}).refine(data => {
  if (data.type === 'President' && (data.drewCiv !== undefined || data.drewSta !== undefined)) {
    const dc = data.drewCiv ?? 0;
    const ds = data.drewSta ?? 0;
    return dc + ds === 3;
  }
  return true;
}, {
  message: "President must declare exactly 3 drawn policies",
  path: ["drewCiv", "drewSta"]
});

export const nominateChancellorSchema = z.string().min(1).max(64);
export const presidentDiscardSchema = z.number().int().min(0).max(3); // handles Strategist 4-card draw (discard from hand)
export const chancellorPlaySchema = z.number().int().min(0).max(2);
export const performExecutiveActionSchema = z.string().min(1).max(64);
export const voteSchema = z.enum(['Aye', 'Nay']);
export const kickPlayerSchema = z.string().min(1).max(64);
export const vetoResponseSchema = z.boolean();

export const signalSchema = z.object({
  to: z.string().min(1).max(64),
  fromId: z.string().min(1).max(64),
  signal: z.object({
    sdp: z.any().optional(),
    candidate: z.any().optional(),
  }).passthrough(),
});

export const titleAbilityDataSchema = z.discriminatedUnion('use', [
  z.object({ use: z.literal(false) }),
  z.object({
    use: z.literal(true),
    role: z.enum([
      'Assassin',
      'Strategist',
      'Broker',
      'Handler',
      'Auditor',
      'Interdictor',
      'Archivist',
      'Herald',
      'Quorum',
      'Cipher',
    ]),
    targetId: z.string().min(1).max(64).optional(),
    claim: z.string().min(1).max(80).optional(),
    message: z.string().min(1).max(80).optional(),
  }),
]);

export const heraldResponseSchema = z.enum(['Confirmed', 'Denied']);

export const sendReactionSchema = z.string().min(1).max(64);

export const censureVoteSchema = z.object({
  targetId: z.string().min(1).max(64),
});

