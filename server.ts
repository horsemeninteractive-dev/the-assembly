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

import { User, GameState, Player } from './src/types.ts';
import { createDeck } from './server/utils.ts';
import { GameEngine } from './server/gameEngine.ts';
import { registerRoutes, validateToken } from './server/apiRoutes.ts';
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

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

if (!process.env.STRIPE_SECRET_KEY) {
  logger.warn('[Stripe] STRIPE_SECRET_KEY not set — payment endpoints will return 503.');
}

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const MAX_ROOM_CAPACITY = 500;

// Cloud Run URLs: https://<service>-<hash>-<region>.a.run.app
const CLOUD_RUN_PATTERN = /^https:\/\/[a-z0-9-]+-[a-z0-9]+-[a-z]{2,4}\.a\.run\.app$/;

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  const explicit = [
    process.env.APP_URL,
    'https://theassembly.web.app',
    'http://localhost:3000',
    'http://localhost',
    'capacitor://localhost',
  ].filter(Boolean);
  return explicit.includes(origin) || CLOUD_RUN_PATTERN.test(origin);
}

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
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'", 'https://*.discord.com', 'https://*.discordapp.io'],
          scriptSrc,
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'blob:', '*'],
          mediaSrc: ["'self'", 'blob:', 'data:', '*'],
          connectSrc: ["'self'", '*'],
          frameAncestors: ["'self'", 'https://discord.com', 'https://*.discord.com', 'https://*.discordapp.io'],
        },
      },
      crossOriginEmbedderPolicy: { policy: 'credentialless' },
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

  let currentConfig: SystemConfig = await getSystemConfig();
  const engine = new GameEngine({ io, getConfig: () => currentConfig });
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

      // Set cache headers for better performance
      res.setHeader('Cache-Control', 'public, max-age=31536000');

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

    const drainSpectatorQueue = (state: GameState, roomId: string) => {
      if (!state.spectatorQueue) state.spectatorQueue = [];
      const queue = state.spectatorQueue;
      const drained: typeof state.spectatorQueue = [];

      for (const queued of queue) {
        if (state.players.length >= state.maxPlayers) break;

        // Move from spectators list to players list
        state.spectators = state.spectators.filter((s) => s.id !== queued.id);
        const player: Player = {
          id: randomUUID(),
          socketId: queued.id,
          name: queued.name,
          userId: queued.userId,
          avatarUrl: queued.avatarUrl,
          activeFrame: queued.activeFrame,
          activePolicyStyle: queued.activePolicyStyle,
          activeVotingStyle: queued.activeVotingStyle,
          isAlive: true,
          isPresidentialCandidate: false,
          isChancellorCandidate: false,
          isPresident: false,
          isChancellor: false,
          wasPresident: false,
          wasChancellor: false,
          isReady: false,
          hasActed: false,
          stateEnactments: 0,
          civilEnactments: 0,
        };
        state.players.push(player);
        drained.push(queued);
        // Notify the queued player that they've joined
        io.to(queued.id).emit('queueDrained');
      }

      state.spectatorQueue = queue.filter((q) => !drained.find((d) => d.id === q.id));
      if (drained.length > 0) {
        engine.broadcastState(roomId);
      }
    };

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

    socket.on(
      'joinRoom',
      async ({
        roomId,
        name: rawName,
        userId,
        activeFrame,
        activePolicyStyle,
        activeVotingStyle,
        maxPlayers,
        actionTimer,
        mode,
        isSpectator,
        privacy,
        inviteCode,
      }) => {
        // Validation & Sanitisation
        if (typeof roomId !== 'string' || roomId.length < 1 || roomId.length > 40) return;
        if (typeof rawName !== 'string') return;
        if (userId && userId !== socket.data.userId) {
          socket.emit('error', 'Unauthorized: User ID mismatch.');
          return;
        }
        const name = rawName
          .replace(/<[^>]*>/g, '')
          .replace(/\0/g, '')
          .substring(0, 32);
        if (!/^[a-zA-Z0-9 _\-'!?.]+$/.test(roomId)) {
          socket.emit('error', 'Room name contains invalid characters.');
          return;
        }

        const safeMax = Math.max(5, Math.min(10, maxPlayers || 5));
        const safeTimer =
          actionTimer === 0 ? 0 : Math.max(30, Math.min(120, actionTimer || 60));
        const user = userId ? await getUserById(userId) : null;
        if (user?.isBanned) {
          socket.emit('error', 'Your account has been restricted.');
          socket.disconnect();
          return;
        }

        let state = engine.rooms.get(roomId);
        if (!state && engine.rooms.size >= MAX_ROOM_CAPACITY) {
          socket.emit('error', 'Server at capacity. Too many active rooms.');
          return;
        }

        if (!state) {
          if (currentConfig.maintenanceMode && !user?.isAdmin) {
            socket.emit(
              'error',
              'The server is currently undergoing maintenance. New rooms cannot be created at this time.'
            );
            return;
          }
          // Generating a 4-char invite code if private
          const code =
            privacy === 'private'
              ? randomBytes(3).toString('hex').toUpperCase().slice(0, 6)
              : undefined;
          state = {
            roomId,
            players: [],
            spectators: [],
            spectatorQueue: [],
            privacy: privacy || 'public',
            inviteCode: code,
            hostUserId: userId,
            mode: mode || 'Ranked',
            phase: 'Lobby',
            civilDirectives: 0,
            stateDirectives: 0,
            electionTracker: 0,
            deck: createDeck(),
            discard: [],
            drawnPolicies: [],
            chancellorPolicies: [],
            currentExecutiveAction: 'None',
            log: [`Room ${roomId} created in ${mode || 'Ranked'} mode.`],
            presidentIdx: 0,
            lastPresidentIdx: -1,
            maxPlayers: safeMax,
            actionTimer: safeTimer,
            messages: [],
            round: 1,
            vetoUnlocked: false,
            vetoRequested: false,
            declarations: [],
          };
          engine.rooms.set(roomId, state);
        } else {
          // Room exists — check reconnect FIRST before any privacy gate
          // (disconnected player rejoining should never be blocked by privacy)
          if (!isSpectator && state.phase !== 'Lobby') {
            const existingPlayer = state.players.find((p) => p.userId === userId && !p.isAI);
            if (existingPlayer) {
              existingPlayer.socketId = socket.id;
              existingPlayer.isDisconnected = false;

              state.isPaused = false;
              state.pauseReason = undefined;
              state.pauseTimer = undefined;
              state.log.push(`${existingPlayer.name} reconnected.`);
              if (state.log.length > 50) state.log.shift();

              // Join room BEFORE broadcast so the client receives the update
              socket.join(roomId);
              engine.broadcastState(roomId);
              socket.to(roomId).emit('peerJoined', socket.id);
              return;
            }
          }

          // Lobby-phase reconnect: player refreshed tab or briefly disconnected
          if (!isSpectator && state.phase === 'Lobby' && userId) {
            const existingLobbyPlayer = state.players.find((p) => p.userId === userId && !p.isAI);
            if (existingLobbyPlayer) {
              existingLobbyPlayer.socketId = socket.id;
              existingLobbyPlayer.name = name; // refresh display name too
              socket.join(roomId);
              state.log.push(`${name} rejoined the lobby.`);
              engine.broadcastState(roomId);
              socket.to(roomId).emit('peerJoined', socket.id);
              return;
            }
          }

          // Enforce privacy — applies to both players and spectators
          if (state.privacy === 'private') {
            if (state.inviteCode && inviteCode?.toUpperCase() !== state.inviteCode) {
              socket.emit('error', 'Invalid invite code.');
              return;
            }
          } else if (state.privacy === 'friends') {
            if (state.hostUserId && userId && state.hostUserId !== userId) {
              const areFriends = await isFriend(state.hostUserId, userId);
              if (!areFriends) {
                socket.emit(
                  'error',
                  isSpectator
                    ? 'You must be friends with the host to spectate this room.'
                    : 'This room is friends only.'
                );
                return;
              }
            }
          }
        }

        if (isSpectator) {
          let avatarUrl: string | undefined;
          if (userId) {
            const user = await getUserById(userId);
            if (user) avatarUrl = user.avatarUrl;
          }
          state.spectators.push({ id: socket.id, name, avatarUrl });
          socket.join(roomId);
          engine.broadcastState(roomId);
          return;
        }

        if (state.phase !== 'Lobby') {
          socket.emit('error', 'Game already in progress.');
          return;
        }

        if (state.isLocked && userId !== state.hostUserId) {
          socket.emit('error', 'This room is locked.');
          return;
        }

        if (state.players.length >= state.maxPlayers) {
          socket.emit('error', 'Room full.');
          return;
        }

        let avatarUrl: string | undefined;
        if (userId) {
          socket.data.userId = userId;
          userSockets.set(userId, socket.id);
          const friends = await getFriends(userId);
          for (const friend of friends) {
            const friendSocketId = userSockets.get(friend.id);
            if (friendSocketId) {
              io.to(friendSocketId).emit('userStatusChanged', { userId, isOnline: true, roomId });
              let friendRoomId: string | undefined;
              for (const [rId, state] of engine.rooms.entries()) {
                if (state.players.some((p) => p.userId === friend.id && !p.isDisconnected)) {
                  friendRoomId = rId;
                  break;
                }
              }
              socket.emit('userStatusChanged', {
                userId: friend.id,
                isOnline: true,
                roomId: friendRoomId,
              });
            }
          }
          const user = await getUserById(userId);
          if (user) avatarUrl = user.avatarUrl;
        }

        const player: Player = {
          id: randomUUID(),
          socketId: socket.id,
          name,
          userId,
          avatarUrl,
          activeFrame,
          activePolicyStyle,
          activeVotingStyle,
          isAlive: true,
          isPresidentialCandidate: false,
          isChancellorCandidate: false,
          isPresident: false,
          isChancellor: false,
          wasPresident: false,
          wasChancellor: false,
          isReady: false,
          isAI: false,
          stateEnactments: 0,
          civilEnactments: 0,
        };

        state.players.push(player);
        socket.join(roomId);
        state.log.push(`${name} joined the lobby.`);
        socket.to(roomId).emit('peerJoined', socket.id);
        engine.broadcastState(roomId);
      }
    );

    socket.on('toggleReady', () => {
      const roomId = getRoom();
      if (!roomId) return;
      const state = engine.rooms.get(roomId);
      if (!state || state.phase !== 'Lobby') return;

      const player = state.players.find((p) => p.socketId === socket.id);
      if (!player) return;

      player.isReady = !player.isReady;
      state.log.push(`${player.name} is ${player.isReady ? 'Ready' : 'Not Ready'}.`);

      const humanPlayers = state.players.filter((p) => !p.isAI);
      if (state.mode === 'Ranked' && humanPlayers.length < 5) {
        state.log.push('Need at least 5 players to ready up.');
        engine.broadcastState(roomId);
        return;
      }

      if (humanPlayers.every((p) => p.isReady) && humanPlayers.length >= 1) {
        state.log.push('All human players ready! Starting game...');
        if (state.mode === 'Ranked') {
          engine.startGame(roomId);
        } else {
          engine.fillWithAI(roomId);
        }
      }

      engine.broadcastState(roomId);
    });

    socket.on('startLobbyTimer', () => {
      const roomId = getRoom();
      if (!roomId) return;
      const state = engine.rooms.get(roomId);
      if (!state || state.phase !== 'Lobby') return;

      state.lobbyTimer = 30;
      state.isTimerActive = true;
      engine.broadcastState(roomId);
    });

    socket.on('startGame', () => {
      const roomId = getRoom();
      if (!roomId) return;
      engine.startGame(roomId);
    });

    socket.on('signal', ({ to, signal }) => {
      io.to(to).emit('signal', { from: socket.id, signal });
    });

    socket.on('sendFriendRequest', async (targetUserId) => {
      const userId = socket.data.userId;
      if (!userId) return;
      await sendFriendRequest(userId, targetUserId);
      const targetSocketId = userSockets.get(targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('friendRequestReceived', { fromUserId: userId });
      }
    });

    socket.on('acceptFriendRequest', async (targetUserId) => {
      const userId = socket.data.userId;
      if (!userId) return;
      await acceptFriendRequest(userId, targetUserId);
      const targetSocketId = userSockets.get(targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('friendRequestAccepted', { fromUserId: userId });
      }
    });

    socket.on('nominateChancellor', (chancellorId) => {
      const roomId = getRoom();
      if (!roomId) return;
      const state = engine.rooms.get(roomId);
      if (!state) return;
      engine.nominateChancellor(state, roomId, chancellorId, socket.id);
    });

    socket.on('vote', (vote) => {
      if (vote !== 'Aye' && vote !== 'Nay') return;

      const roomId = getRoom();
      if (!roomId) return;
      const state = engine.rooms.get(roomId);
      if (!state || state.phase !== 'Voting') return;

      const player = state.players.find((p) => p.socketId === socket.id);
      if (!player || !player.isAlive || player.hasActed) return;

      if (state.detainedPlayerId === player.id) {
        socket.emit('error', 'You are detained by the Interdictor and cannot vote this round.');
        return;
      }

      player.hasActed = true;
      player.vote = vote;

      if (
        state.players.filter((p) => p.isAlive && p.id !== state.detainedPlayerId && !p.vote)
          .length === 0
      ) {
        engine.handleVoteResult(state, roomId);
      } else {
        engine.broadcastState(roomId);
        engine.processAITurns(roomId);
      }
    });

    socket.on('presidentDiscard', (idx) => {
      const roomId = getRoom();
      if (!roomId) return;
      const state = engine.rooms.get(roomId);
      if (!state) return;
      engine.handlePresidentDiscard(state, roomId, socket.id, idx);
    });

    socket.on('chancellorPlay', (idx) => {
      const roomId = getRoom();
      if (!roomId) return;
      const state = engine.rooms.get(roomId);
      if (!state) return;
      engine.handleChancellorPlay(state, roomId, socket.id, idx);
    });

    socket.on('declarePolicies', (data) => {
      const roomId = getRoom();
      if (!roomId) return;
      const state = engine.rooms.get(roomId);
      if (!state) return;

      const player = state.players.find((p) => p.socketId === socket.id);
      if (!player) return;

      if (data) {
        const alreadyDeclared = state.declarations.some(
          (d) => d.playerId === player.id && d.type === data.type
        );
        if (alreadyDeclared) return;

        state.declarations = state.declarations.filter((d) => d.type !== data.type);

        state.declarations.push({
          playerId: player.id,
          playerName: player.name,
          civ: data.civ,
          sta: data.sta,
          ...(data.type === 'President' ? { drewCiv: data.drewCiv, drewSta: data.drewSta } : {}),
          type: data.type,
          timestamp: Date.now(),
        });
        const passedOrReceived = data.type === 'President' ? 'passed' : 'received';
        const drewStr =
          data.type === 'President' && data.drewCiv !== undefined
            ? ` (drew ${data.drewCiv}C/${data.drewSta}S)`
            : '';
        state.log.push(
          `${player.name} (${data.type}) declared ${passedOrReceived} ${data.civ} Civil and ${data.sta} State directives.${drewStr}`
        );
      }

      engine.broadcastState(roomId);
      engine.checkRoundEnd(state, roomId);
    });

    socket.on('performExecutiveAction', async (targetId) => {
      const roomId = getRoom();
      if (!roomId) return;
      const state = engine.rooms.get(roomId);
      if (!state) return;
      await engine.handleExecutiveAction(state, roomId, targetId, socket.id);
    });

    socket.on('useTitleAbility', async (abilityData) => {
      const roomId = getRoom();
      if (!roomId) return;
      const state = engine.rooms.get(roomId);
      if (!state) return;
      const player = state.players.find((p) => p.socketId === socket.id);
      if (!state.titlePrompt || !player || state.titlePrompt.playerId !== player.id) return;
      await engine.handleTitleAbility(state, roomId, abilityData);
    });

    socket.on('vetoRequest', () => {
      const roomId = getRoom();
      if (!roomId) return;
      const state = engine.rooms.get(roomId);
      if (!state || state.phase !== 'Legislative_Chancellor') return;

      const player = state.players.find((p) => p.socketId === socket.id);
      if (!player || !player.isChancellor || !player.isAlive || player.hasActed) return;
      player.hasActed = true;

      if (state.vetoUnlocked) {
        state.vetoRequested = true;
        state.log.push(`${player.name} (Chancellor) requested a Veto.`);
        if (state.log.length > 50) state.log.shift();
        engine.broadcastState(roomId);
        engine.processAITurns(roomId);
      }
    });

    socket.on('vetoResponse', (agree) => {
      const roomId = getRoom();
      if (!roomId) return;
      const state = engine.rooms.get(roomId);
      if (!state || !state.vetoRequested) return;

      const player = state.players.find((p) => p.socketId === socket.id);
      if (!player || !player.isPresident || !player.isAlive || player.hasActed) return;
      player.hasActed = true;

      engine.handleVetoResponse(state, roomId, player, agree);
    });

    socket.on('sendMessage', (text) => {
      if (typeof text !== 'string') return;

      const roomId = getRoom();
      if (!roomId) return;
      const state = engine.rooms.get(roomId);
      if (!state) return;

      const player = state.players.find((p) => p.socketId === socket.id);
      if (!player) return;

      const now = Date.now();
      const lastChat = (socket.data as any).lastChatTimestamp || 0;
      if (now - lastChat < 1000) {
        socket.emit('error', 'Please wait before sending another message.');
        return;
      }
      (socket.data as any).lastChatTimestamp = now;

      const sanitized = text
        .replace(/<[^>]*>/g, '')
        .replace(/\0/g, '')
        .trim();
      if (sanitized.length === 0 || sanitized.length > 300) return;

      state.messages.push({ sender: player.name, text: sanitized, timestamp: Date.now() });
      if (state.messages.length > 50) state.messages.shift();
      engine.broadcastState(roomId);
    });

    socket.on('playAgain', () => {
      const roomId = getRoom();
      if (!roomId) return;
      const state = engine.rooms.get(roomId);
      if (!state || state.phase !== 'GameOver') return;

      Object.assign(state, {
        phase: 'Lobby',
        civilDirectives: 0,
        stateDirectives: 0,
        electionTracker: 0,
        deck: createDeck(),
        discard: [],
        drawnPolicies: [],
        chancellorPolicies: [],
        currentExecutiveAction: 'None',
        log: [`Game reset in room ${roomId}.`],
        presidentIdx: 0,
        lastPresidentIdx: -1,
        round: 1,
        winner: undefined,
        declarations: [],
        lastEnactedPolicy: undefined,
        isTimerActive: false,
        lobbyTimer: 30,
        roundHistory: [],
        pendingChancellorClaim: undefined,
        lastGovernmentVotes: undefined,
        lastGovernmentPresidentId: undefined,
        lastGovernmentChancellorId: undefined,
        messages: [],
        detainedPlayerId: undefined,
        rejectedChancellorId: undefined,
        presidentId: undefined,
        chancellorId: undefined,
        investigationResult: undefined,
        presidentSaw: undefined,
        chancellorSaw: undefined,
        presidentTimedOut: false,
        chancellorTimedOut: false,
        isPaused: false,
        pauseReason: undefined,
        pauseTimer: undefined,
        disconnectedPlayerId: undefined,
        titlePrompt: undefined,
        lastExecutiveActionStateCount: 0,
        vetoUnlocked: false,
        vetoRequested: false,
        previousVotes: undefined,
        handlerSwapPending: undefined,
        handlerSwapPositions: undefined,
        isStrategistAction: undefined,
      });

      state.players = state.players.filter((p) => !p.isAI && !p.isDisconnected);
      state.players.forEach((p) => {
        p.role = undefined;
        p.titleRole = undefined;
        p.titleUsed = false;
        p.isAlive = true;
        p.isPresident = false;
        p.isChancellor = false;
        p.isPresidentialCandidate = false;
        p.isChancellorCandidate = false;
        p.wasPresident = false;
        p.wasChancellor = false;
        p.vote = undefined;
        p.isReady = false;
        p.hasActed = false;
        p.suspicion = undefined;
        p.stateEnactments = 0;
        p.civilEnactments = 0;
        p.isProvenNotOverseer = false;
        p.alliances = undefined;
      });

      drainSpectatorQueue(state, roomId);
      engine.broadcastState(roomId);
    });

    socket.on(
      'joinQueue',
      (data: {
        name: string;
        userId?: string;
        avatarUrl?: string;
        activeFrame?: string;
        activePolicyStyle?: string;
        activeVotingStyle?: string;
      }) => {
        const roomId = getRoom();
        if (!roomId) return;
        const state = engine.rooms.get(roomId);
        if (!state) return;
        if (!state.spectators.find((s) => s.id === socket.id)) return;
        if (state.spectatorQueue.find((q) => q.id === socket.id)) return;
        state.spectatorQueue.push({
          id: socket.id,
          name: (data.name || '')
            .replace(/<[^>]*>/g, '')
            .replace(/\0/g, '')
            .substring(0, 32),
          userId: data.userId,
          avatarUrl: data.avatarUrl,
          activeFrame: data.activeFrame,
          activePolicyStyle: data.activePolicyStyle,
          activeVotingStyle: data.activeVotingStyle,
        });

        if (state.phase === 'Lobby') {
          drainSpectatorQueue(state, roomId);
        }
        engine.broadcastState(roomId);
      }
    );

    socket.on('leaveQueue', () => {
      const roomId = getRoom();
      if (!roomId) return;
      const state = engine.rooms.get(roomId);
      if (!state) return;
      state.spectatorQueue = state.spectatorQueue.filter((q) => q.id !== socket.id);
      engine.broadcastState(roomId);
    });

    socket.on('kickPlayer', (targetSocketId: string) => {
      const roomId = getRoom();
      if (!roomId) return;
      const state = engine.rooms.get(roomId);
      if (!state) return;
      const host = state.players.find((p) => p.userId === state.hostUserId);
      if (!host || host.socketId !== socket.id) return;
      if (targetSocketId === socket.id) return;
      const target = state.players.find((p) => p.id === targetSocketId);
      if (!target) return;
      state.players = state.players.filter((p) => p.id !== targetSocketId);
      state.log.push(`${target.name} was removed by the host.`);
      io.to(targetSocketId).emit('kicked');
      engine.broadcastState(roomId);
    });

    socket.on('toggleLock', () => {
      const roomId = getRoom();
      if (!roomId) return;
      const state = engine.rooms.get(roomId);
      if (!state || state.phase !== 'Lobby') return;
      const host = state.players.find((p) => p.userId === state.hostUserId);
      if (!host || host.socketId !== socket.id) return;
      state.isLocked = !state.isLocked;
      state.log.push(`Room ${state.isLocked ? 'locked' : 'unlocked'} by host.`);
      engine.broadcastState(roomId);
    });

    socket.on('hostStartGame', () => {
      const roomId = getRoom();
      if (!roomId) return;
      const state = engine.rooms.get(roomId);
      if (!state || state.phase !== 'Lobby') return;
      const host = state.players.find((p) => p.userId === state.hostUserId);
      if (!host || host.socketId !== socket.id) return;
      const humanPlayers = state.players.filter((p) => !p.isAI);
      if (state.mode === 'Ranked' && humanPlayers.length < 5) {
        socket.emit('error', 'Need at least 5 players to start a ranked game.');
        return;
      }
      if (humanPlayers.length < 1) {
        socket.emit('error', 'Need at least 1 player to start.');
        return;
      }
      state.log.push('Host started the game.');
      if (state.mode === 'Ranked') {
        engine.startGame(roomId);
      } else {
        engine.fillWithAI(roomId);
      }
      engine.broadcastState(roomId);
    });

    socket.on('leaveRoom', () => {
      const roomId = getRoom();
      if (!roomId) return;
      const state = engine.rooms.get(roomId);
      engine.handleLeave(socket, roomId, true);
      if (state && (state.phase === 'Lobby' || state.phase === 'GameOver')) {
        drainSpectatorQueue(state, roomId);
      }
    });

    socket.on('updateMediaState', ({ isMicOn, isCamOn }) => {
      engine.rooms.forEach((state, roomId) => {
        const player = state.players.find((p) => p.socketId === socket.id);
        if (player) {
          player.isMicOn = isMicOn;
          player.isCamOn = isCamOn;
          engine.broadcastState(roomId);
        }
      });
    });

    socket.on('adminDeleteRoom', async (roomId: string) => {
      if (!socket.data.userId) return;
      const user = await getUserById(socket.data.userId);
      if (!user || !user.isAdmin) return;

      const state = engine.rooms.get(roomId);
      if (state) {
        state.log.push('This room has been terminated by an administrator.');
        engine.broadcastState(roomId);
        setTimeout(() => {
          io.to(roomId).emit('kicked');
          engine.deleteRoom(roomId);
          logger.info({ admin: user.username, roomId }, 'Admin deleted room');
          io.emit('adminBroadcast', {
            message: `Admin closed room: ${roomId}`,
            sender: 'System',
            timestamp: Date.now(),
          });
        }, 2000);
      } else {
        engine.deleteRoom(roomId);
        logger.info({ admin: user.username, roomId }, 'Admin deleted room (cleanup)');
      }
    });

    socket.on('adminBroadcast', async (message: string) => {
      if (!socket.data.userId) return;
      const user = await getUserById(socket.data.userId);
      if (!user || !user.isAdmin) return;
      io.emit('adminBroadcast', { message, sender: user.username, timestamp: Date.now() });
      logger.info({ admin: user.username, message }, 'Admin broadcast');
    });

    socket.on('adminUpdateUser', async (data: { userId: string; updates: any }) => {
      if (!socket.data.userId) return;
      const admin = await getUserById(socket.data.userId);
      if (!admin || !admin.isAdmin) return;

      const targetUser = await getUserById(data.userId);
      if (!targetUser) return;

      if (data.updates.stats) targetUser.stats = { ...targetUser.stats, ...data.updates.stats };
      if (typeof data.updates.cabinetPoints === 'number')
        targetUser.cabinetPoints = data.updates.cabinetPoints;
      if (typeof data.updates.isBanned === 'boolean') targetUser.isBanned = data.updates.isBanned;

      await saveUser(targetUser);
      const targetSocketId = userSockets.get(data.userId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('userUpdate', targetUser);
        if (targetUser.isBanned)
          io.to(targetSocketId).emit('kicked', 'Your account has been restricted.');
      }
    });

    socket.on('adminUpdateConfig', async (config: Partial<SystemConfig>) => {
      if (!socket.data.userId) return;
      const admin = await getUserById(socket.data.userId);
      if (!admin || !admin.isAdmin) return;
      currentConfig = await updateSystemConfig(config);
      io.emit('adminConfigUpdate', currentConfig);
    });

    socket.on('adminClearRedis', async () => {
      if (!socket.data.userId) return;
      const admin = await getUserById(socket.data.userId);
      if (!admin || !admin.isAdmin) return;
      await engine.clearAllRedisRooms();
      socket.emit('adminClearRedisSuccess', 'Successfully purged all Redis room state.');
    });

    socket.on('disconnect', async () => {
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
      engine.rooms.forEach((state, roomId) => {
        engine.handleLeave(socket, roomId);
      });
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
