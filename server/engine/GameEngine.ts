/**
 * engine/GameEngine.ts — Thin Orchestrator
 *
 * Owns:
 *   - rooms Map (single source of truth for in-memory game state)
 *   - Timer maps (actionTimers, pauseTimers, lobbyTimers)
 *   - io and getConfig references
 *   - All sub-engine instances
 *
 * Delegates:
 *   - Broadcasting & Redis  → GameBroadcaster
 *   - AI decisions          → AIEngine
 *   - Round lifecycle       → RoundManager
 *   - Title abilities       → TitleRoleResolver
 *   - Match conclusion      → MatchCloser
 *   - Pause / disconnect    → PauseManager
 *
 * Exposes a flat public API so that server.ts and all socket handlers can keep
 * calling engine.someMethod() without knowing which sub-module owns it.
 */

import { Server, Socket } from 'socket.io';
import { GameState, Player, Policy, GamePhase, TitleAbilityData, SystemConfig } from '../../shared/types.ts';
import { logger } from '../logger.ts';
import { stateClient, roomKey, ROOM_TTL_SECONDS, isRedisConfigured } from '../redis.ts';
import { GameBroadcaster } from './GameBroadcaster.ts';
import { AIEngine } from './ai/AIEngine.ts';
import { RoundManager } from './RoundManager.ts';
import { TitleRoleResolver, PostRoundContinuation } from './TitleRoleResolver.ts';
import { MatchCloser } from './MatchCloser.ts';
import { PauseManager } from './PauseManager.ts';
import type { IEngineCore } from './IEngineCore.ts';

export type Deps = {
  io: Server;
  getConfig: () => SystemConfig;
};

export class GameEngine implements IEngineCore {
  // ── Core state ──────────────────────────────────────────────────────────────
  readonly rooms: Map<string, GameState> = new Map();
  readonly io: Server;
  readonly getConfig: () => SystemConfig;

  // ── Timer registries ────────────────────────────────────────────────────────
  /** One action-timeout handle per room. */
  readonly actionTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  /** One pause-countdown handle per room. */
  readonly pauseTimers: Map<string, ReturnType<typeof setInterval>> = new Map();
  /** Lobby countdown handles (kept for API compatibility). */
  readonly lobbyTimers: Map<string, ReturnType<typeof setInterval>> = new Map();

  // ── Sub-engines ─────────────────────────────────────────────────────────────
  readonly broadcaster: GameBroadcaster;
  readonly aiEngine: AIEngine;
  readonly roundManager: RoundManager;
  readonly titleRoleResolver: TitleRoleResolver;
  readonly matchCloser: MatchCloser;
  readonly pauseManager: PauseManager;

  constructor({ io, getConfig }: Deps) {
    this.io = io;
    this.getConfig = getConfig;

    this.broadcaster = new GameBroadcaster(io, this.rooms);
    this.aiEngine = new AIEngine(this);
    this.roundManager = new RoundManager(this);
    this.titleRoleResolver = new TitleRoleResolver(this);
    this.matchCloser = new MatchCloser(this);
    this.pauseManager = new PauseManager(this);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Broadcast & Redis — delegates to GameBroadcaster
  // ═══════════════════════════════════════════════════════════════════════════

  broadcastState(roomId: string): void {
    this.broadcaster.broadcastState(roomId);
  }

  deleteRoom(roomId: string): void {
    this.broadcaster.deleteRoom(roomId);
  }

  async clearAllRedisRooms(): Promise<void> {
    await this.broadcaster.clearAllRedisRooms();
  }

  async updateRoomAverageElo(state: GameState): Promise<void> {
    await this.broadcaster.updateRoomAverageElo(state);
  }

  clearActionTimer(roomId: string): void {
    this.roundManager.clearActionTimer(roomId);
  }

  startActionTimer(roomId: string): void {
    this.roundManager.startActionTimer(roomId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase management — delegates to RoundManager
  // ═══════════════════════════════════════════════════════════════════════════

  enterPhase(s: GameState, roomId: string, phase: GamePhase): void {
    this.roundManager.enterPhase(s, roomId, phase);
  }

  /** Public entry point for server.ts to transition into Legislative_Chancellor. */
  enterLegislativeChancellor(s: GameState, roomId: string): void {
    this.roundManager.enterPhase(s, roomId, 'Legislative_Chancellor');
  }

  resetPlayerActions(s: GameState): void {
    this.roundManager.resetPlayerActions(s);
  }

  resetPlayerHasActed(s: GameState): void {
    this.roundManager.resetPlayerHasActed(s);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Game start — delegates to RoundManager
  // ═══════════════════════════════════════════════════════════════════════════

  fillWithAI(roomId: string): void {
    this.roundManager.fillWithAI(roomId);
  }

  startGame(roomId: string): void {
    this.roundManager.startGame(roomId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Election — delegates to RoundManager
  // ═══════════════════════════════════════════════════════════════════════════

  startNomination(state: GameState, roomId: string): void {
    this.roundManager.startNomination(state, roomId);
  }

  nominateChancellor(
    s: GameState,
    roomId: string,
    chancellorId: string,
    presidentId: string
  ): void {
    this.roundManager.nominateChancellor(s, roomId, chancellorId, presidentId);
  }

  handleVoteResult(s: GameState, roomId: string): void {
    this.roundManager.tallyVotes(s, roomId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Legislative — delegates to RoundManager
  // ═══════════════════════════════════════════════════════════════════════════

  handlePresidentDiscard(
    s: GameState,
    roomId: string,
    presidentId: string,
    idx: number
  ): void {
    this.roundManager.handlePresidentDiscard(s, roomId, presidentId, idx);
  }

  handleChancellorPlay(
    s: GameState,
    roomId: string,
    chancellorId: string,
    idx: number
  ): void {
    this.roundManager.handleChancellorPlay(s, roomId, chancellorId, idx);
  }

  triggerPolicyEnactment(
    s: GameState,
    roomId: string,
    policy: Policy,
    isChaos = false,
    playerId?: string
  ): void {
    this.roundManager.enactPolicy(s, roomId, policy, isChaos, playerId);
  }

  checkRoundEnd(s: GameState, roomId: string): void {
    this.roundManager.checkRoundEnd(s, roomId);
  }

  triggerAIDeclarations(state: GameState, roomId: string): void {
    this.roundManager.autoDeclareMissing(state, roomId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Executive Actions — delegates to RoundManager
  // ═══════════════════════════════════════════════════════════════════════════

  async handleExecutiveAction(
    s: GameState,
    roomId: string,
    targetId: string,
    presidentId?: string
  ): Promise<void> {
    await this.roundManager.handleExecutiveAction(s, roomId, targetId, presidentId);
  }

  runExecutiveAction(s: GameState, roomId: string): void {
    this.roundManager.runExecutiveAction(s, roomId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Veto — delegates to RoundManager
  // ═══════════════════════════════════════════════════════════════════════════

  handleVetoResponse(s: GameState, roomId: string, player: Player, agree: boolean): void {
    this.roundManager.handleVetoResponse(s, roomId, player, agree);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Title Abilities — delegates to TitleRoleResolver
  // ═══════════════════════════════════════════════════════════════════════════

  async handleTitleAbility(
    s: GameState,
    roomId: string,
    abilityData: TitleAbilityData
  ): Promise<void> {
    await this.titleRoleResolver.handleTitleAbility(s, roomId, abilityData);
  }


  runPostRoundTitleAbilities(s: GameState, roomId: string): void {
    this.titleRoleResolver.runPostRoundTitleAbilities(s, roomId);
  }

  continuePostRoundAfter(s: GameState, roomId: string, after: PostRoundContinuation): void {
    this.titleRoleResolver.continuePostRoundAfter(s, roomId, after);
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // Victory & Stats — delegates to MatchCloser
  // ═══════════════════════════════════════════════════════════════════════════

  async updateUserStats(
    s: GameState,
    winningSide?: 'Civil' | 'State',
    leaverId?: string
  ): Promise<void> {
    await this.matchCloser.updateUserStats(s, winningSide, leaverId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Pause / Disconnect — delegates to PauseManager
  // ═══════════════════════════════════════════════════════════════════════════

  async handleLeave(socket: Socket, roomId: string, isIntentional = false): Promise<void> {
    await this.pauseManager.handleLeave(socket, roomId, isIntentional);
  }

  async handlePauseTimeout(roomId: string): Promise<void> {
    await this.pauseManager.handlePauseTimeout(roomId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AI — delegates to AIEngine
  // ═══════════════════════════════════════════════════════════════════════════

  scheduleAITurns(s: GameState, roomId: string): void {
    this.aiEngine.scheduleAITurns(s, roomId);
  }

  processAITurns(roomId: string): void {
    this.aiEngine.processAITurns(roomId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Room lifecycle
  // ═══════════════════════════════════════════════════════════════════════════

  async resetRoom(roomId: string): Promise<void> {
    await this.roundManager.resetRoom(roomId);
  }

  async drainSpectatorQueue(roomId: string): Promise<void> {
    await this.roundManager.drainSpectatorQueue(roomId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Redis restoration — runs once on server startup
  // ═══════════════════════════════════════════════════════════════════════════

  async restoreFromRedis(): Promise<void> {
    if (!isRedisConfigured || !stateClient) return;

    let cursor = '0';
    const keys: string[] = [];
    do {
      const [nextCursor, batch] = await stateClient.scan(cursor, 'MATCH', 'room:*', 'COUNT', 100);
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');

    if (keys.length === 0) return;

    logger.info({ count: keys.length }, 'Beginning room restoration from Redis...');

    for (const key of keys) {
      const raw = await stateClient.get(key);
      if (!raw) continue;

      let state: GameState;
      try {
        state = JSON.parse(raw) as GameState;
      } catch {
        logger.warn({ key }, 'Skipping malformed state from Redis');
        continue;
      }

      const roomId = state.roomId;

      if (state.phase === 'GameOver') {
        await stateClient.del(key);
        continue;
      }
      if (state.players.filter((p) => !p.isAI).length === 0) {
        await stateClient.del(key);
        continue;
      }

      for (const p of state.players) {
        if (!p.isAI) p.isDisconnected = true;
      }

      if (state.phase !== 'Lobby') {
        state.isPaused = true;
        state.pauseReason = 'Server restarted. Waiting for players to reconnect…';

        if (state.disconnectedPlayerId && (state.pauseTimer ?? 0) > 0) {
          state.pauseTimer = 60;
          this.pauseManager.startPauseInterval(roomId, state.disconnectedPlayerId);
        }
      }

      this.rooms.set(roomId, state);

      if (!state.isPaused && state.actionTimerEnd !== undefined) {
        const remaining = state.actionTimerEnd - Date.now();
        if (remaining > 0) {
          const handle = setTimeout(async () => {
            this.actionTimers.delete(roomId);
            const s = this.rooms.get(roomId);
            if (!s || s.phase === 'Lobby' || s.phase === 'GameOver' || s.isPaused) return;
            s.actionTimerEnd = undefined;
            await this.roundManager.fireActionTimerExpiry(s, roomId);
          }, remaining);
          this.actionTimers.set(roomId, handle);
        } else {
          setTimeout(async () => {
            const s = this.rooms.get(roomId);
            if (!s || s.phase === 'Lobby' || s.phase === 'GameOver') return;
            s.actionTimerEnd = undefined;
            await this.roundManager.fireActionTimerExpiry(s, roomId);
          }, 0);
        }
      }

      logger.info(
        { roomId, phase: state.phase, playerCount: state.players.length },
        'Restored room from Redis'
      );
    }
  }

  // ── Misc aliases for legacy call-sites ─────────────────────────────────────

  nextPresident(state: GameState, roomId: string, successfulGovernment = false): void {
    this.roundManager.nextRound(state, roomId, successfulGovernment);
  }
}

