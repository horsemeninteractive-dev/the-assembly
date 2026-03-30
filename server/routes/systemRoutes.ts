import { Request, Response } from 'express';
import { RouteContext } from './types.ts';
import { getRedisStatus } from '../redis.ts';
import { getGlobalStats, getAllLeaderboards } from '../supabaseService.ts';
import { logger } from '../logger.ts';
import rateLimit from 'express-rate-limit';
import { requireAuth, sanitizeUser } from './shared.ts';
import { createHmac } from 'crypto';
import { UserInternal } from '../../src/types.ts';

export function registerSystemRoutes({ app, engine }: RouteContext): void {
  const costLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down.' },
  });

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

  app.get('/api/global-stats', async (_req: Request, res: Response) => {
    try {
      const stats = await getGlobalStats();
      res.json(stats || { civilWins: 0, stateWins: 0 });
    } catch (err) {
      logger.error({ err }, 'Error fetching global stats');
      res.json({ civilWins: 0, stateWins: 0 });
    }
  });

  app.post('/api/tts', costLimiter, requireAuth, async (req: Request, res: Response) => {
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

  app.get('/api/webrtc/ice-servers', requireAuth, (req: Request, res: Response) => {
    const iceServers: any[] = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];

    const turnUrl = process.env.TURN_URL;
    const turnSecret = process.env.TURN_SECRET;
    const turnUsername = process.env.TURN_USERNAME;

    if (turnUrl && turnSecret) {
      const unixTimestamp = Math.floor(Date.now() / 1000) + 3600;
      const username = `${unixTimestamp}:${turnUsername || req.user!.id}`;
      const hmac = createHmac('sha1', turnSecret);
      hmac.update(username);
      const password = hmac.digest('base64');

      iceServers.push({
        urls: turnUrl.split(','),
        username,
        credential: password,
      });
    } else if (turnUrl && turnUsername && process.env.TURN_PASSWORD) {
      iceServers.push({
        urls: turnUrl.split(','),
        username: turnUsername,
        credential: process.env.TURN_PASSWORD,
      });
    }

    res.json({ iceServers });
  });
}
