/**
 * engine/PauseManager.ts
 *
 * Owns disconnection and reconnection lifecycle:
 *   - startPauseInterval — pauses game, starts 60s reconnect countdown
 *   - handleLeave — spectator/player leave, intentional vs unintentional
 *   - handlePauseTimeout — AI replacement or Ranked forfeit on reconnect timeout
 *   - checkRoomCleanup — purges empty rooms
 */

import { randomUUID } from 'crypto';
import { Socket } from 'socket.io';
import { GameState, Player } from '../../shared/types';
import { AI_BOTS } from './ai/aiPersonalities';
import { addLog, pick } from './utils';
import type { IEngineCore } from './IEngineCore';

/** Extra surface that PauseManager needs beyond the base orchestrator interface. */
export interface IPauseContext extends IEngineCore {
  readonly pauseTimers: Map<string, ReturnType<typeof setInterval>>;
  readonly actionTimers: Map<string, ReturnType<typeof setTimeout>>;
  readonly lobbyTimers: Map<string, ReturnType<typeof setInterval>>;
}

export class PauseManager {
  constructor(private readonly engine: IPauseContext) {}

  // ---------------------------------------------------------------------------
  // Host migration — called immediately when the host leaves or disconnects
  // in the Lobby phase. Only relevant in Lobby; mid-game the host role is unused.
  // ---------------------------------------------------------------------------

  private migrateHost(state: GameState, leavingUserId: string | undefined): void {
    if (state.phase !== 'Lobby') return;
    if (!leavingUserId || state.hostUserId !== leavingUserId) return;

    const nextHost = state.players.find((p) => !p.isAI && p.userId !== leavingUserId);
    if (!nextHost) return; // room is about to be empty — cleanup will handle it

    state.hostUserId = nextHost.userId;
    addLog(state, `${nextHost.name} is now the host.`);
    this.engine.io.to(state.roomId).emit('hostChanged', { newHostUserId: nextHost.userId });
  }

  // ---------------------------------------------------------------------------
  // Pause interval — one per room
  // ---------------------------------------------------------------------------

  startPauseInterval(roomId: string, playerId: string): void {
    const state = this.engine.rooms.get(roomId);
    if (!state) return;
    const player = state.players.find((p) => p.id === playerId);
    if (!player) return;

    player.isDisconnected = true;

    if (state.phase === 'Lobby') {
      addLog(
        state,
        `${player.name} disconnected from lobby. They will be removed in 10s if they don't return.`
      );
      // Migrate the host crown immediately so the lobby isn't frozen.
      this.migrateHost(state, player.userId);
    } else if (state.phase !== 'GameOver') {
      state.isPaused = true;
      state.pauseReason = `${player.name} disconnected. Waiting 60 s for reconnection…`;
      state.pauseTimer = 60;
      state.disconnectedPlayerId = player.id;
      addLog(state, `${player.name} disconnected. Game paused.`);
      this.engine.clearActionTimer(roomId);
      state.actionTimerEnd = undefined;
    }

    const existing = this.engine.pauseTimers.get(roomId);
    if (existing) clearInterval(existing);

    const iv = setInterval(() => {
      const s = this.engine.rooms.get(roomId);
      if (!s || s.phase === 'GameOver' || !player.isDisconnected) {
        clearInterval(iv);
        if (this.engine.pauseTimers.get(roomId) === iv) this.engine.pauseTimers.delete(roomId);
        return;
      }

      if (s.phase === 'Lobby') {
        if (s.lobbyPauseTimer === undefined) s.lobbyPauseTimer = 10;
        s.lobbyPauseTimer--;
        if (s.lobbyPauseTimer <= 0) {
          clearInterval(iv);
          s.players = s.players.filter((p) => p.id !== player.id);
          addLog(s, `${player.name} removed from lobby (timeout).`);
          if (!this.checkRoomCleanup(roomId)) {
            this.engine.broadcastState(roomId);
          }
        }
      } else {
        if (s.pauseTimer === undefined) s.pauseTimer = 60;
        s.pauseTimer--;
        if (s.pauseTimer <= 0) {
          clearInterval(iv);
          this.engine.pauseTimers.delete(roomId);
          this.handlePauseTimeout(roomId);
        }
      }
      this.engine.broadcastState(roomId);
    }, 1000);

    this.engine.pauseTimers.set(roomId, iv);
  }

  // ---------------------------------------------------------------------------
  // Leave handler — called from socket 'disconnecting' and 'leaveRoom'
  // ---------------------------------------------------------------------------

  async handleLeave(socket: Socket, roomId: string, isIntentional = false): Promise<void> {
    const state = this.engine.rooms.get(roomId);
    if (!state) return;

    const spectator = state.spectators.find((s) => s.id === socket.id);
    const queued = (state.spectatorQueue ?? []).find((q) => q.id === socket.id);

    state.spectators = state.spectators.filter((s) => s.id !== socket.id);
    state.spectatorQueue = (state.spectatorQueue ?? []).filter((q) => q.id !== socket.id);

    if (spectator || queued) {
      addLog(state, `${spectator?.name || queued?.name || 'A user'} left the room.`);
    }

    const player = state.players.find((p) => p.socketId === socket.id);
    if (player) {
      if (!player.isAI && (!player.isDisconnected || isIntentional)) {
        if (isIntentional) {
          if (state.phase === 'Lobby' || state.phase === 'GameOver') {
            state.players = state.players.filter((p) => p.id !== player.id);
            addLog(state, `${player.name} left the room.`);
            // Migrate the host crown immediately if the host just left the lobby.
            this.migrateHost(state, player.userId);
          } else {
            if (state.mode === 'Ranked') {
              state.phase = 'GameOver';
              state.winner = undefined;
              state.isPaused = false;
              const msg = `${player.name} has left the game. Match ended as inconclusive.`;
              state.winReason = msg;
              addLog(state, msg);
              state.messages.push({
                sender: 'System',
                text: msg,
                timestamp: Date.now(),
                type: 'text',
              });
              await this.engine.updateUserStats(state, undefined, player.id);
              state.players = state.players.filter((p) => p.id !== player.id);
            } else {
              const takenNames = new Set(state.players.map((p) => p.name.replace(' (AI)', '')));
              const available = AI_BOTS.filter((b) => !takenNames.has(b.name));
              const bot = pick(available) ?? AI_BOTS[Math.floor(AI_BOTS.length * Math.random())];

              const oldId = player.id;
              player.isAI = true;
              player.isDisconnected = false;
              player.id = `ai-${randomUUID()}`;
              player.userId = undefined;
              player.name = `${bot.name} (AI)`;
              player.avatarUrl = bot.avatarUrl;
              player.personality = bot.personality;

              if (state.presidentialOrder) {
                const idx = state.presidentialOrder.indexOf(oldId);
                if (idx !== -1) state.presidentialOrder[idx] = player.id;
              }
              if (state.presidentId === oldId) state.presidentId = player.id;
              if (state.chancellorId === oldId) state.chancellorId = player.id;

              addLog(state, `${bot.name} (AI) has replaced ${player.name}.`);
            }
          }
        } else {
          this.startPauseInterval(roomId, player.id);
        }
      }
    }

    socket.leave(roomId);
    await this.engine.updateRoomAverageElo(state);
    if (!this.checkRoomCleanup(roomId)) {
      this.engine.broadcastState(roomId);
    }
  }

  // ---------------------------------------------------------------------------
  // Pause timeout — reconnect window expired
  // ---------------------------------------------------------------------------

  async handlePauseTimeout(roomId: string): Promise<void> {
    const state = this.engine.rooms.get(roomId);
    if (!state || !state.isPaused) return;

    const player = state.players.find((p) => p.id === state.disconnectedPlayerId);
    if (!player) {
      state.isPaused = false;
      this.engine.broadcastState(roomId);
      return;
    }

    if (state.mode === 'Ranked') {
      state.phase = 'GameOver';
      state.winner = undefined;
      const msg = `Game ended as inconclusive — ${player.name} failed to reconnect.`;
      state.winReason = msg;
      addLog(state, msg);
      state.messages.push({ sender: 'System', text: msg, timestamp: Date.now(), type: 'text' });
      await this.engine.updateUserStats(state, undefined, player.id);
      state.players = state.players.filter((p) => p.id !== player.id);
    } else {
      const takenNames = new Set(state.players.map((p) => p.name.replace(' (AI)', '')));
      const available = AI_BOTS.filter((b) => !takenNames.has(b.name));
      const bot = pick(available) ?? AI_BOTS[Math.floor(Math.random() * AI_BOTS.length)];

      const oldId = player.id;
      player.isAI = true;
      player.isDisconnected = false;
      player.id = `ai-${randomUUID()}`;
      player.userId = undefined;
      player.name = `${bot.name} (AI)`;
      player.avatarUrl = bot.avatarUrl;
      player.personality = bot.personality;

      if (state.presidentialOrder) {
        const idx = state.presidentialOrder.indexOf(oldId);
        if (idx !== -1) state.presidentialOrder[idx] = player.id;
      }
      if (state.presidentId === oldId) state.presidentId = player.id;
      if (state.chancellorId === oldId) state.chancellorId = player.id;
      if (state.titlePrompt && state.titlePrompt.playerId === oldId)
        state.titlePrompt.playerId = player.id;
      if (state.rejectedChancellorId === oldId) state.rejectedChancellorId = player.id;
      if (state.detainedPlayerId === oldId) state.detainedPlayerId = player.id;
      if (state.lastGovernmentPresidentId === oldId) state.lastGovernmentPresidentId = player.id;
      if (state.lastGovernmentChancellorId === oldId) state.lastGovernmentChancellorId = player.id;

      addLog(state, `${player.name} (AI) took over the disconnected seat.`);
      state.isPaused = false;
      this.engine.aiEngine.scheduleAITurns(state, roomId);
    }

    state.pauseTimer = undefined;
    await this.engine.updateRoomAverageElo(state);
    if (!this.checkRoomCleanup(roomId)) {
      this.engine.broadcastState(roomId);
    }
  }

  // ---------------------------------------------------------------------------
  // Room cleanup
  // ---------------------------------------------------------------------------

  /** Returns true if the room was deleted. */
  checkRoomCleanup(roomId: string): boolean {
    const state = this.engine.rooms.get(roomId);
    if (!state) return true;

    const humanCount = state.players.filter((p) => !p.isAI).length;
    const spectatorCount = state.spectators.length;

    if (humanCount === 0 && spectatorCount === 0) {
      this.engine.deleteRoom(roomId);
      const lt = this.engine.lobbyTimers.get(roomId);
      if (lt) {
        clearInterval(lt);
        this.engine.lobbyTimers.delete(roomId);
      }
      const pt = this.engine.pauseTimers.get(roomId);
      if (pt) {
        clearInterval(pt);
        this.engine.pauseTimers.delete(roomId);
      }
      return true;
    }
    return false;
  }
}

