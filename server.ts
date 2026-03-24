import express from "express";
import cors from "cors";
import path from "path";
import { createServer } from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createServer as createViteServer } from "vite";
import { randomUUID } from "crypto";

import { User, GameState, Player } from "./src/types.ts";
import { createDeck } from "./server/utils.ts";
import { GameEngine } from "./server/gameEngine.ts";
import { registerRoutes } from "./server/apiRoutes.ts";
import { getUserById, sendFriendRequest, acceptFriendRequest, getFriends, isFriend } from "./server/supabaseService.ts";
import { pubClient, subClient, isRedisConfigured } from "./server/redis.ts";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Cloud Run URLs: https://<service>-<hash>-<region>.a.run.app
const CLOUD_RUN_PATTERN = /^https:\/\/[a-z0-9-]+-[a-z0-9]+-[a-z]{2,4}\.a\.run\.app$/;

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  const explicit = [
    process.env.APP_URL,
    "https://theassembly.web.app",
    "http://localhost:3000",
    "http://localhost",
    "capacitor://localhost"
  ].filter(Boolean);
  return explicit.includes(origin) || CLOUD_RUN_PATTERN.test(origin);
}

async function startServer() {
  console.log("[Server] Starting with Stripe integration...");
  const app = express();
  app.set("trust proxy", 1);
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, curl, Postman)
      if (!origin || isAllowedOrigin(origin)) return callback(null, true);
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
  }));

  // Stripe webhook must be placed BEFORE express.json() to get the raw body
  app.post("/api/webhook/stripe", express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      console.error("[Stripe] Missing signature or webhook secret");
      return res.status(400).send("Webhook Error: Missing signature or secret");
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      console.error(`[Stripe] Webhook Error: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const cpAmount = parseInt(session.metadata?.cpAmount || "0", 10);

      if (userId && cpAmount > 0) {
        console.log(`[Stripe] Crediting ${cpAmount} CP to user ${userId}`);
        const user = await getUserById(userId);
        if (user) {
          user.cabinetPoints = (user.cabinetPoints ?? 0) + cpAmount;
          const { saveUser } = await import("./server/supabaseService.ts");
          await saveUser(user);
          
          // Notify the user via socket if they are online
          const socketId = userSockets.get(userId);
          if (socketId) {
            io.to(socketId).emit("userUpdate", user);
          }
        }
      }
    }

    res.json({ received: true });
  });

  app.use(express.json());

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    pingTimeout: 60000,
    pingInterval: 25000,
    cors: {
      origin: (origin, callback) => {
        if (!origin || isAllowedOrigin(origin)) return callback(null, true);
        callback(new Error(`CORS: origin '${origin}' not allowed`));
      },
      methods: ["GET", "POST"],
    },
  });

  // Attach Redis adapter for multi-instance pub/sub (no-op if Redis not configured)
  if (isRedisConfigured && pubClient && subClient) {
    io.adapter(createAdapter(pubClient, subClient));
    console.log("[Redis] Socket.IO adapter attached");
  }

  const engine = new GameEngine({ io });
  const userSockets = new Map<string, string>();

  // Restore persisted game rooms from Redis before accepting connections
  await engine.restoreFromRedis();

  registerRoutes(app, io, engine, userSockets, stripe);

  // Add headers for Discord Activity media permissions
  app.use((req, res, next) => {
    // Explicitly allow microphone, camera, and display-capture for Discord Activity
    res.setHeader("Permissions-Policy", "microphone=*, camera=*, display-capture=*, speaker-selection=*, autoplay=*, text-to-speech=*, screen-wake-lock=*");

    // Comprehensive CSP for Discord Activity environment
    res.setHeader("Content-Security-Policy",
      "default-src 'self' https://*.discord.com https://*.discordapp.io; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.discord.com; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' data: https://fonts.gstatic.com; " +
      "img-src 'self' data: blob: *; " +
      "media-src 'self' blob: data: *; " +
      "connect-src 'self' *; " +
      "frame-ancestors 'self' https://discord.com https://*.discord.com https://*.discordapp.io;"
    );

    // Headers for cross-origin isolation (needed for some media features)
    res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");

    next();
  });

  // Proxy route for external assets to bypass Discord's strict CSP
  app.get("/proxy", async (req, res) => {
    const url = req.query.url as string;
    if (!url) return res.status(400).send("URL is required");

    try {
      // Enforce HTTPS — block file://, http://, and other non-HTTPS schemes
      // that could be used for SSRF against internal services.
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch {
        return res.status(400).send("Invalid URL");
      }
      if (parsedUrl.protocol !== "https:") {
        return res.status(403).send("Only HTTPS URLs are allowed");
      }

      // Exact hostname match — endsWith() is vulnerable to subdomain spoofing
      // (e.g. "evildomain.googleapis.com" would pass an endsWith check).
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
        'lh3.googleusercontent.com'
      ]);

      if (!allowedHostnames.has(parsedUrl.hostname)) {
        return res.status(403).send("Domain not allowed");
      }

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      if (!response.ok) {
        console.error(`[Proxy] Fetch failed for ${url}: ${response.status} ${response.statusText}`);
        return res.status(response.status).send(response.statusText);
      }

      const contentType = response.headers.get("content-type");
      if (contentType) res.setHeader("Content-Type", contentType);

      // Add CORP header to allow proxied assets in cross-origin isolated environments
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("Access-Control-Allow-Origin", "*");

      // Set cache headers for better performance
      res.setHeader("Cache-Control", "public, max-age=31536000");

      const arrayBuffer = await response.arrayBuffer();
      let body = Buffer.from(arrayBuffer);

      // If it's a CSS file from Google Fonts, rewrite URLs to go through the proxy
      if (contentType && contentType.includes("text/css") && url.includes("fonts.googleapis.com")) {
        let css = body.toString();
        // Replace url(https://fonts.gstatic.com/...) with url(/proxy?url=https%3A%2F%2Ffonts.gstatic.com%2F...)
        css = css.replace(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g, (match, fontUrl) => {
          return `url(/proxy?url=${encodeURIComponent(fontUrl)})`;
        });
        body = Buffer.from(css);
      }

      res.send(body);
    } catch (error: any) {
      console.error(`[Proxy] Error fetching ${url}:`, error.message);
      res.status(500).send("Error fetching resource");
    }
  });

  io.on("connection", (socket) => {
    const getRoom = (): string | undefined =>
      Array.from(socket.rooms).find(r => r !== socket.id);

    const drainSpectatorQueue = (state: any, roomId: string) => {
      if (!state.spectatorQueue) state.spectatorQueue = [];
      const queue = state.spectatorQueue;
      const drained: any[] = [];
      
      for (const queued of queue) {
        if (state.players.length >= state.maxPlayers) break;
        
        // Move from spectators list to players list
        state.spectators = state.spectators.filter((s: any) => s.id !== queued.id);
        state.players.push({
          id: queued.id,
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
        });
        drained.push(queued);
        // Notify the queued player that they've joined
        io.to(queued.id).emit("queueDrained");
      }
      
      state.spectatorQueue = queue.filter((q: any) => !drained.find(d => d.id === q.id));
      if (drained.length > 0) {
        engine.broadcastState(roomId);
      }
    };

    socket.on("userConnected", async (userId) => {
      socket.data.userId = userId;
      userSockets.set(userId, socket.id);
      const friends = await getFriends(userId);
      for (const friend of friends) {
        const friendSocketId = userSockets.get(friend.id);
        if (friendSocketId) {
          // Find which room the friend is in (if any)
          let friendRoomId: string | undefined;
          for (const [rId, state] of engine.rooms.entries()) {
            if (state.players.some(p => p.userId === friend.id && !p.isDisconnected)) {
              friendRoomId = rId;
              break;
            }
          }
          io.to(friendSocketId).emit("userStatusChanged", { userId, isOnline: true });
          socket.emit("userStatusChanged", { userId: friend.id, isOnline: true, roomId: friendRoomId });
        }
      }
    });

    socket.on("joinRoom", async ({
      roomId, name, userId, activeFrame, activePolicyStyle, activeVotingStyle,
      maxPlayers, actionTimer, mode, isSpectator, privacy, inviteCode, hostUserId,
    }) => {
      let state = engine.rooms.get(roomId);

      if (!state) {
        // Generating a 4-char invite code if private
        const code = privacy === 'private'
          ? Math.random().toString(36).substring(2, 6).toUpperCase()
          : undefined;
        state = {
          roomId,
          players: [],
          spectators: [],
          spectatorQueue: [],
          privacy: privacy || 'public',
          inviteCode: code,
          hostUserId: userId,
          mode: mode || "Ranked",
          phase: "Lobby",
          civilDirectives: 0,
          stateDirectives: 0,
          electionTracker: 0,
          deck: createDeck(),
          discard: [],
          drawnPolicies: [],
          chancellorPolicies: [],
          currentExecutiveAction: "None",
          log: [`Room ${roomId} created in ${mode || "Ranked"} mode.`],
          presidentIdx: 0,
          lastPresidentIdx: -1,
          maxPlayers: maxPlayers || 5,
          actionTimer: actionTimer || 0,
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
        if (!isSpectator && state.phase !== "Lobby") {
          const existingPlayer = state.players.find(p => p.userId === userId && !p.isAI);
          if (existingPlayer) {
            const oldId = existingPlayer.id;
            existingPlayer.id = socket.id;
            existingPlayer.isDisconnected = false;

            // Comprehensive ID re-mapping across all GameState fields
            if (state.presidentId === oldId) state.presidentId = socket.id;
            if (state.chancellorId === oldId) state.chancellorId = socket.id;
            if (state.rejectedChancellorId === oldId) state.rejectedChancellorId = socket.id;
            if (state.detainedPlayerId === oldId) state.detainedPlayerId = socket.id;
            if (state.lastGovernmentPresidentId === oldId) state.lastGovernmentPresidentId = socket.id;
            if (state.lastExecutiveActionStateCount === oldId as any) state.lastExecutiveActionStateCount = socket.id as any; // Edge case check
            if (state.lastEnactedPolicy && state.lastEnactedPolicy.playerId === oldId) {
              state.lastEnactedPolicy.playerId = socket.id;
            }

            if (state.presidentialOrder) {
              state.presidentialOrder = state.presidentialOrder.map(id => id === oldId ? socket.id : id);
            }

            if (state.titlePrompt && state.titlePrompt.playerId === oldId) {
              state.titlePrompt.playerId = socket.id;
            }

            if (state.previousVotes) {
              if (state.previousVotes[oldId]) {
                state.previousVotes[socket.id] = state.previousVotes[oldId];
                delete state.previousVotes[oldId];
              }
            }

            if (state.lastGovernmentVotes) {
              if (state.lastGovernmentVotes[oldId]) {
                state.lastGovernmentVotes[socket.id] = state.lastGovernmentVotes[oldId];
                delete state.lastGovernmentVotes[oldId];
              }
            }

            state.declarations.forEach(d => {
              if (d.playerId === oldId) d.playerId = socket.id;
            });

            state.roundHistory?.forEach(rh => {
              if (rh.presidentId === oldId) rh.presidentId = socket.id;
              if (rh.chancellorId === oldId) rh.chancellorId = socket.id;
              rh.votes.forEach(v => {
                if (v.playerId === oldId) v.playerId = socket.id;
              });
            });

            state.isPaused = false;
            state.pauseReason = undefined;
            state.pauseTimer = undefined;
            state.log.push(`${existingPlayer.name} reconnected.`);
            
            // Join room BEFORE broadcast so the client receives the update
            socket.join(roomId);
            engine.broadcastState(roomId);
            socket.to(roomId).emit("peerJoined", socket.id);
            return;
          }
        }

        // Lobby-phase reconnect: player refreshed tab or briefly disconnected
        // while in the waiting room. Update their socket ID so later events
        // (toggleReady etc.) can find them by socket.id correctly.
        if (!isSpectator && state.phase === "Lobby" && userId) {
          const existingLobbyPlayer = state.players.find(p => p.userId === userId && !p.isAI);
          if (existingLobbyPlayer) {
            existingLobbyPlayer.id = socket.id;
            existingLobbyPlayer.name = name; // refresh display name too
            socket.join(roomId);
            state.log.push(`${name} rejoined the lobby.`);
            engine.broadcastState(roomId);
            socket.to(roomId).emit("peerJoined", socket.id);
            return;
          }
        }

        // Enforce privacy — applies to both players and spectators
        if (state.privacy === 'private') {
          if (state.inviteCode && inviteCode?.toUpperCase() !== state.inviteCode) {
            socket.emit("error", "Invalid invite code.");
            return;
          }
        } else if (state.privacy === 'friends') {
          if (state.hostUserId && userId && state.hostUserId !== userId) {
            const areFriends = await isFriend(state.hostUserId, userId);
            if (!areFriends) {
              socket.emit("error", isSpectator ? "You must be friends with the host to spectate this room." : "This room is friends only.");
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

      if (state.phase !== "Lobby") {
        // Non-disconnected player trying to join an in-progress game
        socket.emit("error", "Game already in progress.");
        return;
      }

      if (state.isLocked && userId !== state.hostUserId) {
        socket.emit("error", "This room is locked.");
        return;
      }

      if (state.players.length >= state.maxPlayers) {
        socket.emit("error", "Room full.");
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
            // Tell friend this user is online and in this room
            io.to(friendSocketId).emit("userStatusChanged", { userId, isOnline: true, roomId });
            // Tell this user which room the friend is in (if any)
            let friendRoomId: string | undefined;
            for (const [rId, state] of engine.rooms.entries()) {
              if (state.players.some(p => p.userId === friend.id && !p.isDisconnected)) {
                friendRoomId = rId;
                break;
              }
            }
            socket.emit("userStatusChanged", { userId: friend.id, isOnline: true, roomId: friendRoomId });
          }
        }
        const user = await getUserById(userId);
        if (user) avatarUrl = user.avatarUrl;
      }

      const player: Player = {
        id: socket.id,
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
      };

      state.players.push(player);
      socket.join(roomId);
      state.log.push(`${name} joined the lobby.`);
      socket.to(roomId).emit("peerJoined", socket.id);
      engine.broadcastState(roomId);
    });

    socket.on("toggleReady", () => {
      const roomId = getRoom();
      if (!roomId) return;
      const state = engine.rooms.get(roomId);
      if (!state || state.phase !== "Lobby") return;

      const player = state.players.find(p => p.id === socket.id);
      if (!player) return;

      player.isReady = !player.isReady;
      state.log.push(`${player.name} is ${player.isReady ? "Ready" : "Not Ready"}.`);

      const humanPlayers = state.players.filter(p => !p.isAI);
      if (state.mode === 'Ranked' && humanPlayers.length < 5) {
        state.log.push("Need at least 5 players to ready up.");
        engine.broadcastState(roomId);
        return;
      }

      if (humanPlayers.every(p => p.isReady) && humanPlayers.length >= 1) {
        state.log.push("All human players ready! Starting game...");
        if (state.mode === 'Ranked') {
          engine.startGame(roomId);
        } else {
          engine.fillWithAI(roomId);
        }
      }

      engine.broadcastState(roomId);
    });

    socket.on("startLobbyTimer", () => {
      const roomId = getRoom();
      if (!roomId) return;
      const state = engine.rooms.get(roomId);
      if (!state || state.phase !== "Lobby") return;

      state.lobbyTimer = 30;
      state.isTimerActive = true;
      engine.broadcastState(roomId);
    });

    socket.on("startGame", () => {
      const roomId = getRoom();
      if (!roomId) return;
      engine.startGame(roomId);
    });

    socket.on("signal", ({ to, signal }) => {
      io.to(to).emit("signal", { from: socket.id, signal });
    });

    socket.on("sendFriendRequest", async (targetUserId) => {
      const userId = socket.data.userId;
      if (!userId) return;
      await sendFriendRequest(userId, targetUserId);
      const targetSocketId = userSockets.get(targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit("friendRequestReceived", { fromUserId: userId });
      }
    });

    socket.on("acceptFriendRequest", async (targetUserId) => {
      const userId = socket.data.userId;
      if (!userId) return;
      await acceptFriendRequest(userId, targetUserId);
      const targetSocketId = userSockets.get(targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit("friendRequestAccepted", { fromUserId: userId });
      }
    });

    socket.on("nominateChancellor", (chancellorId) => {
      const roomId = getRoom();
      if (!roomId) return;
      const state = engine.rooms.get(roomId);
      if (!state) return;
      engine.nominateChancellor(state, roomId, chancellorId, socket.id);
    });

    socket.on("vote", (vote) => {
      if (vote !== "Aye" && vote !== "Nay") return;

      const roomId = getRoom();
      if (!roomId) return;
      const state = engine.rooms.get(roomId);
      if (!state || state.phase !== "Voting") return;

      const player = state.players.find(p => p.id === socket.id);
      if (!player || !player.isAlive || player.hasActed) return;

      if (state.detainedPlayerId === player.id) {
        socket.emit("error", "You are detained by the Interdictor and cannot vote this round.");
        return;
      }

      player.hasActed = true;
      player.vote = vote;

      if (state.players.filter(p => p.isAlive && p.id !== state.detainedPlayerId && !p.vote).length === 0) {
        const jaVotes = state.players.filter(p => p.vote === "Aye").length;
        const neinVotes = state.players.filter(p => p.vote === "Nay").length;
        engine.handleVoteResult(state, roomId, jaVotes, neinVotes);
      } else {
        engine.broadcastState(roomId);
        engine.processAITurns(roomId);
      }
    });

    socket.on("presidentDiscard", (idx) => {
      const roomId = getRoom();
      if (!roomId) return;
      const state = engine.rooms.get(roomId);
      if (!state) return;
      engine.handlePresidentDiscard(state, roomId, socket.id, idx);
    });

    socket.on("chancellorPlay", (idx) => {
      const roomId = getRoom();
      if (!roomId) return;
      const state = engine.rooms.get(roomId);
      if (!state) return;
      engine.handleChancellorPlay(state, roomId, socket.id, idx);
    });

    socket.on("declarePolicies", (data) => {
      const roomId = getRoom();
      if (!roomId) return;
      const state = engine.rooms.get(roomId);
      if (!state) return;

      const player = state.players.find(p => p.id === socket.id);
      if (!player) return;

      if (data) {
        const alreadyDeclared = state.declarations.some(
          d => d.playerId === player.id && d.type === data.type
        );
        if (alreadyDeclared) return;

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
        const drewStr = data.type === 'President' && data.drewCiv !== undefined
          ? ` (drew ${data.drewCiv}C/${data.drewSta}S)`
          : '';
        state.log.push(
          `${player.name} (${data.type}) declared ${passedOrReceived} ${data.civ} Civil and ${data.sta} State directives.${drewStr}`
        );
      }

      engine.broadcastState(roomId);
      engine.checkRoundEnd(state, roomId);
    });

    socket.on("performExecutiveAction", async (targetId) => {
      const roomId = getRoom();
      if (!roomId) return;
      const state = engine.rooms.get(roomId);
      if (!state) return;
      await engine.handleExecutiveAction(state, roomId, targetId, socket.id);
    });

    socket.on("useTitleAbility", async (abilityData) => {
      const roomId = getRoom();
      if (!roomId) return;
      const state = engine.rooms.get(roomId);
      if (!state || !state.titlePrompt || state.titlePrompt.playerId !== socket.id) return;
      await engine.handleTitleAbility(state, roomId, abilityData);
    });

    socket.on("vetoRequest", () => {
      const roomId = getRoom();
      if (!roomId) return;
      const state = engine.rooms.get(roomId);
      if (!state || state.phase !== "Legislative_Chancellor") return;

      const player = state.players.find(p => p.id === socket.id);
      if (!player || !player.isChancellor || !player.isAlive || player.hasActed) return;
      player.hasActed = true;

      if (state.vetoUnlocked) {
        state.vetoRequested = true;
        state.log.push(`${player.name} (Chancellor) requested a Veto.`);
        engine.broadcastState(roomId);
        engine.processAITurns(roomId);
      }
    });

    socket.on("vetoResponse", (agree) => {
      const roomId = getRoom();
      if (!roomId) return;
      const state = engine.rooms.get(roomId);
      if (!state || !state.vetoRequested) return;

      const player = state.players.find(p => p.id === socket.id);
      if (!player || !player.isPresident || !player.isAlive || player.hasActed) return;
      player.hasActed = true;

      engine.handleVetoResponse(state, roomId, player, agree);
    });

    socket.on("sendMessage", (text) => {
      if (typeof text !== "string") return;

      const roomId = getRoom();
      if (!roomId) return;
      const state = engine.rooms.get(roomId);
      if (!state) return;

      const player = state.players.find(p => p.id === socket.id);
      if (!player) return;

      if (text.startsWith('/debug')) {
        if (process.env.NODE_ENV !== 'production') {
          const pres = state.players[state.presidentIdx];
          const chan = state.players.find(p => p.id === state.chancellorId);
          state.log.push(`DEBUG: Phase: ${state.phase}, PresIdx: ${state.presidentIdx}, Pres: ${pres?.name}, Chan: ${chan?.name}`);
          engine.broadcastState(roomId);
        }
        return;
      }

      // Strip HTML tags and null bytes before storing — defense in depth
      // against stored XSS if rendering ever changes from JSX to innerHTML.
      const sanitized = text
        .replace(/<[^>]*>/g, "")   // strip any HTML tags
        .replace(/\0/g, "")        // strip null bytes
        .trim();

      if (sanitized.length === 0 || sanitized.length > 300) return;

      state.messages.push({ sender: player.name, text: sanitized, timestamp: Date.now() });
      if (state.messages.length > 50) state.messages.shift();
      engine.broadcastState(roomId);
    });

    socket.on("playAgain", () => {
      const roomId = getRoom();
      if (!roomId) return;
      const state = engine.rooms.get(roomId);
      if (!state || state.phase !== "GameOver") return;

      Object.assign(state, {
        phase: "Lobby",
        civilDirectives: 0,
        stateDirectives: 0,
        electionTracker: 0,
        deck: createDeck(),
        discard: [],
        drawnPolicies: [],
        chancellorPolicies: [],
        currentExecutiveAction: "None",
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
      });

      state.players = state.players.filter(p => !p.isAI && !p.isDisconnected);
      state.players.forEach(p => {
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
      });

      // Drain the spectator queue into the lobby as players (up to maxPlayers)
      drainSpectatorQueue(state, roomId);

      engine.broadcastState(roomId);
    });

    // Spectator queue join
    socket.on("joinQueue", (data: { name: string; userId?: string; avatarUrl?: string; activeFrame?: string; activePolicyStyle?: string; activeVotingStyle?: string }) => {
      const roomId = getRoom();
      if (!roomId) return;
      const state = engine.rooms.get(roomId);
      if (!state) return;
      // Only spectators can queue
      if (!state.spectators.find(s => s.id === socket.id)) return;
      // Don't double-add
      if (state.spectatorQueue.find(q => q.id === socket.id)) return;
      state.spectatorQueue.push({ 
        id: socket.id, 
        name: data.name, 
        userId: data.userId, 
        avatarUrl: data.avatarUrl,
        activeFrame: data.activeFrame, 
        activePolicyStyle: data.activePolicyStyle, 
        activeVotingStyle: data.activeVotingStyle 
      });
      
      // If in lobby, try to drain immediately
      if (state.phase === "Lobby") {
        drainSpectatorQueue(state, roomId);
      }
      
      engine.broadcastState(roomId);
    });

    // Spectator queue leave
    socket.on("leaveQueue", () => {
      const roomId = getRoom();
      if (!roomId) return;
      const state = engine.rooms.get(roomId);
      if (!state) return;
      state.spectatorQueue = state.spectatorQueue.filter(q => q.id !== socket.id);
      engine.broadcastState(roomId);
    });

    // ── Host Controls ─────────────────────────────────────────────────────

    socket.on("kickPlayer", (targetSocketId: string) => {
      const roomId = getRoom();
      if (!roomId) return;
      const state = engine.rooms.get(roomId);
      if (!state) return;
      // Only host can kick
      const host = state.players.find(p => p.userId === state.hostUserId);
      if (!host || host.id !== socket.id) return;
      // Can't kick yourself
      if (targetSocketId === socket.id) return;
      const target = state.players.find(p => p.id === targetSocketId);
      if (!target) return;
      // Remove from room
      state.players = state.players.filter(p => p.id !== targetSocketId);
      state.log.push(`${target.name} was removed by the host.`);
      io.to(targetSocketId).emit("kicked");
      engine.broadcastState(roomId);
    });

    socket.on("toggleLock", () => {
      const roomId = getRoom();
      if (!roomId) return;
      const state = engine.rooms.get(roomId);
      if (!state || state.phase !== "Lobby") return;
      const host = state.players.find(p => p.userId === state.hostUserId);
      if (!host || host.id !== socket.id) return;
      state.isLocked = !state.isLocked;
      state.log.push(`Room ${state.isLocked ? "locked" : "unlocked"} by host.`);
      engine.broadcastState(roomId);
    });

    socket.on("hostStartGame", () => {
      const roomId = getRoom();
      if (!roomId) return;
      const state = engine.rooms.get(roomId);
      if (!state || state.phase !== "Lobby") return;
      const host = state.players.find(p => p.userId === state.hostUserId);
      if (!host || host.id !== socket.id) return;
      const humanPlayers = state.players.filter(p => !p.isAI);
      if (state.mode === 'Ranked' && humanPlayers.length < 5) {
        socket.emit("error", "Need at least 5 players to start a ranked game.");
        return;
      }
      if (humanPlayers.length < 1) {
        socket.emit("error", "Need at least 1 player to start.");
        return;
      }
      state.log.push("Host started the game.");
      if (state.mode === 'Ranked') {
        engine.startGame(roomId);
      } else {
        engine.fillWithAI(roomId);
      }
      engine.broadcastState(roomId);
    });

    socket.on("leaveRoom", () => {
      const roomId = getRoom();
      if (!roomId) return;
      const state = engine.rooms.get(roomId);
      engine.handleLeave(socket, roomId, true);
      if (state && (state.phase === "Lobby" || state.phase === "GameOver")) {
        drainSpectatorQueue(state, roomId);
      }
    });

    socket.on("updateMediaState", ({ isMicOn, isCamOn }) => {
      engine.rooms.forEach((state, roomId) => {
        const player = state.players.find(p => p.id === socket.id);
        if (player) {
          player.isMicOn = isMicOn;
          player.isCamOn = isCamOn;
          engine.broadcastState(roomId);
        }
      });
    });

    // ── Admin Tools ────────────────────────────────────────────────────────

    socket.on("adminDeleteRoom", async (roomId: string) => {
      if (!socket.data.userId) return;
      const user = await getUserById(socket.data.userId);
      if (!user || !user.isAdmin) {
        socket.emit("error", "Unauthorized: Admin privileges required.");
        return;
      }

      const state = engine.rooms.get(roomId);
      if (state) {
        state.log.push("This room has been terminated by an administrator.");
        engine.broadcastState(roomId);
        
        // Give players a moment to see the message before closing
        setTimeout(() => {
          io.to(roomId).emit("kicked");
          engine.rooms.delete(roomId);
          console.log(`Admin ${user.username} deleted room ${roomId}`);
        }, 2000);
      }
    });

    socket.on("adminBroadcast", async (message: string) => {
      if (!socket.data.userId) return;
      const user = await getUserById(socket.data.userId);
      if (!user || !user.isAdmin) {
        socket.emit("error", "Unauthorized: Admin privileges required.");
        return;
      }

      io.emit("adminBroadcast", { 
        message, 
        sender: user.username,
        timestamp: Date.now()
      });
      console.log(`Admin ${user.username} broadcast: ${message}`);
    });

    socket.on("disconnect", async () => {
      if (socket.data.userId) {
        const userId = socket.data.userId;
        userSockets.delete(userId);
        const friends = await getFriends(userId);
        for (const friend of friends) {
          const friendSocketId = userSockets.get(friend.id);
          if (friendSocketId) {
            io.to(friendSocketId).emit("userStatusChanged", { userId, isOnline: false });
          }
        }
      }
      engine.rooms.forEach((state, roomId) => {
        if (state.players.find(p => p.id === socket.id)) {
          engine.handleLeave(socket, roomId);
        }
        // Clean up spectators and queue on disconnect
        state.spectators = state.spectators.filter(s => s.id !== socket.id);
        state.spectatorQueue = (state.spectatorQueue ?? []).filter(q => q.id !== socket.id);
      });
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files from the dist directory
    app.use(express.static("dist", {
      setHeaders: (res, filePath) => {
        // Set long-term cache for hashed assets in the assets/ directory
        if (filePath.includes(path.join("dist", "assets"))) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else if (filePath.endsWith("index.html") || filePath.endsWith("sw.js") || filePath.endsWith("manifest.json")) {
          // Never cache the entry points or service worker to ensure immediate updates upon redeploy
          res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        }
      }
    }));

    app.get('/version', (req, res) => {
      res.json({ version: 'v0.9.8' });
    });

    app.get("*", (_req, res) => {
      // Set no-cache for index.html as well (fallback route)
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.sendFile(path.resolve("dist", "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
