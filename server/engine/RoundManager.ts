/**
 * engine/RoundManager.ts
 *
 * Refactored into specialized sub-managers:
 *   - ElectionManager: Nomination, voting, tally
 *   - LegislativeManager: Discard, play, enactment, chaos, declarations, veto
 *   - ExecutiveActionManager: Investigate, execution, special election, policy peek
 */

import { randomUUID } from 'crypto';
import { GameState, Player, Policy, GamePhase } from '../../src/types.ts';
import { createDeck } from '../utils.ts';
import { AI_BOTS } from '../aiPersonalities.ts';
import { assignRoles } from '../gameRules.ts';
import { initializeSuspicion } from '../suspicion.ts';
import { assignPersonalAgendas } from '../personalAgendas.ts';
import { addLog, ensureDeckHas, pick } from './utils.ts';
import type { IEngineCore } from './IEngineCore.ts';

import { ElectionManager } from './round/ElectionManager.ts';
import { LegislativeManager } from './round/LegislativeManager.ts';
import { ExecutiveActionManager } from './round/ExecutiveActionManager.ts';

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

  startActionTimer(roomId: string): void {
    const state = this.engine.rooms.get(roomId);
    if (
      !state ||
      state.actionTimer === 0 ||
      state.phase === 'Lobby' ||
      state.phase === 'GameOver'
    ) {
      if (state) state.actionTimerEnd = undefined;
      this.clearActionTimer(roomId);
      return;
    }

    this.clearActionTimer(roomId);
    state.actionTimerEnd = Date.now() + state.actionTimer * 1000;

    const handle = setTimeout(async () => {
      this.engine.actionTimers.delete(roomId);
      const s = this.engine.rooms.get(roomId);
      if (!s || s.phase === 'Lobby' || s.phase === 'GameOver' || s.isPaused) return;
      s.actionTimerEnd = undefined;
      await this.onActionTimerExpired(s, roomId);
    }, state.actionTimer * 1000);

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
        difficulty: pick(['Casual', 'Normal', 'Elite']) as 'Casual' | 'Normal' | 'Elite',
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
    if (state.mode !== 'Classic') {
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
    addLog(state, 'Game started! Roles assigned.');
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
    state.vetoRequested = false;
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
    this.resetPlayerActions(state);
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

  captureRoundHistory(s: GameState, policy: Policy, isChaos: boolean): void {
    this.legislative.captureRoundHistory(s, policy, isChaos);
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
