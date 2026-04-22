import { GameState, Player, Policy } from '../../../shared/types';
import { addLog, ensureDeckHas } from '../utils';
import { updateSuspicionFromPolicy, updateSuspicionFromPolicyExpectation, updateSuspicionFromDeclarations } from '../../game/suspicion';
import { AI_WEIGHTS } from '../ai/aiWeights';
import { CHAT } from '../ai/aiChatPhrases';
import { getExecutiveAction } from '../../game/gameRules';

export class LegislativeManager {
  constructor(private readonly round: any) {}

  checkRoundEnd(s: GameState, roomId: string): void {
    if (s.phase !== 'Legislative_Chancellor' && !s.peekDeclarationPending) return;

    if (s.peekDeclarationPending) {
      if (s.declarations.some((d) => d.type === 'Peek')) {
        s.peekDeclarationPending = false;
        this.round.nextRound(s, roomId, true);
      }
      return;
    }
    
    // If the president is blocked (e.g. Veiled Proceedings), add a dummy 'blocked' declaration
    // so the UI knows to show the grey indicator and that declarations are 'complete'.
    if (s.presidentDeclarationBlocked && !s.declarations.some(d => d.type === 'President')) {
      const president = s.players.find((p) => p.isPresident);
      if (president) {
        s.declarations.push({
          playerId: president.id,
          playerName: president.name,
          type: 'President',
          civ: 0,
          sta: 0,
          timestamp: Date.now(),
          isBlocked: true,
        });
        this.round.engine.broadcastState(roomId);
      }
    }

    const presDecl = s.declarations.some((d) => d.type === 'President');
    const chanDecl = s.declarations.some((d) => d.type === 'Chancellor');
    if (presDecl && chanDecl) this.onBothDeclared(s, roomId);
  }

  runExecutiveAction(s: GameState, roomId: string): void {
    if (s.lastEnactedPolicy?.type !== 'State' || s.lastEnactedPolicy?.isChaos) {
      this.round.nextRound(s, roomId, true);
      return;
    }

    if (s.stateDirectives <= (s.lastExecutiveActionStateCount ?? 0)) {
      this.round.nextRound(s, roomId, true);
      return;
    }

    const action = getExecutiveAction(s);
    if (action === 'None') {
      this.round.nextRound(s, roomId, true);
    } else if (action === 'PolicyPeek') {
      s.lastExecutiveActionStateCount = s.stateDirectives;
      this.round.executive.apply(s, roomId, ''); // Execute peek immediately
    } else {
      s.lastExecutiveActionStateCount = s.stateDirectives;
      s.players.forEach((p: Player) => (p.hasActed = false)); 
      this.round.enterPhase(s, roomId, 'Executive_Action');
      addLog(s, `Presidential Executive Action required: ${action}`);
    }
  }

  startPresidentialPhase(s: GameState, roomId: string, president: Player): void {
    ensureDeckHas(s, 4);
    if (s.deck.length === 0) {
      addLog(s, '[ERROR] Deck empty after reshuffle. Skipping to next round.');
      this.round.nextRound(s, roomId, true);
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
      this.round.enterPhase(s, roomId, 'Legislative_President');
    } else {
      s.drawnPolicies = s.deck.splice(0, 3);
      this.round.enterPhase(s, roomId, 'Legislative_President');
    }
  }

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
      this.round.engine.broadcastState(roomId);
      return;
    }

    s.chancellorPolicies = [...s.drawnPolicies];
    s.chancellorSaw = [...s.chancellorPolicies];
    s.drawnPolicies = [];
    this.round.enterPhase(s, roomId, 'Legislative_Chancellor');
  }

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

    const player = s.players.find((p: Player) => p.id === chancellorId);
    if (!player || !player.isAlive || player.hasActed) return;
    player.hasActed = true;

    if (s.chancellorPolicies.length === 0) return;

    const played = s.chancellorPolicies.splice(idx, 1)[0];
    if (!played) return;

    s.discard.push(...s.chancellorPolicies);
    s.chancellorPolicies = [];
    this.enactPolicy(s, roomId, played, false, chancellorId);
    this.round.engine.broadcastState(roomId);
  }

  enactPolicy(
    s: GameState,
    roomId: string,
    policy: Policy,
    isChaos: boolean,
    playerId?: string
  ): void {
    s.lastEnactedPolicy = { type: policy, timestamp: Date.now(), playerId, trackerReady: false, isChaos };
    this.round.engine.broadcastState(roomId);

    setTimeout(async () => {
      const st = this.round.engine.rooms.get(roomId);
      if (!st || st.isPaused || st.phase === 'GameOver') return;

      const amount = (st.ironMandate && !isChaos) ? 2 : 1;
      if (policy === 'Civil') {
        st.civilDirectives += amount;
        addLog(st, `A Civil directive was enacted${st.ironMandate ? ' (Iron Mandate: x2)' : ''}.`);
        if (!isChaos && playerId) {
          const chancellor = st.players.find((p: Player) => p.id === playerId);
          if (chancellor) chancellor.civilEnactments = (chancellor.civilEnactments ?? 0) + 1;
        }
      } else {
        st.stateDirectives += amount;
        addLog(st, `A State directive was enacted${st.ironMandate ? ' (Iron Mandate: x2)' : ''}. Total: ${st.stateDirectives}`);
        if (st.stateDirectives >= 5) st.vetoUnlocked = true;
        if (!isChaos && playerId) {
          const chancellor = st.players.find((p: Player) => p.id === playerId);
          if (chancellor) chancellor.stateEnactments = (chancellor.stateEnactments ?? 0) + 1;
        }
      }

      updateSuspicionFromPolicy(st, policy);
      updateSuspicionFromPolicyExpectation(st, policy);

      if (await this.round.engine.matchCloser.checkVictory(st, roomId)) return;

      if (st.lastEnactedPolicy) {
        st.lastEnactedPolicy.trackerReady = true;
      }
      this.round.engine.broadcastState(roomId);

      if (isChaos) {
        this.captureRoundHistory(st, policy, true);
        this.round.nextRound(st, roomId, false);
      } else {
        this.scheduleAutoDeclarations(st, roomId);
      }
    }, 5000);
  }

  enactChaosPolicy(s: GameState, roomId: string): void {
    addLog(s, 'Election tracker hit 3 — Chaos directive enacted!');
    s.electionTracker = 0;
    s.players.forEach((p: Player) => {
      p.wasPresident = false;
      p.wasChancellor = false;
    });

    ensureDeckHas(s, 1);
    if (s.deck.length === 0) {
      addLog(s, '[ERROR] Deck empty. Skipping chaos policy.');
      this.round.nextRound(s, roomId, false);
      return;
    }

    const policy = s.deck.shift()!;
    this.round.resetPlayerActions(s);
    
    this.enactPolicy(s, roomId, policy, true);
    this.round.engine.broadcastState(roomId);
  }

  // ---------------------------------------------------------------------------
  // Declarations
  // ---------------------------------------------------------------------------

  scheduleAutoDeclarations(s: GameState, roomId: string): void {
    setTimeout(() => {
      const st = this.round.engine.rooms.get(roomId);
      if (!st || st.isPaused) return;
      if (st.phase !== 'Legislative_Chancellor' && !st.peekDeclarationPending) return;
      this.autoDeclareMissing(st, roomId);
    }, 1500);
  }

  autoDeclareMissing(s: GameState, roomId: string): void {
    if (s.phase === 'Legislative_Chancellor') {
      const president = s.players.find((p: Player) => p.isPresident);
      const chancellor = s.players.find((p: Player) => p.isChancellor);
      if (!president || !chancellor) return;

      const presDeclared = s.declarations.some((d) => d.type === 'President');
      const chanDeclared = s.declarations.some((d) => d.type === 'Chancellor');

      if (!presDeclared && (president.isAI || s.presidentTimedOut) && !s.presidentDeclarationBlocked)
        this.generateDeclaration(s, roomId, president, 'President');
      if (!chanDeclared && (chancellor.isAI || s.chancellorTimedOut))
        this.generateDeclaration(s, roomId, chancellor, 'Chancellor');
    } else if (s.peekDeclarationPending) {
      const president = s.players.find((p: Player) => p.isPresident);
      if (president && (president.isAI || s.presidentTimedOut)) {
        this.generateDeclaration(s, roomId, president, 'Peek');
      }
    }
  }

  generateDeclaration(
    s: GameState,
    roomId: string,
    player: Player,
    type: 'President' | 'Chancellor' | 'Peek'
  ): void {
    if (s.declarations.some((d) => d.playerId === player.id && d.type === type)) return;

    s.declarations = s.declarations.filter((d) => d.type !== type);

    if (type === 'Peek') {
      const actualPeek = s.deck.slice(0, 3);
      let civ = actualPeek.filter((p) => p === 'Civil').length;
      let sta = actualPeek.filter((p) => p === 'State').length;
      let isRefused = false;

      if (player.role !== 'Civil') {
        const roll = Math.random();
        if (roll < 0.15) {
          isRefused = true;
        } else if (roll < 0.4 && civ > 0) {
          civ--;
          sta++;
        }
      } else {
        if (Math.random() < 0.05) isRefused = true;
      }

      s.declarations.push({
        playerId: player.id,
        playerName: player.name,
        civ,
        sta,
        type: 'Peek',
        timestamp: Date.now(),
        isRefused,
      });

      addLog(s, `${player.name} declared what they saw during the Peek.`);
      this.round.engine.broadcastState(roomId);
      this.checkRoundEnd(s, roomId);
      return;
    }

    const saw = s.chancellorSaw ?? [];
    const drew = s.presidentSaw ?? [];
    let civ = saw.filter((p) => p === 'Civil').length;
    let sta = saw.filter((p) => p === 'State').length;
    let drewCiv = drew.filter((p) => p === 'Civil').length;
    let drewSta = drew.filter((p) => p === 'State').length;

    const presidentPlayer = s.players.find((p: Player) => p.isPresident);
    const presIsState = presidentPlayer?.role !== 'Civil';
    const chancellorPlayer = s.players.find((p: Player) => p.isChancellor);
    const chanIsState = chancellorPlayer?.role !== 'Civil';
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
      let lieCivil = false; // true = shift sta→civ (civil-direction lie)
      if (player.role !== 'Civil') {
        if (player.personality === 'Deceptive') lie = true;
        else if (player.personality === 'Aggressive')
          lie = Math.random() < AI_WEIGHTS.lying.Aggressive;
        else if (player.personality === 'Strategic')
          // Only start lying with conviction once State has meaningful presence
          lie = (s.stateDirectives ?? 0) >= 3;
        else if (player.personality === 'Chaotic')
          lie = Math.random() < AI_WEIGHTS.lying.Chaotic;
      } else if (player.role === 'Civil') {
        // Civil players occasionally lie to make themselves look more Civil
        // (deflecting suspicion when a State policy was enacted)
        if (enacted === 'State' && sta > 0 && Math.random() < 0.35) {
          lieCivil = true;
        }
      }
      if (lie && civ > 0) {
        if (enacted === 'Civil' && civ === 1) {
          // Do not lie — would be too obvious
        } else {
          civ--;
          sta++;
        }
      } else if (lieCivil && sta > 0) {
        sta--;
        civ++;
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

    this.round.engine.broadcastState(roomId);

    const presDecl = s.declarations.some((d) => d.type === 'President') || s.presidentDeclarationBlocked;
    const chanDecl = s.declarations.some((d) => d.type === 'Chancellor');
    if (presDecl && chanDecl) this.onBothDeclared(s, roomId);
  }

  onBothDeclared(s: GameState, roomId: string): void {
    if (s.phase !== 'Legislative_Chancellor') return;
    if (!s.lastEnactedPolicy) return;
    if (s.declarationsLogged) return; // prevent double-logging
    s.declarationsLogged = true;

    updateSuspicionFromDeclarations(s);

    const presFull = s.declarations.find((d) => d.type === 'President');
    if (presFull && !presFull.isBlocked) {
      const drewCiv = presFull.drewCiv ?? 0;
      const drewSta = presFull.drewSta ?? 0;
      const drewStr = (drewCiv + drewSta) > 0 ? ` (drew ${drewCiv}C/${drewSta}S)` : '';
      addLog(s, `${presFull.playerName} (President) declared passed ${presFull.civ}C/${presFull.sta}S.${drewStr}`);
    }

    const chanFull = s.declarations.find((d) => d.type === 'Chancellor');
    if (chanFull) {
      addLog(s, `${chanFull.playerName} (Chancellor) declared received ${chanFull.civ}C/${chanFull.sta}S.`);
    }

    const bothAI =
      s.players.find((p: Player) => p.isPresident)?.isAI &&
      s.players.find((p: Player) => p.isChancellor)?.isAI;
    if (!bothAI && s.lastEnactedPolicy?.type === 'State' && Math.random() > 0.4) {
      const pres = s.players.find((pl: Player) => pl.isPresident);
      const chan = s.players.find((pl: Player) => pl.isChancellor);
      const speaker = pres?.isAI ? pres : chan?.isAI ? chan : null;
      if (speaker) {
        setTimeout(() => {
          const st = this.round.engine.rooms.get(roomId);
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
          this.round.engine.aiEngine.postAIChat(st, speaker, lines);
          this.round.engine.broadcastState(roomId);
        }, 1200);
      }
    }

    if (!s.lastEnactedPolicy.historyCaptured) {
      this.captureRoundHistory(s, s.lastEnactedPolicy.type, false);
      s.lastEnactedPolicy.historyCaptured = true;
      s.lastGovernmentVotes = undefined;
    }

    this.round.engine.titleRoleResolver.runPostRoundTitleAbilities(s, roomId);
  }

  handleVetoResponse(s: GameState, roomId: string, player: Player, agree: boolean): void {
    if (agree) {
      addLog(s, `${player.name} (President) agreed to Veto. Both directives discarded.`);
      s.discard.push(...s.chancellorPolicies);
      s.chancellorPolicies = [];
      s.vetoRequested = false;

      if (!s.roundHistory) s.roundHistory = [];
      const vetoPresident = s.players.find((p: Player) => p.isPresident);
      const vetoChancellor = s.players.find((p: Player) => p.isChancellor);
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

      const auditor = s.players.find((p: Player) => p.titleRole === 'Auditor' && !p.titleUsed && p.isAlive);
      if (auditor) {
        s.titlePrompt = {
          playerId: auditor.id,
          role: 'Auditor',
          context: { role: 'Auditor', discardPile: s.discard.slice(-3) },
        };
        this.round.enterPhase(s, roomId, 'Auditor_Action');
      } else {
        this.round.nextRound(s, roomId, false);
      }
    } else {
      s.vetoRequested = false;
      s.vetoDenied = true;
      const vetoChancellor = s.players.find((p: Player) => p.isChancellor);
      if (vetoChancellor) vetoChancellor.hasActed = false;
      addLog(s, `${player.name} (President) denied the Veto. Chancellor must enact a directive.`);
      this.round.startActionTimer(roomId);
      this.round.engine.aiEngine.scheduleAITurns(s, roomId);
      this.round.engine.broadcastState(roomId);
    }
  }

  captureRoundHistory(s: GameState, policy: Policy, isChaos: boolean): void {
    if (!s.roundHistory) s.roundHistory = [];

    if (isChaos) {
      s.roundHistory.push({ round: s.round, presidentName: '—', chancellorName: '—', policy, chaos: true, votes: [] });
      return;
    }

    if (!s.lastGovernmentPresidentId || !s.lastGovernmentChancellorId) return;
    const pres = s.players.find((p: Player) => p.id === s.lastGovernmentPresidentId);
    const chan = s.players.find((p: Player) => p.id === s.lastGovernmentChancellorId);
    if (!pres || !chan) return;

    const presDecl = s.declarations.find((d) => d.type === 'President');
    const chanDecl = s.declarations.find((d) => d.type === 'Chancellor');
    const peekDecl = s.declarations.find((d) => d.type === 'Peek');
    const action = getExecutiveAction(s);

    const actualDrewCiv = s.presidentSaw?.filter(p => p === 'Civil').length ?? 0;
    const actualDrewSta = s.presidentSaw?.filter(p => p === 'State').length ?? 0;

    s.roundHistory.push({
      round: s.round,
      presidentName: pres.name,
      chancellorName: chan.name,
      presidentId: pres.id,
      chancellorId: chan.id,
      policy,
      votes: Object.entries(s.lastGovernmentVotes ?? {}).map(([pid, v]) => {
        const pl = s.players.find((p: Player) => p.id === pid);
        return { playerId: pid, playerName: pl?.name ?? pid, vote: v as 'Aye' | 'Nay' };
      }),
      presDeclaration: presDecl
        ? { civ: presDecl.civ, sta: presDecl.sta, drewCiv: presDecl.drewCiv ?? 0, drewSta: presDecl.drewSta ?? 0 }
        : undefined,
      chanDeclaration: chanDecl ? { civ: chanDecl.civ, sta: chanDecl.sta } : undefined,
      peekDeclaration: peekDecl ? { civ: peekDecl.civ, sta: peekDecl.sta, isRefused: peekDecl.isRefused } : undefined,
      actualDrewCiv,
      actualDrewSta,
      executiveAction: action !== 'None' ? action : undefined,
    });
  }
}

