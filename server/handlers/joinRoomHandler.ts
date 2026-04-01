import { Server, Socket } from 'socket.io';
import { randomBytes, randomUUID } from 'crypto';
import { z } from 'zod';
import { GameEngine } from '../gameEngine.ts';
import { getUserById, getFriends, isFriend } from '../supabaseService.ts';
import { createDeck } from '../utils.ts';
import { Player, SystemConfig } from '../../src/types.ts';
import { logger } from '../logger.ts';

import { joinRoomSchema } from '../schemas.ts';
import v8 from 'v8';
import { getUserSocketId, getSocketId, setUserSocketId, checkRoomCreationLimit, recordRoomCreation } from '../redis.ts';

const MAX_ROOM_CAPACITY = parseInt(process.env.MAX_ROOM_CAPACITY || '100');

export async function handleJoinRoom(
  socket: Socket,
  io: Server,
  engine: GameEngine,
  userSockets: Map<string, string>,
  currentConfig: SystemConfig,
  payload: unknown
) {
  const result = joinRoomSchema.safeParse(payload);
  if (!result.success) {
    logger.warn({ errors: result.error.flatten() }, 'Invalid joinRoom payload');
    return socket.emit('error', 'Invalid join request data.');
  }

  const {
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
    avatarUrl: clientAvatarUrl,
  } = result.data;

  // Validation & Sanitisation
  if (typeof roomId !== 'string' || roomId.length < 1 || roomId.length > 40) return;
  if (typeof rawName !== 'string') return;
  if (userId && userId !== socket.data.userId) {
    socket.emit('error', { code: 'UNAUTHORIZED', message: 'User ID mismatch.' });
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
  const safeTimer = actionTimer === 0 ? 0 : Math.max(30, Math.min(120, actionTimer || 60));
  const user = userId ? await getUserById(userId) : null;
  if (user?.isBanned) {
    socket.emit('error', { code: 'BANNED', message: 'Your account has been restricted.' });
    socket.disconnect();
    return;
  }

  let state = engine.rooms.get(roomId);
  
  if (!state && engine.rooms.size >= MAX_ROOM_CAPACITY) {
    socket.emit('error', { code: 'SERVER_CAPACITY', message: 'Server at capacity. Too many active rooms.' });
    return;
  }

  // Circuit Breaker: Prevent new room creation if memory pressure is high (>80% heapUsed)
  if (!state) {
    const mem = process.memoryUsage();
    const heapLimit = v8.getHeapStatistics().heap_size_limit;
    if (mem.heapUsed > heapLimit * 0.8) {
      logger.error(
        { heapUsed: mem.heapUsed, heapLimit, roomCount: engine.rooms.size },
        'Circuit Breaker: Rejecting room creation due to high memory pressure'
      );
      socket.emit('error', 'The assembly is currently overcrowded. Please try again in a few minutes.');
      return;
    }
  }

  if (!state) {
    if (currentConfig.maintenanceMode && !user?.isAdmin) {
      socket.emit('error', { 
        code: 'MAINTENANCE_MODE', 
        message: 'The server is currently undergoing maintenance. New rooms cannot be created at this time.' 
      });
      return;
    }
    if (userId) {
      const { allowed, reason } = await checkRoomCreationLimit(userId);
      if (!allowed && !user?.isAdmin) {
        socket.emit('error', reason);
        return;
      }
    }

    // Generating a 6-char invite code if private
    const code =
      privacy === 'private'
        ? randomBytes(3).toString('hex').toUpperCase().slice(0, 6)
        : undefined;

    if (userId) await recordRoomCreation(userId);

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
        socket.data.roomId = roomId;
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
        // Critical: clear disconnect state so the eviction timer stops running
        existingLobbyPlayer.isDisconnected = false;
        (state as any).lobbyPauseTimer = undefined;
        socket.data.roomId = roomId;
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
    let avatarUrl: string | undefined = clientAvatarUrl;
    if (userId) {
      const user = await getUserById(userId);
      if (user) avatarUrl = user.avatarUrl;
    }
    socket.data.roomId = roomId;
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

  let avatarUrl: string | undefined = clientAvatarUrl;
  if (userId) {
    socket.data.userId = userId;
    userSockets.set(userId, socket.id);
    
    // Background task — don't block the join path for social notifications
    const notifyTask = (async () => {
      try {
        await setUserSocketId(userId, socket.id);
        const friends = await getFriends(userId);
        for (const friend of friends) {
          const friendSocketId = await getSocketId(friend.id, userSockets);
          if (friendSocketId) {
            io.to(friendSocketId).emit('userStatusChanged', { userId, isOnline: true, roomId });
            // find friend's room for status consistency
            let friendRoomId: string | undefined;
            for (const [rId, s] of engine.rooms.entries()) {
              if (s.players.some((p) => p.userId === friend.id && !p.isDisconnected)) {
                friendRoomId = rId;
                break;
              }
            }
            socket.emit('userStatusChanged', { userId: friend.id, isOnline: true, roomId: friendRoomId });
          }
        }
      } catch (err) {
        logger.warn({ err }, 'Deferred join-room notification task failed');
      }
    })();

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
  socket.data.roomId = roomId;
  socket.join(roomId);
  state.log.push(`${name} joined the lobby.`);
  socket.to(roomId).emit('peerJoined', socket.id);
  await engine.updateRoomAverageElo(state);
  engine.broadcastState(roomId);
}
