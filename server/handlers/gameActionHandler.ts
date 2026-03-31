import { Server, Socket } from 'socket.io';
import { GameEngine } from '../gameEngine.ts';
import { logger } from '../logger.ts';
import {
  voteSchema,
  presidentDiscardSchema,
  chancellorPlaySchema,
  declarePoliciesSchema,
  performExecutiveActionSchema,
  titleAbilityDataSchema,
  vetoResponseSchema,
  nominateChancellorSchema,
  joinQueueSchema,
  signalSchema,
} from '../schemas.ts';
import { sendFriendRequest, acceptFriendRequest } from '../supabaseService.ts';
import { getUserSocketId } from '../redis.ts';

/**
 * Handlers for standard in-game actions like voting, policy declaration, 
 * and legislative decisions.
 */
export function registerGameActionHandlers(
  socket: Socket,
  io: Server,
  engine: GameEngine,
  userSockets: Map<string, string>
) {
  const getRoom = (): string | undefined => Array.from(socket.rooms).find((r) => r !== socket.id);

  socket.on('vote', (payload) => {
    const result = voteSchema.safeParse(payload);
    if (!result.success) return socket.emit('error', 'Invalid vote data.');
    const vote = result.data;

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

  socket.on('nominateChancellor', (payload) => {
    const result = nominateChancellorSchema.safeParse(payload);
    if (!result.success) return socket.emit('error', 'Invalid nomination data.');
    const chancellorId = result.data;

    const roomId = getRoom();
    if (!roomId) return;
    const state = engine.rooms.get(roomId);
    if (!state) return;

    const me = state.players.find((p) => p.socketId === socket.id);
    if (!me) return;

    engine.nominateChancellor(state, roomId, chancellorId, me.id);
  });

  socket.on('presidentDiscard', (payload) => {
    const result = presidentDiscardSchema.safeParse(payload);
    if (!result.success) return socket.emit('error', 'Invalid discard data.');
    const idx = result.data;

    const roomId = getRoom();
    if (!roomId) return;
    const state = engine.rooms.get(roomId);
    if (!state) return;

    const me = state.players.find((p) => p.socketId === socket.id);
    if (!me) return;

    engine.handlePresidentDiscard(state, roomId, me.id, idx);
  });

  socket.on('chancellorPlay', (payload) => {
    const result = chancellorPlaySchema.safeParse(payload);
    if (!result.success) return socket.emit('error', 'Invalid play data.');
    const idx = result.data;

    const roomId = getRoom();
    if (!roomId) return;
    const state = engine.rooms.get(roomId);
    if (!state) return;

    const me = state.players.find((p) => p.socketId === socket.id);
    if (!me) return;

    engine.handleChancellorPlay(state, roomId, me.id, idx);
  });

  socket.on('declarePolicies', (payload) => {
    const result = declarePoliciesSchema.safeParse(payload);
    if (!result.success) {
      logger.warn({ errors: result.error.flatten() }, 'Invalid declarePolicies payload');
      return socket.emit('error', 'Invalid policy declaration data.');
    }
    const data = result.data;

    const roomId = getRoom();
    if (!roomId) return;
    const state = engine.rooms.get(roomId);
    if (!state) return;

    const player = state.players.find((p) => p.socketId === socket.id);
    if (!player) return;

    if (data.type === 'President' && state.presidentId !== player.id) {
      return socket.emit('error', 'Only the active President can declare as President.');
    }
    if (data.type === 'Chancellor' && state.chancellorId !== player.id) {
      return socket.emit('error', 'Only the active Chancellor can declare as Chancellor.');
    }

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
    const drewStr = data.type === 'President' && data.drewCiv !== undefined
      ? ` (drew ${data.drewCiv}C/${data.drewSta}S)`
      : '';
    state.log.push(
      `${player.name} (${data.type}) declared ${passedOrReceived} ${data.civ} Civil and ${data.sta} State directives.${drewStr}`
    );

    engine.broadcastState(roomId);
    engine.checkRoundEnd(state, roomId);
  });

  socket.on('performExecutiveAction', async (payload) => {
    const result = performExecutiveActionSchema.safeParse(payload);
    if (!result.success) return socket.emit('error', 'Invalid executive action data.');
    const targetId = result.data;

    const roomId = getRoom();
    if (!roomId) return;
    const state = engine.rooms.get(roomId);
    if (!state) return;

    const me = state.players.find((p) => p.socketId === socket.id);
    if (!me) return;

    await engine.handleExecutiveAction(state, roomId, targetId, me.id);
  });

  socket.on('useTitleAbility', async (payload) => {
    const result = titleAbilityDataSchema.safeParse(payload);
    if (!result.success) return socket.emit('error', 'Invalid title ability data.');
    const abilityData = result.data;

    const roomId = getRoom();
    if (!roomId) return;
    const state = engine.rooms.get(roomId);
    if (!state) return;
    const player = state.players.find((p) => p.socketId === socket.id);
    if (!state.titlePrompt || !player || state.titlePrompt.playerId !== player.id) return;
    await engine.handleTitleAbility(state, roomId, abilityData as any);
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

  socket.on('vetoResponse', (payload) => {
    const result = vetoResponseSchema.safeParse(payload);
    if (!result.success) return socket.emit('error', 'Invalid veto response data.');
    const agree = result.data;

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

    const sanitized = text
      .replace(/<[^>]*>/g, '')
      .replace(/\0/g, '')
      .trim();
    if (sanitized.length === 0 || sanitized.length > 300) return;

    state.messages.push({
      sender: player.name,
      text: sanitized,
      timestamp: Date.now(),
      type: 'text',
    });
    if (state.messages.length > 50) state.messages.shift();
    engine.broadcastState(roomId);
  });

  socket.on('playAgain', async () => {
    const roomId = getRoom();
    if (!roomId) return;
    await engine.resetRoom(roomId);
  });

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

  socket.on('updateMediaState', ({ isMicOn, isCamOn }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const state = engine.rooms.get(roomId);
    if (!state) return;

    const player = state.players.find((p) => p.socketId === socket.id);
    if (player) {
      player.isMicOn = isMicOn;
      player.isCamOn = isCamOn;
      engine.broadcastState(roomId);
    }
  });

  socket.on('joinQueue', async (payload: unknown) => {
    const result = joinQueueSchema.safeParse(payload);
    if (!result.success) {
      logger.warn({ errors: result.error.flatten() }, 'Invalid joinQueue payload');
      return socket.emit('error', 'Invalid queue join data.');
    }
    const data = result.data;
    const roomId = getRoom();
    if (!roomId) return;
    const state = engine.rooms.get(roomId);
    if (!state) return;
    if (!state.spectators.find((s) => s.id === socket.id)) return;
    if (state.spectatorQueue.find((q) => q.id === socket.id)) return;
    state.spectatorQueue.push({
      id: socket.id,
      name: data.name
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
      await engine.drainSpectatorQueue(roomId);
    }
    engine.broadcastState(roomId);
  });

  socket.on('leaveQueue', () => {
    const roomId = getRoom();
    if (!roomId) return;
    const state = engine.rooms.get(roomId);
    if (!state) return;
    state.spectatorQueue = state.spectatorQueue.filter((q) => q.id !== socket.id);
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

  socket.on('leaveRoom', async () => {
    const roomId = getRoom();
    if (!roomId) return;
    const state = engine.rooms.get(roomId);
    await engine.handleLeave(socket, roomId, true);
    if (state && (state.phase === 'Lobby' || state.phase === 'GameOver')) {
      await engine.drainSpectatorQueue(roomId);
    }
  });

  socket.on('signal', (payload) => {
    const result = signalSchema.safeParse(payload);
    if (!result.success) return;
    const { to, fromId, signal } = result.data;

    const roomId = getRoom();
    if (!roomId) return;
    const state = engine.rooms.get(roomId);
    if (!state) return;

    const isConnected = state.players.some((p) => p.socketId === to) || 
                        state.spectators.some((s) => s.id === to) ||
                        state.spectatorQueue.some((q) => q.id === to);
    if (!isConnected) return;

    io.to(to).emit('signal', { from: socket.id, fromId, signal });
  });

  socket.on('sendFriendRequest', async (targetUserId) => {
    const userId = socket.data.userId;
    if (!userId) return;
    await sendFriendRequest(userId, targetUserId);
    const targetSocketId = await getUserSocketId(targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('friendRequestReceived', { fromUserId: userId });
    }
  });

  socket.on('acceptFriendRequest', async (targetUserId) => {
    const userId = socket.data.userId;
    if (!userId) return;
    await acceptFriendRequest(userId, targetUserId);
    const targetSocketId = await getUserSocketId(targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('friendRequestAccepted', { fromUserId: userId });
    }
  });
}
