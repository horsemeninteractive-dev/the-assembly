/**
 * engine/RoundManager.ts
 *
 * Refactored into specialized sub-managers:
 *   - ElectionManager: Nomination, voting, tally
 *   - LegislativeManager: Discard, play, enactment, chaos, declarations, veto
 *   - ExecutiveActionManager: Investigate, execution, special election, policy peek
 */

import { randomUUID } from 'crypto';
import { logger } from '../logger';
import { GameState, Player, Policy, GamePhase } from '../../shared/types';
import { createDeck, shuffle } from '../utils';
import { getGlobalStats } from '../db/matches';
import { AI_BOTS } from './ai/aiPersonalities';
import { assignRoles } from '../game/gameRules';
import { initializeSuspicion } from '../game/suspicion';
import { assignPersonalAgendas } from '../game/personalAgendas';
import { addLog, ensureDeckHas, pick } from './utils';
import type { IEngineCore } from './IEngineCore';

import { ElectionManager } from './round/ElectionManager';
import { LegislativeManager } from './round/LegislativeManager';
import { ExecutiveActionManager } from './round/ExecutiveActionManager';

export interface IRoundManagerContext extends IEngineCore {
  readonly actionTimers: Map<string, ReturnType<typeof setTimeout>>;
}

export class RoundManager {
  readonly election: ElectionManager;
  readonly legislative: LegislativeManager;
  readonly executive: ExecutiveActionManager;

  constructor(public readonly engine: IRoundManagerContext) {
    this.election = new ElectionManager(this);
    this.legislative = new LegislativeManager(this);
    this.executive = new ExecutiveActionManager(this);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Action Timer
  // ═══════════════════════════════════════════════════════════════════════════

  startActionTimer(roomId: string, durationMs?: number): void {
    const state = this.engine.rooms.get(roomId);
    if (!state || state.phase === 'Lobby' || state.phase === 'GameOver') {
      if (state) state.actionTimerEnd = undefined;
      this.clearActionTimer(roomId);
      return;
    }

    // Default to the room's configured timer if no override is provided.
    // 0 means no timer.
    const duration = durationMs !== undefined ? durationMs : state.actionTimer * 1000;
    if (duration === 0) {
      state.actionTimerEnd = undefined;
      this.clearActionTimer(roomId);
      return;
    }

    this.clearActionTimer(roomId);
    state.actionTimerEnd = Date.now() + duration;

    const handle = setTimeout(async () => {
      this.engine.actionTimers.delete(roomId);
      const s = this.engine.rooms.get(roomId);
      if (!s || s.phase === 'Lobby' || s.phase === 'GameOver' || s.isPaused) return;
      s.actionTimerEnd = undefined;
      await this.onActionTimerExpired(s, roomId);
    }, duration);

    this.engine.actionTimers.set(roomId, handle);
  }

  clearActionTimer(roomId: string): void {
    const h = this.engine.actionTimers.get(roomId);
    if (h !== undefined) {
      clearTimeout(h);
      this.engine.actionTimers.delete(roomId);
    }
  }

  async fireActionTimerExpiry(s: GameState, roomId: string): Promise<void> {
    return this.onActionTimerExpired(s, roomId);
  }

  private async onActionTimerExpired(s: GameState, roomId: string): Promise<void> {
    if (s.titlePrompt) {
      await this.engine.titleRoleResolver.handleTitleAbility(s, roomId, { use: false });
      return;
    }

    switch (s.phase) {
      case 'Nominate_Chancellor': {
        const president = s.players[s.presidentIdx];
        let eligible = this.election.EligibleChancellors(s, president.id);
        if (eligible.length === 0)
          eligible = s.players.filter((p) => p.isAlive && p.id !== president.id);
        const target = pick(eligible);
        if (target) {
          target.isChancellorCandidate = true;
          addLog(s, `[Timer] ${president.name} timed out. ${target.name} auto-nominated.`);
          this.election.advanceToVotingOrBroker(s, roomId);
        }
        break;
      }
      case 'Voting': {
        for (const p of s.players) {
          if (p.isAlive && !p.vote && p.id !== s.detainedPlayerId) {
            p.vote = Math.random() > 0.3 ? 'Aye' : 'Nay';
          }
        }
        // Also auto-cast for the Dead Man's Gambit ghost voter (dead player, excluded by isAlive)
        if (s.ghostVoterId) {
          const ghost = s.players.find(p => p.id === s.ghostVoterId && !p.vote);
          if (ghost) ghost.vote = Math.random() > 0.3 ? 'Aye' : 'Nay';
        }
        addLog(s, '[Timer] Voting timed out. Remaining votes auto-cast.');
        this.election.tallyVotes(s, roomId);
        break;
      }
      case 'Legislative_President': {
        if (s.presidentId) this.legislative.handlePresidentDiscard(s, roomId, s.presidentId, 0);
        break;
      }
      case 'Legislative_Chancellor': {
        if (s.lastEnactedPolicy) {
          s.presidentTimedOut = true;
          s.chancellorTimedOut = true;
          this.legislative.autoDeclareMissing(s, roomId);
        } else if (s.chancellorId) {
          this.legislative.handleChancellorPlay(s, roomId, s.chancellorId, 0);
        }
        break;
      }
      case 'Executive_Action': {
        // If we're waiting for a peek declaration, auto-declare instead of
        // picking a random execution target.
        if (s.peekDeclarationPending) {
          s.presidentTimedOut = true;
          this.legislative.autoDeclareMissing(s, roomId);
          break;
        }
        const president = s.players.find((p) => p.isPresident);
        if (president) {
          const eligible = s.players.filter((p) => p.isAlive && p.id !== president.id);
          const target = pick(eligible);
          if (target) {
            addLog(s, `[Timer] ${president.name} timed out. Random target selected.`);
            await this.executive.apply(s, roomId, target.id);
          }
        }
        break;
      }
      case 'Censure_Action': {
        // No handler from players — tally whatever votes exist and continue
        addLog(s, '[Timer] Censure vote timed out. Tallying partial results.');
        this.election.tallyCensure(s, roomId);
        break;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase Management
  // ═══════════════════════════════════════════════════════════════════════════

  enterPhase(s: GameState, roomId: string, phase: GamePhase): void {
    if (s.phase === 'GameOver') return;
    s.phase = phase;
    if (phase === 'GameOver') this.engine.broadcaster.clearDelayedSpectatorEmissions(roomId);
    this.resetPlayerHasActed(s);
    this.startActionTimer(roomId);
    this.engine.broadcastState(roomId);
    this.engine.aiEngine.scheduleAITurns(s, roomId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Reset Utils
  // ═══════════════════════════════════════════════════════════════════════════

  resetPlayerActions(s: GameState): void {
    for (const p of s.players) {
      p.isPresidentialCandidate = false;
      p.isChancellorCandidate = false;
      p.isPresident = false;
      p.isChancellor = false;
    }
  }

  resetPlayerHasActed(s: GameState): void {
    for (const p of s.players) p.hasActed = false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Lobby -> Start
  // ═══════════════════════════════════════════════════════════════════════════

  fillWithAI(roomId: string): void {
    const state = this.engine.rooms.get(roomId);
    if (!state) return;
    const takenNames = new Set(state.players.map((p) => p.name.replace(' (AI)', '')));
    const available = AI_BOTS.filter((b) => !takenNames.has(b.name));
    while (state.players.length < state.maxPlayers && available.length > 0) {
      const bot = available.splice(Math.floor(Math.random() * available.length), 1)[0];
      const id = `ai-${randomUUID()}`;
      state.players.push({
        id,
        socketId: id,
        name: `${bot.name} (AI)`,
        avatarUrl: bot.avatarUrl,
        personality: bot.personality,
        isAlive: true,
        isPresidentialCandidate: false,
        isChancellorCandidate: false,
        isPresident: false,
        isChancellor: false,
        wasPresident: false,
        wasChancellor: false,
        isAI: true,
        difficulty: state.aiDifficulty || (pick(['Casual', 'Normal', 'Elite']) as 'Casual' | 'Normal' | 'Elite'),
        stateEnactments: 0,
        civilEnactments: 0,
      });
    }
    this.startGame(roomId);
  }

  startGame(roomId: string): void {
    const state = this.engine.rooms.get(roomId);
    if (!state || state.phase !== 'Lobby') return;
    if (state.players.length < state.maxPlayers && state.mode !== 'Ranked') {
      this.fillWithAI(roomId);
      return;
    }
    const roles = assignRoles(state.players.length);
    state.players.forEach((p, i) => (p.role = roles[i]));

    // --- GAME MODE OVERRIDES ---
    if (state.mode === 'House' && state.houseRules) {
      if (state.houseRules.useTitleRoles) {
        this.engine.titleRoleResolver.assignTitleRoles(state, state.houseRules.titleRolePool as any);
      }
      if (state.houseRules.usePersonalAgendas) {
        assignPersonalAgendas(state);
      }
    } else if (state.mode !== 'Classic') {
      this.engine.titleRoleResolver.assignTitleRoles(state);
      assignPersonalAgendas(state);
    }
    initializeSuspicion(state);
    state.presidentialOrder = state.players.map((p) => p.id);
    state.declarations = [];
    state.round = 0;
    state.lastPresidentIdx = -1;
    const orderLen = state.presidentialOrder.length;
    const startPos = Math.floor(Math.random() * orderLen);
    const prevPos = (startPos - 1 + orderLen) % orderLen;
    const prevId = state.presidentialOrder[prevPos];
    const prevIdx = state.players.findIndex((p) => p.id === prevId);
    state.presidentIdx = prevIdx !== -1 ? prevIdx : 0;
    if (state.mode === 'Crisis' || (state.mode === 'House' && state.houseRules?.useCrisisCards)) {
      this.engine.crisisEngine.initDeck(roomId);
    }

    // --- DECK INITIALIZATION ---
    if (state.mode === 'House' && state.houseRules?.deckComposition) {
      const { civil, state: stateCount } = state.houseRules.deckComposition;
      const deck: Policy[] = [];
      for (let i = 0; i < civil; i++) deck.push('Civil');
      for (let i = 0; i < stateCount; i++) deck.push('State');
      state.deck = shuffle(deck);
      state.discard = [];
    } else {
      state.deck = createDeck();
      state.discard = [];
    }

    addLog(state, `Game started! Mode: ${state.mode}`);
    
    // Fetch global stats for spectator predictions
    getGlobalStats().then(stats => {
      state.globalStats = stats;
      this.engine.broadcastState(roomId);
    }).catch(err => logger.error({ err }, 'Failed to fetch global stats for betting'));

    this.nextRound(state, roomId, false);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Rotation
  // ═══════════════════════════════════════════════════════════════════════════

  private advancePresidentIdx(state: GameState): void {
    let safety = state.players.length + 1;
    do {
      if (state.presidentialOrder) {
        const curId = state.players[state.presidentIdx]?.id;
        const curPos = state.presidentialOrder.indexOf(curId);
        const nextId = state.presidentialOrder[(curPos + 1) % state.presidentialOrder.length];
        const found = state.players.findIndex((p) => p.id === nextId);
        if (found !== -1) state.presidentIdx = found;
      } else {
        state.presidentIdx = (state.presidentIdx + 1) % state.players.length;
      }
      safety--;
    } while (
      safety > 0 &&
      (!state.players[state.presidentIdx] || !state.players[state.presidentIdx].isAlive)
    );
  }

  nextRound(
    state: GameState,
    roomId: string,
    successfulGovernment = false,
    skipAdvance = false
  ): void {
    if (state.phase === 'GameOver') return;

    // Phase 1: Cleanup and reset for the new round
    state.vetoRequested = false;
    state.vetoDenied = false;
    state.rejectedChancellorId = undefined;
    state.detainedPlayerId = undefined;
    if (successfulGovernment) {
      const prevPres = state.players.find((p) => p.isPresident);
      const prevChan = state.players.find((p) => p.isChancellor);
      state.players.forEach((p) => {
        p.wasPresident = false;
        p.wasChancellor = false;
      });
      if (prevPres) prevPres.wasPresident = true;
      if (prevChan) prevChan.wasChancellor = true;
    }
    if (state.activeEventCard) {
      this.engine.crisisEngine.clearEventCard(state);
    }
    this.resetPlayerActions(state);

    // Crisis mode: Draw the card first, reveal it, then finalize transition
    const isCrisisEnabled = state.mode === 'Crisis' || (state.mode === 'House' && state.houseRules?.useCrisisCards);
    if (isCrisisEnabled) {
      this.engine.crisisEngine.drawEventCard(state, roomId);
      if (state.activeEventCard) {
        this.enterPhase(state, roomId, 'Event_Reveal');
        // Suppress the action-timer countdown during the reveal — it has no handler
        this.clearActionTimer(roomId);
        
        setTimeout(() => {
          const s = this.engine.rooms.get(roomId);
          if (s && s.phase === 'Event_Reveal') {
            this.finalizeNextRound(s, roomId, skipAdvance);
          }
        }, 5000);
        return;
      }
    }

    this.finalizeNextRound(state, roomId, skipAdvance);
  }

  private finalizeNextRound(
    state: GameState,
    roomId: string,
    skipAdvance: boolean
  ): void {
    if (state.phase === 'GameOver') return;

    if (!skipAdvance) {
      if (state.handlerSwapPending !== undefined) {
        state.handlerSwapPending--;
        if (state.handlerSwapPending <= 0 && state.presidentialOrder && state.handlerSwapPositions) {
          const [p1, p2] = state.handlerSwapPositions;
          [state.presidentialOrder[p1], state.presidentialOrder[p2]] = [state.presidentialOrder[p2], state.presidentialOrder[p1]];
          state.handlerSwapPending = undefined;
          state.handlerSwapPositions = undefined;
        }
      }
      if (state.lastPresidentIdx !== -1) {
        state.presidentIdx = state.lastPresidentIdx;
        state.lastPresidentIdx = -1;
      }
      this.advancePresidentIdx(state);
    } else {
      // Even on skipAdvance (e.g. SpecialElection), decrement the Handler swap counter
      // so the swap doesn't last an extra round beyond its intended window.
      if (state.handlerSwapPending !== undefined) {
        state.handlerSwapPending--;
        if (state.handlerSwapPending <= 0 && state.presidentialOrder && state.handlerSwapPositions) {
          const [p1, p2] = state.handlerSwapPositions;
          [state.presidentialOrder[p1], state.presidentialOrder[p2]] = [state.presidentialOrder[p2], state.presidentialOrder[p1]];
          state.handlerSwapPending = undefined;
          state.handlerSwapPositions = undefined;
        }
      }
    }

    state.round++;
    addLog(state, `--- Round ${state.round} Started ---`);
    ensureDeckHas(state, 4);

    this.election.beginNomination(state, roomId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Public Delegates for GameEngine
  // ═══════════════════════════════════════════════════════════════════════════

  nominateChancellor(s: GameState, rid: string, cid: string, pid: string) {
    this.election.nominate(s, rid, cid, pid);
  }

  handleVoteResult(s: GameState, rid: string) {
    this.election.tallyVotes(s, rid);
  }

  handlePresidentDiscard(s: GameState, rid: string, pid: string, idx: number) {
    this.legislative.handlePresidentDiscard(s, rid, pid, idx);
  }

  handleChancellorPlay(s: GameState, rid: string, cid: string, idx: number) {
    this.legislative.handleChancellorPlay(s, rid, cid, idx);
  }

  handleVetoResponse(s: GameState, rid: string, player: Player, agree: boolean) {
    this.legislative.handleVetoResponse(s, rid, player, agree);
  }

  async handleExecutiveAction(s: GameState, rid: string, tid: string, pid?: string) {
    await this.executive.apply(s, rid, tid);
  }

  // ── IRoundManager implementation ───────────────────────────────────────────

  getEligibleChancellors(s: GameState, presidentId: string): Player[] {
    return this.election.EligibleChancellors(s, presidentId);
  }

  advanceToVotingOrBroker(s: GameState, roomId: string): void {
    this.election.advanceToVotingOrBroker(s, roomId);
  }

  tallyVotes(s: GameState, roomId: string): void {
    this.election.tallyVotes(s, roomId);
  }

  enactPolicy(s: GameState, roomId: string, policy: Policy, isChaos: boolean, playerId?: string): void {
    this.legislative.enactPolicy(s, roomId, policy, isChaos, playerId);
  }

  autoDeclareMissing(s: GameState, roomId: string): void {
    this.legislative.autoDeclareMissing(s, roomId);
  }

  onBothDeclared(s: GameState, roomId: string): void {
    this.legislative.onBothDeclared(s, roomId);
  }

  checkRoundEnd(s: GameState, roomId: string): void {
    this.legislative.checkRoundEnd(s, roomId);
  }

  runExecutiveAction(s: GameState, roomId: string): void {
    this.legislative.runExecutiveAction(s, roomId);
  }

  applyExecutiveAction(s: GameState, roomId: string, targetId: string): Promise<void> {
    return this.executive.apply(s, roomId, targetId);
  }

  startNomination(state: GameState, roomId: string): void {
    this.election.beginNomination(state, roomId);
  }

  tallyCensure(s: GameState, roomId: string): void {
    this.election.tallyCensure(s, roomId);
  }

  captureRoundHistory(s: GameState, policy: Policy, isChaos: boolean): void {
    this.legislative.captureRoundHistory(s, policy, isChaos);
  }

  handleElectionFailureContinuation(s: GameState, roomId: string): Promise<void> {
    return this.election.handleElectionFailureContinuation(s, roomId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Room Cleanup
  // ═══════════════════════════════════════════════════════════════════════════

  async resetRoom(roomId: string): Promise<void> {
    const state = this.engine.rooms.get(roomId);
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
      houseRules: undefined,
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
      vetoDenied: false,
      previousVotes: undefined,
      handlerSwapPending: undefined,
      handlerSwapPositions: undefined,
      isStrategistAction: undefined,
      // Crisis mode flags — always clear on reset regardless of current mode
      activeEventCard: undefined,
      electionTrackerFrozen: undefined,
      openSession: undefined,
      presidentDeclarationBlocked: undefined,
      censureMotionActive: undefined,
      censuredPlayerId: undefined,
      ghostVoterId: undefined,
      snapElectionActive: undefined,
      snapElectionPhaseDone: undefined,
      doubleTrackerOnFail: undefined,
      ironMandate: undefined,
      chatBlackout: undefined,
      chatBlackoutBuffer: undefined,
    });
    // Reinit or clean up the Crisis deck
    if (state.mode === 'Crisis' || (state.mode === 'House' && state.houseRules?.useCrisisCards)) {
      this.engine.crisisEngine.cleanup(roomId);
      this.engine.crisisEngine.initDeck(roomId);
    } else {
      this.engine.crisisEngine.cleanup(roomId);
    }
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
    await this.drainSpectatorQueue(roomId);
    await this.engine.updateRoomAverageElo(state);
    this.engine.broadcastState(roomId);
  }

  async drainSpectatorQueue(roomId: string): Promise<void> {
    const state = this.engine.rooms.get(roomId);
    if (!state) return;
    if (!state.spectatorQueue) state.spectatorQueue = [];
    const queue = [...state.spectatorQueue];
    for (const queued of queue) {
      if (state.players.length >= (state.maxPlayers ?? 10)) break;
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
      state.spectatorQueue = state.spectatorQueue.filter((q) => q.id !== queued.id);
      this.engine.io.to(queued.id).emit('queueDrained');
    }
    await this.engine.updateRoomAverageElo(state);
    this.engine.broadcastState(roomId);
  }
}

