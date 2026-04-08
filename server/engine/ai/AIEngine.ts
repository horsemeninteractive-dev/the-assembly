/**
 * engine/AIEngine.ts
 *
 * All artificial-intelligence logic:
 *   - AI turn scheduling and dispatch per game phase
 *   - Nomination, voting, legislative, executive, veto, and title-ability decisions
 *   - Personality-weighted policy selection helpers
 *   - AI chat: postAIChat (used by other modules too) and triggerAIReactions
 */

import { GameState, Player, TitleAbilityData } from '../../../shared/types';
import { CHAT } from './aiChatPhrases';
import { AI_WEIGHTS } from './aiWeights';
import { getSuspicion, leastSuspicious, mostSuspicious, updateSuspicionFromNomination } from '../../game/suspicion';
import { shuffle } from '../../utils';
import { addLog, pick } from '../utils';
import type { IEngineCore } from '../IEngineCore';

type Policy = 'Civil' | 'State';

export class AIEngine {
  constructor(private readonly engine: IEngineCore) {}

  // ---------------------------------------------------------------------------
  // Scheduling — fire once per phase entry
  // ---------------------------------------------------------------------------

  scheduleAITurns(s: GameState, roomId: string): void {
    if (s.phase === 'Lobby' || s.phase === 'GameOver' || s.isPaused) return;
    setTimeout(() => {
      const st = this.engine.rooms.get(roomId);
      if (!st || st.isPaused || st.phase === 'Lobby' || st.phase === 'GameOver') return;
      this.runAITurn(st, roomId);
    }, 2000);
  }

  /** Public alias kept for server.ts call-sites. */
  processAITurns(roomId: string): void {
    const s = this.engine.rooms.get(roomId);
    if (s) this.scheduleAITurns(s, roomId);
  }

  // ---------------------------------------------------------------------------
  // Main dispatch
  // ---------------------------------------------------------------------------

  private async runAITurn(s: GameState, roomId: string): Promise<void> {
    // Title ability prompt takes priority — but only resolve it when we are in
    // the correct phase for that ability. A stale scheduleAITurns call from a
    // previous phase must not fire into a titlePrompt that belongs to the next
    // phase.
    if (s.titlePrompt) {
      const expectedPhase: Record<string, string> = {
        Interdictor: 'Nomination_Review',
        Broker: 'Nomination_Review',
        Strategist: 'Legislative_President',
        Auditor: 'Auditor_Action',
        Archivist: 'Auditor_Action',
        Herald: 'Herald_Action',
        Quorum: 'Quorum_Action',
        Assassin: 'Assassin_Action',
        Handler: 'Handler_Action',
      };
      const expected = expectedPhase[s.titlePrompt.role];
      if (expected && s.phase !== expected) return;
      const holder = s.players.find((p) => p.id === s.titlePrompt!.playerId);
      if (holder?.isAI) await this.aiDecideTitleAbility(s, roomId);
      return;
    }

    if (s.vetoRequested) {
      await this.aiVetoResponse(s, roomId);
      return;
    }

    switch (s.phase) {
      case 'Nominate_Chancellor': {
        const president = s.players[s.presidentIdx];
        if (president.isAI) this.aiNominateChancellor(s, roomId);
        break;
      }
      case 'Voting':
        this.aiCastVotes(s, roomId);
        break;
      case 'Legislative_President': {
        const president = s.players.find((p) => p.isPresident);
        if (president?.isAI) this.aiPresidentDiscard(s, roomId);

        // Cipher parallel action: Cipher can act during Legislative_President
        const cipher = s.players.find((p) => p.titleRole === 'Cipher' && !p.cipherUsed && p.isAlive && !p.isPresident);
        if (cipher?.isAI && Math.random() > 0.6) {
          setTimeout(() => {
            const st = this.engine.rooms.get(roomId);
            if (st && st.phase === 'Legislative_President') this.aiCipherDispatch(st, roomId, cipher);
          }, 4000 + Math.random() * 6000);
        }
        break;
      }
      case 'Legislative_Chancellor': {
        const chancellor = s.players.find((p) => p.isChancellor);
        if (chancellor?.isAI && s.chancellorPolicies.length > 0) {
          this.aiChancellorPlay(s, roomId);
        }
        break;
      }
      case 'Executive_Action': {
        const president = s.players.find((p) => p.isPresident);
        if (president?.isAI) await this.aiExecutiveAction(s, roomId);
        break;
      }
      case 'Censure_Action': {
        this.aiCensureVotes(s, roomId);
        break;
      }
      case 'Snap_Election': {
        this.aiSnapVolunteer(s, roomId);
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Nomination
  // ---------------------------------------------------------------------------

  private aiNominateChancellor(s: GameState, roomId: string): void {
    const president = s.players[s.presidentIdx];
    if (!president.isAI) return;

    let eligible = this.engine.roundManager.getEligibleChancellors(s, president.id);
    if (eligible.length === 0)
      eligible = s.players.filter((p) => p.isAlive && p.id !== president.id);
    if (eligible.length === 0) return;

    let target: Player;
    if (president.role === 'Civil' && president.suspicion) {
      target = leastSuspicious(president, eligible);
    } else {
      const overseer = eligible.find((p) => p.role === 'Overseer');
      const teammate = eligible.find((p) => p.role === 'State');
      target =
        s.stateDirectives >= 3 && overseer
          ? overseer
          : teammate && Math.random() > 0.3
            ? teammate
            : pick(eligible)!;
    }

    s.players.forEach((p) => (p.isChancellorCandidate = false));
    target.isChancellorCandidate = true;
    addLog(s, `${president.name} nominated ${target.name} for Chancellor.`);
    updateSuspicionFromNomination(s, president.id, target.id);
    this.triggerAIReactions(s, roomId, 'nomination', { targetId: target.id });
    this.engine.roundManager.advanceToVotingOrBroker(s, roomId);
  }

  // ---------------------------------------------------------------------------
  // Voting
  // ---------------------------------------------------------------------------

  private aiCastVotes(s: GameState, roomId: string): void {
    const chancellor = s.players.find((p) => p.isChancellorCandidate);
    const president = s.players[s.presidentIdx];

    for (const ai of s.players.filter(
      (p) => p.isAI && (p.isAlive || p.id === s.ghostVoterId) && !p.vote && p.id !== s.detainedPlayerId
    )) {
      ai.vote = this.computeAIVote(ai, s, president, chancellor ?? null);
    }

    const aliveVoters = s.players.filter((p) => p.isAlive && p.id !== s.detainedPlayerId);
    const votesNeeded = aliveVoters.length + (s.ghostVoterId ? 1 : 0);
    const votesCast = s.players.filter((p) => p.vote).length;

    if (votesCast >= votesNeeded) this.engine.roundManager.tallyVotes(s, roomId);
    else this.engine.broadcastState(roomId);
  }

  private computeAIVote(
    ai: Player,
    s: GameState,
    president: Player,
    chancellor: Player | null
  ): 'Aye' | 'Nay' {
    const diff =
      ai.difficulty === 'Elite'
        ? AI_WEIGHTS.difficulty.Elite
        : ai.difficulty === 'Casual'
          ? AI_WEIGHTS.difficulty.Casual
          : AI_WEIGHTS.difficulty.Normal;

    if (ai.role === 'Civil' && ai.suspicion) {
      const ps = getSuspicion(ai, president.id);
      const cs = chancellor ? getSuspicion(ai, chancellor.id) : 0;
      const thr = Math.min(0.6, 0.45 + s.round * 0.015) * diff;
      const risk =
        AI_WEIGHTS.riskThresholds[ai.personality!] ?? AI_WEIGHTS.riskThresholds.Default;

      const agendasWithNoise: string[] = ['chaos_agent', 'the_hawk', 'stonewalled'];
      const noise =
        ai.personalAgenda && agendasWithNoise.includes(ai.personalAgenda)
          ? AI_WEIGHTS.noise.AGENDA_CONTRIBUTION
          : 0;

      if ((ps * diff > thr || cs * diff > thr) && Math.random() > risk - noise) {
        return s.electionTracker >= 2 ? 'Aye' : 'Nay';
      }
      if (s.stateDirectives >= 3 && chancellor?.role === 'Overseer') return 'Nay';
      if (s.electionTracker >= 2) return 'Aye';
      if (Math.random() < AI_WEIGHTS.noise.BASE_VOTING + noise)
        return Math.random() > 0.5 ? 'Aye' : 'Nay';
      return 'Aye';
    }

    if (s.civilDirectives >= 4) {
      const isStateGov = president.role !== 'Civil' || chancellor?.role !== 'Civil';
      if (!isStateGov && s.electionTracker < 2) return 'Nay';
    }

    if (s.stateDirectives >= 3 && chancellor?.role === 'Overseer') return 'Aye';
    if (chancellor?.role !== 'Civil' || president.role !== 'Civil')
      return Math.random() > AI_WEIGHTS.stateVoting.AYE_THRESHOLD_BASE ? 'Aye' : 'Nay';
    return Math.random() > AI_WEIGHTS.stateVoting.NAY_THRESHOLD_BASE ? 'Aye' : 'Nay';
  }

  // ---------------------------------------------------------------------------
  // Legislative — President
  // ---------------------------------------------------------------------------

  private aiPresidentDiscard(s: GameState, roomId: string): void {
    const president = s.players.find((p) => p.isPresident);
    if (!president?.isAI || s.drawnPolicies.length === 0) return;

    if (!s.presidentSaw || s.presidentSaw.length === 0) {
      s.presidentSaw = [...s.drawnPolicies];
    }
    while (s.drawnPolicies.length > 2) {
      const idx = this.choosePolicyToDiscard(president, s.drawnPolicies, s.stateDirectives);
      s.discard.push(s.drawnPolicies.splice(idx, 1)[0]);
    }

    s.chancellorPolicies = [...s.drawnPolicies];
    s.chancellorSaw = [...s.chancellorPolicies];
    s.drawnPolicies = [];
    s.isStrategistAction = undefined;
    this.engine.enterPhase(s, roomId, 'Legislative_Chancellor');
  }

  private choosePolicyToDiscard(player: Player, hand: Policy[], stateDir: number): number {
    let idx = -1;

    if (player.role !== 'Civil' && stateDir >= 4) {
      const civIdx = hand.findIndex((p) => p === 'Civil');
      if (civIdx !== -1) return civIdx;
    }

    if (player.personality === 'Aggressive' && player.role !== 'Civil') {
      idx = hand.findIndex((p) => p === 'Civil');
    } else if (player.personality === 'Strategic' && player.role !== 'Civil') {
      idx =
        stateDir < AI_WEIGHTS.legislative.STRATEGIC_PASS_THRESHOLD
          ? hand.findIndex((p) => p === 'State')
          : hand.findIndex((p) => p === 'Civil');
    } else if (player.personality === 'Honest' || player.role === 'Civil') {
      if (Math.random() < AI_WEIGHTS.legislative.CIVIL_MISTAKE_CHANCE) {
        idx = hand.findIndex((p) => p === 'Civil');
      } else {
        idx = hand.findIndex((p) => p === 'State');
      }
    }
    return idx === -1 ? 0 : idx;
  }

  // ---------------------------------------------------------------------------
  // Legislative — Chancellor
  // ---------------------------------------------------------------------------

  private aiChancellorPlay(s: GameState, roomId: string): void {
    const chancellor = s.players.find((p) => p.isChancellor);
    if (!chancellor?.isAI || s.chancellorPolicies.length === 0) return;

    const idx = this.choosePolicyToPlay(
      chancellor,
      s.chancellorPolicies,
      s.stateDirectives,
      s.civilDirectives
    );
    const played = s.chancellorPolicies.splice(idx, 1)[0];
    s.discard.push(...s.chancellorPolicies);
    s.chancellorPolicies = [];
    this.engine.roundManager.enactPolicy(s, roomId, played, false, chancellor.id);
  }

  private choosePolicyToPlay(
    player: Player,
    hand: Policy[],
    stateDir: number,
    civilDir: number
  ): number {
    const hasCivil = hand.includes('Civil');
    const hasState = hand.includes('State');

    // ── Winning plays ─────────────────────────────────────────────────────────
    // Civil chancellor secures an immediate Civil win
    if (player.role === 'Civil' && civilDir === 4 && hasCivil)
      return hand.findIndex((p) => p === 'Civil');

    // State/Overseer chancellor secures an immediate State win
    if ((player.role === 'State' || player.role === 'Overseer') && stateDir === 5 && hasState)
      return hand.findIndex((p) => p === 'State');

    // ── Game-ending loss prevention ───────────────────────────────────────────
    // Civil chancellor must NOT hand State a win by playing State when stateDir === 5
    if (player.role === 'Civil' && stateDir === 5 && hasCivil)
      return hand.findIndex((p) => p === 'Civil');

    // State/Overseer chancellor must NOT hand Civil a win by playing Civil when civilDir === 4
    if ((player.role === 'State' || player.role === 'Overseer') && civilDir === 4 && hasState)
      return hand.findIndex((p) => p === 'State');

    // ── Personality-weighted selection ────────────────────────────────────────
    let idx = -1;
    if (player.personality === 'Aggressive' && player.role !== 'Civil') {
      // Aggressive State players always push State enactments
      idx = hasState ? hand.findIndex((p) => p === 'State') : hand.findIndex((p) => p === 'Civil');
    } else if (player.personality === 'Strategic' && player.role !== 'Civil') {
      // Strategic State players play Civil to blend in while stateDir is low,
      // switching to State once close to the winning threshold
      idx =
        stateDir < AI_WEIGHTS.legislative.STRATEGIC_PLAY_THRESHOLD
          ? hand.findIndex((p) => p === 'Civil')
          : hand.findIndex((p) => p === 'State');
    } else if (player.personality === 'Honest' || player.role === 'Civil') {
      idx = hasCivil ? hand.findIndex((p) => p === 'Civil') : hand.findIndex((p) => p === 'State');
    }
    return idx === -1 ? 0 : idx;
  }

  // ---------------------------------------------------------------------------
  // Executive Action
  // ---------------------------------------------------------------------------

  private async aiExecutiveAction(s: GameState, roomId: string): Promise<void> {
    const president = s.players.find((p) => p.isPresident);
    if (!president?.isAI) return;

    const eligible = s.players.filter((p) => p.isAlive && p.id !== president.id);
    if (eligible.length === 0) return;

    let target: Player;
    if (president.role === 'Civil' && president.suspicion) {
      target =
        s.currentExecutiveAction === 'SpecialElection'
          ? leastSuspicious(president, eligible)
          : mostSuspicious(president, eligible);
    } else {
      const civil = eligible.filter((p) => p.role === 'Civil');
      const state = eligible.filter((p) => p.role === 'State' || p.role === 'Overseer');
      target =
        s.currentExecutiveAction === 'SpecialElection'
          ? (pick(state) ?? pick(eligible)!)
          : (pick(civil) ?? pick(eligible)!);
    }

    await this.engine.roundManager.applyExecutiveAction(s, roomId, target.id);
  }

  // ---------------------------------------------------------------------------
  // Veto
  // ---------------------------------------------------------------------------

  private async aiVetoResponse(s: GameState, roomId: string): Promise<void> {
    const president = s.players.find((p) => p.isPresident);
    if (!president?.isAI) return;

    const stateInHand = s.chancellorPolicies.filter((p) => p === 'State').length;
    const civilInHand = s.chancellorPolicies.filter((p) => p === 'Civil').length;
    let agree: boolean;

    if (president.role === 'Civil') {
      agree = s.electionTracker >= 2 ? false : stateInHand === 2 ? true : Math.random() > 0.75;
    } else {
      agree = civilInHand >= 1 && s.stateDirectives < 4 ? false : Math.random() > 0.7;
    }

    this.engine.roundManager.handleVetoResponse(s, roomId, president, agree);
  }

  // ---------------------------------------------------------------------------
  // Title ability decisions
  // ---------------------------------------------------------------------------

  private async aiDecideTitleAbility(s: GameState, roomId: string): Promise<void> {
    const prompt = s.titlePrompt;
    if (!prompt) return;

    const player = s.players.find((p) => p.id === prompt.playerId);
    if (!player?.isAI) return;

    const isPresident = player.id === s.players[s.presidentIdx].id;
    if (isPresident && (prompt.role === 'Broker' || prompt.role === 'Interdictor')) {
      await this.engine.titleRoleResolver.handleTitleAbility(s, roomId, { use: false });
      return;
    }

    let data: TitleAbilityData = { use: false };

    switch (prompt.role) {
      case 'Assassin': {
        const targets = s.players.filter((p) => p.isAlive && p.id !== player.id);
        const suspect = mostSuspicious(player, targets);
        if (getSuspicion(player, suspect.id) > 0.7) {
          data = { use: true, role: 'Assassin', targetId: suspect.id };
        }
        break;
      }
      case 'Strategist':
        if (Math.random() > 0.4) {
          data = { use: true, role: 'Strategist' };
        }
        break;
      case 'Broker': {
        const candidate = s.players.find((p) => p.isChancellorCandidate);
        if (!isPresident && candidate && getSuspicion(player, candidate.id) > 0.6) {
          data = { use: true, role: 'Broker' };
        }
        break;
      }
      case 'Handler': {
        if (s.presidentialOrder) {
          const curId = s.players[s.presidentIdx].id;
          const curPos = s.presidentialOrder.indexOf(curId);
          const nextId = s.presidentialOrder[(curPos + 1) % s.presidentialOrder.length];
          if (getSuspicion(player, nextId) > 0.6) {
            data = { use: true, role: 'Handler' };
          }
        }
        break;
      }
      case 'Auditor':
        data = { use: true, role: 'Auditor' };
        break;
      case 'Interdictor': {
        const candidates = s.players.filter(
          (p) => p.isAlive && p.id !== s.players[s.presidentIdx].id && p.id !== player.id
        );
        const suspect = candidates.find((p) => getSuspicion(player, p.id) > 0.7);
        if (suspect) {
          data = { use: true, role: 'Interdictor', targetId: suspect.id };
        }
        break;
      }
      case 'Archivist':
        data = { use: true, role: 'Archivist' };
        break;
      case 'Herald': {
        // If the AI is the target of a pending Herald response, they must respond
        if (s.heraldPendingResponse?.targetId === player.id) {
          const agree = player.role === 'Civil' || Math.random() > 0.3;
          data = { 
            use: true, 
            role: 'Herald', 
            agree 
          } as any;
          break;
        }

        // Otherwise (AI is the Herald), they initiate a proclamation
        const targets = s.players.filter((p) => p.isAlive && p.id !== player.id);
        const suspect = mostSuspicious(player, targets);
        if (getSuspicion(player, suspect.id) > 0.6) {
          data = {
            use: true,
            role: 'Herald',
            targetId: suspect.id,
            claim: `I assert that ${suspect.name} is Civil`,
          };
        }
        break;
      }
      case 'Quorum': {
        const chancellor = s.players.find((p) => p.isChancellorCandidate);
        const suspiciousLevel = chancellor ? getSuspicion(player, chancellor.id) : 1;
        // Only re-vote if we trust the chancellor candidate (suspicion < 0.4)
        if (suspiciousLevel < 0.4) {
          data = { use: true, role: 'Quorum' };
        }
        break;
      }
    }

    await this.engine.titleRoleResolver.handleTitleAbility(s, roomId, data);
  }

  private aiCipherDispatch(s: GameState, roomId: string, ai: Player): void {
    const targets = s.players.filter((p) => p.isAlive && p.id !== ai.id);
    if (targets.length === 0) return;

    let target: Player;
    if (ai.role === 'Civil') {
      target = leastSuspicious(ai, targets);
    } else {
      target = mostSuspicious(ai, targets);
    }

    const message = pick(CHAT.cipherDispatch)!;
    this.engine.titleRoleResolver.handleTitleAbility(s, roomId, {
      use: true,
      role: 'Cipher',
      targetId: target.id,
      message,
    });
  }

  private aiCensureVotes(s: GameState, roomId: string): void {
    const aiPlayers = s.players.filter((p) => p.isAI && p.isAlive && !p.censureVoteId);
    if (aiPlayers.length === 0) return;

    for (const ai of aiPlayers) {
      const targets = s.players.filter((p) => p.isAlive && p.id !== ai.id && p.id !== s.players[s.presidentIdx].id);
      if (targets.length === 0) continue;

      let target: Player;
      if (ai.role === 'Civil' && ai.suspicion) {
        target = mostSuspicious(ai, targets);
      } else {
        const civil = targets.filter((p) => p.role === 'Civil');
        target = pick(civil) ?? pick(targets)!;
      }
      ai.censureVoteId = target.id;
    }

    const aliveCount = s.players.filter((p) => p.isAlive).length;
    const votesCast = s.players.filter((p) => p.censureVoteId).length;

    if (votesCast >= aliveCount) {
      this.engine.roundManager.tallyCensure(s, roomId);
    } else {
      this.engine.broadcastState(roomId);
    }
  }

  private aiSnapVolunteer(s: GameState, roomId: string): void {
    if (!s.snapElectionVolunteers) s.snapElectionVolunteers = [];
    const aiPlayers = s.players.filter((p) => p.isAI && p.isAlive);
    for (const ai of aiPlayers) {
      if ((ai.role === 'Overseer' || Math.random() > 0.7) && !s.snapElectionVolunteers.includes(ai.id)) {
        s.snapElectionVolunteers.push(ai.id);
      }
    }
    this.engine.broadcastState(roomId);
  }

  // ---------------------------------------------------------------------------
  // Chat helpers (public — used by RoundManager and TitleRoleResolver)
  // ---------------------------------------------------------------------------

  postAIChat(
    state: GameState,
    ai: Player,
    lines: readonly string[],
    targetName?: string
  ): void {
    let text = lines[Math.floor(Math.random() * lines.length)];
    if (targetName) text = text.replace('{name}', targetName.replace(' (AI)', ''));
    
    if (state.chatBlackout) {
      if (!state.chatBlackoutBuffer) state.chatBlackoutBuffer = [];
      state.chatBlackoutBuffer.push({
        senderId: ai.id,
        senderName: ai.name,
        text,
        timestamp: Date.now(),
      });
    } else {
      state.messages.push({ sender: ai.name, text, timestamp: Date.now(), type: 'text' });
      if (state.messages.length > 50) state.messages.shift();
    }
  }

  triggerAIReactions(
    state: GameState,
    roomId: string,
    type: 'nomination' | 'enactment' | 'failed_vote',
    context?: { targetId?: string }
  ): void {
    const ai = state.players.filter((p) => p.isAI && p.isAlive);
    if (ai.length === 0) return;

    const count = Math.random() > 0.7 ? 2 : 1;
    const commentators: Player[] = (shuffle([...ai]) as Player[]).slice(0, count);

    for (const c of commentators) {
      setTimeout(
        () => {
          const st = this.engine.rooms.get(roomId);
          if (!st || st.isPaused) return;
          let lines: readonly string[] = CHAT.banter;

          if (type === 'nomination' && context?.targetId) {
            const target = st.players.find((p) => p.id === context.targetId);
            if (target) {
              if (c.id === target.id) {
                lines = CHAT.defendingSelf;
              } else {
                const susp = getSuspicion(c, target.id);
                const isTeam =
                  c.role !== 'Civil' && (target.role === 'State' || target.role === 'Overseer');
                if (susp > 0.75 && !isTeam) lines = CHAT.highSuspicion;
                else if (susp > 0.55 && !isTeam) lines = CHAT.suspiciousNominee;
                else if (susp < 0.25 || isTeam) lines = CHAT.praisingCivil;
              }
              this.postAIChat(st, c, lines, target.name);
            }
          } else if (type === 'failed_vote') {
            this.postAIChat(st, c, CHAT.governmentFailed);
          }

          this.engine.broadcastState(roomId);
        },
        1000 + Math.random() * 2000
      );
    }
  }
}

