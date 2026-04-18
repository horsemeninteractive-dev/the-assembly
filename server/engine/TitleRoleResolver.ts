/**
 * engine/TitleRoleResolver.ts
 *
 * Owns all title ability logic:
 *   - Post-round sequencing (Auditor → Assassin → Handler)
 *   - Human-initiated and AI-initiated ability handling
 *   - Per-ability application (Assassin, Strategist, Broker, Handler, Auditor, Interdictor)
 *   - Declined-ability routing
 *   - Title assignment on game start
 */

import { GameState, Player, TitleRole, TitleAbilityData } from '../../shared/types';
import { shuffle } from '../utils';
import { CHAT } from './ai/aiChatPhrases';
import { addLog, ensureDeckHas } from './utils';
import type { IEngineCore } from './IEngineCore';

export type PostRoundContinuation = 'Archivist' | 'Auditor' | 'Assassin' | 'Handler';

export class TitleRoleResolver {
  constructor(private readonly engine: IEngineCore) {}

  // ---------------------------------------------------------------------------
  // Assignment (called from RoundManager.startGame)
  // ---------------------------------------------------------------------------

  assignTitleRoles(state: GameState, pool?: TitleRole[]): void {
    const n = state.players.length;
    const count = n <= 6 ? 2 : n <= 8 ? 3 : 4;
    
    // Default pool for Ranked/Casual matches (the original 6)
    const defaultPool: TitleRole[] = [
      'Auditor',
      'Interdictor',
      'Archivist',
      'Defector',
      'Quorum',
      'Cipher',
    ];

    // House mode can use all 10 roles if no custom pool is specified
    const fullPool: TitleRole[] = [
      ...defaultPool,
      'Assassin',
      'Strategist',
      'Broker',
      'Handler'
    ];

    const poolToUse = pool && pool.length > 0 ? pool : (state.mode === 'House' ? fullPool : defaultPool);
    const titles = shuffle<TitleRole>([...poolToUse]);
    const players = shuffle([...state.players]);
    const assignCount = Math.min(count, titles.length);
    
    for (let i = 0; i < assignCount; i++) {
      players[i].titleRole = titles[i];
      players[i].titleUsed = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Post-round ability sequencing
  // ---------------------------------------------------------------------------

  /**
   * After declarations, run title abilities in order: Auditor → Assassin → Handler.
   * Each ability sets titlePrompt and returns; resolution calls runExecutiveAction.
   */
  runPostRoundTitleAbilities(s: GameState, roomId: string): void {
    if (s.phase === 'GameOver') return;

    const archivist = s.players.find(
      (p) => p.titleRole === 'Archivist' && !p.titleUsed && p.isAlive
    );
    if (archivist) {
      s.titlePrompt = {
        playerId: archivist.id,
        role: 'Archivist',
        context: { role: 'Archivist' },
      };
      this.engine.enterPhase(s, roomId, 'Auditor_Action'); // Reusing Auditor_Action for Archivist overlay
      return;
    }

    const auditor = s.players.find((p) => p.titleRole === 'Auditor' && !p.titleUsed && p.isAlive);
    if (auditor) {
      s.titlePrompt = {
        playerId: auditor.id,
        role: 'Auditor',
        context: { role: 'Auditor', discardPile: s.discard.slice(-3) },
      };
      this.engine.enterPhase(s, roomId, 'Auditor_Action');
      return;
    }

    const president = s.players[s.presidentIdx];
    if (president.titleRole === 'Assassin' && !president.titleUsed && president.isAlive) {
      s.titlePrompt = {
        playerId: president.id,
        role: 'Assassin',
        context: { role: 'Assassin' },
        nextPhase: 'Handler_Action',
      };
      this.engine.enterPhase(s, roomId, 'Assassin_Action');
      return;
    }

    const handler = s.players.find((p) => p.titleRole === 'Handler' && !p.titleUsed && p.isAlive);
    if (handler) {
      s.titlePrompt = {
        playerId: handler.id,
        role: 'Handler',
        context: { role: 'Handler' },
        nextPhase: 'Nominate_Chancellor',
      };
      this.engine.enterPhase(s, roomId, 'Handler_Action');
      return;
    }

    this.engine.runExecutiveAction(s, roomId);
  }

  /** Continue post-round sequence starting after the given ability. */
  continuePostRoundAfter(s: GameState, roomId: string, after: PostRoundContinuation): void {
    if (s.phase === 'GameOver') return;

    if (after === 'Archivist') {
      const auditor = s.players.find((p) => p.titleRole === 'Auditor' && !p.titleUsed && p.isAlive);
      if (auditor) {
        s.titlePrompt = {
          playerId: auditor.id,
          role: 'Auditor',
          context: { role: 'Auditor', discardPile: s.discard.slice(-3) },
        };
        this.engine.enterPhase(s, roomId, 'Auditor_Action');
        return;
      }
    }

    if (after === 'Archivist' || after === 'Auditor') {
      const president = s.players[s.presidentIdx];
      if (president.titleRole === 'Assassin' && !president.titleUsed && president.isAlive) {
        s.titlePrompt = {
          playerId: president.id,
          role: 'Assassin',
          context: { role: 'Assassin' },
          nextPhase: 'Handler_Action',
        };
        this.engine.enterPhase(s, roomId, 'Assassin_Action');
        return;
      }
    }

    if (after === 'Archivist' || after === 'Auditor' || after === 'Assassin') {
      const handler = s.players.find(
        (p) => p.titleRole === 'Handler' && !p.titleUsed && p.isAlive
      );
      if (handler) {
        s.titlePrompt = {
          playerId: handler.id,
          role: 'Handler',
          context: { role: 'Handler' },
          nextPhase: 'Nominate_Chancellor',
        };
        this.engine.enterPhase(s, roomId, 'Handler_Action');
        return;
      }
    }

    this.engine.runExecutiveAction(s, roomId);
  }

  // ---------------------------------------------------------------------------
  // Human / AI trigger point
  // ---------------------------------------------------------------------------

  async handleTitleAbility(
    s: GameState,
    roomId: string,
    abilityData: TitleAbilityData
  ): Promise<void> {
    let prompt = s.titlePrompt;
    const data = abilityData as any; // Cast for union properties

    // Parallel roles (Cipher) can act without a server-side prompt
    if (!prompt && data.use && data.role === 'Cipher') {
      prompt = { 
        playerId: data.playerId || '', 
        role: 'Cipher', 
        context: { role: 'Cipher' } 
      };
    }

    if (!prompt) return;

    const player = s.players.find((p) => p.id === (prompt?.playerId || data.playerId));
    if (!player) {
      if (s.titlePrompt) s.titlePrompt = undefined;
      return;
    }

    if (s.titlePrompt && s.titlePrompt.role === prompt.role) {
      s.titlePrompt = undefined;
    }

    if (abilityData.use) {
      const activeRole = prompt.role;

      if (activeRole !== 'Cipher') {
        player.titleUsed = true;
      } else {
        player.cipherUsed = true;
      }
      
      this.engine.io.to(roomId).emit('powerUsed', { role: prompt.role });
      if (player.isAI) this.engine.aiEngine.postAIChat(s, player, CHAT.powerUsage);
      await this.applyTitleAbility(s, roomId, player, prompt.role, abilityData);
    } else {
      await this.onTitleAbilityDeclined(s, roomId, player, prompt.role);
    }

    this.engine.broadcastState(roomId);
  }

  // ---------------------------------------------------------------------------
  // Per-ability application
  // ---------------------------------------------------------------------------

  private async applyTitleAbility(
    s: GameState,
    roomId: string,
    player: Player,
    role: TitleRole,
    data: TitleAbilityData
  ): Promise<void> {
    switch (role) {
      case 'Assassin': {
        if (!data.use || data.role !== 'Assassin') break;
        const target = s.players.find((p) => p.id === data.targetId && p.isAlive);
        if (target) {
          target.isAlive = target.isPresident = target.isChancellor = false;
          target.isPresidentialCandidate = target.isChancellorCandidate = false;
          addLog(s, `${player.name} (Assassin) secretly executed ${target.name}.`);
          player.assassinKilledId = target.id;
          if (target.role === 'Overseer') {
            await this.engine.matchCloser.endGame(
              s,
              roomId,
              'Civil',
              'OVERSEER ASSASSINATED — CHARTER RESTORED'
            );
            return;
          }
        }
        this.continuePostRoundAfter(s, roomId, 'Assassin');
        break;
      }

      case 'Strategist': {
        ensureDeckHas(s, 4);
        s.drawnPolicies = s.deck.splice(0, 4);
        s.isStrategistAction = true;
        addLog(s, `${player.name} (Strategist) drew an extra directive (4 total).`);
        this.engine.enterPhase(s, roomId, 'Legislative_President');
        break;
      }

      case 'Broker': {
        const candidate = s.players.find((p) => p.isChancellorCandidate);
        if (candidate) {
          candidate.isChancellorCandidate = false;
          s.rejectedChancellorId = candidate.id;
          addLog(s, `${player.name} (Broker) rejected ${candidate.name} — re-nomination required.`);
        }
        const nextBroker = s.players.find(
          (p) => p.titleRole === 'Broker' && !p.titleUsed && p.isAlive && p.id !== player.id
        );
        if (nextBroker) {
          s.titlePrompt = {
            playerId: nextBroker.id,
            role: 'Broker',
            context: { role: 'Broker' },
            nextPhase: 'Voting',
          };
          this.engine.enterPhase(s, roomId, 'Nomination_Review');
        } else {
          this.engine.enterPhase(s, roomId, 'Nominate_Chancellor');
        }
        break;
      }

      case 'Handler': {
        if (s.presidentialOrder) {
          const curId = s.players[s.presidentIdx].id;
          const cur = s.presidentialOrder.indexOf(curId);
          const len = s.presidentialOrder.length;
          const i1Pos = (cur + 1) % len;
          const i2Pos = (cur + 2) % len;
          const i1Id = s.presidentialOrder[i1Pos];
          const i2Id = s.presidentialOrder[i2Pos];
          const i1Name = s.players.find((p) => p.id === i1Id)?.name ?? '?';
          const i2Name = s.players.find((p) => p.id === i2Id)?.name ?? '?';
          [s.presidentialOrder[i1Pos], s.presidentialOrder[i2Pos]] = [
            s.presidentialOrder[i2Pos],
            s.presidentialOrder[i1Pos],
          ];
          s.handlerSwapPending = 3;
          s.handlerSwapPositions = [i1Pos, i2Pos];
          addLog(
            s,
            `${player.name} (Handler) swapped ${i1Name} and ${i2Name} — ${i2Name} will be next President, followed by ${i1Name}.`
          );
        }
        this.continuePostRoundAfter(s, roomId, 'Handler');
        break;
      }

      case 'Auditor': {
        const last3 = s.discard.slice(-3);
        this.engine.io.to(player.socketId).emit('policyPeekResult', last3);
        addLog(s, `${player.name} (Auditor) peeked at the discard pile.`);
        this.continuePostRoundAfter(s, roomId, 'Auditor');
        break;
      }

      case 'Defector': {
        if (!data.use || data.role !== 'Defector') break;
        if (s.previousVotes && s.previousVotes[player.id]) {
          const oldVote = s.previousVotes[player.id];
          const newVote = (data as any).vote || (oldVote === 'Aye' ? 'Nay' : 'Aye');
          s.previousVotes[player.id] = newVote as 'Aye' | 'Nay';
          addLog(s, `The Defector secretly altered their vote.`);
        }
        // Resolving this prompt is handled in the ElectionManager loop
        break;
      }

      case 'Interdictor': {
        if (!data.use || data.role !== 'Interdictor') break;
        const president = s.players[s.presidentIdx];
        const target = s.players.find(
          (p) =>
            p.id === data.targetId &&
            p.isAlive &&
            p.id !== president.id &&
            p.id !== player.id
        );
        if (target) {
          s.detainedPlayerId = target.id;
          addLog(s, `${player.name} (Interdictor) detained ${target.name} for this round.`);
        }
        const nextInterdictor = s.players.find(
          (p) =>
            p.titleRole === 'Interdictor' &&
            !p.titleUsed &&
            p.isAlive &&
            p.id !== player.id
        );
        if (nextInterdictor) {
          s.titlePrompt = {
            playerId: nextInterdictor.id,
            role: 'Interdictor',
            context: { role: 'Interdictor' },
            nextPhase: 'Nominate_Chancellor',
          };
          this.engine.enterPhase(s, roomId, 'Nomination_Review');
        } else {
          this.engine.enterPhase(s, roomId, 'Nominate_Chancellor');
        }
        break;
      }

      case 'Archivist': {
        this.engine.io.to(player.socketId).emit('archivistResult', s.discard);
        addLog(s, `${player.name} (Archivist) reviewed the assembly records.`);
        this.continuePostRoundAfter(s, roomId, 'Archivist');
        break;
      }



      case 'Quorum': {
        s.isRevote = true;
        s.quorumRevotePending = false;
        addLog(s, `${player.name} (Quorum) called an emergency re-vote!`);
        this.engine.enterPhase(s, roomId, 'Voting');
        break;
      }

      case 'Cipher': {
        if (!data.use || data.role !== 'Cipher' || !data.message) break;
        // Broadcast anonymous message prominently
        s.activeCipherMessage = { text: data.message, timestamp: Date.now() };
        this.engine.io.to(roomId).emit('cipherMessage', { text: data.message });
        addLog(s, `[CIPHER DISPATCH]: "${data.message}"`);
        break;
      }
    }
  }

  private async onTitleAbilityDeclined(
    s: GameState,
    roomId: string,
    player: Player,
    role: TitleRole
  ): Promise<void> {
    switch (role) {
      case 'Strategist':
        ensureDeckHas(s, 3);
        s.drawnPolicies = s.deck.splice(0, 3);
        this.engine.enterPhase(s, roomId, 'Legislative_President');
        break;
      case 'Broker':
        this.engine.enterPhase(s, roomId, 'Voting');
        break;
      case 'Interdictor':
        this.engine.enterPhase(s, roomId, 'Nominate_Chancellor');
        break;
      case 'Assassin':
        this.continuePostRoundAfter(s, roomId, 'Assassin');
        break;
      case 'Handler':
        this.continuePostRoundAfter(s, roomId, 'Handler');
        break;
      case 'Auditor':
        this.continuePostRoundAfter(s, roomId, 'Auditor');
        break;
      case 'Archivist':
        this.continuePostRoundAfter(s, roomId, 'Archivist');
        break;
      case 'Defector':
        // If declined, result remains as is
        break;
      case 'Quorum':
        s.quorumRevotePending = false;
        await this.engine.roundManager.handleElectionFailureContinuation(s, roomId);
        break;
      case 'Cipher':
        // No action needed for decline in parallel flow
        break;
    }
  }
}

