import { logger } from './server/logger.ts';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createServer as createViteServer } from 'vite';
import { randomUUID, randomBytes, createHash } from 'crypto';
import fs from 'fs';
import { z } from 'zod';

import { User, GameState, Player } from './src/types.ts';
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
} from './server/supabaseService.ts';
import { pubClient, subClient, isRedisConfigured } from './server/redis.ts';
import { SystemConfig } from './src/types.ts';
import Stripe from 'stripe';

import { registerGameActionHandlers } from './server/handlers/gameActionHandler.ts';
import { registerAdminHandlers } from './server/handlers/adminHandler.ts';

if (process.env.NODE_ENV === 'production' && !isRedisConfigured) {
  logger.fatal('REDIS_URL is required in production for HA and persistence.');
  process.exit(1);
}


const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

if (!process.env.STRIPE_SECRET_KEY) {
  logger.warn('[Config] STRIPE_SECRET_KEY not set — payment endpoints will return 503.');
}
if (!process.env.STRIPE_WEBHOOK_SECRET) {
  logger.info('[Config] STRIPE_WEBHOOK_SECRET not set — webhook verification will fail.');
}
if (!process.env.EMAIL_USER) {
  logger.info('[Config] EMAIL_USER not set — Nodemailer password recovery is disabled.');
}
if (!process.env.RESEND_API_KEY) {
  logger.info('[Config] RESEND_API_KEY not set — Resend integration is disabled.');
}
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const MAX_ROOM_CAPACITY = 500;

import {
  statsSchema,
} from './server/schemas.ts';

let httpServer: any;
let io: Server;

async function startServer() {
  logger.info('Starting with Stripe integration...');

  // Generate CSP hashes from index.html for production
  let prodScriptHashes = '';
  if (process.env.NODE_ENV === 'production') {
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

  const isProd = process.env.NODE_ENV === 'production';
  const scriptSrc = isProd
    ? ["'self'", ...prodScriptHashes.trim().split(' ').filter(Boolean), 'https://*.discord.com']
    : ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://*.discord.com'];

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
            'https://*.discord.com',
            'wss://*.discord.com',
            'https://*.stripe.com',
            'https://*.googleapis.com',
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
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );
  app.set('trust proxy', 1);
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (server-to-server, curl, Postman)
        if (!origin || isAllowedOrigin(origin)) return callback(null, true);
        callback(new Error(`CORS: origin '${origin}' not allowed`));
      },
    })
  );

  // Stripe webhook must be placed BEFORE express.json() to get the raw body
  app.post('/api/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ error: 'Payment service not configured.' });
    }
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      logger.error('Missing Stripe signature or webhook secret');
      return res.status(400).send('Webhook Error: Missing signature or secret');
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      logger.error({ err: err.message }, 'Stripe Webhook Error');
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const cpAmount = parseInt(session.metadata?.cpAmount || '0', 10);

      if (userId && cpAmount > 0) {
        logger.info({ userId, cpAmount }, 'Crediting CP to user via Stripe');
        const user = await getUserById(userId);
        if (user) {
          user.cabinetPoints = (user.cabinetPoints ?? 0) + cpAmount;
          const { saveUser } = await import('./server/supabaseService.ts');
          await saveUser(user);

          // Notify the user via socket if they are online
          const socketId = userSockets.get(userId);
          if (socketId) {
            io.to(socketId).emit('userUpdate', user);
          }
        }
      }
    }

    res.json({ received: true });
  });

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
      'microphone=*, camera=*, display-capture=*, speaker-selection=*, autoplay=*, text-to-speech=*, screen-wake-lock=*'
    );

    next();
  });

  // Proxy route for external assets to bypass Discord's strict CSP
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
    const GAME_ACTIONS = [
      'userConnected',
      'joinRoom',
      'toggleReady',
      'startLobbyTimer',
      'startGame',
      'signal',
      'sendFriendRequest',
      'acceptFriendRequest',
      'nominateChancellor',
      'vote',
      'presidentDiscard',
      'chancellorPlay',
      'declarePolicies',
      'performExecutiveAction',
      'useTitleAbility',
      'vetoRequest',
      'vetoResponse',
      'playAgain',
      'joinQueue',
      'leaveQueue',
      'kickPlayer',
      'toggleLock',
      'hostStartGame',
      'leaveRoom',
      'updateMediaState',
      'adminDeleteRoom',
      'adminBroadcast',
      'adminUpdateUser',
      'adminUpdateConfig',
      'adminClearRedis',
    ];

    socket.use(([event, ...args]: any[], next: (err?: Error) => void) => {
      if (event === 'disconnect') return next();

      const now = Date.now();
      const isChat = event === 'sendMessage';
      const isGameAction = GAME_ACTIONS.includes(event);

      if (!isChat && !isGameAction) return next();

      // Bucket configs
      const CAPACITY = isChat ? 5 : 10;
      const REFILL_RATE = isChat ? 1 : 5; // tokens per second

      // State keys
      const lastKey = isChat ? 'lastChatLimitCheck' : 'lastGameLimitCheck';
      const tokenKey = isChat ? 'chatTokens' : 'gameTokens';

      const last = (socket.data as any)[lastKey] || now;
      const tokens = (socket.data as any)[tokenKey] ?? CAPACITY;

      const elapsed = now - last;
      const regained = (elapsed / 1000) * REFILL_RATE;
      const currentTokens = Math.min(CAPACITY, tokens + regained);

      if (currentTokens < 1) {
        logger.warn(
          { event, userId: (socket.data as any).userId || 'unauth', socketId: socket.id },
          `Throttling ${isChat ? 'chat' : 'game action'} event due to rate limit`
        );
        return next(new Error('Rate limit exceeded. Please slow down.'));
      }

      (socket.data as any)[tokenKey] = currentTokens - 1;
      (socket.data as any)[lastKey] = now;
      next();
    });

    const getRoom = (): string | undefined => Array.from(socket.rooms).find((r) => r !== socket.id);

    // Call modular handlers to register event listeners
    registerGameActionHandlers(socket, io, engine, userSockets);
    registerAdminHandlers(socket, io, engine, userSockets, configRef);



    socket.on('userConnected', async ({ userId, token }: { userId: string; token: string }) => {
      const user = await validateToken(token);
      if (!user || user.id !== userId) {
        socket.emit('error', 'Unauthorized: User ID mismatch or invalid token.');
        socket.disconnect();
        return;
      }
      if (user?.isBanned) {
        socket.emit('error', 'Your account has been restricted.');
        socket.disconnect();
        return;
      }
      socket.data.userId = userId;
      socket.data.isAdmin = user?.isAdmin || false;
      userSockets.set(userId, socket.id);
      const friends = await getFriends(userId);
      for (const friend of friends) {
        const friendSocketId = userSockets.get(friend.id);
        if (friendSocketId) {
          // Find which room the friend is in (if any)
          let friendRoomId: string | undefined;
          for (const [rId, state] of engine.rooms.entries()) {
            if (state.players.some((p) => p.userId === friend.id && !p.isDisconnected)) {
              friendRoomId = rId;
              break;
            }
          }
          io.to(friendSocketId).emit('userStatusChanged', { userId, isOnline: true });
          socket.emit('userStatusChanged', {
            userId: friend.id,
            isOnline: true,
            roomId: friendRoomId,
          });
        }
      }
    });

    socket.on('joinRoom', async (payload) => 
      await handleJoinRoom(socket, io, engine, userSockets, configRef.current, payload)
    );

    socket.on('disconnecting', async () => {
      if (socket.data.userId) {
        const userId = socket.data.userId;
        if (userSockets.get(userId) === socket.id) {
          userSockets.delete(userId);
          const friends = await getFriends(userId);
          for (const friend of friends) {
            const friendSocketId = userSockets.get(friend.id);
            if (friendSocketId)
              io.to(friendSocketId).emit('userStatusChanged', { userId, isOnline: false });
          }
        }
      }

      for (const roomId of socket.rooms) {
        if (roomId !== socket.id) {
          await engine.handleLeave(socket, roomId);
        }
      }
    });
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
