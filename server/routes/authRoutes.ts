import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { randomUUID } from 'crypto';
import rateLimit from 'express-rate-limit';
import nodemailer from 'nodemailer';
import { RouteContext } from './types.ts';
import { JWT_SECRET, sanitizeUser, getErrorMessage } from './shared.ts';
import { getAppUrl, isAllowedOrigin } from '../utils.ts';
import { logger } from '../logger.ts';
import { UserInternal } from '../../src/types.ts';
import {
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../schemas.ts';
import {
  getUser,
  getUserById,
  getUserByGoogleId,
  getUserByDiscordId,
  getUserByEmail,
  saveUser,
  makeNewUser,
  createPasswordResetToken,
  verifyPasswordResetToken,
  deletePasswordResetTokens,
} from '../supabaseService.ts';

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

function oauthSuccessPage(
  user: UserInternal,
  token: string,
  platform: string = 'web',
  nonce: string = ''
): string {
  const targetOrigin = process.env.APP_URL || 'https://theassembly.web.app';
  const saneUser = sanitizeUser(user);
  const nonceAttr = nonce ? ` nonce="${nonce}"` : '';

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

export function registerAuthRoutes({ app }: RouteContext): void {
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts. Please try again later.' },
  });

  const forgotPasswordLimiter = rateLimit({
    windowMs: 30 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many reset requests. Please wait 30 minutes.' },
  });

  app.post('/api/register', authLimiter, async (req: Request, res: Response) => {
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

  app.post('/api/login', authLimiter, async (req: Request, res: Response) => {
    const { username, password } = req.body;
    const user = await getUser(username);
    if (!user || !user.password || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (user.isBanned) {
      return res.status(403).json({ error: 'Account restricted.' });
    }
    const token = jwt.sign({ userId: user.id, tokenVersion: user.tokenVersion }, JWT_SECRET!, {
      expiresIn: '30d',
    });
    const userWithoutPassword = sanitizeUser(user);
    res.json({ user: userWithoutPassword, token });
  });

  app.post('/api/auth/forgot-password', forgotPasswordLimiter, async (req: Request, res: Response) => {
    const result = forgotPasswordSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    const { email } = result.data;

    try {
      const user = await getUserByEmail(email);
      if (!user) {
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

  app.post('/api/auth/reset-password', authLimiter, async (req: Request, res: Response) => {
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
}
