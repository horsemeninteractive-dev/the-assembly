import { logger } from './logger.ts';
import { Express, Request, Response, NextFunction } from 'express';
import { Server } from 'socket.io';
import { randomUUID, createHmac } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { GameEngine } from './gameEngine.ts';
import rateLimit from 'express-rate-limit';
import { GameState, RoomInfo, UserInternal } from '../src/types.ts';
import nodemailer from 'nodemailer';
import { DEFAULT_ITEMS, CP_PACKAGES } from '../src/sharedConstants.ts';
import { z } from 'zod';
import { getAppUrl, isAllowedOrigin } from './utils.ts';
import {
  registerSchema,
  loginSchema,
  updateEmailSchema,
  updateUsernameSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './schemas.ts';

declare global {
  namespace Express {
    interface Request {
      user?: UserInternal;
    }
  }
}

export function sanitizeUser(user: UserInternal): Omit<UserInternal, 'password'> {
  const { password, ...safeUser } = user;
  return safeUser;
}

import { getRedisStatus } from './redis.ts';

import {
  getUser,
  getUserById,
  getUserByGoogleId,
  getUserByDiscordId,
  getUserByEmail,
  saveUser,
  makeNewUser,
  getFriends,
  sendFriendRequest,
  acceptFriendRequest,
  isFriend,
  removeFriend,
  getAllLeaderboards,
  getGlobalStats,
  getMatchHistory,
  getPendingFriendRequests,
  searchUsers,
  getLeaderboard,
  getSystemConfig,
  updateSystemConfig,
  createPasswordResetToken,
  verifyPasswordResetToken,
  deletePasswordResetTokens,
  db,
  isConfigured,
} from './supabaseService.ts';

const transporter =
  process.env.EMAIL_USER && process.env.EMAIL_PASS
    ? nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      })
    : null;

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is not set.');
if (JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long for security compliance.');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function htmlEscape(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function validateToken(token: string): Promise<UserInternal | null> {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET!) as { userId: string; tokenVersion?: number };
    const user = await getUserById(decoded.userId);
    if (!user) return null;
    // Critical: check if tokenVersion exists and matches the DB
    if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== user.tokenVersion) {
      return null;
    }
    return user;
  } catch (_) {
    return null;
  }
}

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  const user = await validateToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid or expired session' });
  if (!user.isAdmin) return res.status(403).json({ error: 'Forbidden' });
  (req as any).user = user;
  next();
}

/** Standard authentication middleware for general user routes. */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const user = await validateToken(token);
    if (!user) return res.status(401).json({ error: 'Invalid or expired session' });
    req.user = user;
    next();
  } catch (_) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/** Safely extracts a message from unknown catch values, including axios errors. */
function getErrorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    if (e.response && typeof e.response === 'object') {
      const r = e.response as Record<string, unknown>;
      if (r.data) return String(r.data);
    }
    if (typeof e.message === 'string') return e.message;
  }
  return String(err);
}

function oauthSuccessPage(
  user: UserInternal,
  token: string,
  platform: string = 'web',
  nonce: string = ''
): string {
  const targetOrigin = process.env.APP_URL || 'https://theassembly.web.app';
  const saneUser = sanitizeUser(user);
  const nonceAttr = nonce ? ` nonce="${nonce}"` : '';

  // JSON.stringify is safe but we escape < to prevent </script> injection
  const authDataJson = JSON.stringify({
    user: saneUser,
    token: token,
    platform: platform,
    origin: targetOrigin,
  }).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Authentication Success</title>
  <style${nonceAttr}>
    body { background: #0a0a0a; margin: 0; padding: 0; }
    .container { display: flex; flex-direction: column; align-items: center; margin-top: 20vh; font-family: sans-serif; color: white; }
  </style>
</head>
<body>
<div class="container" id="container">
  <p>Authentication successful. Redirecting...</p>
</div>

<script${nonceAttr}>
(function() {
  var authData = ${authDataJson};
  var user = authData.user;
  var userStr = JSON.stringify(user);
  var token = authData.token;
  var origin = authData.origin;
  var platform = authData.platform;
  var container = document.getElementById('container');
  
  var redirectParams = '?token=' + encodeURIComponent(token) + '&user=' + encodeURIComponent(userStr);
  
  if (platform === 'android') {
    var intentLink = 'intent://auth' + redirectParams + '#Intent;scheme=theassembly;package=com.horsemeninteractive.theassembly;end';
    window.location.href = intentLink;
    setTimeout(function() {
      window.location.href = 'theassembly://auth' + redirectParams;
    }, 500);

    var p = document.createElement('p');
    p.style.marginTop = '40px';
    p.style.color = '#888';
    p.style.fontSize = '14px';
    p.textContent = 'If you are not redirected automatically:';
    container.appendChild(p);

    var a = document.createElement('a');
    a.href = intentLink;
    a.style.marginTop = '15px';
    a.style.padding = '12px 24px';
    a.style.background = '#2563eb';
    a.style.color = 'white';
    a.style.textDecoration = 'none';
    a.style.borderRadius = '6px';
    a.style.fontWeight = 'bold';
    a.textContent = 'Return to The Assembly';
    container.appendChild(a);
  } else if (window.opener) {
    window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', user: user, token: token }, origin);
    window.close();
  } else {
    window.location.href = '/?token=' + encodeURIComponent(token) + '&user=' + encodeURIComponent(userStr);
  }
})();
</script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export function registerRoutes(
  app: Express,
  io: Server,
  engine: GameEngine,
  userSockets: Map<string, string>,
  stripe: any
): void {
  const rooms = engine.rooms;

  // ── Rate limiters ────────────────────────────────────────────────────────
  // Strict: auth routes — prevent brute-force and account enumeration.
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts. Please try again later.' },
  });

  // Moderate: cost-bearing endpoints (TTS calls Gemini, shop debits points).
  const costLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down.' },
  });

  // High-frequency: blanket cap on all other API routes.
  const generalLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down.' },
  });

  // Dedicated: forgot-password (prevents email spam).
  const forgotPasswordLimiter = rateLimit({
    windowMs: 30 * 60 * 1000, // 30 minutes
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many reset requests. Please wait 30 minutes.' },
  });

  app.use('/api', generalLimiter);
  app.use('/api/register', authLimiter);
  app.use('/api/login', authLimiter);
  app.use('/api/auth/forgot-password', forgotPasswordLimiter);
  app.use('/api/auth/reset-password', authLimiter);
  app.use('/api/tts', costLimiter);
  app.use('/api/shop/buy', costLimiter);

  // ── Version endpoint ────────────────────────────────────────────────────────
  app.get('/version', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ version: process.env.APP_VERSION || 'dev' });
  });

  app.get('/api/health', (req: Request, res: Response) => {
    const memory = process.memoryUsage();
    res.json({
      status: 'healthy',
      rooms: engine.rooms.size,
      redis: getRedisStatus(),
      uptime: process.uptime(),
      memory: {
        rss: `${Math.round(memory.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(memory.external / 1024 / 1024)}MB`,
      },
    });
  });

  app.post('/api/register', async (req: Request, res: Response) => {
    const result = registerSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.issues[0].message });
    }
    const { username, password, email, avatarUrl } = result.data;

    if (await getUser(username)) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    if (await getUserByEmail(email)) {
      return res.status(400).json({ error: 'Email already in use' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = makeNewUser({
      id: randomUUID(),
      username,
      email,
      avatarUrl,
      password: hashedPassword,
    });
    await saveUser(newUser);
    const token = jwt.sign(
      { userId: newUser.id, tokenVersion: newUser.tokenVersion },
      JWT_SECRET!,
      { expiresIn: '30d' }
    );
    const userWithoutPassword = sanitizeUser(newUser);
    res.json({ user: userWithoutPassword, token });
  });

  app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
    const result = forgotPasswordSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    const { email } = result.data;

    try {
      const user = await getUserByEmail(email);
      if (!user) {
        // Return success even if user not found to prevent account enumeration
        return res.json({
          message: 'If an account exists with that email, a reset link has been sent.',
        });
      }

      if (!transporter) {
        logger.error('Nodemailer transporter is not configured');
        return res.status(500).json({ error: 'Email service not configured' });
      }

      const resetToken = randomUUID();
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour
      await createPasswordResetToken(user.id, resetToken, expiresAt);

      const origin = getAppUrl(req);
      const resetLink = `${origin}/reset-password?token=${resetToken}`;

      await transporter.sendMail({
        from: `"The Assembly" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Reset your Assembly Password',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #0a0a0a; color: white; border: 1px solid #333; border-radius: 12px;">
            <h1 style="color: #ef4444; text-transform: uppercase; letter-spacing: 2px;">The Assembly</h1>
            <p>You requested to reset your password. Click the button below to proceed:</p>
            <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background-color: #ef4444; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 20px;">Reset Password</a>
            <p style="margin-top: 30px; font-size: 12px; color: #888;">This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.</p>
          </div>
        `,
      });

      res.json({ message: 'If an account exists with that email, a reset link has been sent.' });
    } catch (err: any) {
      logger.error({ err }, 'Forgot password error');
      res.status(500).json({ error: 'Failed to process request' });
    }
  });

  app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
    const result = resetPasswordSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid request or password too short' });
    }
    const { token, newPassword } = result.data;

    try {
      const userId = await verifyPasswordResetToken(token);
      if (!userId) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }

      const user = await getUserById(userId);
      if (!user) return res.status(404).json({ error: 'User not found' });

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      await saveUser(user);
      await deletePasswordResetTokens(userId);

      res.json({ message: 'Password reset successful. You can now login with your new password.' });
    } catch (err: any) {
      logger.error({ err }, 'Reset password error');
      res.status(500).json({ error: 'Failed to reset password' });
    }
  });

  app.post('/api/user/update-email', requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const result = updateEmailSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: 'Invalid email address' });
      }
      const { email } = result.data;

      // Check if email is already taken
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

  app.post('/api/login', async (req: Request, res: Response) => {
    const { username, password } = req.body;
    const user = await getUser(username);
    if (!user || !user.password || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ userId: user.id, tokenVersion: user.tokenVersion }, JWT_SECRET!, {
      expiresIn: '30d',
    });
    const userWithoutPassword = sanitizeUser(user);
    res.json({ user: userWithoutPassword, token });
  });

  app.post('/api/logout', requireAuth, async (req: Request, res: Response) => {
    const user = req.user!;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await saveUser(user);
    res.json({ success: true, message: 'Logged out' });
  });

  app.get('/api/me', requireAuth, async (req: Request, res: Response) => {
    const userWithoutPassword = sanitizeUser(req.user!);
    res.json({ user: userWithoutPassword });
  });

  app.post('/api/user/update-username', requireAuth, async (req: Request, res: Response) => {
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

  // Mark tutorial as completed — adds 'tutorial-complete' to claimedRewards
  app.post('/api/tutorial-complete', requireAuth, async (req: Request, res: Response) => {
    const user = req.user!;
    if (!user.claimedRewards.includes('tutorial-complete')) {
      user.claimedRewards.push('tutorial-complete');
      await saveUser(user);
    }
    const safe = sanitizeUser(user);
    res.json({ user: safe });
  });

  // Match history — returns last X games for a user
  app.get('/api/match-history/:userId', requireAuth, async (req: Request, res: Response) => {
    const user = req.user!;

    // IDOR Mitigation: Only owner or admin can read this history
    if (user.id !== req.params.userId && !user.isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const history = await getMatchHistory(req.params.userId, limit, offset);
    res.json({ history });
  });

  // Claim a season pass reward
  app.post('/api/pass/claim', requireAuth, async (req: Request, res: Response) => {
    const { rewardId, itemId } = req.body;
    const user = req.user!;
    if (user.claimedRewards.includes(rewardId)) {
      return res.status(400).json({ error: 'Already claimed' });
    }
    // Grant the cosmetic item if one is attached
    if (itemId && !user.ownedCosmetics.includes(itemId)) {
      user.ownedCosmetics.push(itemId);
    }
    // Grant CP for the level-30 reward
    if (rewardId === 'pass-0-lvl30') {
      user.cabinetPoints = (user.cabinetPoints ?? 0) + 500;
    }
    user.claimedRewards.push(rewardId);
    await saveUser(user);
    const safe = sanitizeUser(user);
    res.json({ user: safe });
  });

  // Pin/unpin achievements — body: { pinnedAchievements: string[] } (max 3 IDs)
  app.post('/api/achievements/pin', requireAuth, async (req: Request, res: Response) => {
    const user = req.user!;

    const { pinnedAchievements } = req.body;
    if (!Array.isArray(pinnedAchievements) || pinnedAchievements.length > 3) {
      return res
        .status(400)
        .json({ error: 'pinnedAchievements must be an array of up to 3 IDs' });
    }

    // Verify each ID is actually earned by this user
    const earned = new Set(
      (user.earnedAchievements ?? []).map((a: any) => (typeof a === 'string' ? a : a.id))
    );
    const valid = pinnedAchievements.filter((id: string) => earned.has(id)).slice(0, 3);

    user.pinnedAchievements = valid;
    await saveUser(user);
    const safe = sanitizeUser(user);
    res.json({ user: safe });
  });

  // Recently played with — returns the stored list from the user record
  app.get('/api/recently-played', requireAuth, async (req: Request, res: Response) => {
    res.json({ recentlyPlayedWith: req.user!.recentlyPlayedWith ?? [] });
  });

  // ── Google OAuth ──────────────────────────────────────────────────────────

  app.get('/api/auth/google/url', (req: Request, res: Response) => {
    const origin = getAppUrl(req);
    const platform = req.query.platform === 'android' ? 'android' : 'web';
    const state = encodeURIComponent(JSON.stringify({ origin, platform }));
    const clientId = process.env.GOOGLE_CLIENT_ID;
    logger.info({ clientId }, 'Google Client ID');
    if (!clientId) {
      logger.error('GOOGLE_CLIENT_ID is not set!');
      return res.status(500).json({ error: 'Google OAuth not configured' });
    }
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${origin}/auth/google/callback`,
      response_type: 'code',
      scope: 'openid profile email',
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
  });

  app.get(
    ['/auth/google/callback', '/auth/google/callback/'],
    authLimiter,
    async (req: Request, res: Response) => {
      const { code } = req.query;
      if (!code) return res.status(400).send('No code provided');
      try {
        const origin = getAppUrl(req);
        let platform = 'web';
        if (req.query.state) {
          try {
            platform = JSON.parse(decodeURIComponent(req.query.state as string)).platform || 'web';
          } catch (e) {}
        }
        const redirectUri = `${origin}/auth/google/callback`;
        const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
          code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
        });
        const userRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
        });
        const googleUser = userRes.data;
        const fallback = `google_${googleUser.sub}`;

        let user = await getUserByGoogleId(googleUser.sub);
        if (!user) {
          let username = googleUser.name || fallback;
          if (await getUser(username)) username = fallback;
          user = makeNewUser({
            id: randomUUID(),
            username,
            avatarUrl: googleUser.picture,
            googleId: googleUser.sub,
          });
          await saveUser(user);
        } else {
          user.avatarUrl = googleUser.picture;
          await saveUser(user);
        }
        const token = jwt.sign({ userId: user.id, tokenVersion: user.tokenVersion }, JWT_SECRET!, {
          expiresIn: '30d',
        });
        res.send(oauthSuccessPage(user, token, platform, (res as any).locals.nonce));
      } catch (err: unknown) {
        logger.error({ err: getErrorMessage(err) }, 'Google OAuth Error');
        res.status(500).send('Authentication failed');
      }
    }
  );

  // ── Discord OAuth ─────────────────────────────────────────────────────────

  async function handleDiscordAuth(code: string, origin: string) {
    const redirectUri = `${origin}/auth/discord/callback`;
    const tokenRes = await axios.post(
      'https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: redirectUri,
      })
    );
    const userRes = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
    });
    const discordUser = userRes.data;
    const fallback = `discord_${discordUser.id}`;
    const avatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : `https://cdn.discordapp.com/embed/avatars/${parseInt(discordUser.discriminator) % 5}.png`;

    let user = await getUserByDiscordId(discordUser.id);
    if (!user) {
      let username = discordUser.username || fallback;
      if (await getUser(username)) username = fallback;
      user = makeNewUser({ id: randomUUID(), username, avatarUrl, discordId: discordUser.id });
      await saveUser(user);
    } else {
      user.avatarUrl = avatarUrl;
      await saveUser(user);
    }
    const token = jwt.sign({ userId: user.id, tokenVersion: user.tokenVersion }, JWT_SECRET!, {
      expiresIn: '30d',
    });
    return { user, token };
  }

  app.get('/api/auth/discord/url', (req: Request, res: Response) => {
    const origin = getAppUrl(req);
    const platform = req.query.platform === 'android' ? 'android' : 'web';
    const state = encodeURIComponent(JSON.stringify({ origin, platform }));
    const clientId = process.env.DISCORD_CLIENT_ID;
    logger.info({ clientId }, 'Discord Client ID');
    if (!clientId) {
      logger.error('DISCORD_CLIENT_ID is not set!');
      return res.status(500).json({ error: 'Discord OAuth not configured' });
    }
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${origin}/auth/discord/callback`,
      response_type: 'code',
      scope: 'identify email',
      state,
    });
    res.json({ url: `https://discord.com/api/oauth2/authorize?${params}` });
  });

  app.post('/api/auth/discord/callback', authLimiter, async (req: Request, res: Response) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'No code provided' });
    try {
      const origin = getAppUrl(req);
      const { user, token } = await handleDiscordAuth(code, origin);
      const userWithoutPassword = sanitizeUser(user);
      res.json({ user: userWithoutPassword, token });
    } catch (err: unknown) {
      logger.error({ err: getErrorMessage(err) }, 'Discord Activity Auth Error');
      res.status(500).json({ error: 'Authentication failed' });
    }
  });

  app.get(
    ['/auth/discord/callback', '/auth/discord/callback/'],
    authLimiter,
    async (req: Request, res: Response) => {
      const { code } = req.query;
      if (!code) return res.status(400).send('No code provided');
      try {
        const origin = getAppUrl(req);
        let platform = 'web';
        if (req.query.state) {
          try {
            platform = JSON.parse(decodeURIComponent(req.query.state as string)).platform || 'web';
          } catch (e) {}
        }
        const { user, token } = await handleDiscordAuth(code as string, origin);
        res.send(oauthSuccessPage(user, token, platform, (res as any).locals.nonce));
      } catch (err: unknown) {
        logger.error({ err: getErrorMessage(err) }, 'Discord OAuth Error');
        res.status(500).send('Authentication failed');
      }
    }
  );

  // ── Rooms ─────────────────────────────────────────────────────────────────

  app.get('/api/rooms', async (_req: Request, res: Response) => {
    const roomList = await Promise.all(
      Array.from(engine.rooms.entries()).map(([id, state]) => {
        const averageElo = state.averageElo;
        const host = state.players.find((p) => p.userId === state.hostUserId) || state.players[0];
        return {
          id,
          name: state.roomId,
          playerCount: state.players.length,
          spectatorCount: state.spectators.length,
          maxPlayers: state.maxPlayers,
          phase: state.phase,
          actionTimer: state.actionTimer,
          playerAvatars: state.players.map((p) => p.avatarUrl || '').filter(Boolean),
          mode: state.mode,
          averageElo,
          privacy: state.privacy ?? 'public',
          isLocked: state.isLocked ?? false,
          hostName: host?.name || 'Unknown',
        } as RoomInfo;
      })
    );
    res.json(roomList);
  });

  app.get('/api/leaderboard', async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const boards = await getAllLeaderboards(limit, offset);
    const strip = (arr: any[]) => arr.map((u) => sanitizeUser(u as UserInternal));
    res.json({
      overall: strip(boards.overall),
      ranked: strip(boards.ranked),
      casual: strip(boards.casual),
      classic: strip(boards.classic),
    });
  });

  // ── Admin ─────────────────────────────────────────────────────────────────

  app.get('/api/admin/test', requireAdmin, async (req, res) => {
    const { data, error } = await db.from('users').select('id, username').limit(5);
    res.json({ data, error, isConfigured });
  });

  app.get('/api/admin/users/search', requireAdmin, async (req, res) => {
    const admin = (req as any).user;
    const query = req.query.q as string;
    logger.info({ adminId: admin.id, query }, 'Admin User Search Request');

    const users = await searchUsers(query, admin.id, 20);
    res.json(users.map((u) => sanitizeUser(u as UserInternal)));
  });

  app.get('/api/admin/config', requireAdmin, async (req, res) => {
    const config = await getSystemConfig();
    res.json(config);
  });

  app.get('/api/global-stats', async (_req: Request, res: Response) => {
    try {
      const stats = await getGlobalStats();
      res.json(stats || { civilWins: 0, stateWins: 0 });
    } catch (err) {
      logger.error({ err }, 'Error fetching global stats');
      res.json({ civilWins: 0, stateWins: 0 });
    }
  });

  app.get('/api/rejoin-info', (req: Request, res: Response) => {
    const userId = req.query.userId as string;
    if (!userId) return res.json({ canRejoin: false });
    for (const state of engine.rooms.values()) {
      const player = state.players.find((p) => p.userId === userId && p.isDisconnected);
      if (player) {
        return res.json({
          canRejoin: true,
          roomId: state.roomId,
          roomName: state.roomId,
          mode: state.mode,
        });
      }
    }
    res.json({ canRejoin: false });
  });

  // ── Shop ──────────────────────────────────────────────────────────────────

  app.post('/api/shop/buy', requireAuth, async (req: Request, res: Response) => {
    const { itemId } = req.body;
    const user = req.user!;

    const item = DEFAULT_ITEMS.find((i) => i.id === itemId);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    if (user.stats.points < item.price)
      return res.status(400).json({ error: 'Not enough points' });
    if (user.ownedCosmetics.includes(itemId))
      return res.status(400).json({ error: 'Already owned' });

    user.stats.points -= item.price;
    user.ownedCosmetics.push(itemId);
    await saveUser(user);
    const userWithoutPassword = sanitizeUser(user);
    res.json({ user: userWithoutPassword });
  });

  // ── Stripe Payments ──────────────────────────────────────────────────────

  app.post('/api/create-checkout-session', requireAuth, async (req: Request, res: Response) => {
    if (!process.env.STRIPE_SECRET_KEY)
      return res.status(503).json({ error: 'Payment service not configured.' });

    const { packageId } = req.body;
    const user = req.user!;

    try {
      const pkg = CP_PACKAGES.find((p) => p.id === packageId);
      if (!pkg) return res.status(400).json({ error: 'Invalid package' });

      const origin = getAppUrl(req);

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: pkg.name,
                description: `Purchase ${pkg.cp} Cabinet Points`,
              },
              unit_amount: pkg.price,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${origin}/?purchase=success`,
        cancel_url: `${origin}/?purchase=cancel`,
        metadata: {
          userId: user.id,
          cpAmount: pkg.cp.toString(),
        },
      });

      res.json({ url: session.url });
    } catch (err: any) {
      logger.error({ err: err.message }, 'Stripe Create Session Error');
      res.status(500).json({ error: 'Failed to create checkout session' });
    }
  });

  // ── Friends ───────────────────────────────────────────────────────────────

  app.get('/api/friends/status', requireAuth, async (req: Request, res: Response) => {
    const user = req.user!;
    try {
      const friends = await getFriends(user.id);
      const statuses: Record<string, { isOnline: boolean; roomId?: string }> = {};
      for (const friend of friends) {
        const friendSocketId = userSockets.get(friend.id);
        if (friendSocketId) {
          let roomId: string | undefined;
          for (const [rId, state] of rooms.entries()) {
            if (state.players.some((p) => p.userId === friend.id && !p.isDisconnected)) {
              roomId = rId;
              break;
            }
          }
          statuses[friend.id] = { isOnline: true, roomId };
        } else {
          statuses[friend.id] = { isOnline: false };
        }
      }
      res.json({ statuses });
    } catch (_) {
      res.status(500).json({ error: 'Failed to fetch friend statuses' });
    }
  });

  // Pending friend requests received by this user
  app.get('/api/friends/pending', requireAuth, async (req: Request, res: Response) => {
    const user = req.user!;
    const pending = await getPendingFriendRequests(user.id);
    res.json({ pending });
  });

  // Search users by username (for friend search)
  app.get('/api/users/search', requireAuth, async (req: Request, res: Response) => {
    const query = req.query.q as string;
    const currentUser = req.user!;
    if (!query || query.length < 2) return res.json({ users: [] });
    try {
      const results = await searchUsers(query, currentUser.id);
      // Attach isFriend status to each result
      const withStatus = await Promise.all(
        results.map(async (u: UserInternal) => {
          const friendStatus = await isFriend(currentUser.id, u.id);
          const safe = sanitizeUser(u);
          return { ...safe, isFriend: friendStatus };
        })
      );
      res.json({ users: withStatus });
    } catch (_) {
      res.status(500).json({ error: 'Failed to search users' });
    }
  });

  app.get('/api/friends', requireAuth, async (req: Request, res: Response) => {
    const user = req.user!;
    const friends = await getFriends(user.id);
    res.json({ friends });
  });

  app.post('/api/friends/request', requireAuth, async (req: Request, res: Response) => {
    const { targetUserId } = req.body;
    const user = req.user!;
    await sendFriendRequest(user.id, targetUserId);
    res.json({ success: true });
  });

  app.post('/api/friends/accept', requireAuth, async (req: Request, res: Response) => {
    const { targetUserId } = req.body;
    const user = req.user!;
    await acceptFriendRequest(user.id, targetUserId);
    res.json({ success: true });
  });

  app.get('/api/user/:userId', requireAuth, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    const user = await getUserById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isFriendStatus = await isFriend(currentUser.id, user.id);

    const userWithoutPassword = sanitizeUser(user);
    res.json({ user: userWithoutPassword, isFriend: isFriendStatus });
  });

  app.delete('/api/friends/:targetUserId', requireAuth, async (req: Request, res: Response) => {
    const user = req.user!;
    await removeFriend(user.id, req.params.targetUserId);
    res.json({ success: true });
  });

  app.post('/api/friends/invite/:friendId', requireAuth, async (req: Request, res: Response) => {
    const { roomId } = req.body;
    const user = req.user!;

    const friendSocketId = userSockets.get(req.params.friendId);
    if (friendSocketId) {
      io.to(friendSocketId).emit('friendInvite', {
        fromUserId: user.id,
        fromUsername: user.username,
        roomId,
      });
    }
    res.json({ success: true });
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
      if (frameId && !isItemUnlocked(frameId))
        return res.status(400).json({ error: 'Not owned' });
      user.activeFrame = frameId;
    }
    if (policyStyle !== undefined) {
      if (policyStyle && !isItemUnlocked(policyStyle))
        return res.status(400).json({ error: 'Not owned' });
      user.activePolicyStyle = policyStyle;
    }
    if (votingStyle !== undefined) {
      if (votingStyle && !isItemUnlocked(votingStyle))
        return res.status(400).json({ error: 'Not owned' });
      user.activeVotingStyle = votingStyle;
    }
    if (music !== undefined) {
      if (music && !isItemUnlocked(music)) return res.status(400).json({ error: 'Not owned' });
      user.activeMusic = music;
    }
    if (soundPack !== undefined) {
      if (soundPack && !isItemUnlocked(soundPack))
        return res.status(400).json({ error: 'Not owned' });
      user.activeSoundPack = soundPack;
    }
    if (backgroundId !== undefined) {
      if (backgroundId && !isItemUnlocked(backgroundId))
        return res.status(400).json({ error: 'Not owned' });
      user.activeBackground = backgroundId;
    }

    await saveUser(user);

    // Push cosmetic changes to all live rooms immediately
    for (const room of rooms.values()) {
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
  
  // ── TTS proxy ─────────────────────────────────────────────────────────────
  // Calls Gemini TTS server-side so the API key is never exposed in the
  // client bundle. Returns the base64-encoded WAV audio from Gemini directly.

  app.post('/api/tts', requireAuth, async (req: Request, res: Response) => {
    const { text, voice } = req.body as { text?: string; voice?: string };

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'text is required' });
    }
    if (text.length > 500) {
      return res.status(400).json({ error: 'text too long (max 500 chars)' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'TTS not configured' });
    }

    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text }] }],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: voice ?? 'Puck' },
                },
              },
            },
          }),
        }
      );

      if (!geminiRes.ok) {
        const err = await geminiRes.text();
        logger.error({ err }, 'TTS Gemini error');
        return res.status(502).json({ error: 'TTS upstream error' });
      }

      const data = (await geminiRes.json()) as any;
      const base64Audio = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!base64Audio) {
        return res.status(502).json({ error: 'No audio returned from TTS' });
      }

      res.json({ audio: base64Audio });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ msg }, 'TTS Request failed');
      res.status(500).json({ error: 'TTS request failed' });
    }
  });

  // ── WebRTC ICE Servers ────────────────────────────────────────────────────
  // Provides STUN and time-limited TURN credentials to authenticated users.
  app.get('/api/webrtc/ice-servers', requireAuth, (req: Request, res: Response) => {
    const iceServers: any[] = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];

    const turnUrl = process.env.TURN_URL; // e.g., "turn:turn.theassembly.net:3478"
    const turnSecret = process.env.TURN_SECRET; // Shared secret for coturn/Xirsys
    const turnUsername = process.env.TURN_USERNAME; // Optional fixed prefix

    if (turnUrl && turnSecret) {
      // Time-limited credentials (standard for coturn/Xirsys/Cloudflare)
      const unixTimestamp = Math.floor(Date.now() / 1000) + 3600; // 1h validity
      const username = `${unixTimestamp}:${turnUsername || req.user!.id}`;
      const hmac = createHmac('sha1', turnSecret);
      hmac.update(username);
      const password = hmac.digest('base64');

      iceServers.push({
        urls: turnUrl.split(','), // Support comma-separated URLs
        username,
        credential: password,
      });
    } else if (turnUrl && turnUsername && process.env.TURN_PASSWORD) {
      // Fixed credentials (fallback)
      iceServers.push({
        urls: turnUrl.split(','),
        username: turnUsername,
        credential: process.env.TURN_PASSWORD,
      });
    }

    res.json({ iceServers });
  });
}
