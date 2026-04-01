import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import rateLimit from 'express-rate-limit';
import nodemailer from 'nodemailer';

import { RouteContext } from './types.ts';
import { JWT_SECRET, sanitizeUser } from './shared.ts';
import { getAppUrl } from '../utils.ts';
import { logger } from '../logger.ts';
import { registerSchema, forgotPasswordSchema, resetPasswordSchema } from '../schemas.ts';
import {
  getUser,
  getUserById,
  getUserByEmail,
  saveUser,
  makeNewUser,
  createPasswordResetToken,
  verifyPasswordResetToken,
  deletePasswordResetTokens,
} from '../db/index.ts';

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
      return res.status(400).json({ code: 'ALREADY_EXISTS', message: 'Username already exists' });
    }
    if (await getUserByEmail(email)) {
      return res.status(400).json({ code: 'ALREADY_EXISTS', message: 'Email already in use' });
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
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    res.json({ user: userWithoutPassword, token });
  });

  app.post('/api/login', authLimiter, async (req: Request, res: Response) => {
    const { username, password } = req.body;
    const user = await getUser(username);
    if (!user || user.password === undefined || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });
    }
    if (user.isBanned) {
      return res.status(403).json({ code: 'BANNED', message: 'Account restricted.' });
    }
    const token = jwt.sign({ userId: user.id, tokenVersion: user.tokenVersion }, JWT_SECRET!, {
      expiresIn: '30d',
    });
    const userWithoutPassword = sanitizeUser(user);
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
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

  app.post('/api/logout', (req: Request, res: Response) => {
    res.clearCookie('token');
    res.json({ success: true });
  });

  app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
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
}
