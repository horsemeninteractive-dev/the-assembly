/**
 * gameEngine.ts — The Assembly Game Engine (Rewrite)
 *
 * Design principles:
 *  - One canonical phase-transition path: every phase change goes through enterPhase().
 *  - AI turns fire exactly once per phase entry via scheduleAITurns(), never recursively.
 *  - Only one action timer is live per room at a time.
 *  - No setTimeout-based polling loops or nested retry chains.
 *  - Title abilities (Assassin, Strategist, Broker, Handler, Auditor, Interdictor)
 *    are resolved in a clean, ordered sequence via runPostRoundTitleAbilities().
 *  - Round history and suspicion updates happen at well-defined checkpoints only.
 */

import { randomUUID } from "crypto";
import { Server, Socket } from "socket.io";
import {
  GameState, Player, Policy, ExecutiveAction, TitleRole, TitleAbilityData, GamePhase, UserInternal, RecentlyPlayedEntry, SystemConfig,
} from "../src/types.ts";
import { shuffle, createDeck } from "./utils.ts";
import { AI_BOTS, CHAT } from "./aiConstants.ts";
import { getExecutiveAction, assignRoles } from "./gameRules.ts";
import {
  initializeSuspicion,
  getSuspicion,
  leastSuspicious,
  mostSuspicious,
  updateSuspicionFromPolicy,
  updateSuspicionFromDeclarations,
  updateSuspicionFromInvestigation,
  updateSuspicionFromNomination,
  updateSuspicionFromPolicyExpectation,
} from "./suspicion.ts";
import { getUserById, saveUser, saveMatchResult, incrementGlobalWin } from "./supabaseService.ts";
import { calculateXpGain } from "../src/lib/xp.ts";
import { checkAchievements } from "./achievements.ts";
import { ACHIEVEMENT_MAP } from "../src/lib/achievements.ts";
import {
  assignPersonalAgendas,
  evaluateAllAgendas,
  getPlayerAgenda,
  AGENDA_MAP,
} from "./personalAgendas.ts";
import { stateClient, roomKey, ROOM_TTL_SECONDS, isRedisConfigured } from "./redis.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Deps = { 
  io: Server;
  getConfig: () => SystemConfig;
};


// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function pick<T>(arr: T[]): T | undefined {
  return arr.length === 0 ? undefined : arr[Math.floor(Math.random() * arr.length)];
}

function addLog(s: GameState, msg: string): void {
  s.log.push(msg);
}

/**
 * Standard ELO formula adapted for team games.
 * K=32 for players under 30 games (provisional), K=20 for established players.
 * opponentAvgElo is the average ELO of the opposing team.
 * Returns a signed integer delta (can be negative).
 */
function computeEloChange(playerElo: number, opponentAvgElo: number, won: boolean, gamesPlayed: number): number {
  const K        = gamesPlayed < 30 ? 32 : 20;
  const expected = 1 / (1 + Math.pow(10, (opponentAvgElo - playerElo) / 400));
  return Math.round(K * ((won ? 1 : 0) - expected));
}

function ensureDeckHas(s: GameState, n: number): void {
  if (s.deck.length < n && s.discard.length > 0) {
    s.deck = shuffle([...s.deck, ...s.discard]);
    s.discard = [];
    addLog(s, "Reshuffled discard pile into deck.");
  }
}

// ---------------------------------------------------------------------------
// GameEngine
// ---------------------------------------------------------------------------

export class GameEngine {
  private io: Server;
  readonly rooms: Map<string, GameState> = new Map();
  private getConfig: () => SystemConfig;

  /** One action-timeout handle per room. */
  private actionTimers: Map<string, ReturnType<typeof setTimeout>>  = new Map();
  /** One pause-countdown handle per room. */
  private pauseTimers:  Map<string, ReturnType<typeof setInterval>> = new Map();
  /** Lobby countdown handles (kept for API compatibility). */
  private lobbyTimers:  Map<string, ReturnType<typeof setInterval>> = new Map();

  constructor({ io, getConfig }: Deps) {
    this.io = io;
    this.getConfig = getConfig;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Public surface — called from server.ts socket handlers
  // ═══════════════════════════════════════════════════════════════════════════

  broadcastState(roomId: string): void {
    const state = this.rooms.get(roomId);
    if (!state) return;

    // Cache socket references for this room
    const roomSockets = this.io.sockets.adapter.rooms.get(roomId);
    if (!roomSockets) return;

    for (const socketId of roomSockets) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (!socket) continue;

      const isSpectator = state.spectators.some(s => s.id === socketId);
      const isGameOver = state.phase === "GameOver";

      // Tailor the player list for this specific recipient
      const tailoredPlayers = state.players.map(p => {
        // Base info is always public
        const { role, titleRole, personalAgenda, ...rest } = p;
        
        // At game over, everyone sees everything
        if (isGameOver) return { ...rest, role, titleRole, personalAgenda };
        
        // Admins and Spectators see all roles
        if (socket.data?.isAdmin || isSpectator) return { ...rest, role, titleRole, personalAgenda };
        
        // Active players see ONLY their own secret info (and haven't handled and/or at game over)
        if (p.id === socketId) return { ...rest, role, titleRole, personalAgenda };
        
        // Otherwise, hide secret info
        return rest;
      });

      // Tailor spectatorRoles: only sent to spectators/admins or at game over
      const tailoredSpectatorRoles = (isSpectator || socket.data?.isAdmin || isGameOver) 
        ? Object.fromEntries(
            state.players.map(p => [
              p.id,
              {
                role: p.role ?? "Unknown",
                titleRole: p.titleRole,
                agendaName: p.personalAgenda
                  ? (AGENDA_MAP.get(p.personalAgenda)?.name ?? p.personalAgenda)
                  : undefined,
              }
            ])
          )
        : undefined;

      socket.emit("gameStateUpdate", {
        ...state,
        players: tailoredPlayers,
        spectatorRoles: tailoredSpectatorRoles,
      });

      // Special handling for privateInfo (State/Overseer agents list, etc.)
      const p = state.players.find(pl => pl.id === socketId);
      if (p && !p.isAI && p.role && !isGameOver) {
        const stateAgents = state.players
          .filter(pl => pl.role === "State" || pl.role === "Overseer")
          .map(pl => ({ id: pl.id, name: pl.name, role: pl.role! }));

        if (p.role === "State" || (p.role === "Overseer" && state.players.length <= 6)) {
          socket.emit("privateInfo", { 
            role: p.role, 
            stateAgents, 
            titleRole: p.titleRole, 
            personalAgenda: getPlayerAgenda(state, p.id) 
          });
        } else {
          socket.emit("privateInfo", { 
            role: p.role, 
            titleRole: p.titleRole, 
            personalAgenda: getPlayerAgenda(state, p.id) 
          });
        }
      }
    }

    // Persist state to Redis on every broadcast (write-through cache).
    // Fire-and-forget — we never block the game loop on a Redis write.
    if (isRedisConfigured && stateClient) {
      stateClient
        .set(roomKey(roomId), JSON.stringify(state), "EX", ROOM_TTL_SECONDS)
        .catch(err => console.error(`[Redis] failed to persist room ${roomId}:`, err.message));
    }
  }

  /** Remove a room from the in-memory map and Redis. */
  public deleteRoom(roomId: string): void {
    this.rooms.delete(roomId);
    if (isRedisConfigured && stateClient) {
      stateClient.del(roomKey(roomId)).catch(err =>
        console.error(`[Redis] failed to delete room ${roomId}:`, err.message)
      );
    }
  }

  /** Clear all room keys from Redis. */
  public async clearAllRedisRooms(): Promise<void> {
    if (!isRedisConfigured || !stateClient) return;
    const keys = await stateClient.keys("room:*");
    if (keys.length > 0) {
      await stateClient.del(...keys);
      console.log(`[Redis] Purged ${keys.length} stale room(s).`);
    }
  }

  /**
   * On server startup, reload all persisted rooms from Redis and restart
   * any timers that were live when the previous instance went down.
   *
   * Called once from server.ts after the Socket.IO adapter is ready.
   */
  public async restoreFromRedis(): Promise<void> {
    if (!isRedisConfigured || !stateClient) return;

    const keys = await stateClient.keys("room:*");
    if (keys.length === 0) return;

    console.log(`[Redis] restoring ${keys.length} room(s) from Redis...`);

    for (const key of keys) {
      const raw = await stateClient.get(key);
      if (!raw) continue;

      let state: GameState;
      try {
        state = JSON.parse(raw) as GameState;
      } catch {
        console.warn(`[Redis] skipping malformed state for key ${key}`);
        continue;
      }

      const roomId = state.roomId;

      // Drop finished or empty rooms — nothing to restore
      if (state.phase === "GameOver") {
        await stateClient.del(key);
        continue;
      }
      if (state.players.filter(p => !p.isAI).length === 0) {
        await stateClient.del(key);
        continue;
      }

      // Mark all human players as disconnected — they'll need to rejoin.
      // The 60-second reconnect grace period will handle them naturally.
      for (const p of state.players) {
        if (!p.isAI) p.isDisconnected = true;
      }

      // Pause the game if it was mid-round so it doesn't auto-advance
      // while nobody is connected yet.
      if (state.phase !== "Lobby") {
        state.isPaused    = true;
        state.pauseReason = "Server restarted. Waiting for players to reconnect…";
      }

      this.rooms.set(roomId, state);

      // Restart action timer with remaining duration if one was live.
      // If the timer already expired while the server was down, fire
      // the expiry handler immediately via a zero-delay timeout.
      if (state.actionTimerEnd !== undefined && !state.isPaused) {
        const remaining = state.actionTimerEnd - Date.now();
        if (remaining > 0) {
          const handle = setTimeout(async () => {
            this.actionTimers.delete(roomId);
            const s = this.rooms.get(roomId);
            if (!s || s.phase === "Lobby" || s.phase === "GameOver" || s.isPaused) return;
            s.actionTimerEnd = undefined;
            await this.onActionTimerExpired(s, roomId);
          }, remaining);
          this.actionTimers.set(roomId, handle);
        } else {
          // Expired while server was down — handle on next tick
          setTimeout(async () => {
            const s = this.rooms.get(roomId);
            if (!s || s.phase === "Lobby" || s.phase === "GameOver" || s.isPaused) return;
            s.actionTimerEnd = undefined;
            await this.onActionTimerExpired(s, roomId);
          }, 0);
        }
      }

      console.log(`[Redis] restored room ${roomId} (phase: ${state.phase}, players: ${state.players.length})`);
    }
  }

  public resetPlayerActions(s: GameState): void {
    for (const p of s.players) {
      p.isPresidentialCandidate = false;
      p.isChancellorCandidate   = false;
      p.isPresident             = false;
      p.isChancellor            = false;
    }
  }

  public resetPlayerHasActed(s: GameState): void {
    for (const p of s.players) p.hasActed = false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Action Timer — only one live per room
  // ═══════════════════════════════════════════════════════════════════════════

  startActionTimer(roomId: string): void {
    const state = this.rooms.get(roomId);
    if (!state || state.actionTimer === 0 || state.phase === "Lobby" || state.phase === "GameOver") {
      if (state) state.actionTimerEnd = undefined;
      this.clearActionTimer(roomId);
      return;
    }

    this.clearActionTimer(roomId);
    state.actionTimerEnd = Date.now() + state.actionTimer * 1000;

    const handle = setTimeout(async () => {
      this.actionTimers.delete(roomId);
      const s = this.rooms.get(roomId);
      if (!s || s.phase === "Lobby" || s.phase === "GameOver" || s.isPaused) return;
      s.actionTimerEnd = undefined;
      await this.onActionTimerExpired(s, roomId);
    }, state.actionTimer * 1000);

    this.actionTimers.set(roomId, handle);
  }

  private clearActionTimer(roomId: string): void {
    const h = this.actionTimers.get(roomId);
    if (h !== undefined) { clearTimeout(h); this.actionTimers.delete(roomId); }
  }

  private async onActionTimerExpired(s: GameState, roomId: string): Promise<void> {
    // Title ability prompts always take priority
    if (s.titlePrompt) {
      await this.resolveTitleAbility(s, roomId, { use: false });
      return;
    }

    switch (s.phase) {
      case "Nominate_Chancellor": {
        const president = s.players[s.presidentIdx];
        let eligible = this.getEligibleChancellors(s, president.id);
        if (eligible.length === 0) eligible = s.players.filter(p => p.isAlive && p.id !== president.id);
        const target = pick(eligible);
        if (target) {
          target.isChancellorCandidate = true;
          addLog(s, `[Timer] ${president.name} timed out. ${target.name} auto-nominated.`);
          this.advanceToVotingOrBroker(s, roomId);
        }
        break;
      }
      case "Voting": {
        for (const p of s.players) {
          if (p.isAlive && !p.vote && p.id !== s.detainedPlayerId) {
            p.vote = Math.random() > 0.3 ? "Aye" : "Nay";
          }
        }
        addLog(s, "[Timer] Voting timed out. Remaining votes auto-cast.");
        this.tallyVotes(s, roomId);
        break;
      }
      case "Legislative_President": {
        const president = s.players.find(p => p.isPresident);
        if (president && s.drawnPolicies.length > 0) {
          s.presidentSaw = [...s.drawnPolicies];
          while (s.drawnPolicies.length > 2) {
            const i = Math.floor(Math.random() * s.drawnPolicies.length);
            s.discard.push(s.drawnPolicies.splice(i, 1)[0]);
          }
          s.chancellorPolicies = [...s.drawnPolicies];
          s.chancellorSaw      = [...s.chancellorPolicies];
          s.drawnPolicies      = [];
          s.presidentTimedOut  = true;
          addLog(s, `[Timer] ${president.name} timed out. Random directive discarded.`);
          this.enterPhase(s, roomId, "Legislative_Chancellor");
        }
        break;
      }
      case "Legislative_Chancellor": {
        if (s.lastEnactedPolicy) {
          // Policy already enacted; auto-declare for whoever hasn't yet
          s.presidentTimedOut  = true;
          s.chancellorTimedOut = true;
          this.autoDeclareMissing(s, roomId);
        } else {
          const chancellor = s.players.find(p => p.isChancellor);
          if (chancellor && s.chancellorPolicies.length > 0) {
            const idx    = Math.floor(Math.random() * s.chancellorPolicies.length);
            const played = s.chancellorPolicies.splice(idx, 1)[0];
            s.discard.push(...s.chancellorPolicies);
            s.chancellorPolicies = [];
            s.chancellorTimedOut = true;
            addLog(s, `[Timer] ${chancellor.name} timed out. Random directive enacted.`);
            this.enactPolicy(s, roomId, played, false, chancellor.id);
          }
        }
        break;
      }
      case "Executive_Action": {
        const president = s.players.find(p => p.isPresident);
        if (president) {
          const eligible = s.players.filter(p => p.isAlive && p.id !== president.id);
          const target   = pick(eligible);
          if (target) {
            addLog(s, `[Timer] ${president.name} timed out. Random target selected.`);
            await this.applyExecutiveAction(s, roomId, target.id);
          }
        }
        break;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase Management — single canonical entry point for all transitions
  // ═══════════════════════════════════════════════════════════════════════════

  private enterPhase(s: GameState, roomId: string, phase: GamePhase): void {
    if (s.phase === "GameOver") return;
    s.phase = phase;
    this.resetPlayerHasActed(s);
    this.startActionTimer(roomId);
    this.broadcastState(roomId);
    this.scheduleAITurns(s, roomId);
  }

  /** Public entry point for server.ts to transition into Legislative_Chancellor
   *  — ensures hasActed is reset for all players, same as any enterPhase call. */
  public enterLegislativeChancellor(s: GameState, roomId: string): void {
    this.enterPhase(s, roomId, "Legislative_Chancellor");
  }

  /** Human president discards a policy by index. */
  public handlePresidentDiscard(s: GameState, roomId: string, presidentSocketId: string, idx: number): void {
    if (s.phase !== "Legislative_President") return;
    if (s.presidentId !== presidentSocketId) return;
    const player = s.players.find(p => p.id === presidentSocketId);
    if (!player || !player.isAlive || player.hasActed) return;
    player.hasActed = true;

    // Guard: timer may have already auto-discarded and cleared the hand
    if (s.drawnPolicies.length === 0) return;

    s.presidentSaw = [...s.drawnPolicies];
    const discarded = s.drawnPolicies.splice(idx, 1)[0];
    if (!discarded) return;
    s.discard.push(discarded);

    if (s.drawnPolicies.length > 2) {
      // Still more to discard (Strategist drew 4 — needs to discard 2)
      player.hasActed = false;
      this.broadcastState(roomId);
      return;
    }

    s.chancellorPolicies = [...s.drawnPolicies];
    s.chancellorSaw      = [...s.chancellorPolicies];
    s.drawnPolicies      = [];
    this.enterLegislativeChancellor(s, roomId);
  }

  /** Human chancellor enacts a policy by index. */
  public handleChancellorPlay(s: GameState, roomId: string, chancellorSocketId: string, idx: number): void {
    if (s.phase !== "Legislative_Chancellor") return;
    if (s.chancellorId !== chancellorSocketId) return;
    const player = s.players.find(p => p.id === chancellorSocketId);
    if (!player || !player.isAlive || player.hasActed) return;
    player.hasActed = true;

    // Guard: timer may have already auto-played and cleared the hand
    if (s.chancellorPolicies.length === 0) return;

    const played = s.chancellorPolicies.splice(idx, 1)[0];
    // Guard: splice on a partially-cleared array can return undefined
    if (!played) return;

    s.discard.push(...s.chancellorPolicies);
    s.chancellorPolicies = [];
    // Do NOT restart the timer here — phase stays Legislative_Chancellor during
    // the animation window; restarting would create a stale misfire.
    this.enactPolicy(s, roomId, played, false, chancellorSocketId);
    this.broadcastState(roomId);
  }



  scheduleAITurns(s: GameState, roomId: string): void {
    if (s.phase === "Lobby" || s.phase === "GameOver" || s.isPaused) return;
    setTimeout(() => {
      const st = this.rooms.get(roomId);
      if (!st || st.isPaused || st.phase === "Lobby" || st.phase === "GameOver") return;
      this.runAITurn(st, roomId);
    }, 2000);
  }

  /** Public alias used by server.ts */
  processAITurns(roomId: string): void {
    const s = this.rooms.get(roomId);
    if (s) this.scheduleAITurns(s, roomId);
  }

  private async runAITurn(s: GameState, roomId: string): Promise<void> {
    // Title ability prompt takes priority — but only resolve it if we are in
    // the correct phase for that ability. A stale scheduleAITurns call from a
    // previous phase must not fire into a titlePrompt that belongs to the next
    // phase (e.g. a lingering AI turn from Executive_Action firing during
    // Nomination_Review and resolving the Interdictor before its time).
    if (s.titlePrompt) {
      const expectedPhase: Record<string, string> = {
        Interdictor: "Nomination_Review",
        Broker:      "Nomination_Review",
        Strategist:  "Legislative_President",
        Auditor:     "Auditor_Action",
        Assassin:    "Assassin_Action",
        Handler:     "Handler_Action",
      };
      const expected = expectedPhase[s.titlePrompt.role];
      if (expected && s.phase !== expected) return; // wrong phase — wait for the right one
      const holder = s.players.find(p => p.id === s.titlePrompt!.playerId);
      if (holder?.isAI) await this.aiDecideTitleAbility(s, roomId);
      return;
    }

    if (s.vetoRequested) {
      await this.aiVetoResponse(s, roomId);
      return;
    }

    switch (s.phase) {
      case "Nominate_Chancellor": {
        const president = s.players[s.presidentIdx];
        if (president.isAI) this.aiNominateChancellor(s, roomId);
        break;
      }
      case "Voting":
        this.aiCastVotes(s, roomId);
        break;
      case "Legislative_President": {
        const president = s.players.find(p => p.isPresident);
        if (president?.isAI) this.aiPresidentDiscard(s, roomId);
        break;
      }
      case "Legislative_Chancellor": {
        const chancellor = s.players.find(p => p.isChancellor);
        if (chancellor?.isAI) {
          if (s.chancellorPolicies.length > 0) {
            this.aiChancellorPlay(s, roomId);
          }
        }
        break;
      }
      case "Executive_Action": {
        const president = s.players.find(p => p.isPresident);
        if (president?.isAI) await this.aiExecutiveAction(s, roomId);
        break;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Game Start & Room Management
  // ═══════════════════════════════════════════════════════════════════════════

  fillWithAI(roomId: string): void {
    const state = this.rooms.get(roomId);
    if (!state) return;

    const takenNames = new Set(state.players.map(p => p.name.replace(" (AI)", "")));
    const available  = AI_BOTS.filter(b => !takenNames.has(b.name));

    while (state.players.length < state.maxPlayers && available.length > 0) {
      const bot = available.splice(Math.floor(Math.random() * available.length), 1)[0];
      state.players.push({
        id:                      `ai-${randomUUID()}`,
        name:                    `${bot.name} (AI)`,
        avatarUrl:               bot.avatarUrl,
        personality:             bot.personality,
        isAlive:                 true,
        isPresidentialCandidate: false,
        isChancellorCandidate:   false,
        isPresident:             false,
        isChancellor:            false,
        wasPresident:            false,
        wasChancellor:           false,
        isAI:                    true,
      });
    }

    this.startGame(roomId);
  }

  startGame(roomId: string): void {
    const state = this.rooms.get(roomId);
    if (!state || state.phase !== "Lobby") return;

    if (state.players.length < state.maxPlayers && state.mode !== "Ranked") {
      this.fillWithAI(roomId);
      return;
    }

    const roles = assignRoles(state.players.length);
    state.players.forEach((p, i) => (p.role = roles[i]));
    
    if (state.mode !== 'Classic') {
      this.assignTitleRoles(state);
      assignPersonalAgendas(state);
    }
    
    initializeSuspicion(state);

    state.presidentialOrder = state.players.map(p => p.id);
    state.declarations      = [];
    state.round             = 0;  // nextRound increments to 1 on first call
    state.lastPresidentIdx  = -1;

    // Pick a random starting president, then point presidentIdx one step
    // behind so that advancePresidentIdx() inside nextRound() lands on them.
    const orderLen  = state.presidentialOrder.length;
    const startPos  = Math.floor(Math.random() * orderLen);
    const prevPos   = (startPos - 1 + orderLen) % orderLen;
    const prevId    = state.presidentialOrder[prevPos];
    const prevIdx   = state.players.findIndex(p => p.id === prevId);
    state.presidentIdx = prevIdx !== -1 ? prevIdx : 0;

    addLog(state, "Game started! Roles assigned.");
    this.nextRound(state, roomId, false);
  }

  private assignTitleRoles(state: GameState): void {
    const n      = state.players.length;
    const count  = n <= 6 ? 2 : n <= 8 ? 3 : 4;
    const titles = shuffle<TitleRole>(["Assassin", "Strategist", "Broker", "Handler", "Auditor", "Interdictor"]);
    const players = shuffle([...state.players]);
    for (let i = 0; i < count; i++) {
      players[i].titleRole = titles[i];
      players[i].titleUsed = false;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Presidential Rotation
  // ═══════════════════════════════════════════════════════════════════════════

  private advancePresidentIdx(state: GameState): void {
    let safety = state.players.length + 1;
    do {
      if (state.presidentialOrder) {
        const curId  = state.players[state.presidentIdx]?.id;
        const curPos = state.presidentialOrder.indexOf(curId);
        const nextId = state.presidentialOrder[(curPos + 1) % state.presidentialOrder.length];
        const found  = state.players.findIndex(p => p.id === nextId);
        if (found !== -1) state.presidentIdx = found;
      } else {
        state.presidentIdx = (state.presidentIdx + 1) % state.players.length;
      }
      safety--;
    } while (
      safety > 0 &&
      (!state.players[state.presidentIdx] || !state.players[state.presidentIdx].isAlive)
    );

    if (safety <= 0) addLog(state, "[ERROR] No alive player found for President. Aborting.");
  }

  /**
   * End the current government, advance the president pointer, increment round,
   * then start the next nomination.
   */
  private nextRound(state: GameState, roomId: string, successfulGovernment = false, skipAdvance = false): void {
    if (state.phase === "GameOver") return;

    state.vetoRequested        = false;
    state.rejectedChancellorId = undefined;
    state.detainedPlayerId     = undefined;

    if (successfulGovernment) {
      const prevPres = state.players.find(p => p.isPresident);
      const prevChan = state.players.find(p => p.isChancellor);
      state.players.forEach(p => { p.wasPresident = false; p.wasChancellor = false; });
      if (prevPres) prevPres.wasPresident = true;
      if (prevChan) prevChan.wasChancellor = true;
    }

    this.resetPlayerActions(state);

    if (skipAdvance) {
      // presidentIdx already points at the special-election target — use as-is.
      // lastPresidentIdx holds the pre-special-election origin so the round
      // AFTER the special round restores and advances correctly.
    } else {
      // Handler swap countdown: swap was applied so order is [..., A, i2, i1, i3, ...].
      // Decrement each round. When it hits 1 (i3's turn is about to start),
      // swap the positions back before advancing — order restored for all future
      // cycles regardless of player count.
      if (state.handlerSwapPending !== undefined) {
        state.handlerSwapPending--;
        if (state.handlerSwapPending <= 0 && state.presidentialOrder && state.handlerSwapPositions) {
          const [p1, p2] = state.handlerSwapPositions;
          [state.presidentialOrder[p1], state.presidentialOrder[p2]] =
            [state.presidentialOrder[p2], state.presidentialOrder[p1]];
          state.handlerSwapPending   = undefined;
          state.handlerSwapPositions = undefined;
        }
      }
      // If returning from a special election, restore the normal rotation origin
      if (state.lastPresidentIdx !== -1) {
        state.presidentIdx     = state.lastPresidentIdx;
        state.lastPresidentIdx = -1;
      }
      this.advancePresidentIdx(state);
    }
    state.round++;
    addLog(state, `--- Round ${state.round} Started ---`);

    state.messages.push({
      sender: "System",
      text:   `Round ${state.round} Started`,
      timestamp: Date.now(),
      type:   "round_separator",
      round:  state.round,
    });

    ensureDeckHas(state, 4);

    // Occasional AI banter at round start
    if (Math.random() > 0.6) {
      const commentator = pick(state.players.filter(p => p.isAI && p.isAlive));
      if (commentator) {
        setTimeout(() => {
          if (!state.isPaused) {
            this.postAIChat(state, commentator, CHAT.banter);
            this.broadcastState(roomId);
          }
        }, 2000);
      }
    }

    this.beginNomination(state, roomId);
  }

  // Public alias used by old call-sites in server.ts
  nextPresident(state: GameState, roomId: string, successfulGovernment = false): void {
    this.nextRound(state, roomId, successfulGovernment);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Election Phase
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Start a nomination: set the presidential candidate, check for Interdictor.
   */
  private beginNomination(state: GameState, roomId: string): void {
    this.resetPlayerActions(state);
    state.presidentTimedOut  = false;
    state.chancellorTimedOut = false;
    state.drawnPolicies      = [];
    state.chancellorPolicies = [];
    state.presidentSaw       = undefined;
    state.chancellorSaw      = undefined;
    state.lastEnactedPolicy  = undefined;
    state.isStrategistAction = undefined;

    state.players[state.presidentIdx].isPresidentialCandidate = true;
    addLog(state, `${state.players[state.presidentIdx].name} is the Presidential Candidate.`);

    // Check for an unused Interdictor (cannot be the incoming president)
    const interdictor = state.players.find(
      p => p.titleRole === "Interdictor" && !p.titleUsed && p.isAlive &&
           p.id !== state.players[state.presidentIdx].id,
    );

    if (interdictor && state.round > 1) {
      state.titlePrompt = { playerId: interdictor.id, role: "Interdictor", context: { role: "Interdictor" }, nextPhase: "Nominate_Chancellor" };
      this.enterPhase(state, roomId, "Nomination_Review");
    } else {
      this.enterPhase(state, roomId, "Nominate_Chancellor");
    }
  }

  // Public alias used by server.ts
  startNomination(state: GameState, roomId: string): void {
    this.beginNomination(state, roomId);
  }

  private getEligibleChancellors(s: GameState, presidentId: string): Player[] {
    const alive = s.players.filter(p => p.isAlive).length;
    return s.players.filter(p =>
      p.isAlive &&
      p.id !== presidentId &&
      p.id !== s.rejectedChancellorId &&
      p.id !== s.detainedPlayerId &&
      !p.wasChancellor &&
      !(alive > 5 && p.wasPresident),
    );
  }

  private advanceToVotingOrBroker(s: GameState, roomId: string): void {
    const broker = s.players.find(p => p.titleRole === "Broker" && !p.titleUsed && p.isAlive);
    if (broker) {
      s.titlePrompt = { playerId: broker.id, role: "Broker", context: { role: "Broker" }, nextPhase: "Voting" };
      this.enterPhase(s, roomId, "Nomination_Review");
    } else {
      this.enterPhase(s, roomId, "Voting");
    }
  }

  nominateChancellor(s: GameState, roomId: string, chancellorId: string, presidentSocketId: string): void {
    // Reject if a title ability is still pending or the phase is wrong
    if (s.titlePrompt) return;
    if (s.phase !== "Nominate_Chancellor") return;

    const president = s.players[s.presidentIdx];
    if (president.id !== presidentSocketId || !president.isAlive || president.hasActed) return;
    president.hasActed = true;

    const chancellor = s.players.find(p => p.id === chancellorId);
    if (!chancellor || !chancellor.isAlive || chancellor.id === president.id) return;

    if (s.rejectedChancellorId === chancellor.id) {
      this.io.to(presidentSocketId).emit("error", "This player was rejected by the Broker and cannot be nominated again this round.");
      president.hasActed = false;
      return;
    }
    if (s.detainedPlayerId === chancellor.id) {
      this.io.to(presidentSocketId).emit("error", "This player is detained by the Interdictor and cannot be nominated.");
      president.hasActed = false;
      return;
    }

    const alive = s.players.filter(p => p.isAlive).length;
    if (chancellor.wasChancellor || (alive > 5 && chancellor.wasPresident)) {
      this.io.to(presidentSocketId).emit("error", "Player is ineligible due to term limits.");
      president.hasActed = false;
      return;
    }

    s.players.forEach(p => (p.isChancellorCandidate = false));
    chancellor.isChancellorCandidate = true;
    addLog(s, `${president.name} nominated ${chancellor.name} for Chancellor.`);
    updateSuspicionFromNomination(s, president.id, chancellor.id);
    this.triggerAIReactions(s, roomId, "nomination", { targetId: chancellor.id });
    this.advanceToVotingOrBroker(s, roomId);
  }

  // ─── Voting ────────────────────────────────────────────────────────────────

  private tallyVotes(s: GameState, roomId: string): void {
    if (!s.previousVotes) s.previousVotes = {};
    for (const p of s.players) {
      if (p.vote) s.previousVotes[p.id] = p.vote;
    }

    // Coalition tracking
    const voters = s.players.filter(p => p.isAlive && s.previousVotes![p.id]);
    for (let i = 0; i < voters.length; i++) {
      for (let j = i + 1; j < voters.length; j++) {
        const [p1, p2] = [voters[i], voters[j]];
        if (s.previousVotes![p1.id] === s.previousVotes![p2.id]) {
          if (!p1.alliances) p1.alliances = {};
          if (!p2.alliances) p2.alliances = {};
          p1.alliances[p2.id] = (p1.alliances[p2.id] ?? 0) + 0.1;
          p2.alliances[p1.id] = (p2.alliances[p1.id] ?? 0) + 0.1;
        }
      }
    }

    const aye = s.players.filter(p => p.vote === "Aye").length;
    const nay = s.players.filter(p => p.vote === "Nay").length;
    s.players.forEach(p => (p.vote = undefined));

    // Show the reveal for 4 seconds, then process the result
    s.actionTimerEnd = Date.now() + 4000;
    s.declarations = [];
    this.enterPhase(s, roomId, "Voting_Reveal");

    setTimeout(async () => {
      const st = this.rooms.get(roomId);
      if (!st || st.phase !== "Voting_Reveal") return;
      st.actionTimerEnd = undefined;
      const votes = st.previousVotes;
      st.previousVotes = undefined;

      if (aye > nay) {
        await this.electionPassed(st, roomId, aye, nay, votes ?? {});
      } else {
        await this.electionFailed(st, roomId, aye, nay, votes ?? {});
      }
    }, 4000);
  }

  /** Public alias used by server.ts vote handler */
  handleVoteResult(s: GameState, roomId: string, aye: number, nay: number): void {
    this.tallyVotes(s, roomId);
  }

  private async electionPassed(
    s: GameState, roomId: string, aye: number, nay: number,
    votes: Record<string, "Aye" | "Nay">,
  ): Promise<void> {
    addLog(s, `Election passed! (${aye} Aye, ${nay} Nay)`);

    const chancellor = s.players.find(p => p.isChancellorCandidate);
    const president  = s.players.find(p => p.isPresidentialCandidate);
    if (!chancellor || !president) {
      addLog(s, "[ERROR] electionPassed: missing candidates.");
      this.nextRound(s, roomId, false);
      return;
    }

    // Overseer wins by being elected chancellor after 3 State directives
    if (s.stateDirectives >= 3) {
      if (chancellor.role === "Overseer") {
        addLog(s, "The Overseer was elected Chancellor — State Supremacy!");
        await this.endGame(s, roomId, "State", "THE OVERSEER HAS ASCENDED");
        return;
      } else {
        chancellor.isProvenNotOverseer = true;
      }
    }

    this.resetPlayerActions(s);
    s.players.forEach(p => { p.isPresident = false; p.isChancellor = false; });
    president.isPresident   = true;
    chancellor.isChancellor = true;
    s.presidentId           = president.id;
    s.chancellorId          = chancellor.id;
    s.electionTracker       = 0;

    s.lastGovernmentVotes        = { ...votes };
    s.lastGovernmentPresidentId  = president.id;
    s.lastGovernmentChancellorId = chancellor.id;
    updateSuspicionFromNomination(s, president.id, chancellor.id);

    ensureDeckHas(s, 4);
    if (s.deck.length === 0) {
      addLog(s, "[ERROR] Deck empty after reshuffle. Skipping to next round.");
      this.nextRound(s, roomId, true);
      return;
    }

    // Strategist draws 4 instead of 3
    if (president.titleRole === "Strategist" && !president.titleUsed) {
      s.titlePrompt   = { playerId: president.id, role: "Strategist", context: { role: "Strategist" }, nextPhase: "Legislative_President" };
      s.drawnPolicies = [];
      this.enterPhase(s, roomId, "Legislative_President");
    } else {
      s.drawnPolicies = s.deck.splice(0, 3);
      this.enterPhase(s, roomId, "Legislative_President");
    }
  }

  private async electionFailed(
    s: GameState, roomId: string, aye: number, nay: number,
    votes: Record<string, "Aye" | "Nay">,
  ): Promise<void> {
    addLog(s, `Election failed! (${aye} Aye, ${nay} Nay)`);

    const presPlayer = s.players[s.presidentIdx];
    const chanPlayer = s.players.find(p => p.isChancellorCandidate);
    if (!s.roundHistory) s.roundHistory = [];
    s.roundHistory.push({
      round:          s.round,
      presidentName:  presPlayer?.name ?? "?",
      chancellorName: chanPlayer?.name ?? "?",
      presidentId:    presPlayer?.id,
      chancellorId:   chanPlayer?.id,
      failed:         true,
      failReason:     "vote",
      votes: Object.entries(votes).map(([pid, v]) => {
        const pl = s.players.find(p => p.id === pid);
        return { playerId: pid, playerName: pl?.name ?? pid, vote: v };
      }),
    });

    s.electionTracker++;
    if (s.electionTracker >= 3) {
      await this.enactChaosPolicy(s, roomId);
    } else {
      this.triggerAIReactions(s, roomId, "failed_vote");
      this.nextRound(s, roomId, false);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Legislative Phase
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Central policy-enactment dispatcher.
   * Waits 6 s for the animation, updates counts, checks victory,
   * then routes to declarations (normal) or chaos next-round.
   */
  private enactPolicy(
    s: GameState, roomId: string, policy: Policy, isChaos: boolean, playerId?: string,
  ): void {
    // Set lastEnactedPolicy immediately so the client can start the reveal
    // animation straight away. trackerReady=false signals that the tracker
    // hasn't been updated yet — the client must not show declarations yet.
    s.lastEnactedPolicy = { type: policy, timestamp: Date.now(), playerId, trackerReady: false };
    this.broadcastState(roomId);

    setTimeout(async () => {
      const st = this.rooms.get(roomId);
      if (!st || st.isPaused) return;

      if (policy === "Civil") {
        st.civilDirectives++;
        addLog(st, "A Civil directive was enacted.");
        // Track chancellor's civil enactments
        if (!isChaos && playerId) {
          const chancellor = st.players.find(p => p.id === playerId);
          if (chancellor) chancellor.civilEnactments = (chancellor.civilEnactments ?? 0) + 1;
        }
      } else {
        st.stateDirectives++;
        addLog(st, `A State directive was enacted. Total: ${st.stateDirectives}`);
        if (st.stateDirectives >= 5) st.vetoUnlocked = true;
        // Track chancellor's state enactments
        if (!isChaos && playerId) {
          const chancellor = st.players.find(p => p.id === playerId);
          if (chancellor) chancellor.stateEnactments = (chancellor.stateEnactments ?? 0) + 1;
        }
      }

      // 1. Update suspicion immediately after counts are updated
      updateSuspicionFromPolicy(st, policy);
      updateSuspicionFromPolicyExpectation(st, policy);

      // 2. Check victory BEFORE flagging trackerReady for declarations
      if (await this.checkVictory(st, roomId)) return;

      // 3. Only if game continues, signal that the policy is ready for declaration
      if (st.lastEnactedPolicy) {
        st.lastEnactedPolicy.trackerReady = true;
      }
      this.broadcastState(roomId);

      if (isChaos) {
        this.captureRoundHistory(st, policy, true);
        this.nextRound(st, roomId, false);
      } else {
        // Wait for both players to declare before running end-of-round logic
        this.scheduleAutoDeclarations(st, roomId);
      }
    }, 5000);
  }

  /** Public alias retained for server.ts compatibility */
  triggerPolicyEnactment(
    s: GameState, roomId: string, policy: Policy, isChaos = false, playerId?: string,
  ): void {
    this.enactPolicy(s, roomId, policy, isChaos, playerId);
  }

  private async enactChaosPolicy(s: GameState, roomId: string): Promise<void> {
    addLog(s, "Election tracker hit 3 — Chaos directive enacted!");
    s.electionTracker = 0;
    s.players.forEach(p => { p.wasPresident = false; p.wasChancellor = false; });

    ensureDeckHas(s, 1);
    if (s.deck.length === 0) {
      addLog(s, "[ERROR] Deck empty. Skipping chaos policy.");
      this.nextRound(s, roomId, false);
      return;
    }

    const policy = s.deck.shift()!;
    this.resetPlayerActions(s);
    this.enactPolicy(s, roomId, policy, true);
    this.broadcastState(roomId);
  }

  // ─── Declarations ─────────────────────────────────────────────────────────

  /**
   * After policy enactment, schedule a single auto-declare pass.
   * Human players declare via socket; AI players and timed-out players are handled here.
   */
  private scheduleAutoDeclarations(s: GameState, roomId: string): void {
    setTimeout(() => {
      const st = this.rooms.get(roomId);
      if (!st || st.phase !== "Legislative_Chancellor") return;
      this.autoDeclareMissing(st, roomId);
    }, 1500);
  }

  private autoDeclareMissing(s: GameState, roomId: string): void {
    if (s.phase !== "Legislative_Chancellor") return;

    const president  = s.players.find(p => p.isPresident);
    const chancellor = s.players.find(p => p.isChancellor);
    if (!president || !chancellor) return;

    const presDeclared = s.declarations.some(d => d.type === "President");
    const chanDeclared = s.declarations.some(d => d.type === "Chancellor");

    if (!presDeclared && (president.isAI  || s.presidentTimedOut))  this.generateDeclaration(s, roomId, president,  "President");
    if (!chanDeclared && (chancellor.isAI || s.chancellorTimedOut)) this.generateDeclaration(s, roomId, chancellor, "Chancellor");
  }

  /** Generate and record an AI or auto-declaration (with possible lying). */
  private generateDeclaration(
    s: GameState, roomId: string, player: Player, type: "President" | "Chancellor",
  ): void {
    if (s.declarations.some(d => d.playerId === player.id && d.type === type)) return;
    
    // Remove any existing declaration of the same title (President/Chancellor)
    s.declarations = s.declarations.filter(d => d.type !== type);

    const saw     = s.chancellorSaw ?? [];
    const drew    = s.presidentSaw  ?? [];
    let civ       = saw.filter(p => p === "Civil").length;
    let sta       = saw.filter(p => p === "State").length;
    let drewCiv   = drew.filter(p => p === "Civil").length;
    let drewSta   = drew.filter(p => p === "State").length;

    const presIsState = s.players.find(p => p.isPresident)?.role  !== "Civil";
    const chanIsState = s.players.find(p => p.isChancellor)?.role !== "Civil";
    const bothState   = presIsState && chanIsState;
    const enacted     = s.lastEnactedPolicy?.type;

    if (bothState && enacted === "State") {
      if (type === "President") {
        if      (sta === 2 && Math.random() > 0.5) { civ = 1; sta = 1; }
        else if (sta === 1 && Math.random() > 0.5) { civ = 0; sta = 2; }
        s.pendingChancellorClaim = { civ, sta };
      } else {
        if (s.pendingChancellorClaim) {
          ({ civ, sta } = s.pendingChancellorClaim);
          s.pendingChancellorClaim = undefined;
        }
      }
    } else {
      let lie = false;
      if (player.role !== "Civil") {
        if      (player.personality === "Deceptive")  lie = true;
        else if (player.personality === "Aggressive") lie = Math.random() > 0.15;
        else if (player.personality === "Strategic")  lie = (s.stateDirectives ?? 0) >= 1;
        else if (player.personality === "Chaotic")    lie = Math.random() > 0.3;
      }
      if (lie && civ > 0) { 
        if (enacted === "Civil" && civ === 1) {
          // Do not lie, must claim at least 1 Civil since Civil was enacted
        } else {
          civ--; sta++; 
        }
      }
    }

    if (type === "President") {
      if (player.role !== "Civil") {
        const discardedCiv = drewCiv - civ;
        // Always try to hide discarding a Civil by claiming we drew a State instead
        if (discardedCiv > 0) {
          drewCiv -= discardedCiv;
          drewSta += discardedCiv;
        }
      }
      // Absolute paradox prevention: you must have drawn what you claim you passed
      while (drewSta < sta && drewCiv > 0) { drewCiv--; drewSta++; }
      while (drewCiv < civ && drewSta > 0) { drewSta--; drewCiv++; }
    }

    s.declarations.push({
      playerId:   player.id,
      playerName: player.name,
      civ, sta,
      ...(type === "President" ? { drewCiv, drewSta } : {}),
      type,
      timestamp:  Date.now(),
    });

    const verb   = type === "President" ? "passed" : "received";
    const drewStr = type === "President" ? ` (drew ${drewCiv}C/${drewSta}S)` : "";
    addLog(s, `${player.name} (${type}) declared ${verb} ${civ}C/${sta}S.${drewStr}`);

    if (player.isAI && enacted === "State" && Math.random() > 0.4) {
      setTimeout(() => {
        if (s.isPaused) return;
        const lines = type === "Chancellor"
          ? (player.role === "Civil" ? CHAT.chanCivilStateEnacted : CHAT.chanStateStateEnacted)
          : (player.role === "Civil" ? CHAT.presCivilStateEnacted : CHAT.presStateStateEnacted);
        this.postAIChat(s, player, lines);
        this.broadcastState(roomId);
      }, 1200);
    }

    this.broadcastState(roomId);

    const presDecl = s.declarations.some(d => d.type === "President");
    const chanDecl = s.declarations.some(d => d.type === "Chancellor");
    if (presDecl && chanDecl) this.onBothDeclared(s, roomId);
  }

  /** Called once both players have declared — runs suspicion, history, then title abilities. */
  private onBothDeclared(s: GameState, roomId: string): void {
    if (s.phase !== "Legislative_Chancellor") return;
    if (!s.lastEnactedPolicy) return;

    updateSuspicionFromDeclarations(s);

    if (!s.lastEnactedPolicy.historyCaptured) {
      this.captureRoundHistory(s, s.lastEnactedPolicy.type, false);
      s.lastEnactedPolicy.historyCaptured = true;
      s.lastGovernmentVotes = undefined;
    }

    this.runPostRoundTitleAbilities(s, roomId);
  }

  /** Public alias used by server.ts declarePolicies handler */
  checkRoundEnd(s: GameState, roomId: string): void {
    const presDecl = s.declarations.some(d => d.type === "President");
    const chanDecl = s.declarations.some(d => d.type === "Chancellor");
    if (presDecl && chanDecl) this.onBothDeclared(s, roomId);
  }

  // ─── Post-round title abilities ────────────────────────────────────────────

  /**
   * After declarations, run title abilities in order: Auditor → Assassin → Handler.
   * Each ability sets titlePrompt and returns; resolution calls runExecutiveAction.
   */
  private runPostRoundTitleAbilities(s: GameState, roomId: string): void {
    if (s.phase === "GameOver") return;

    const auditor = s.players.find(p => p.titleRole === "Auditor" && !p.titleUsed && p.isAlive);
    if (auditor) {
      s.titlePrompt = { playerId: auditor.id, role: "Auditor", context: { role: "Auditor", discardPile: s.discard.slice(-3) } };
      this.enterPhase(s, roomId, "Auditor_Action");
      return;
    }

    const president = s.players[s.presidentIdx];
    if (president.titleRole === "Assassin" && !president.titleUsed && president.isAlive) {
      s.titlePrompt = { playerId: president.id, role: "Assassin", context: { role: "Assassin" }, nextPhase: "Handler_Action" };
      this.enterPhase(s, roomId, "Assassin_Action");
      return;
    }

    const handler = s.players.find(p => p.titleRole === "Handler" && !p.titleUsed && p.isAlive);
    if (handler) {
      s.titlePrompt = { playerId: handler.id, role: "Handler", context: { role: "Handler" }, nextPhase: "Nominate_Chancellor" };
      this.enterPhase(s, roomId, "Handler_Action");
      return;
    }

    this.runExecutiveAction(s, roomId);
  }

  /** Continue post-round sequence starting after the given ability. */
  private continuePostRoundAfter(s: GameState, roomId: string, after: TitleRole): void {
    if (s.phase === "GameOver") return;

    if (after === "Auditor") {
      const president = s.players[s.presidentIdx];
      if (president.titleRole === "Assassin" && !president.titleUsed && president.isAlive) {
        s.titlePrompt = { playerId: president.id, role: "Assassin", context: { role: "Assassin" }, nextPhase: "Handler_Action" };
        this.enterPhase(s, roomId, "Assassin_Action");
        return;
      }
    }

    if (after === "Auditor" || after === "Assassin") {
      const handler = s.players.find(p => p.titleRole === "Handler" && !p.titleUsed && p.isAlive);
      if (handler) {
        s.titlePrompt = { playerId: handler.id, role: "Handler", context: { role: "Handler" }, nextPhase: "Nominate_Chancellor" };
        this.enterPhase(s, roomId, "Handler_Action");
        return;
      }
    }

    this.runExecutiveAction(s, roomId);
  }

  // No-op stubs kept for server.ts call-site compatibility
  checkAuditorTrigger(_state: GameState): void {}
  triggerAIDeclarations(state: GameState, roomId: string): void {
    this.autoDeclareMissing(state, roomId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Title Ability Resolution — single handler for all abilities
  // ═══════════════════════════════════════════════════════════════════════════

  async handleTitleAbility(s: GameState, roomId: string, abilityData: TitleAbilityData): Promise<void> {
    const prompt = s.titlePrompt;
    if (!prompt) return;

    const player = s.players.find(p => p.id === prompt.playerId);
    if (!player) { s.titlePrompt = undefined; return; }

    s.titlePrompt = undefined;

    if (abilityData.use) {
      // Only mark used and fire events when the ability is actually activated
      player.titleUsed = true;
      this.io.to(roomId).emit("powerUsed", { role: prompt.role });
      if (player.isAI) this.postAIChat(s, player, CHAT.powerUsage);
      await this.applyTitleAbility(s, roomId, player, prompt.role, abilityData);
    } else {
      // Player declined — ability is preserved for a future round
      this.onTitleAbilityDeclined(s, roomId, player, prompt.role);
    }

    this.broadcastState(roomId);
  }

  /** Alias used by old server.ts path */
  async resolveTitleAbility(s: GameState, roomId: string, abilityData: TitleAbilityData): Promise<void> {
    await this.handleTitleAbility(s, roomId, abilityData);
  }

  private async applyTitleAbility(
    s: GameState, roomId: string, player: Player, role: TitleRole, data: TitleAbilityData,
  ): Promise<void> {
    switch (role) {
      case "Assassin": {
        if (!data.use || data.role !== "Assassin") break;
        const target = s.players.find(p => p.id === data.targetId && p.isAlive);
        if (target) {
          target.isAlive = target.isPresident = target.isChancellor = false;
          target.isPresidentialCandidate = target.isChancellorCandidate = false;
          addLog(s, `${player.name} (Assassin) secretly executed ${target.name}.`);
          if (target.role === "Overseer") {
            await this.endGame(s, roomId, "Civil", "OVERSEER ASSASSINATED — CHARTER RESTORED");
            return;
          }
        }
        this.continuePostRoundAfter(s, roomId, "Assassin");
        break;
      }

      case "Strategist": {
        ensureDeckHas(s, 4);
        s.drawnPolicies      = s.deck.splice(0, 4);
        s.isStrategistAction = true;
        addLog(s, `${player.name} (Strategist) drew an extra directive (4 total).`);
        this.enterPhase(s, roomId, "Legislative_President");
        break;
      }

      case "Broker": {
        const candidate = s.players.find(p => p.isChancellorCandidate);
        if (candidate) {
          candidate.isChancellorCandidate = false;
          s.rejectedChancellorId = candidate.id;
          addLog(s, `${player.name} (Broker) rejected ${candidate.name} — re-nomination required.`);
        }
        // Chain to a second Broker if one exists
        const nextBroker = s.players.find(p => p.titleRole === "Broker" && !p.titleUsed && p.isAlive && p.id !== player.id);
        if (nextBroker) {
          s.titlePrompt = { playerId: nextBroker.id, role: "Broker", context: { role: "Broker" }, nextPhase: "Voting" };
          this.enterPhase(s, roomId, "Nomination_Review");
        } else {
          this.enterPhase(s, roomId, "Nominate_Chancellor");
        }
        break;
      }

      case "Handler": {
        if (s.presidentialOrder) {
          const curId = s.players[s.presidentIdx].id;
          const cur   = s.presidentialOrder.indexOf(curId);
          const len   = s.presidentialOrder.length;
          const i1Pos = (cur + 1) % len;
          const i2Pos = (cur + 2) % len;
          const i1Id   = s.presidentialOrder[i1Pos];
          const i2Id   = s.presidentialOrder[i2Pos];
          const i1Name = s.players.find(p => p.id === i1Id)?.name ?? "?";
          const i2Name = s.players.find(p => p.id === i2Id)?.name ?? "?";
          // Swap i1 and i2 so advancePresidentIdx visits i2 first this cycle.
          // We store i1's id and the swap positions so nextRound can revert the
          // array and place i1 directly after i2's round — keeping all future
          // cycles in the original order.
          [s.presidentialOrder[i1Pos], s.presidentialOrder[i2Pos]] =
            [s.presidentialOrder[i2Pos], s.presidentialOrder[i1Pos]];
          s.handlerSwapPending   = 3;   // 3=i2 next, 2=i1 next, 1=revert before i3
          s.handlerSwapPositions = [i1Pos, i2Pos];
          addLog(s, `${player.name} (Handler) swapped ${i1Name} and ${i2Name} — ${i2Name} will be next President, followed by ${i1Name}.`);
        }
        this.continuePostRoundAfter(s, roomId, "Handler");
        break;
      }

      case "Auditor": {
        const last3 = s.discard.slice(-3);
        this.io.to(player.id).emit("policyPeekResult", last3);
        addLog(s, `${player.name} (Auditor) peeked at the discard pile.`);
        this.continuePostRoundAfter(s, roomId, "Auditor");
        break;
      }

      case "Interdictor": {
        if (!data.use || data.role !== "Interdictor") break;
        const president = s.players[s.presidentIdx];
        const target = s.players.find(
          p => p.id === data.targetId && p.isAlive &&
               p.id !== president.id && p.id !== player.id,
        );
        if (target) {
          s.detainedPlayerId = target.id;
          addLog(s, `${player.name} (Interdictor) detained ${target.name} for this round.`);
        }
        const nextInterdictor = s.players.find(p => p.titleRole === "Interdictor" && !p.titleUsed && p.isAlive && p.id !== player.id);
        if (nextInterdictor) {
          s.titlePrompt = { playerId: nextInterdictor.id, role: "Interdictor", context: { role: "Interdictor" }, nextPhase: "Nominate_Chancellor" };
          this.enterPhase(s, roomId, "Nomination_Review");
        } else {
          this.enterPhase(s, roomId, "Nominate_Chancellor");
        }
        break;
      }
    }
  }

  private onTitleAbilityDeclined(s: GameState, roomId: string, player: Player, role: TitleRole): void {
    switch (role) {
      case "Strategist":
        ensureDeckHas(s, 3);
        s.drawnPolicies = s.deck.splice(0, 3);
        this.enterPhase(s, roomId, "Legislative_President");
        break;
      case "Broker":
        this.enterPhase(s, roomId, "Voting");
        break;
      case "Interdictor":
        this.enterPhase(s, roomId, "Nominate_Chancellor");
        break;
      case "Assassin":
        this.continuePostRoundAfter(s, roomId, "Assassin");
        break;
      case "Handler":
        this.continuePostRoundAfter(s, roomId, "Handler");
        break;
      case "Auditor":
        this.continuePostRoundAfter(s, roomId, "Auditor");
        break;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Executive Actions
  // ═══════════════════════════════════════════════════════════════════════════

  private runExecutiveAction(s: GameState, roomId: string): void {
    if (s.phase === "GameOver") return;

    const action = getExecutiveAction(s);

    // Only fire each action once per State directive milestone
    if (action !== "None" && s.lastExecutiveActionStateCount !== s.stateDirectives) {
      s.lastExecutiveActionStateCount = s.stateDirectives;
      s.currentExecutiveAction = action;

      if (action === "PolicyPeek") {
        const top3 = s.deck.slice(0, 3);
        if (s.presidentId) {
          this.io.to(s.presidentId).emit("policyPeekResult", top3);
          const pres = s.players.find(p => p.id === s.presidentId);
          addLog(s, `${pres?.name ?? "President"} previewed the top 3 directives.`);
        }
        this.nextRound(s, roomId, true);
        return;
      }

      addLog(s, `Executive Action unlocked: ${action}`);
      this.enterPhase(s, roomId, "Executive_Action");
    } else {
      this.nextRound(s, roomId, true);
    }
  }

  async handleExecutiveAction(s: GameState, roomId: string, targetId: string, presidentSocketId?: string): Promise<void> {
    if (presidentSocketId) {
      if (s.phase !== "Executive_Action") return;
      if (s.presidentId !== presidentSocketId) return;
      const player = s.players.find(p => p.id === presidentSocketId);
      if (!player || !player.isAlive || player.hasActed) return;
      player.hasActed = true;
    }
    await this.applyExecutiveAction(s, roomId, targetId);
    this.broadcastState(roomId);
  }

  private async applyExecutiveAction(s: GameState, roomId: string, targetId: string): Promise<void> {
    const action = s.currentExecutiveAction;
    s.currentExecutiveAction = "None";

    const target = s.players.find(p => p.id === targetId && p.isAlive);
    if (!target) { this.nextRound(s, roomId, true); return; }

    if (action === "Execution") {
      await this.executePlayer(s, roomId, target);
    } else if (action === "Investigate") {
      this.investigatePlayer(s, roomId, target);
    } else if (action === "SpecialElection") {
      addLog(s, `Special Election: ${target.name} will be the next Presidential Candidate.`);

      // Store the current president's index so the round AFTER the special
      // election restores here and advancePresidentIdx resumes normal rotation.
      s.lastPresidentIdx = s.presidentIdx;

      // Point presidentIdx directly at the target. skipAdvance=true tells
      // nextRound to use this value as-is rather than restore-then-advance.
      s.presidentIdx = s.players.indexOf(target);

      // Route through nextRound with skipAdvance=true — presidentIdx is already
      // the target, so no advance needed. Handles round counter, log separator,
      // full state reset, and beginNomination (including Interdictor check).
      this.nextRound(s, roomId, true, true);
    } else {
      this.nextRound(s, roomId, true);
    }
  }

  private async executePlayer(s: GameState, roomId: string, target: Player): Promise<void> {
    target.isAlive = false;
    target.isPresident = target.isChancellor = false;
    target.isPresidentialCandidate = target.isChancellorCandidate = false;
    addLog(s, `${target.name} was executed!`);

    const president = s.players.find(p => p.id === s.presidentId);
    if (president?.userId) {
      const u = await getUserById(president.userId);
      if (u) { u.stats.kills++; await saveUser(u); }
    }
    if (target.userId) {
      const u = await getUserById(target.userId);
      if (u) { u.stats.deaths++; await saveUser(u); }
    }

    if (target.role === "Overseer") {
      addLog(s, "The Overseer was executed — Charter Restored!");
      await this.endGame(s, roomId, "Civil", "THE OVERSEER IS ELIMINATED — CHARTER RESTORED");
    } else {
      this.nextRound(s, roomId, true);
    }
  }

  private investigatePlayer(s: GameState, roomId: string, target: Player): void {
    addLog(s, `President investigated ${target.name}.`);
    const result = target.role === "Civil" ? "Civil" : "State";

    if (s.presidentId) {
      this.io.to(s.presidentId).emit("investigationResult", { targetName: target.name, role: result });
      updateSuspicionFromInvestigation(s, s.presidentId, target.id, result);

      const pres = s.players.find(p => p.id === s.presidentId);
      if (pres?.isAI && Math.random() > 0.3) {
        setTimeout(() => {
          if (!s.isPaused) {
            this.postAIChat(s, pres, result === "State" ? CHAT.investigateState : CHAT.investigateCivil, target.name);
            this.broadcastState(roomId);
          }
        }, 1000);
      }
    }

    this.nextRound(s, roomId, true);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Veto
  // ═══════════════════════════════════════════════════════════════════════════

  handleVetoResponse(s: GameState, roomId: string, player: Player, agree: boolean): void {
    if (agree) {
      addLog(s, `${player.name} (President) agreed to Veto. Both directives discarded.`);
      s.discard.push(...s.chancellorPolicies);
      s.chancellorPolicies = [];
      s.vetoRequested      = false;

      if (!s.roundHistory) s.roundHistory = [];
      const vetoPresident  = s.players.find(p => p.isPresident);
      const vetoChancellor = s.players.find(p => p.isChancellor);
      s.roundHistory.push({
        round:          s.round,
        presidentName:  vetoPresident?.name  ?? "?",
        chancellorName: vetoChancellor?.name ?? "?",
        presidentId:    vetoPresident?.id,
        chancellorId:   vetoChancellor?.id,
        failed: true, failReason: "veto", votes: [],
      });

      s.electionTracker++;
      if (s.electionTracker >= 3) {
        this.enactChaosPolicy(s, roomId);
        return;
      }

      // Check for Auditor even on a veto
      const auditor = s.players.find(p => p.titleRole === "Auditor" && !p.titleUsed && p.isAlive);
      if (auditor) {
        s.titlePrompt = { playerId: auditor.id, role: "Auditor", context: { role: "Auditor", discardPile: s.discard.slice(-3) } };
        this.enterPhase(s, roomId, "Auditor_Action");
      } else {
        this.nextRound(s, roomId, false);
      }
    } else {
      s.vetoRequested = false;
      const vetoChancellor = s.players.find(p => p.isChancellor);
      if (vetoChancellor) vetoChancellor.hasActed = false;
      addLog(s, `${player.name} (President) denied the Veto. Chancellor must enact a directive.`);
      this.broadcastState(roomId);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Victory & Stats
  // ═══════════════════════════════════════════════════════════════════════════

  private async checkVictory(s: GameState, roomId: string): Promise<boolean> {
    if (s.civilDirectives >= 5) {
      await this.endGame(s, roomId, "Civil", "CHARTER RESTORED");
      return true;
    }
    if (s.stateDirectives >= 6) {
      await this.endGame(s, roomId, "State", "STATE SUPREMACY");
      return true;
    }
    return false;
  }

  private async endGame(s: GameState, roomId: string, winner: "Civil" | "State", reason: string): Promise<void> {
    s.phase     = "GameOver";
    s.winner    = winner;
    s.winReason = reason;
    addLog(s, `Game over: ${reason}`);
    this.clearActionTimer(roomId);
    await this.updateUserStats(s, winner);
    await incrementGlobalWin(winner);
    this.broadcastState(roomId);
  }

  async updateUserStats(s: GameState, winningSide: "Civil" | "State"): Promise<void> {
    const humanPlayers = s.players.filter(p => !p.isAI && p.userId);
    if (humanPlayers.length === 0) return;

    // ── Single parallel fetch — replaces N sequential getUserById calls ────
    const fetched = await Promise.all(humanPlayers.map(p => getUserById(p.userId!)));
    const userMap = new Map<string, UserInternal>();
    for (let i = 0; i < humanPlayers.length; i++) {
      const u = fetched[i];
      if (u) userMap.set(humanPlayers[i].userId!, u);
    }

    const validUsers = Array.from(userMap.values());
    const roomAverageElo = validUsers.length
      ? Math.round(validUsers.reduce((sum, u) => sum + u.stats.elo, 0) / validUsers.length)
      : 1000;

    const now = new Date().toISOString();

    // Per-player results collected for socket emissions after saves
    type PlayerResult = {
      playerId:        string;
      user:            UserInternal;
      won:             boolean;
      eloChange:       number;
      eloBeforeCalc:   number;
      xpEarned:        number;
      ipEarned:        number;
      cpEarned:        number;
      agendaCompleted: boolean;
      agendaName:      string | undefined;
      newAchievementIds: string[];
      matchRecord:     Parameters<typeof saveMatchResult>[0];
    };
    const results: PlayerResult[] = [];

    // ── Per-side ELO averages for opponent ELO calculation ───────────────
    // For each player, "opponent" is the average rating of the opposing team.
    const civilElos   = humanPlayers
      .filter(p => p.role === "Civil")
      .map(p => userMap.get(p.userId!)?.stats.elo ?? 1000);
    const stateElos   = humanPlayers
      .filter(p => p.role === "State" || p.role === "Overseer")
      .map(p => userMap.get(p.userId!)?.stats.elo ?? 1000);
    const avgCivilElo = civilElos.length
      ? Math.round(civilElos.reduce((a, b) => a + b, 0) / civilElos.length)
      : 1000;
    const avgStateElo = stateElos.length
      ? Math.round(stateElos.reduce((a, b) => a + b, 0) / stateElos.length)
      : 1000;

    // ── Mutate all user records in memory ─────────────────────────────────
    for (const p of humanPlayers) {
      const user = userMap.get(p.userId!);
      if (!user) continue;
      const oldXp = user.stats.xp;
      const oldIp = user.stats.points;

      user.stats.gamesPlayed++;
      if      (p.role === "Civil")    user.stats.civilGames++;
      else if (p.role === "State")    user.stats.stateGames++;
      else if (p.role === "Overseer") user.stats.overseerGames++;

      const won = (winningSide === "Civil" && p.role === "Civil") ||
                  (winningSide === "State"  && (p.role === "State" || p.role === "Overseer"));

      if (won) {
        if (p.role === "Civil")    user.stats.civilWins    = (user.stats.civilWins    ?? 0) + 1;
        if (p.role === "State")    user.stats.stateWins    = (user.stats.stateWins    ?? 0) + 1;
        if (p.role === "Overseer") user.stats.overseerWins = (user.stats.overseerWins ?? 0) + 1;
      }

      const xpGain = calculateXpGain({ win: won, kills: p.role === "Overseer" ? p.stateEnactments || 0 : 0 });
      user.stats.xp += xpGain;

      // Compute ELO delta here, before ELO is mutated, so eloBeforeCalc is accurate.
      // opponentAvgElo is the average rating of the opposing team.
      const opponentAvgElo = (p.role === "Civil") ? avgStateElo : avgCivilElo;
      const eloChange      = s.mode === "Ranked"
        ? computeEloChange(user.stats.elo, opponentAvgElo, won, user.stats.gamesPlayed)
        : 0;

      if (won) {
        user.stats.wins++;
        user.stats.points += s.mode === "Ranked" ? 100 : 40;
      } else {
        user.stats.losses++;
        user.stats.points += s.mode === "Ranked" ? 25 : 10;
      }

      // Per-mode counters for segmented leaderboards
      if (s.mode === "Ranked") {
        user.stats.rankedGames = (user.stats.rankedGames ?? 0) + 1;
        if (won) user.stats.rankedWins = (user.stats.rankedWins ?? 0) + 1;
      } else if (s.mode === "Classic") {
        user.stats.classicGames = (user.stats.classicGames ?? 0) + 1;
        if (won) user.stats.classicWins = (user.stats.classicWins ?? 0) + 1;
      } else {
        user.stats.casualGames = (user.stats.casualGames ?? 0) + 1;
        if (won) user.stats.casualWins = (user.stats.casualWins ?? 0) + 1;
      }

      if (s.mode === "Ranked") {
        user.stats.elo = Math.max(0, user.stats.elo + eloChange);
      }

      // Personal agenda
      let agendaCompleted = false;
      if (p.personalAgenda) {
        const agendaDef = AGENDA_MAP.get(p.personalAgenda);
        if (agendaDef) {
          agendaCompleted = agendaDef.evaluate(s, p.id) === "completed";
          if (agendaCompleted) {
            user.stats.xp     += 100;
            user.stats.points += s.mode === "Ranked" ? 40 : 20;
            user.stats.agendasCompleted++;
          }
        }
      }

      // Achievements
      const newAchievementIds = checkAchievements({ user, s, p, won, agendaCompleted });
      let achievementXp = 0;
      let achievementCp = 0;
      if (newAchievementIds.length > 0) {
        if (!user.earnedAchievements) user.earnedAchievements = [];
        if (!user.pinnedAchievements) user.pinnedAchievements = [];
        for (const id of newAchievementIds) {
          user.earnedAchievements.push({ id, earnedAt: now });
          const def = ACHIEVEMENT_MAP.get(id);
          if (def) { achievementXp += def.xpReward; achievementCp += def.cpReward; }
        }
        user.stats.xp     += achievementXp;
        user.cabinetPoints = (user.cabinetPoints ?? 0) + achievementCp;
      }

      const config = this.getConfig();
      const xpMult = config.xpMultiplier || 1.0;
      const ipMult = config.ipMultiplier || 1.0;

      const baseIp        = won ? (s.mode === "Ranked" ? 100 : 40) : (s.mode === "Ranked" ? 25 : 10);
      const agendaIp      = agendaCompleted ? (s.mode === "Ranked" ? 40 : 20) : 0;
      const agendaXp      = agendaCompleted ? 100 : 0;

      const totalMatchXp = Math.floor((xpGain + agendaXp + achievementXp) * xpMult);
      const totalMatchIp = Math.floor((baseIp + agendaIp) * ipMult);

      // We already added raw xpGain/points/achievementXp to user stats above, 
      // but we need to adjust them for the multiplier.
      // Re-calculating the final state values:
      user.stats.xp = oldXp + totalMatchXp;
      user.stats.points = oldIp + totalMatchIp;

      const eloAfter      = user.stats.elo;
      const eloBeforeCalc = eloAfter - eloChange;
      const xpEarned      = totalMatchXp;
      const ipEarned      = totalMatchIp;
      const cpEarned      = achievementCp;

      results.push({
        playerId: p.id,
        user,
        won,
        eloChange,
        eloBeforeCalc,
        xpEarned,
        ipEarned,
        cpEarned,
        agendaCompleted,
        agendaName: p.personalAgenda ? (AGENDA_MAP.get(p.personalAgenda)?.name ?? undefined) : undefined,
        newAchievementIds,
        matchRecord: {
          id:             randomUUID(),
          userId:         p.userId!,
          playedAt:       now,
          roomName:       s.roomId,
          mode:           s.mode,
          playerCount:    s.players.length,
          role:           p.role!,
          won,
          winReason:      s.winReason ?? "",
          rounds:         s.round,
          civilDirectives: s.civilDirectives,
          stateDirectives: s.stateDirectives,
          agendaId:       p.personalAgenda,
          agendaName:     p.personalAgenda ? (AGENDA_MAP.get(p.personalAgenda)?.name) : undefined,
          agendaCompleted,
          xpEarned,
          ipEarned,
          cpEarned,
        },
      });
    }

    // ── Recently Played With — computed from in-memory records, no re-fetch ─
    const snapshots = results.map(r => ({
      userId: r.user.id,
      entry: {
        userId:       r.user.id,
        username:     r.user.username,
        avatarUrl:    r.user.avatarUrl,
        activeFrame:  r.user.activeFrame,
        elo:          r.user.stats.elo,
        lastPlayedAt: now,
      } as RecentlyPlayedEntry,
    }));

    for (const { userId } of snapshots) {
      const u = userMap.get(userId);
      if (!u) continue;
      const existingMap = new Map<string, any>((u.recentlyPlayedWith ?? []).map(e => [e.userId, e]));
      for (const { userId: coId, entry } of snapshots) {
        if (coId === userId) continue;
        existingMap.set(coId, entry);
      }
      u.recentlyPlayedWith = Array.from(existingMap.values())
        .sort((a, b) => new Date(b.lastPlayedAt).getTime() - new Date(a.lastPlayedAt).getTime())
        .slice(0, 20);
    }

    // ── Single parallel save — replaces N sequential saveUser/saveMatchResult ─
    await Promise.all([
      ...validUsers.map(u => saveUser(u)),
      ...results.map(r => saveMatchResult(r.matchRecord)),
    ]);

    // ── Socket emissions (after saves so clients receive final state) ──────
    for (const r of results) {
      const { password: _, ...safe } = r.user;
      this.io.to(r.playerId).emit("userUpdate", safe);
      this.io.to(r.playerId).emit("postMatchResult", {
        won:             r.won,
        mode:            s.mode,
        role:            s.players.find(p => p.id === r.playerId)?.role,
        eloChange:       r.eloChange,
        eloBefore:       r.eloBeforeCalc,
        eloAfter:        r.user.stats.elo,
        roomAverageElo,
        xpEarned:        r.xpEarned,
        ipEarned:        r.ipEarned,
        agendaName:      r.agendaName,
        agendaCompleted: r.agendaCompleted,
        rounds:          s.round,
        civilDirectives: s.civilDirectives,
        stateDirectives: s.stateDirectives,
        newAchievements: r.newAchievementIds,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Round History
  // ═══════════════════════════════════════════════════════════════════════════

  private captureRoundHistory(s: GameState, policy: Policy, isChaos: boolean): void {
    if (!s.roundHistory) s.roundHistory = [];

    if (isChaos) {
      s.roundHistory.push({ round: s.round, presidentName: "—", chancellorName: "—", policy, chaos: true, votes: [] });
      return;
    }

    if (!s.lastGovernmentPresidentId || !s.lastGovernmentChancellorId) return;
    const pres = s.players.find(p => p.id === s.lastGovernmentPresidentId);
    const chan  = s.players.find(p => p.id === s.lastGovernmentChancellorId);
    if (!pres || !chan) return;

    const presDecl = s.declarations.find(d => d.type === "President");
    const chanDecl = s.declarations.find(d => d.type === "Chancellor");
    const action   = getExecutiveAction(s);

    s.roundHistory.push({
      round:          s.round,
      presidentName:  pres.name,
      chancellorName: chan.name,
      presidentId:    pres.id,
      chancellorId:   chan.id,
      policy,
      votes: Object.entries(s.lastGovernmentVotes ?? {}).map(([pid, v]) => {
        const pl = s.players.find(p => p.id === pid);
        return { playerId: pid, playerName: pl?.name ?? pid, vote: v as "Aye" | "Nay" };
      }),
      presDeclaration: presDecl
        ? { civ: presDecl.civ, sta: presDecl.sta, drewCiv: presDecl.drewCiv ?? 0, drewSta: presDecl.drewSta ?? 0 }
        : undefined,
      chanDeclaration: chanDecl ? { civ: chanDecl.civ, sta: chanDecl.sta } : undefined,
      executiveAction: action !== "None" ? action : undefined,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Disconnection & Pause
  // ═══════════════════════════════════════════════════════════════════════════

  handleLeave(socket: Socket, roomId: string, isIntentional: boolean = false): void {
    const state = this.rooms.get(roomId);
    if (!state) return;

    const player = state.players.find(p => p.id === socket.id);
    if (player) {
      if (!player.isAI && (!player.isDisconnected || isIntentional)) {
        if (isIntentional) {
          // Intentional leave: handle immediately based on phase and mode
          if (state.phase === "Lobby" || state.phase === "GameOver") {
            state.players = state.players.filter(p => p.id !== player.id);
            addLog(state, `${player.name} left the room.`);
          } else {
            // In-progress game
            if (state.mode === "Ranked") {
              // Ranked: Forfeit/End game immediately
              state.phase = "GameOver";
              state.winner = undefined;
              state.isPaused = false;
              const msg = `${player.name} has left the game. Match ended as inconclusive.`;
              addLog(state, msg);
              state.messages.push({ sender: "System", text: msg, timestamp: Date.now(), type: "text" });
            } else {
              // Casual: Replace with AI immediately
              const takenNames = new Set(state.players.map(p => p.name.replace(" (AI)", "")));
              const available = AI_BOTS.filter(b => !takenNames.has(b.name));
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
          // Unintentional disconnect: Start reconnection timer
          player.isDisconnected = true;
          
          if (state.phase === "Lobby") {
            addLog(state, `${player.name} disconnected from lobby. They will be removed in 60s if they don't return.`);
          } else if (state.phase !== "GameOver") {
            state.isPaused             = true;
            state.pauseReason          = `${player.name} disconnected. Waiting 60 s for reconnection…`;
            state.pauseTimer           = 60;
            state.disconnectedPlayerId = player.id;
            addLog(state, `${player.name} disconnected. Game paused.`);
            this.clearActionTimer(roomId);
            state.actionTimerEnd = undefined;
          }

          const existing = this.pauseTimers.get(roomId);
          if (existing) clearInterval(existing);

          const iv = setInterval(() => {
            const s = this.rooms.get(roomId);
            if (!s || !player.isDisconnected) { 
              clearInterval(iv); 
              if (this.pauseTimers.get(roomId) === iv) this.pauseTimers.delete(roomId); 
              return; 
            }
            
            if (s.phase === "Lobby") {
              if (s.lobbyPauseTimer === undefined) s.lobbyPauseTimer = 60;
              s.lobbyPauseTimer--;
              if (s.lobbyPauseTimer <= 0) {
                clearInterval(iv);
                s.players = s.players.filter(p => p.id !== player.id);
                addLog(s, `${player.name} removed from lobby (timeout).`);
                this.broadcastState(roomId);
              }
            } else {
              s.pauseTimer!--;
              if (s.pauseTimer! <= 0) {
                clearInterval(iv);
                this.pauseTimers.delete(roomId);
                this.handlePauseTimeout(roomId);
              }
            }
            this.broadcastState(roomId);
          }, 1000);

          this.pauseTimers.set(roomId, iv);
        }
      }
    }

    const spectator = state.spectators.find(s => s.id === socket.id);
    if (spectator) {
      state.spectators = state.spectators.filter(s => s.id !== socket.id);
      addLog(state, `${spectator.name} (Spectator) left.`);
    }

    socket.leave(roomId);

    if (state.players.filter(p => !p.isAI).length === 0 && state.spectators.length === 0) {
      this.deleteRoom(roomId);
      const lt = this.lobbyTimers.get(roomId);
      if (lt) { clearInterval(lt); this.lobbyTimers.delete(roomId); }
    } else {
      this.broadcastState(roomId);
    }
  }

  handlePauseTimeout(roomId: string): void {
    const state = this.rooms.get(roomId);
    if (!state || !state.isPaused) return;

    const player = state.players.find(p => p.id === state.disconnectedPlayerId);
    if (!player) { state.isPaused = false; this.broadcastState(roomId); return; }

    if (state.mode === "Ranked") {
      state.phase  = "GameOver";
      state.winner = undefined;
      const msg = `Game ended as inconclusive — ${player.name} failed to reconnect.`;
      addLog(state, msg);
      state.messages.push({ sender: "System", text: msg, timestamp: Date.now(), type: "text" });
    } else {
      const takenNames = new Set(state.players.map(p => p.name.replace(" (AI)", "")));
      const available  = AI_BOTS.filter(b => !takenNames.has(b.name));
      const bot        = pick(available) ?? AI_BOTS[Math.floor(Math.random() * AI_BOTS.length)];

      const oldId = player.id;
      player.isAI           = true;
      player.isDisconnected = false;
      player.id             = `ai-${randomUUID()}`;
      player.userId         = undefined;
      player.name           = `${bot.name} (AI)`;
      player.avatarUrl      = bot.avatarUrl;
      player.personality    = bot.personality;

      if (state.presidentialOrder) {
        const idx = state.presidentialOrder.indexOf(oldId);
        if (idx !== -1) state.presidentialOrder[idx] = player.id;
      }
      if (state.presidentId  === oldId) state.presidentId  = player.id;
      if (state.chancellorId === oldId) state.chancellorId = player.id;
      if (state.titlePrompt && state.titlePrompt.playerId === oldId) state.titlePrompt.playerId = player.id;
      if (state.rejectedChancellorId === oldId) state.rejectedChancellorId = player.id;
      if (state.detainedPlayerId === oldId) state.detainedPlayerId = player.id;
      if (state.lastGovernmentPresidentId === oldId) state.lastGovernmentPresidentId = player.id;
      if (state.lastGovernmentChancellorId === oldId) state.lastGovernmentChancellorId = player.id;

      addLog(state, `${player.name} (AI) took over the disconnected seat.`);
      state.isPaused = false;
      this.scheduleAITurns(state, roomId);
    }

    state.disconnectedPlayerId = undefined;
    state.pauseReason          = undefined;
    state.pauseTimer           = undefined;
    this.broadcastState(roomId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AI — Nomination
  // ═══════════════════════════════════════════════════════════════════════════

  private aiNominateChancellor(s: GameState, roomId: string): void {
    const president = s.players[s.presidentIdx];
    if (!president.isAI) return;

    let eligible = this.getEligibleChancellors(s, president.id);
    if (eligible.length === 0) eligible = s.players.filter(p => p.isAlive && p.id !== president.id);
    if (eligible.length === 0) return;

    let target: Player;
    if (president.role === "Civil" && president.suspicion) {
      target = leastSuspicious(president, eligible);
    } else {
      const overseer = eligible.find(p => p.role === "Overseer");
      const teammate = eligible.find(p => p.role === "State");
      target = (s.stateDirectives >= 3 && overseer)
        ? overseer
        : (teammate && Math.random() > 0.3)
          ? teammate
          : pick(eligible)!;
    }

    s.players.forEach(p => (p.isChancellorCandidate = false));
    target.isChancellorCandidate = true;
    addLog(s, `${president.name} nominated ${target.name} for Chancellor.`);
    updateSuspicionFromNomination(s, president.id, target.id);
    this.triggerAIReactions(s, roomId, "nomination", { targetId: target.id });
    this.advanceToVotingOrBroker(s, roomId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AI — Voting
  // ═══════════════════════════════════════════════════════════════════════════

  private aiCastVotes(s: GameState, roomId: string): void {
    const chancellor = s.players.find(p => p.isChancellorCandidate);
    const president  = s.players[s.presidentIdx];

    for (const ai of s.players.filter(p => p.isAI && p.isAlive && !p.vote && p.id !== s.detainedPlayerId)) {
      ai.vote = this.computeAIVote(ai, s, president, chancellor ?? null);
    }

    const remaining = s.players.filter(p => p.isAlive && p.id !== s.detainedPlayerId && !p.vote).length;
    if (remaining === 0) this.tallyVotes(s, roomId);
    else this.broadcastState(roomId);
  }

  private computeAIVote(ai: Player, s: GameState, president: Player, chancellor: Player | null): "Aye" | "Nay" {
    const diff = ai.difficulty === "Elite" ? 1.5 : ai.difficulty === "Casual" ? 0.5 : 1.0;

    if (ai.role === "Civil" && ai.suspicion) {
      const ps  = getSuspicion(ai, president.id);
      const cs  = chancellor ? getSuspicion(ai, chancellor.id) : 0;
      const thr = Math.min(0.60, 0.45 + s.round * 0.015) * diff;
      const risk = ai.personality === "Strategic" ? 0.3 : ai.personality === "Chaotic" ? 0.7 : 0.5;

      // Agenda-based Noise: Certain agendas make Civils more "thorny" and prone to Naying
      const agendasWithNoise: string[] = ["chaos_agent", "the_hawk", "stonewalled"];
      const noise = (ai.personalAgenda && agendasWithNoise.includes(ai.personalAgenda)) ? 0.25 : 0;

      if ((ps * diff > thr || cs * diff > thr) && Math.random() > (risk - noise)) {
        return s.electionTracker >= 2 ? "Aye" : "Nay";
      }
      if (s.stateDirectives >= 3 && chancellor?.role === "Overseer") return "Nay";
      if (s.electionTracker >= 2) return "Aye";

      // Base noise: 20% of the time, vote randomly, influenced by noise-heavy agendas
      if (Math.random() < (0.20 + noise)) return Math.random() > 0.5 ? "Aye" : "Nay";
      return "Aye";
    }

    // State Aggression: If Civil team is near victory, State players block non-State governments desperately
    if (s.civilDirectives >= 4) {
      const isStateGov = (president.role !== "Civil" || chancellor?.role !== "Civil");
      if (!isStateGov && s.electionTracker < 2) return "Nay";
    }

    if (s.stateDirectives >= 3 && chancellor?.role === "Overseer") return "Aye";
    if (chancellor?.role !== "Civil" || president.role !== "Civil") return Math.random() > 0.15 ? "Aye" : "Nay";
    return Math.random() > 0.45 ? "Aye" : "Nay";
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AI — Legislative
  // ═══════════════════════════════════════════════════════════════════════════

  private aiPresidentDiscard(s: GameState, roomId: string): void {
    const president = s.players.find(p => p.isPresident);
    if (!president?.isAI || s.drawnPolicies.length === 0) return;

    s.presidentSaw = [...s.drawnPolicies];
    while (s.drawnPolicies.length > 2) {
      const idx = this.choosePolicyToDiscard(president, s.drawnPolicies, s.stateDirectives);
      s.discard.push(s.drawnPolicies.splice(idx, 1)[0]);
    }

    s.chancellorPolicies  = [...s.drawnPolicies];
    s.chancellorSaw       = [...s.chancellorPolicies];
    s.drawnPolicies       = [];
    s.isStrategistAction  = undefined as any;
    this.enterPhase(s, roomId, "Legislative_Chancellor");
  }

  private choosePolicyToDiscard(player: Player, hand: Policy[], stateDir: number): number {
    let idx = -1;

    // State Aggression: If Civil is winning, discard Civil at any cost of suspicion
    if (player.role !== "Civil" && stateDir >= 4) {
      const civIdx = hand.findIndex(p => p === "Civil");
      if (civIdx !== -1) return civIdx;
    }

    if (player.personality === "Aggressive" && player.role !== "Civil") {
      idx = hand.findIndex(p => p === "Civil");
    } else if (player.personality === "Strategic" && player.role !== "Civil") {
      idx = stateDir < 1 ? hand.findIndex(p => p === "State") : hand.findIndex(p => p === "Civil");
    } else if (player.personality === "Honest" || player.role === "Civil") {
      // Civil Noise: 5% chance to "accidentally" discard Civil or follow a weird agenda
      if (Math.random() < 0.05) {
        idx = hand.findIndex(p => p === "Civil");
      } else {
        idx = hand.findIndex(p => p === "State");
      }
    }
    return idx === -1 ? 0 : idx;
  }

  private aiChancellorPlay(s: GameState, roomId: string): void {
    const chancellor = s.players.find(p => p.isChancellor);
    if (!chancellor?.isAI || s.chancellorPolicies.length === 0) return;

    const idx    = this.choosePolicyToPlay(chancellor, s.chancellorPolicies, s.stateDirectives, s.civilDirectives);
    const played = s.chancellorPolicies.splice(idx, 1)[0];
    s.discard.push(...s.chancellorPolicies);
    s.chancellorPolicies = [];
    this.enactPolicy(s, roomId, played, false, chancellor.id);
  }

  private choosePolicyToPlay(player: Player, hand: Policy[], stateDir: number, civilDir: number): number {
    if (player.role === "Civil" && civilDir === 4 && hand.includes("Civil")) return hand.findIndex(p => p === "Civil");
    if ((player.role === "State" || player.role === "Overseer") && stateDir === 5 && hand.includes("State")) return hand.findIndex(p => p === "State");

    let idx = -1;
    if (player.personality === "Aggressive" && player.role !== "Civil") {
      idx = hand.findIndex(p => p === "Civil");
    } else if (player.personality === "Strategic" && player.role !== "Civil") {
      idx = stateDir < 2 ? hand.findIndex(p => p === "Civil") : hand.findIndex(p => p === "State");
    } else if (player.personality === "Honest" || player.role === "Civil") {
      idx = hand.findIndex(p => p === "Civil");
    }
    return idx === -1 ? 0 : idx;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AI — Executive Action
  // ═══════════════════════════════════════════════════════════════════════════

  private async aiExecutiveAction(s: GameState, roomId: string): Promise<void> {
    const president = s.players.find(p => p.isPresident);
    if (!president?.isAI) return;

    const eligible = s.players.filter(p => p.isAlive && p.id !== president.id);
    if (eligible.length === 0) return;

    let target: Player;
    if (president.role === "Civil" && president.suspicion) {
      target = s.currentExecutiveAction === "SpecialElection"
        ? leastSuspicious(president, eligible)
        : mostSuspicious(president, eligible);
    } else {
      const civil = eligible.filter(p => p.role === "Civil");
      const state = eligible.filter(p => p.role === "State" || p.role === "Overseer");
      target = s.currentExecutiveAction === "SpecialElection"
        ? (pick(state) ?? pick(eligible)!)
        : (pick(civil) ?? pick(eligible)!);
    }

    await this.applyExecutiveAction(s, roomId, target.id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AI — Veto
  // ═══════════════════════════════════════════════════════════════════════════

  private async aiVetoResponse(s: GameState, roomId: string): Promise<void> {
    const president = s.players.find(p => p.isPresident);
    if (!president?.isAI) return;

    const stateInHand = s.chancellorPolicies.filter(p => p === "State").length;
    const civilInHand = s.chancellorPolicies.filter(p => p === "Civil").length;
    let agree: boolean;

    if (president.role === "Civil") {
      agree = s.electionTracker >= 2 ? false : stateInHand === 2 ? true : Math.random() > 0.75;
    } else {
      agree = (civilInHand >= 1 && s.stateDirectives < 4) ? false : Math.random() > 0.7;
    }

    this.handleVetoResponse(s, roomId, president, agree);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AI — Title Ability Decisions
  // ═══════════════════════════════════════════════════════════════════════════

  private async aiDecideTitleAbility(s: GameState, roomId: string): Promise<void> {
    const prompt = s.titlePrompt;
    if (!prompt) return;

    const player = s.players.find(p => p.id === prompt.playerId);
    if (!player?.isAI) return;

    const isPresident = player.id === s.players[s.presidentIdx].id;
    // Broker and Interdictor cannot be self-applied by the sitting president
    if (isPresident && (prompt.role === "Broker" || prompt.role === "Interdictor")) {
      await this.handleTitleAbility(s, roomId, { use: false });
      return;
    }

    let data: TitleAbilityData = { use: false };

    switch (prompt.role) {
      case "Assassin": {
        const targets = s.players.filter(p => p.isAlive && p.id !== player.id);
        const suspect = mostSuspicious(player, targets);
        if (getSuspicion(player, suspect.id) > 0.7) {
          data = { use: true, role: "Assassin", targetId: suspect.id };
        }
        break;
      }
      case "Strategist":
        if (Math.random() > 0.4) {
          data = { use: true, role: "Strategist" };
        }
        break;
      case "Broker": {
        const candidate = s.players.find(p => p.isChancellorCandidate);
        if (!isPresident && candidate && getSuspicion(player, candidate.id) > 0.6) {
          data = { use: true, role: "Broker" };
        }
        break;
      }
      case "Handler": {
        if (s.presidentialOrder) {
          const curId  = s.players[s.presidentIdx].id;
          const curPos = s.presidentialOrder.indexOf(curId);
          const nextId = s.presidentialOrder[(curPos + 1) % s.presidentialOrder.length];
          if (getSuspicion(player, nextId) > 0.6) {
            data = { use: true, role: "Handler" };
          }
        }
        break;
      }
      case "Auditor":
        data = { use: true, role: "Auditor" };
        break;
      case "Interdictor": {
        const candidates = s.players.filter(p =>
          p.isAlive && p.id !== s.players[s.presidentIdx].id && p.id !== player.id,
        );
        const suspect = candidates.find(p => getSuspicion(player, p.id) > 0.7);
        if (suspect) {
          data = { use: true, role: "Interdictor", targetId: suspect.id };
        }
        break;
      }
    }

    await this.handleTitleAbility(s, roomId, data);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AI — Chat
  // ═══════════════════════════════════════════════════════════════════════════

  private postAIChat(state: GameState, ai: Player, lines: readonly string[], targetName?: string): void {
    let text = lines[Math.floor(Math.random() * lines.length)];
    if (targetName) text = text.replace("{name}", targetName.replace(" (AI)", ""));
    state.messages.push({ sender: ai.name, text, timestamp: Date.now(), type: "text" });
    if (state.messages.length > 50) state.messages.shift();
  }

  private triggerAIReactions(
    state: GameState, roomId: string,
    type: "nomination" | "enactment" | "failed_vote",
    context?: { targetId?: string },
  ): void {
    const ai = state.players.filter(p => p.isAI && p.isAlive);
    if (ai.length === 0) return;

    const count       = Math.random() > 0.7 ? 2 : 1;
    const commentators = shuffle([...ai]).slice(0, count);

    for (const c of commentators) {
      setTimeout(() => {
        if (state.isPaused) return;
        let lines: readonly string[] = CHAT.banter;

        if (type === "nomination" && context?.targetId) {
          const target = state.players.find(p => p.id === context.targetId);
          if (target) {
            if (c.id === target.id) {
              lines = CHAT.defendingSelf;
            } else {
              const susp   = getSuspicion(c, target.id);
              const isTeam = c.role !== "Civil" && (target.role === "State" || target.role === "Overseer");
              if      (susp > 0.75 && !isTeam) lines = CHAT.highSuspicion;
              else if (susp > 0.55 && !isTeam) lines = CHAT.suspiciousNominee;
              else if (susp < 0.25 || isTeam)  lines = CHAT.praisingCivil;
            }
            this.postAIChat(state, c, lines, target.name);
          }
        } else if (type === "failed_vote") {
          this.postAIChat(state, c, CHAT.governmentFailed);
        }

        this.broadcastState(roomId);
      }, 1000 + Math.random() * 2000);
    }
  }
}
