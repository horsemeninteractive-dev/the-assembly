/**
 * engine/RoundManager.ts
 *
 * Owns the complete game lifecycle from Lobby through GameOver:
 *   - Game start, AI fill, role assignment
 *   - Presidential rotation and special elections
 *   - Nomination, Broker/Interdictor gating, voting
 *   - Legislative (President discard, Chancellor play)
 *   - Policy enactment, declarations, chaos policy
 *   - Executive actions (investigation, execution, special election)
 *   - Veto handling
 *   - Round history capture
 *   - Room reset and spectator queue drain
 *   - Action timer (one per room)
 */

import { randomUUID } from 'crypto';
import { GameState, Player, Policy, GamePhase } from '../../src/types.ts';
import { shuffle, createDeck } from '../utils.ts';
import { AI_BOTS } from '../aiPersonalities.ts';
import { AI_WEIGHTS } from '../aiWeights.ts';
import { CHAT } from '../aiChatPhrases.ts';
import { assignRoles, getExecutiveAction } from '../gameRules.ts';
import {
  initializeSuspicion,
  updateSuspicionFromPolicy,
  updateSuspicionFromDeclarations,
  updateSuspicionFromInvestigation,
  updateSuspicionFromNomination,
  updateSuspicionFromPolicyExpectation,
} from '../suspicion.ts';
import { getUserById, saveUser } from '../supabaseService.ts';
import { assignPersonalAgendas, getPlayerAgenda, AGENDA_MAP } from '../personalAgendas.ts';
import { addLog, ensureDeckHas, pick } from './utils.ts';
import type { IEngineCore } from './IEngineCore.ts';

/** Extra surface RoundManager needs: direct access to the actionTimers map. */
export interface IRoundManagerContext extends IEngineCore {
  readonly actionTimers: Map<string, ReturnType<typeof setTimeout>>;
}

export class RoundManager {
  constructor(private readonly engine: IRoundManagerContext) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // Action Timer — one per room
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

  /** Public wrapper used by GameEngine.restoreFromRedis and the action-timer callback. */
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
        let eligible = this.getEligibleChancellors(s, president.id);
        if (eligible.length === 0)
          eligible = s.players.filter((p) => p.isAlive && p.id !== president.id);
        const target = pick(eligible);
        if (target) {
          target.isChancellorCandidate = true;
          addLog(s, `[Timer] ${president.name} timed out. ${target.name} auto-nominated.`);
          this.advanceToVotingOrBroker(s, roomId);
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
        this.tallyVotes(s, roomId);
        break;
      }
      case 'Legislative_President': {
        const president = s.players.find((p) => p.isPresident);
        if (president && s.drawnPolicies.length > 0) {
          if (!s.presidentSaw || s.presidentSaw.length === 0) {
            s.presidentSaw = [...s.drawnPolicies];
          }
          while (s.drawnPolicies.length > 2) {
            const i = Math.floor(Math.random() * s.drawnPolicies.length);
            s.discard.push(s.drawnPolicies.splice(i, 1)[0]);
          }
          s.chancellorPolicies = [...s.drawnPolicies];
          s.chancellorSaw = [...s.chancellorPolicies];
          s.drawnPolicies = [];
          s.presidentTimedOut = true;
          addLog(s, `[Timer] ${president.name} timed out. Random directive discarded.`);
          this.enterPhase(s, roomId, 'Legislative_Chancellor');
        }
        break;
      }
      case 'Legislative_Chancellor': {
        if (s.lastEnactedPolicy) {
          s.presidentTimedOut = true;
          s.chancellorTimedOut = true;
          this.autoDeclareMissing(s, roomId);
        } else {
          const chancellor = s.players.find((p) => p.isChancellor);
          if (chancellor && s.chancellorPolicies.length > 0) {
            const idx = Math.floor(Math.random() * s.chancellorPolicies.length);
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
      case 'Executive_Action': {
        const president = s.players.find((p) => p.isPresident);
        if (president) {
          const eligible = s.players.filter((p) => p.isAlive && p.id !== president.id);
          const target = pick(eligible);
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
  // Phase Management — single canonical entry point
  // ═══════════════════════════════════════════════════════════════════════════

  enterPhase(s: GameState, roomId: string, phase: GamePhase): void {
    if (s.phase === 'GameOver') return;
    s.phase = phase;

    if (phase === 'GameOver') {
      this.engine.broadcaster.clearDelayedSpectatorEmissions(roomId);
    }

    this.resetPlayerHasActed(s);
    this.startActionTimer(roomId);
    this.engine.broadcastState(roomId);
    this.engine.aiEngine.scheduleAITurns(s, roomId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Player state resets
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
  // Game Start
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
  // Presidential Rotation
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
    if (safety <= 0) addLog(state, '[ERROR] No alive player found for President. Aborting.');
  }

  /** Public so GameEngine can delegate nextPresident to it. */
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
        if (
          state.handlerSwapPending <= 0 &&
          state.presidentialOrder &&
          state.handlerSwapPositions
        ) {
          const [p1, p2] = state.handlerSwapPositions;
          [state.presidentialOrder[p1], state.presidentialOrder[p2]] = [
            state.presidentialOrder[p2],
            state.presidentialOrder[p1],
          ];
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

    state.messages.push({
      sender: 'System',
      text: `Round ${state.round} Started`,
      timestamp: Date.now(),
      type: 'round_separator',
      round: state.round,
    });
    if (state.messages.length > 50) state.messages.shift();

    ensureDeckHas(state, 4);

    if (Math.random() > 0.6) {
      const commentator = pick(state.players.filter((p) => p.isAI && p.isAlive));
      if (commentator) {
        setTimeout(() => {
          const st = this.engine.rooms.get(roomId);
          if (!st || st.isPaused) return;
          this.engine.aiEngine.postAIChat(st, commentator, CHAT.banter);
          this.engine.broadcastState(roomId);
        }, 2000);
      }
    }

    this.beginNomination(state, roomId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Election — Nomination
  // ═══════════════════════════════════════════════════════════════════════════

  /** Public so the orchestrator can call startNomination -> beginNomination. */
  startNomination(state: GameState, roomId: string): void {
    return this.beginNomination(state, roomId);
  }

  private beginNomination(state: GameState, roomId: string): void {
    this.resetPlayerActions(state);
    state.presidentTimedOut = false;
    state.chancellorTimedOut = false;
    state.drawnPolicies = [];
    state.chancellorPolicies = [];
    state.presidentSaw = undefined;
    state.chancellorSaw = undefined;
    state.lastEnactedPolicy = undefined;
    state.isStrategistAction = undefined;

    state.players[state.presidentIdx].isPresidentialCandidate = true;
    addLog(state, `${state.players[state.presidentIdx].name} is the Presidential Candidate.`);

    const interdictor = state.players.find(
      (p) =>
        p.titleRole === 'Interdictor' &&
        !p.titleUsed &&
        p.isAlive &&
        p.id !== state.players[state.presidentIdx].id
    );

    if (interdictor && state.round > 1) {
      state.titlePrompt = {
        playerId: interdictor.id,
        role: 'Interdictor',
        context: { role: 'Interdictor' },
        nextPhase: 'Nominate_Chancellor',
      };
      this.enterPhase(state, roomId, 'Nomination_Review');
    } else {
      this.enterPhase(state, roomId, 'Nominate_Chancellor');
    }
  }

  getEligibleChancellors(s: GameState, presidentId: string): Player[] {
    const alive = s.players.filter((p) => p.isAlive).length;
    return s.players.filter(
      (p) =>
        p.isAlive &&
        p.id !== presidentId &&
        p.id !== s.rejectedChancellorId &&
        p.id !== s.detainedPlayerId &&
        !p.wasChancellor &&
        !(alive > 5 && p.wasPresident)
    );
  }

  advanceToVotingOrBroker(s: GameState, roomId: string): void {
    const broker = s.players.find((p) => p.titleRole === 'Broker' && !p.titleUsed && p.isAlive);
    if (broker) {
      s.titlePrompt = {
        playerId: broker.id,
        role: 'Broker',
        context: { role: 'Broker' },
        nextPhase: 'Voting',
      };
      this.enterPhase(s, roomId, 'Nomination_Review');
    } else {
      this.enterPhase(s, roomId, 'Voting');
    }
  }

  nominateChancellor(
    s: GameState,
    roomId: string,
    chancellorId: string,
    presidentId: string
  ): void {
    if (s.titlePrompt) return;
    if (s.phase !== 'Nominate_Chancellor') return;

    const president = s.players[s.presidentIdx];
    if (president.id !== presidentId || !president.isAlive || president.hasActed) return;
    president.hasActed = true;

    const chancellor = s.players.find((p) => p.id === chancellorId);
    if (!chancellor || !chancellor.isAlive || chancellor.id === president.id) return;

    if (s.rejectedChancellorId === chancellor.id) {
      this.engine.io
        .to(president.socketId)
        .emit('error', 'This player was rejected by the Broker and cannot be nominated again this round.');
      president.hasActed = false;
      return;
    }
    if (s.detainedPlayerId === chancellor.id) {
      this.engine.io
        .to(president.socketId)
        .emit('error', 'This player is detained by the Interdictor and cannot be nominated.');
      president.hasActed = false;
      return;
    }

    const alive = s.players.filter((p) => p.isAlive).length;
    if (chancellor.wasChancellor || (alive > 5 && chancellor.wasPresident)) {
      this.engine.io.to(president.socketId).emit('error', 'Player is ineligible due to term limits.');
      president.hasActed = false;
      return;
    }

    s.players.forEach((p) => (p.isChancellorCandidate = false));
    chancellor.isChancellorCandidate = true;
    addLog(s, `${president.name} nominated ${chancellor.name} for Chancellor.`);
    updateSuspicionFromNomination(s, president.id, chancellor.id);
    this.engine.aiEngine.triggerAIReactions(s, roomId, 'nomination', { targetId: chancellor.id });
    this.advanceToVotingOrBroker(s, roomId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Voting
  // ═══════════════════════════════════════════════════════════════════════════

  /** Alias required by IRoundManager interface. */
  handleVoteResult(s: GameState, roomId: string): void {
    return this.tallyVotes(s, roomId);
  }

  tallyVotes(s: GameState, roomId: string): void {
    if (!s.previousVotes) s.previousVotes = {};
    for (const p of s.players) {
      if (p.vote) s.previousVotes[p.id] = p.vote;
    }

    const voters = s.players.filter((p) => p.isAlive && s.previousVotes![p.id]);
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

    const aye = s.players.filter((p) => p.vote === 'Aye').length;
    const nay = s.players.filter((p) => p.vote === 'Nay').length;
    s.players.forEach((p) => (p.vote = undefined));

    s.actionTimerEnd = Date.now() + 4000;
    s.declarations = [];
    this.enterPhase(s, roomId, 'Voting_Reveal');

    setTimeout(async () => {
      const st = this.engine.rooms.get(roomId);
      if (!st || st.phase !== 'Voting_Reveal') return;
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

  private async electionPassed(
    s: GameState,
    roomId: string,
    aye: number,
    nay: number,
    votes: Record<string, 'Aye' | 'Nay'>
  ): Promise<void> {
    addLog(s, `Election passed! (${aye} Aye, ${nay} Nay)`);

    const chancellor = s.players.find((p) => p.isChancellorCandidate);
    const president = s.players.find((p) => p.isPresidentialCandidate);
    if (!chancellor || !president) {
      addLog(s, '[ERROR] electionPassed: missing candidates.');
      this.nextRound(s, roomId, false);
      return;
    }

    if (s.stateDirectives >= 3) {
      if (chancellor.role === 'Overseer') {
        addLog(s, 'The Overseer was elected Chancellor — State Supremacy!');
        await this.engine.matchCloser.endGame(s, roomId, 'State', 'THE OVERSEER HAS ASCENDED');
        return;
      } else {
        chancellor.isProvenNotOverseer = true;
      }
    }

    this.resetPlayerActions(s);
    s.players.forEach((p) => {
      p.isPresident = false;
      p.isChancellor = false;
    });
    president.isPresident = true;
    chancellor.isChancellor = true;
    s.presidentId = president.id;
    s.chancellorId = chancellor.id;
    s.electionTracker = 0;

    s.lastGovernmentVotes = { ...votes };
    s.lastGovernmentPresidentId = president.id;
    s.lastGovernmentChancellorId = chancellor.id;
    updateSuspicionFromNomination(s, president.id, chancellor.id);

    ensureDeckHas(s, 4);
    if (s.deck.length === 0) {
      addLog(s, '[ERROR] Deck empty after reshuffle. Skipping to next round.');
      this.nextRound(s, roomId, true);
      return;
    }

    if (president.titleRole === 'Strategist' && !president.titleUsed) {
      s.titlePrompt = {
        playerId: president.id,
        role: 'Strategist',
        context: { role: 'Strategist' },
        nextPhase: 'Legislative_President',
      };
      s.drawnPolicies = [];
      this.enterPhase(s, roomId, 'Legislative_President');
    } else {
      s.drawnPolicies = s.deck.splice(0, 3);
      this.enterPhase(s, roomId, 'Legislative_President');
    }
  }

  private async electionFailed(
    s: GameState,
    roomId: string,
    aye: number,
    nay: number,
    votes: Record<string, 'Aye' | 'Nay'>
  ): Promise<void> {
    addLog(s, `Election failed! (${aye} Aye, ${nay} Nay)`);

    const presPlayer = s.players[s.presidentIdx];
    const chanPlayer = s.players.find((p) => p.isChancellorCandidate);
    if (!s.roundHistory) s.roundHistory = [];
    s.roundHistory.push({
      round: s.round,
      presidentName: presPlayer?.name ?? '?',
      chancellorName: chanPlayer?.name ?? '?',
      presidentId: presPlayer?.id,
      chancellorId: chanPlayer?.id,
      failed: true,
      failReason: 'vote',
      votes: Object.entries(votes).map(([pid, v]) => {
        const pl = s.players.find((p) => p.id === pid);
        return { playerId: pid, playerName: pl?.name ?? pid, vote: v };
      }),
    });

    s.electionTracker++;
    if (s.electionTracker >= 3) {
      await this.enactChaosPolicy(s, roomId);
    } else {
      this.engine.aiEngine.triggerAIReactions(s, roomId, 'failed_vote');
      this.nextRound(s, roomId, false);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Legislative — President discard
  // ═══════════════════════════════════════════════════════════════════════════

  handlePresidentDiscard(
    s: GameState,
    roomId: string,
    presidentId: string,
    idx: number
  ): void {
    if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0) return;
    if (s.phase !== 'Legislative_President') return;
    if (s.presidentId !== presidentId) return;
    if (idx >= s.drawnPolicies.length) return;

    const player = s.players.find((p) => p.id === presidentId);
    if (!player || !player.isAlive || player.hasActed) return;
    player.hasActed = true;

    if (s.drawnPolicies.length === 0) return;

    if (!s.presidentSaw || s.presidentSaw.length === 0) {
      s.presidentSaw = [...s.drawnPolicies];
    }
    const discarded = s.drawnPolicies.splice(idx, 1)[0];
    if (!discarded) return;
    s.discard.push(discarded);

    if (s.drawnPolicies.length > 2) {
      player.hasActed = false;
      this.engine.broadcastState(roomId);
      return;
    }

    s.chancellorPolicies = [...s.drawnPolicies];
    s.chancellorSaw = [...s.chancellorPolicies];
    s.drawnPolicies = [];
    this.enterPhase(s, roomId, 'Legislative_Chancellor');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Legislative — Chancellor play
  // ═══════════════════════════════════════════════════════════════════════════

  handleChancellorPlay(
    s: GameState,
    roomId: string,
    chancellorId: string,
    idx: number
  ): void {
    if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0) return;
    if (s.phase !== 'Legislative_Chancellor') return;
    if (s.chancellorId !== chancellorId) return;
    if (idx >= s.chancellorPolicies.length) return;

    const player = s.players.find((p) => p.id === chancellorId);
    if (!player || !player.isAlive || player.hasActed) return;
    player.hasActed = true;

    if (s.chancellorPolicies.length === 0) return;

    const played = s.chancellorPolicies.splice(idx, 1)[0];
    if (!played) return;

    s.discard.push(...s.chancellorPolicies);
    s.chancellorPolicies = [];
    this.enactPolicy(s, roomId, played, false, chancellorId);
    this.engine.broadcastState(roomId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Policy enactment
  // ═══════════════════════════════════════════════════════════════════════════

  enactPolicy(
    s: GameState,
    roomId: string,
    policy: Policy,
    isChaos: boolean,
    playerId?: string
  ): void {
    s.lastEnactedPolicy = { type: policy, timestamp: Date.now(), playerId, trackerReady: false };
    this.engine.broadcastState(roomId);

    setTimeout(async () => {
      const st = this.engine.rooms.get(roomId);
      if (!st || st.isPaused || st.phase === 'GameOver') return;

      if (policy === 'Civil') {
        st.civilDirectives++;
        addLog(st, 'A Civil directive was enacted.');
        if (!isChaos && playerId) {
          const chancellor = st.players.find((p) => p.id === playerId);
          if (chancellor) chancellor.civilEnactments = (chancellor.civilEnactments ?? 0) + 1;
        }
      } else {
        st.stateDirectives++;
        addLog(st, `A State directive was enacted. Total: ${st.stateDirectives}`);
        if (st.stateDirectives >= 5) st.vetoUnlocked = true;
        if (!isChaos && playerId) {
          const chancellor = st.players.find((p) => p.id === playerId);
          if (chancellor) chancellor.stateEnactments = (chancellor.stateEnactments ?? 0) + 1;
        }
      }

      updateSuspicionFromPolicy(st, policy);
      updateSuspicionFromPolicyExpectation(st, policy);

      if (await this.engine.matchCloser.checkVictory(st, roomId)) return;

      if (st.lastEnactedPolicy) {
        st.lastEnactedPolicy.trackerReady = true;
      }
      this.engine.broadcastState(roomId);

      if (isChaos) {
        this.captureRoundHistory(st, policy, true);
        this.nextRound(st, roomId, false);
      } else {
        this.scheduleAutoDeclarations(st, roomId);
      }
    }, 5000);
  }

  private async enactChaosPolicy(s: GameState, roomId: string): Promise<void> {
    addLog(s, 'Election tracker hit 3 — Chaos directive enacted!');
    s.electionTracker = 0;
    s.players.forEach((p) => {
      p.wasPresident = false;
      p.wasChancellor = false;
    });

    ensureDeckHas(s, 1);
    if (s.deck.length === 0) {
      addLog(s, '[ERROR] Deck empty. Skipping chaos policy.');
      this.nextRound(s, roomId, false);
      return;
    }

    const policy = s.deck.shift()!;
    this.resetPlayerActions(s);
    this.enactPolicy(s, roomId, policy, true);
    this.engine.broadcastState(roomId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Declarations
  // ═══════════════════════════════════════════════════════════════════════════

  private scheduleAutoDeclarations(s: GameState, roomId: string): void {
    setTimeout(() => {
      const st = this.engine.rooms.get(roomId);
      if (!st || st.phase !== 'Legislative_Chancellor' || st.isPaused) return;
      this.autoDeclareMissing(st, roomId);
    }, 1500);
  }

  autoDeclareMissing(s: GameState, roomId: string): void {
    if (s.phase !== 'Legislative_Chancellor') return;

    const president = s.players.find((p) => p.isPresident);
    const chancellor = s.players.find((p) => p.isChancellor);
    if (!president || !chancellor) return;

    const presDeclared = s.declarations.some((d) => d.type === 'President');
    const chanDeclared = s.declarations.some((d) => d.type === 'Chancellor');

    if (!presDeclared && (president.isAI || s.presidentTimedOut))
      this.generateDeclaration(s, roomId, president, 'President');
    if (!chanDeclared && (chancellor.isAI || s.chancellorTimedOut))
      this.generateDeclaration(s, roomId, chancellor, 'Chancellor');
  }

  private generateDeclaration(
    s: GameState,
    roomId: string,
    player: Player,
    type: 'President' | 'Chancellor'
  ): void {
    if (s.declarations.some((d) => d.playerId === player.id && d.type === type)) return;

    s.declarations = s.declarations.filter((d) => d.type !== type);

    const saw = s.chancellorSaw ?? [];
    const drew = s.presidentSaw ?? [];
    let civ = saw.filter((p) => p === 'Civil').length;
    let sta = saw.filter((p) => p === 'State').length;
    let drewCiv = drew.filter((p) => p === 'Civil').length;
    let drewSta = drew.filter((p) => p === 'State').length;

    const presIsState = s.players.find((p) => p.isPresident)?.role !== 'Civil';
    const chanIsState = s.players.find((p) => p.isChancellor)?.role !== 'Civil';
    const bothState = presIsState && chanIsState;
    const enacted = s.lastEnactedPolicy?.type;

    if (bothState && enacted === 'State') {
      if (type === 'President') {
        if (sta === 2 && Math.random() > 0.5) { civ = 1; sta = 1; }
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
      if (player.role !== 'Civil') {
        if (player.personality === 'Deceptive') lie = true;
        else if (player.personality === 'Aggressive')
          lie = Math.random() < AI_WEIGHTS.lying.Aggressive;
        else if (player.personality === 'Strategic')
          lie = (s.stateDirectives ?? 0) >= AI_WEIGHTS.legislative.STRATEGIC_PASS_THRESHOLD;
        else if (player.personality === 'Chaotic')
          lie = Math.random() < AI_WEIGHTS.lying.Chaotic;
      }
      if (lie && civ > 0) {
        if (enacted === 'Civil' && civ === 1) {
          // Do not lie — must claim at least 1 Civil since Civil was enacted
        } else {
          civ--;
          sta++;
        }
      }
    }

    if (type === 'President') {
      if (player.role !== 'Civil') {
        const discardedCiv = drewCiv - civ;
        if (discardedCiv > 0) {
          drewCiv -= discardedCiv;
          drewSta += discardedCiv;
        }
      }
      while (drewSta < sta && drewCiv > 0) { drewCiv--; drewSta++; }
      while (drewCiv < civ && drewSta > 0) { drewSta--; drewCiv++; }
    }

    s.declarations.push({
      playerId: player.id,
      playerName: player.name,
      civ,
      sta,
      ...(type === 'President' ? { drewCiv, drewSta } : {}),
      type,
      timestamp: Date.now(),
    });

    this.engine.broadcastState(roomId);

    const presDecl = s.declarations.some((d) => d.type === 'President');
    const chanDecl = s.declarations.some((d) => d.type === 'Chancellor');
    if (presDecl && chanDecl) this.onBothDeclared(s, roomId);
  }

  onBothDeclared(s: GameState, roomId: string): void {
    if (s.phase !== 'Legislative_Chancellor') return;
    if (!s.lastEnactedPolicy) return;

    updateSuspicionFromDeclarations(s);

    const presFull = s.declarations.find((d) => d.type === 'President');
    if (presFull) {
      const drewStr = ` (drew ${presFull.drewCiv}C/${presFull.drewSta}S)`;
      addLog(s, `${presFull.playerName} (President) declared passed ${presFull.civ}C/${presFull.sta}S.${drewStr}`);
    }

    const chanFull = s.declarations.find((d) => d.type === 'Chancellor');
    if (chanFull) {
      addLog(s, `${chanFull.playerName} (Chancellor) declared received ${chanFull.civ}C/${chanFull.sta}S.`);
    }

    const bothAI =
      s.players.find((p) => p.isPresident)?.isAI &&
      s.players.find((p) => p.isChancellor)?.isAI;
    if (!bothAI && s.lastEnactedPolicy?.type === 'State' && Math.random() > 0.4) {
      const pres = s.players.find((pl) => pl.isPresident);
      const chan = s.players.find((pl) => pl.isChancellor);
      const speaker = pres?.isAI ? pres : chan?.isAI ? chan : null;
      if (speaker) {
        setTimeout(() => {
          const st = this.engine.rooms.get(roomId);
          if (!st || st.isPaused) return;
          const roleType = speaker.isPresident ? 'President' : 'Chancellor';
          const lines =
            roleType === 'Chancellor'
              ? speaker.role === 'Civil'
                ? CHAT.chanCivilStateEnacted
                : CHAT.chanStateStateEnacted
              : speaker.role === 'Civil'
                ? CHAT.presCivilStateEnacted
                : CHAT.presStateStateEnacted;
          this.engine.aiEngine.postAIChat(st, speaker, lines);
          this.engine.broadcastState(roomId);
        }, 1200);
      }
    }

    if (!s.lastEnactedPolicy.historyCaptured) {
      this.captureRoundHistory(s, s.lastEnactedPolicy.type, false);
      s.lastEnactedPolicy.historyCaptured = true;
      s.lastGovernmentVotes = undefined;
    }

    this.engine.titleRoleResolver.runPostRoundTitleAbilities(s, roomId);
  }

  checkRoundEnd(s: GameState, roomId: string): void {
    const presDecl = s.declarations.some((d) => d.type === 'President');
    const chanDecl = s.declarations.some((d) => d.type === 'Chancellor');
    if (presDecl && chanDecl) this.onBothDeclared(s, roomId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Executive Actions
  // ═══════════════════════════════════════════════════════════════════════════

  runExecutiveAction(s: GameState, roomId: string): void {
    if (s.phase === 'GameOver') return;

    const action = getExecutiveAction(s);
    if (action !== 'None' && s.lastExecutiveActionStateCount !== s.stateDirectives) {
      s.lastExecutiveActionStateCount = s.stateDirectives;
      s.currentExecutiveAction = action;

      if (action === 'PolicyPeek') {
        const top3 = s.deck.slice(0, 3);
        const pres = s.players.find((p) => p.id === s.presidentId);
        if (pres?.socketId) {
          this.engine.io.to(pres.socketId).emit('policyPeekResult', top3);
          addLog(s, `${pres.name} previewed the top 3 directives.`);
        }
        this.nextRound(s, roomId, true);
        return;
      }

      addLog(s, `Executive Action unlocked: ${action}`);
      this.enterPhase(s, roomId, 'Executive_Action');
    } else {
      this.nextRound(s, roomId, true);
    }
  }

  async handleExecutiveAction(
    s: GameState,
    roomId: string,
    targetId: string,
    presidentId?: string
  ): Promise<void> {
    if (presidentId) {
      if (s.phase !== 'Executive_Action') return;
      if (s.presidentId !== presidentId) return;
      const player = s.players.find((p) => p.id === presidentId);
      if (!player || !player.isAlive || player.hasActed) return;
      player.hasActed = true;
    }
    await this.applyExecutiveAction(s, roomId, targetId);
    this.engine.broadcastState(roomId);
  }

  async applyExecutiveAction(
    s: GameState,
    roomId: string,
    targetId: string
  ): Promise<void> {
    const action = s.currentExecutiveAction;
    s.currentExecutiveAction = 'None';

    const target = s.players.find((p) => p.id === targetId && p.isAlive);
    if (!target) {
      this.nextRound(s, roomId, true);
      return;
    }

    if (action === 'Execution') {
      await this.executePlayer(s, roomId, target);
    } else if (action === 'Investigate') {
      this.investigatePlayer(s, roomId, target);
    } else if (action === 'SpecialElection') {
      addLog(s, `Special Election: ${target.name} will be the next Presidential Candidate.`);
      s.lastPresidentIdx = s.presidentIdx;
      s.presidentIdx = s.players.indexOf(target);
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

    const president = s.players.find((p) => p.id === s.presidentId);
    if (president?.userId) {
      const u = await getUserById(president.userId);
      if (u) { u.stats.kills++; await saveUser(u); }
    }
    if (target.userId) {
      const u = await getUserById(target.userId);
      if (u) { u.stats.deaths++; await saveUser(u); }
    }

    if (target.role === 'Overseer') {
      addLog(s, 'The Overseer was executed — Charter Restored!');
      await this.engine.matchCloser.endGame(s, roomId, 'Civil', 'THE OVERSEER IS ELIMINATED — CHARTER RESTORED');
    } else {
      this.nextRound(s, roomId, true);
    }
  }

  private investigatePlayer(s: GameState, roomId: string, target: Player): void {
    addLog(s, `President investigated ${target.name}.`);
    const result = target.role === 'Civil' ? 'Civil' : 'State';

    if (s.presidentId) {
      const pres = s.players.find((p) => p.id === s.presidentId);
      if (pres?.socketId) {
        this.engine.io
          .to(pres.socketId)
          .emit('investigationResult', { targetName: target.name, role: result });
        updateSuspicionFromInvestigation(s, s.presidentId, target.id, result);
      }
      if (pres?.isAI && Math.random() > 0.3) {
        setTimeout(() => {
          const st = this.engine.rooms.get(roomId);
          if (!st || st.isPaused) return;
          this.engine.aiEngine.postAIChat(
            st,
            pres,
            result === 'State' ? CHAT.investigateState : CHAT.investigateCivil,
            target.name
          );
          this.engine.broadcastState(roomId);
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
      s.vetoRequested = false;

      if (!s.roundHistory) s.roundHistory = [];
      const vetoPresident = s.players.find((p) => p.isPresident);
      const vetoChancellor = s.players.find((p) => p.isChancellor);
      s.roundHistory.push({
        round: s.round,
        presidentName: vetoPresident?.name ?? '?',
        chancellorName: vetoChancellor?.name ?? '?',
        presidentId: vetoPresident?.id,
        chancellorId: vetoChancellor?.id,
        failed: true,
        failReason: 'veto',
        votes: [],
      });

      s.electionTracker++;
      if (s.electionTracker >= 3) {
        this.enactChaosPolicy(s, roomId);
        return;
      }

      const auditor = s.players.find((p) => p.titleRole === 'Auditor' && !p.titleUsed && p.isAlive);
      if (auditor) {
        s.titlePrompt = {
          playerId: auditor.id,
          role: 'Auditor',
          context: { role: 'Auditor', discardPile: s.discard.slice(-3) },
        };
        this.enterPhase(s, roomId, 'Auditor_Action');
      } else {
        this.nextRound(s, roomId, false);
      }
    } else {
      s.vetoRequested = false;
      const vetoChancellor = s.players.find((p) => p.isChancellor);
      if (vetoChancellor) vetoChancellor.hasActed = false;
      addLog(s, `${player.name} (President) denied the Veto. Chancellor must enact a directive.`);
      this.startActionTimer(roomId);
      this.engine.aiEngine.scheduleAITurns(s, roomId);
      this.engine.broadcastState(roomId);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Round History
  // ═══════════════════════════════════════════════════════════════════════════

  captureRoundHistory(s: GameState, policy: Policy, isChaos: boolean): void {
    if (!s.roundHistory) s.roundHistory = [];

    if (isChaos) {
      s.roundHistory.push({ round: s.round, presidentName: '—', chancellorName: '—', policy, chaos: true, votes: [] });
      return;
    }

    if (!s.lastGovernmentPresidentId || !s.lastGovernmentChancellorId) return;
    const pres = s.players.find((p) => p.id === s.lastGovernmentPresidentId);
    const chan = s.players.find((p) => p.id === s.lastGovernmentChancellorId);
    if (!pres || !chan) return;

    const presDecl = s.declarations.find((d) => d.type === 'President');
    const chanDecl = s.declarations.find((d) => d.type === 'Chancellor');
    const action = getExecutiveAction(s);

    s.roundHistory.push({
      round: s.round,
      presidentName: pres.name,
      chancellorName: chan.name,
      presidentId: pres.id,
      chancellorId: chan.id,
      policy,
      votes: Object.entries(s.lastGovernmentVotes ?? {}).map(([pid, v]) => {
        const pl = s.players.find((p) => p.id === pid);
        return { playerId: pid, playerName: pl?.name ?? pid, vote: v as 'Aye' | 'Nay' };
      }),
      presDeclaration: presDecl
        ? { civ: presDecl.civ, sta: presDecl.sta, drewCiv: presDecl.drewCiv ?? 0, drewSta: presDecl.drewSta ?? 0 }
        : undefined,
      chanDeclaration: chanDecl ? { civ: chanDecl.civ, sta: chanDecl.sta } : undefined,
      executiveAction: action !== 'None' ? action : undefined,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Room Reset & Spectator Queue
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
