import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserInternal } from '../../src/types.ts';
import { getUserById } from '../supabaseService.ts';
import { env } from '../env.ts';

declare global {
  namespace Express {
    interface Request {
      user?: UserInternal;
    }
    interface Response {
      locals: {
        nonce?: string;
      };
    }
  }
}

export const JWT_SECRET = env.JWT_SECRET;

export function htmlEscape(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function sanitizeUser(user: UserInternal): Omit<UserInternal, 'password'> {
  const { password, ...safeUser } = user;
  return safeUser;
}

export async function validateToken(token: string): Promise<UserInternal | null> {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET!) as { userId: string; tokenVersion?: number };
    const user = await getUserById(decoded.userId);
    if (!user) return null;
    if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== user.tokenVersion) {
      return null;
    }
    return user;
  } catch (_) {
    return null;
  }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  const user = await validateToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid or expired session' });
  if (!user.isAdmin) return res.status(403).json({ error: 'Forbidden' });
  (req as any).user = user;
  next();
}

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

export function getErrorMessage(err: unknown): string {
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
