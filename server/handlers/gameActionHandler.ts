import { Server, Socket } from 'socket.io';
import { GameEngine } from '../gameEngine';
import { logger } from '../logger';
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
  sendReactionSchema,
  censureVoteSchema,
  spectatorPredictSchema,
  giveCommendationSchema,
} from '../game/schemas';
import { sendFriendRequest, acceptFriendRequest, getUserById, saveUser, getGlobalStats } from '../supabaseService';
import { getUserSocketId, getSocketId } from '../redis';

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
    if (!result.success) return socket.emit('error', { code: 'INVALID_REQUEST', message: 'Invalid vote data.' });
    const vote = result.data;

    const roomId = getRoom();
    if (!roomId) return;
    const state = engine.rooms.get(roomId);
    if (!state || state.phase !== 'Voting') return;

    const player = state.players.find((p) => p.socketId === socket.id);
    if (!player || player.hasActed) return;
    if (!player.isAlive && player.id !== state.ghostVoterId) return;

    if (state.detainedPlayerId === player.id) {
      socket.emit('error', { code: 'DETAINED', message: 'You are detained by the Interdictor and cannot vote this round.' });
      return;
    }

    player.hasActed = true;
    player.vote = vote;

    if (state.openSession) {
      io.to(roomId).emit('openSessionVotecast', { playerId: player.id, vote });
    }

    const aliveCount = state.players.filter((p) => p.isAlive && p.id !== state.detainedPlayerId).length;
    const ghostVoted = state.ghostVoterId && state.players.find(p => p.id === state.ghostVoterId)?.vote ? 1 : 0;
    const votesNeeded = aliveCount + (state.ghostVoterId ? 1 : 0);
    const votesCast = state.players.filter(p => p.vote).length;

    if (votesCast >= votesNeeded) {
      engine.handleVoteResult(state, roomId);
    } else {
      engine.broadcastState(roomId);
      engine.processAITurns(roomId);
    }
  });

  socket.on('nominateChancellor', (payload) => {
    const result = nominateChancellorSchema.safeParse(payload);
    if (!result.success) return socket.emit('error', { code: 'INVALID_REQUEST', message: 'Invalid nomination data.' });
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
    if (!result.success) return socket.emit('error', { code: 'INVALID_REQUEST', message: 'Invalid discard data.' });
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

    if (data.type === 'Peek') {
      if (data.isRefused) {
        state.log.push(`${player.name} refused to declare what they saw during the Peek.`);
      } else {
        state.log.push(`${player.name} declared they saw ${data.civ} Civil and ${data.sta} State directives.`);
      }
    }
    // President/Chancellor declaration logs are written by onBothDeclared
    // once both sides have declared, to avoid duplicate entries.

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
    if (!player) return;

    // Cipher can use their power in parallel (no titlePrompt required)
    if (abilityData.use && (abilityData as any).role === 'Cipher') {
      await engine.handleTitleAbility(state, roomId, abilityData as any);
      return;
    }

    if (!state.titlePrompt || state.titlePrompt.playerId !== player.id) return;
    await engine.handleTitleAbility(state, roomId, abilityData as any);
  });



  socket.on('vetoRequest', () => {
    const roomId = getRoom();
    if (!roomId) return;
    const state = engine.rooms.get(roomId);
    if (!state || state.phase !== 'Legislative_Chancellor') return;

    const player = state.players.find((p) => p.socketId === socket.id);
    if (!player || !player.isChancellor || !player.isAlive || player.hasActed || state.vetoDenied) return;
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

    if (state.chatBlackout) {
      if (!state.chatBlackoutBuffer) state.chatBlackoutBuffer = [];
      state.chatBlackoutBuffer.push({
        senderId: player.id,
        senderName: player.name,
        text: sanitized,
        timestamp: Date.now(),
      });
      // Do not broadcast to rivals; broadcast state will hide new messages if handled in client
      // or we just don't broadcast state if we want total silence.
      // But standard broadcastState is okay if the client UI filters them.
      // Better to NOT broadcastState here to avoid leaking.
    } else {
      engine.broadcastState(roomId);
    }
  });
  
  socket.on('sendReaction', (payload) => {
    const result = sendReactionSchema.safeParse(payload);
    if (!result.success) return;
    const reaction = result.data;

    const roomId = getRoom();
    if (!roomId) return;
    const state = engine.rooms.get(roomId);
    if (!state) return;

    const player = state.players.find((p) => p.socketId === socket.id);
    if (!player || !player.isAlive) return;

    io.to(roomId).emit('reaction', { playerId: player.id, reaction });
  });

  socket.on('censureVote', (payload) => {
    const result = censureVoteSchema.safeParse(payload);
    if (!result.success) return;
    const { targetId } = result.data;

    const roomId = getRoom();
    if (!roomId) return;
    const state = engine.rooms.get(roomId);
    if (!state || state.phase !== 'Censure_Action') return;

    const player = state.players.find((p) => p.socketId === socket.id);
    if (!player || !player.isAlive || player.hasActed) return;

    // The current President cannot be censured
    if (targetId === state.players[state.presidentIdx].id) {
      socket.emit('error', 'The current President cannot be censured.');
      return;
    }

    player.hasActed = true;
    if (!player.censureVoteId) player.censureVoteId = targetId; // Need to add censureVoteId to Player type

    const aliveCount = state.players.filter((p) => p.isAlive).length;
    const votesCast = state.players.filter((p) => p.censureVoteId).length;

    if (votesCast >= aliveCount) {
      engine.roundManager.tallyCensure(state, roomId);
    } else {
      engine.broadcastState(roomId);
    }
  });

  socket.on('snapVolunteer', () => {
    const roomId = getRoom();
    if (!roomId) return;
    const state = engine.rooms.get(roomId);
    if (!state || state.phase !== 'Snap_Election') return;

    const player = state.players.find((p) => p.socketId === socket.id);
    if (!player || !player.isAlive) return;

    if (!state.snapElectionVolunteers) state.snapElectionVolunteers = [];
    if (!state.snapElectionVolunteers.includes(player.id)) {
      state.snapElectionVolunteers.push(player.id);
    }
    engine.broadcastState(roomId);
  });

  socket.on('ping-server', (callback) => {
    if (typeof callback === 'function') callback();
  });

  socket.on('setLagging', (isLagging) => {
    const roomId = getRoom();
    if (!roomId) return;
    const state = engine.rooms.get(roomId);
    if (!state) return;
    const player = state.players.find((p) => p.socketId === socket.id);
    if (!player) return;
    
    if (player.isLagging !== isLagging) {
      player.isLagging = isLagging;
      engine.broadcastState(roomId);
    }
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

  socket.on('leaveRoom', async (payload?: { intentional?: boolean }) => {
    const roomId = getRoom();
    if (!roomId) return;
    const state = engine.rooms.get(roomId);
    const intentional = payload?.intentional ?? true;
    await engine.handleLeave(socket, roomId, intentional);
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

    // Removed `if (!socket.data.userId) return;` because guests may not have a userId and breaking the fromId mapping breaks the client's WebRTC streams logic.
    io.to(to).emit('signal', { from: socket.id, fromId, signal });
  });

  socket.on('sendFriendRequest', async (targetUserId) => {
    const userId = socket.data.userId;
    if (!userId) return;
    await sendFriendRequest(userId, targetUserId);
    const targetSocketId = await getSocketId(targetUserId, userSockets);
    if (targetSocketId) {
      io.to(targetSocketId).emit('friendRequestReceived', { fromUserId: userId });
    }
  });

  socket.on('acceptFriendRequest', async (targetUserId) => {
    const userId = socket.data.userId;
    if (!userId) return;
    await acceptFriendRequest(userId, targetUserId);
    const targetSocketId = await getSocketId(targetUserId, userSockets);
    if (targetSocketId) {
      io.to(targetSocketId).emit('friendRequestAccepted', { fromUserId: userId });
    }
  });

  socket.on('spectatorPredict', async (payload) => {
    const result = spectatorPredictSchema.safeParse(payload);
    if (!result.success) return socket.emit('error', 'Invalid prediction data.');
    const { prediction, amount } = result.data;

    const roomId = getRoom();
    if (!roomId) return;
    const state = engine.rooms.get(roomId);
    if (!state || state.phase === 'Lobby' || state.phase === 'GameOver') return;

    const me = state.spectators.find((s) => s.id === socket.id);
    if (!me) return;

    // Predictions must be placed before the end of Round 1
    if (state.round > 1) {
      socket.emit('error', 'Predictions are closed after the first round.');
      return;
    }

    if (!state.spectatorPredictions) state.spectatorPredictions = {};

    const userId = socket.data.userId;
    if (!userId) {
      socket.emit('error', 'Register an account to wager IP on match outcomes.');
      return;
    }

    const key = userId;
    if (state.spectatorPredictions[key]) {
      socket.emit('error', 'You have already placed a prediction.');
      return;
    }

    // Validate and deduct IP
    try {
      const user = await getUserById(userId);
      if (!user) {
        socket.emit('error', 'User profile not found.');
        return;
      }

      if (user.stats.points < amount) {
        socket.emit('error', `Insufficient IP balance. You have ${user.stats.points} IP.`);
        return;
      }

      // Deduct IP immediately
      user.stats.points -= amount;
      await saveUser(user);

      // Refresh global stats if missing
      if (!state.globalStats) {
        state.globalStats = await getGlobalStats();
      }

      // Calculate dynamic odds
      const civilWins = state.globalStats.civilWins + 100;
      const stateWins = state.globalStats.stateWins + 100;
      const total = civilWins + stateWins;
      const prob = (prediction === 'Civil' ? civilWins : stateWins) / total;
      const odds = Math.max(1.1, Number((1 / prob).toFixed(2))); // Minimum odds 1.1x

      state.spectatorPredictions[key] = {
        prediction,
        amount,
        odds,
        timestamp: Date.now(),
      };

      state.log.push(`${me.name} wagered ${amount} IP on a ${prediction} victory at ${odds}x odds.`);
      if (state.log.length > 50) state.log.shift();
      
      engine.broadcastState(roomId);
      
      // Emit user update to show new balance
      const { password: _, ...safeUser } = user;
      socket.emit('userUpdate', safeUser as any);
      
    } catch (err) {
      logger.error({ err, userId, roomId }, 'Failed to process spectator prediction');
      socket.emit('error', 'An error occurred while processing your wager.');
    }
  });

  socket.on('initiateKickVote', (targetId) => {
    const roomId = getRoom();
    if (!roomId) return;
    const state = engine.rooms.get(roomId);
    if (!state || state.phase === 'Lobby' || state.phase === 'GameOver') return;

    if (state.kickVote) {
      return socket.emit('error', 'A kick vote is already in progress.');
    }

    const initiator = state.players.find((p) => p.socketId === socket.id);
    if (!initiator || !initiator.isAlive) return;

    const target = state.players.find((p) => p.id === targetId);
    if (!target) return socket.emit('error', 'Target player not found.');
    if (target.id === initiator.id) return socket.emit('error', 'You cannot kick yourself.');

    // Only non-hosts can start kick votes (hosts have direct kick button)
    if (initiator.userId === state.hostUserId) {
      return socket.emit('error', 'Use the admin kick feature instead.');
    }

    state.kickVote = {
      targetId,
      initiatorId: initiator.id,
      votes: { [initiator.id]: 'Aye' },
      endsAt: Date.now() + 30000, // 30 second window
    };

    state.log.push(`${initiator.name} initiated a vote to kick ${target.name}.`);
    engine.broadcastState(roomId);

    // Auto-tally after 30 seconds
    setTimeout(() => {
      const s = engine.rooms.get(roomId);
      if (s && s.kickVote && s.kickVote.targetId === targetId) {
        tallyKickVote(s, roomId);
      }
    }, 30050);
  });

  socket.on('castKickVote', (vote) => {
    const roomId = getRoom();
    if (!roomId) return;
    const state = engine.rooms.get(roomId);
    if (!state || !state.kickVote) return;

    const player = state.players.find((p) => p.socketId === socket.id);
    if (!player || !player.isAlive || player.id === state.kickVote.targetId) return;

    state.kickVote.votes[player.id] = vote;

    const humanPlayers = state.players.filter(p => !p.isAI && p.isAlive && (state.kickVote ? p.id !== state.kickVote.targetId : true));
    const votesCount = Object.keys(state.kickVote.votes).length;

    if (votesCount >= humanPlayers.length) {
      tallyKickVote(state, roomId);
    } else {
      engine.broadcastState(roomId);
    }
  });

  function tallyKickVote(state: any, roomId: string) {
    if (!state.kickVote) return;
    const targetId = state.kickVote.targetId;
    const target = state.players.find((p: any) => p.id === targetId);
    const votes = Object.values(state.kickVote.votes);
    const ayes = votes.filter(v => v === 'Aye').length;
    
    // Simple majority of ALIVE players (including target for count)
    const livingPlayers = state.players.filter((p: any) => p.isAlive).length;
    const threshold = Math.floor(livingPlayers / 2) + 1;

    if (ayes >= threshold) {
      state.log.push(`Kick vote passed for ${target?.name ?? 'Unknown'}.`);
      state.players = state.players.filter((p: any) => p.id !== targetId);
      if (target?.socketId) {
        io.to(target.socketId).emit('kicked');
      }
    } else {
      state.log.push(`Kick vote failed for ${target?.name ?? 'Unknown'}.`);
    }

    state.kickVote = undefined;
    engine.broadcastState(roomId);
  }
}

