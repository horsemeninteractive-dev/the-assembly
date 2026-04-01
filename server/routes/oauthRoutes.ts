import { Request, Response } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import rateLimit from 'express-rate-limit';

import { RouteContext } from './types.ts';
import { JWT_SECRET, sanitizeUser, getErrorMessage } from './shared.ts';
import { getAppUrl } from '../utils.ts';
import { logger } from '../logger.ts';
import {
  getUser,
  getUserById,
  getUserByGoogleId,
  getUserByDiscordId,
  saveUser,
  makeNewUser,
} from '../db/index.ts';
import {
  setOAuthExchangeCode,
  consumeOAuthExchangeCode,
  setOAuthNonce,
  verifyOAuthNonce,
} from '../redis.ts';
import { oauthSuccessPage } from '../templates/oauthSuccess.ts';

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

export function registerOAuthRoutes({ app }: RouteContext): void {
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts. Please try again later.' },
  });

  app.post('/api/auth/exchange', async (req: Request, res: Response) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'No code provided' });

    try {
      const data = await consumeOAuthExchangeCode(code);
      if (!data) {
        return res.status(400).json({ error: 'Invalid or expired exchange code' });
      }

      const user = await getUserById(data.userId);
      if (!user) return res.status(404).json({ error: 'User not found' });

      res.cookie('token', data.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
      res.json({
        user: sanitizeUser(user),
        token: data.token,
      });
    } catch (err) {
      logger.error({ err }, 'OAuth exchange error');
      res.status(500).json({ error: 'Failed to exchange code' });
    }
  });

  app.get('/api/auth/google/url', async (req: Request, res: Response) => {
    const origin = getAppUrl(req);
    const platform = req.query.platform === 'android' ? 'android' : 'web';
    const csrfNonce = randomUUID();
    await setOAuthNonce(csrfNonce);
    const state = encodeURIComponent(JSON.stringify({ origin, platform, csrfNonce }));
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
            const stateData = JSON.parse(decodeURIComponent(req.query.state as string));
            const { csrfNonce } = stateData;
            if (!csrfNonce || !(await verifyOAuthNonce(csrfNonce))) {
              logger.warn({ csrfNonce }, 'Invalid or missing OAuth CSRF nonce');
              return res.status(403).send('Authentication failed: CSRF verification failed.');
            }
            platform = stateData.platform || 'web';
          } catch (e) {
            return res.status(400).send('Invalid state parameter');
          }
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

        const exchangeCode = randomUUID();
        await setOAuthExchangeCode(exchangeCode, { userId: user.id, token });

        res.send(oauthSuccessPage(user, token, platform, (res as any).locals.nonce, exchangeCode));
      } catch (err: unknown) {
        logger.error({ err: getErrorMessage(err) }, 'Google OAuth Error');
        res.status(500).send('Authentication failed');
      }
    }
  );

  app.get('/api/auth/discord/url', async (req: Request, res: Response) => {
    const origin = getAppUrl(req);
    const platform = req.query.platform === 'android' ? 'android' : 'web';
    const csrfNonce = randomUUID();
    await setOAuthNonce(csrfNonce);
    const state = encodeURIComponent(JSON.stringify({ origin, platform, csrfNonce }));
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
            const stateData = JSON.parse(decodeURIComponent(req.query.state as string));
            const { csrfNonce } = stateData;
            if (!csrfNonce || !(await verifyOAuthNonce(csrfNonce))) {
              logger.warn({ csrfNonce }, 'Invalid or missing OAuth CSRF nonce');
              return res.status(403).send('Authentication failed: CSRF verification failed.');
            }
            platform = stateData.platform || 'web';
          } catch (e) {
            return res.status(400).send('Invalid state parameter');
          }
        }
        const { user, token } = await handleDiscordAuth(code as string, origin);
        
        const exchangeCode = randomUUID();
        await setOAuthExchangeCode(exchangeCode, { userId: user.id, token });

        res.send(oauthSuccessPage(user, token, platform, (res as any).locals.nonce, exchangeCode));
      } catch (err: unknown) {
        logger.error({ err: getErrorMessage(err) }, 'Discord OAuth Error');
        res.status(500).send('Authentication failed');
      }
    }
  );
}
