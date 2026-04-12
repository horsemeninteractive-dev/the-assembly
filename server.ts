import { env } from './server/env.ts';
import { logger } from './server/logger.ts';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import { statsSchema } from './server/game/schemas.ts';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createServer as createViteServer } from 'vite';
import { randomUUID, randomBytes, createHash } from 'crypto';
import fs from 'fs';
import { z } from 'zod';
import cookieParser from 'cookie-parser';

interface SocketData {
  userId?: string;
  isAdmin?: boolean;
  chatTokens?: number;
  gameTokens?: number;
  lastChatLimitCheck?: number;
  lastGameLimitCheck?: number;
  _presenceInterval?: NodeJS.Timeout;
}
import { User, GameState, Player } from './shared/types.ts';
import { createDeck, isAllowedOrigin } from './server/utils.ts';
import { GameEngine } from './server/gameEngine.ts';
import { registerRoutes, validateToken } from './server/apiRoutes.ts';
import { handleJoinRoom } from './server/handlers/joinRoomHandler.ts';
import {
  getUserById,
  sendFriendRequest,
  acceptFriendRequest,
  getFriends,
  isFriend,
  getSystemConfig,
  updateSystemConfig,
  saveUser,
  isStripeEventProcessed,
  recordStripeEvent,
} from './server/supabaseService.ts';
import { getMatchById } from './server/db/matches.ts';
import { pubClient, subClient, isRedisConfigured, setUserSocketId, getSocketId, getUserSocketId, removeUserSocketId, refreshUserStatus } from './server/redis.ts';
import { SystemConfig } from './shared/types.ts';
import { registerStripeWebhook, stripe } from './server/handlers/stripeHandler.ts';
import { registerSocketAuthMiddleware } from './server/handlers/socketAuthHandler.ts';
import { registerPresenceHandlers } from './server/handlers/presenceHandler.ts';

/** Global set to track in-flight database asynchronous writes during graceful shutdown. */
export const inFlightWrites = new Set<Promise<any>>();

import { registerGameActionHandlers } from './server/handlers/gameActionHandler.ts';
import { registerAdminHandlers } from './server/handlers/adminHandler.ts';
import { challengeNotifier } from './server/challengeNotifier.ts';

const PORT = env.PORT;

let httpServer: any;
let io: Server<any, any, any, SocketData>;

async function startServer() {
  logger.info('Starting with Stripe integration...');

  // Generate CSP hashes from index.html for production
  let prodScriptHashes = '';
  if (env.NODE_ENV === 'production') {
    try {
      const htmlPath = path.resolve('dist', 'index.html');
      if (fs.existsSync(htmlPath)) {
        const html = fs.readFileSync(htmlPath, 'utf8');
        const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
        let match;
        const hashes: string[] = [];
        while ((match = scriptRegex.exec(html)) !== null) {
          if (match[1] && match[1].trim() !== '') {
            const hash = createHash('sha256').update(match[1]).digest('base64');
            hashes.push(`'sha256-${hash}'`);
          }
        }
        if (hashes.length > 0) {
          prodScriptHashes = ' ' + hashes.join(' ');
        }
      }
    } catch (err: any) {
      logger.error({ err: err.message }, 'Failed to parse index.html for CSP hashes');
    }
  }

  const isProd = env.NODE_ENV === 'production';
  const scriptSrc = isProd
    ? [
        "'self'",
        ...prodScriptHashes.trim().split(' ').filter(Boolean),
        'https://*.discord.com',
        (_req: any, res: any) => `'nonce-${res.locals.nonce}'`,
      ]
    : [
        // Dev: no nonce — presence of nonce causes browsers to ignore 'unsafe-inline'
        // per CSP spec, which breaks Vite's injected HMR scripts.
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        'https://*.discord.com',
      ];

  const app = express();
  
  // Generate a nonce for every request to allow specific inline styles/scripts without 'unsafe-inline'
  app.use((_req, res, next) => {
    res.locals.nonce = randomBytes(16).toString('base64');
    next();
  });

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'", 'https://*.discord.com', 'https://*.discordapp.io'],
          scriptSrc,
          styleSrc: [
            "'self'",
            'https://fonts.googleapis.com',
            // In development, we keep unsafe-inline for Vite's HMR and Tailwind 4 JIT.
            // In production, we use the nonce.
            isProd ? (_req, res) => `'nonce-${(res as any).locals.nonce}'` : "'unsafe-inline'",
          ],
          fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
          imgSrc: [
            "'self'",
            'data:',
            'blob:',
            'https://*.discord.com',
            'https://*.discordapp.com',
            'https://lh3.googleusercontent.com',
            'https://api.dicebear.com',
            'https://*.dicebear.com',
            'https://picsum.photos',
            'https://i.pravatar.cc',
            'https://images.unsplash.com',
            'https://raw.githubusercontent.com',
            'https://transparenttextures.com',
            'https://www.transparenttextures.com',
            'https://storage.googleapis.com',
            'https://*.googleapis.com',
            'https://*.gstatic.com',
          ],
          mediaSrc: [
            "'self'",
            'blob:',
            'data:',
            'https://gamesounds.xyz',
            'https://cdn.discordapp.com',
            'https://storage.googleapis.com',
          ],
          connectSrc: [
            "'self'",
            'https://*.supabase.co',
            'https://theassembly.web.app',
            'wss://theassembly.web.app',
            'https://*.a.run.app',
            'wss://*.a.run.app',
            'https://*.discord.com',
            'wss://*.discord.com',
            'https://*.stripe.com',
            'https://*.googleapis.com',
            // Allow Vite HMR websocket in development
            ...(!isProd ? ['ws://localhost:*', 'wss://localhost:*'] : []),
          ],
          frameAncestors: [
            "'self'",
            'https://discord.com',
            'https://*.discord.com',
            'https://*.discordapp.io',
          ],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );
  app.set('trust proxy', 1);
  app.use(cookieParser());
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (server-to-server, curl, Postman)
        if (!origin || isAllowedOrigin(origin)) return callback(null, true);
        callback(new Error(`CORS: origin '${origin}' not allowed`));
      },
      credentials: true,
    })
  );

  // Stripe webhook must be placed BEFORE express.json() to get the raw body
  registerStripeWebhook(app, () => io, () => userSockets);

  app.use(express.json());

  httpServer = createServer(app);
  io = new Server(httpServer, {
    pingTimeout: 60000,
    pingInterval: 25000,
    cors: {
      origin: (origin, callback) => {
        if (!origin || isAllowedOrigin(origin)) return callback(null, true);
        callback(new Error(`CORS: origin '${origin}' not allowed`));
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Attach Redis adapter for multi-instance pub/sub (no-op if Redis not configured)
  if (isRedisConfigured && pubClient && subClient) {
    io.adapter(createAdapter(pubClient, subClient));
    logger.info('Redis Socket.IO adapter attached');
  }

  const configRef = { current: await getSystemConfig() };
  const engine = new GameEngine({ io, getConfig: () => configRef.current });
  const userSockets = new Map<string, string>();

  // Restore persisted game rooms from Redis before accepting connections
  await engine.restoreFromRedis();

  app.get('/healthz', async (_req, res) => {
    const checks: Record<string, boolean> = { redis: false, supabase: false };
    try {
      if (pubClient) {
        await pubClient.ping();
        checks.redis = true;
      }
    } catch (e: any) {
      logger.warn({ err: e.message }, 'Health check: Redis ping failed');
    }
    try {
      await getSystemConfig();
      checks.supabase = true;
    } catch (e: any) {
      logger.error({ err: e.message }, 'Health check: Supabase connection failed');
    }

    const ok = checks.supabase; // Supabase is critical for auth/config
    res.status(ok ? 200 : 503).json({
      status: ok ? 'ok' : 'degraded',
      checks,
    });
  });

  registerRoutes(app, io, engine, userSockets, stripe);

  // Add headers for Discord Activity media permissions
  app.use((req, res, next) => {
    // Explicitly allow microphone, camera, and display-capture for Discord Activity
    res.setHeader(
      'Permissions-Policy',
      'microphone=*, camera=*, display-capture=*, autoplay=*, screen-wake-lock=*'
    );

    next();
  });

  // Proxy route for external assets to bypass Discord's strict CSP
  app.get('/api/matches/:id', async (req, res) => {
    try {
      const match = await getMatchById(req.params.id);
      if (!match) return res.status(404).json({ error: 'Match not found' });
      res.json(match);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch match' });
    }
  });

  app.get('/proxy', async (req, res) => {
    const url = req.query.url as string;
    if (!url) return res.status(400).send('URL is required');

    try {
      // Enforce HTTPS — block file://, http://, and other non-HTTPS schemes
      // that could be used for SSRF against internal services.
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch {
        return res.status(400).send('Invalid URL');
      }
      if (parsedUrl.protocol !== 'https:') {
        return res.status(403).send('Only HTTPS URLs are allowed');
      }

      // Exact hostname match — endsWith() is vulnerable to subdomain spoofing
      const allowedHostnames = new Set([
        'storage.googleapis.com',
        'gamesounds.xyz',
        'api.dicebear.com',
        'picsum.photos',
        'raw.githubusercontent.com',
        'transparenttextures.com',
        'www.transparenttextures.com',
        'images.unsplash.com',
        'i.pravatar.cc',
        'cdn.discordapp.com',
        'discord.com',
        'fonts.googleapis.com',
        'fonts.gstatic.com',
        'lh3.googleusercontent.com',
      ]);

      if (!allowedHostnames.has(parsedUrl.hostname)) {
        return res.status(403).send('Domain not allowed');
      }

      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      });

      if (!response.ok) {
        logger.error(
          { url, status: response.status, statusText: response.statusText },
          'Proxy fetch failed'
        );
        return res.status(response.status).send(response.statusText);
      }

      const contentType = response.headers.get('content-type');
      if (contentType) res.setHeader('Content-Type', contentType);

      // Add CORP header to allow proxied assets in cross-origin isolated environments
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Access-Control-Allow-Origin', '*');

      // Set cache headers - static assets get 1 year, dynamic/avatars get 1 hour
      const dynamicDomains = [
        'api.dicebear.com',
        'picsum.photos',
        'i.pravatar.cc',
        'cdn.discordapp.com',
        'lh3.googleusercontent.com',
        'discord.com',
      ];
      const isDynamic = dynamicDomains.some((d) => parsedUrl.hostname.includes(d));
      res.setHeader('Cache-Control', isDynamic ? 'public, max-age=3600' : 'public, max-age=31536000');

      const arrayBuffer = await response.arrayBuffer();
      let body = Buffer.from(arrayBuffer);

      // If it's a CSS file from Google Fonts, rewrite URLs to go through the proxy
      if (contentType && contentType.includes('text/css') && url.includes('fonts.googleapis.com')) {
        let css = body.toString();
        // Replace url(https://fonts.gstatic.com/...) with url(/proxy?url=https%3A%2F%2Ffonts.gstatic.com%2F...)
        css = css.replace(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g, (match, fontUrl) => {
          return `url(/proxy?url=${encodeURIComponent(fontUrl)})`;
        });
        body = Buffer.from(css);
      }

      res.send(body);
    } catch (error: any) {
      logger.error({ url, err: error.message }, 'Proxy error fetching URL');
      res.status(500).send('Error fetching resource');
    }
  });

  io.on('connection', (socket) => {
    registerSocketAuthMiddleware(socket);

    const getRoom = (): string | undefined => Array.from(socket.rooms).find((r) => r !== socket.id);

    // Call modular handlers to register event listeners
    registerPresenceHandlers(socket, io, engine, userSockets);
    registerGameActionHandlers(socket, io, engine, userSockets);
    registerAdminHandlers(socket, io, engine, userSockets, configRef);

    socket.on('joinRoom', async (payload: any) => 
      await handleJoinRoom(socket, io, engine, userSockets, configRef.current, payload)
    );
  });

  app.get('/m/:data', (req, res) => {
    const encoded = req.params.data;
    try {
      const json = Buffer.from(encoded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
      const state = JSON.parse(json);

      const winnerName = state.w === 'C' ? 'CIVIL' : 'STATE';
      const factionText = `${state.f.C} Civil • ${state.f.S} State • ${state.f.O} Overseer`;
      const momentsText = state.k.join(' • ');
      
      const title = `${winnerName} VICTORY | The Assembly`;
      const desc = `Round ${state.rd} • ${factionText}\n${momentsText}`;

      res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    
    <!-- Open Graph / Meta Tags -->
    <meta property="og:type" content="website">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${desc}">
    <meta property="og:image" content="https://theassembly.web.app/hero.png">
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${desc}">
    <meta name="twitter:image" content="https://theassembly.web.app/hero.png">

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
    
    <style>
        body {
            margin: 0;
            background: #050505;
            color: #e2e8f0;
            font-family: 'Inter', sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            overflow: hidden;
        }
        .container {
            position: relative;
            width: 100%;
            max-width: 600px;
            padding: 40px;
            text-align: center;
            background: rgba(15, 15, 15, 0.8);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 32px;
            backdrop-filter: blur(20px);
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        .bg-glow {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 300px;
            height: 300px;
            background: ${state.w === 'C' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)'};
            filter: blur(100px);
            z-index: -1;
        }
        h1 {
            font-size: 10px;
            letter-spacing: 0.5em;
            text-transform: uppercase;
            color: #64748b;
            margin: 0 0 24px 0;
        }
        .result {
            font-size: 48px;
            font-weight: 700;
            letter-spacing: -0.02em;
            margin: 0 0 8px 0;
            color: ${state.w === 'C' ? '#60a5fa' : '#ef4444'};
            text-shadow: 0 0 30px ${state.w === 'C' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(239, 68, 68, 0.3)'};
        }
        .reason {
            font-size: 18px;
            color: #94a3b8;
            margin: 0 0 40px 0;
        }
        .stats {
            display: flex;
            justify-content: center;
            gap: 24px;
            margin-bottom: 40px;
            padding: 24px;
            background: rgba(255, 255, 255, 0.03);
            border-radius: 20px;
        }
        .stat {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .stat-label {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: #475569;
        }
        .stat-value {
            font-size: 16px;
            font-weight: 700;
        }
        .moments {
            text-align: left;
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-bottom: 40px;
        }
        .moment {
            font-size: 14px;
            color: #cbd5e1;
            padding-left: 16px;
            border-left: 2px solid ${state.w === 'C' ? '#3b82f6' : '#ef4444'};
        }
        .cta {
            display: inline-block;
            background: #ffffff;
            color: #000000;
            text-decoration: none;
            padding: 16px 32px;
            border-radius: 12px;
            font-weight: 700;
            font-size: 14px;
            transition: transform 0.2s;
        }
        .cta:hover {
            transform: scale(1.05);
        }
    </style>
</head>
<body>
    <div class="bg-glow"></div>
    <div class="container">
        <h1>Mission Report</h1>
        <div class="result">${state.w === 'C' ? 'Civil Victory' : 'State Victory'}</div>
        <div class="reason">${state.r}</div>
        
        <div class="stats">
            <div class="stat">
                <span class="stat-label">Rounds</span>
                <span class="stat-value">${state.rd}</span>
            </div>
            <div class="stat">
                <span class="stat-label">Civil</span>
                <span class="stat-value">${state.f.C}</span>
            </div>
            <div class="stat">
                <span class="stat-label">State</span>
                <span class="stat-value">${state.f.S}</span>
            </div>
            <div class="stat">
                <span class="stat-label">Overseer</span>
                <span class="stat-value">${state.f.O}</span>
            </div>
        </div>

        <div class="moments">
            ${state.k.map((m: any) => `<div class="moment">${m}</div>`).join('')}
        </div>

        <a href="/" class="cta">ENTER THE ASSEMBLY</a>
    </div>
    
    <script>
        // Optional: redirect to home after a few seconds if you want
        // setTimeout(() => { window.location.href = '/'; }, 10000);
    </script>
</body>
</html>
      `);
    } catch (e) {
      res.redirect('/');
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    app.use(
      express.static('dist', {
        setHeaders: (res, filePath) => {
          if (filePath.includes(path.join('dist', 'assets')))
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          else if (
            filePath.endsWith('index.html') ||
            filePath.endsWith('sw.js') ||
            filePath.endsWith('manifest.json')
          )
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        },
      })
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.sendFile(path.resolve('dist', 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    logger.info({ port: PORT }, 'Server running');
  });
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown() {
  logger.info('Termination signal received: starting graceful shutdown');
  if (io) {
    io.emit(
      'serverRestarting',
      'Server is undergoing maintenance or starting a new version. Reconnecting in 5s!'
    );
    io.close();
  }

  // Gracefully await all in-flight asynchronous database writes (stats, record checks, etc.)
  if (inFlightWrites.size > 0) {
    logger.info({ count: inFlightWrites.size }, 'Awaiting in-flight database writes...');
    await Promise.allSettled([...inFlightWrites]);
    logger.info('In-flight writes completed');
  }

  if (httpServer) {
    httpServer.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
  setTimeout(() => {
    logger.warn('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 10000);
}

startServer();

