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

import { GameState, Player, TitleRole, TitleAbilityData } from '../../src/types.ts';
import { shuffle } from '../utils.ts';
import { CHAT } from '../aiChatPhrases.ts';
import { addLog, ensureDeckHas } from './utils.ts';
import type { IEngineCore } from './IEngineCore.ts';

export type PostRoundContinuation = 'Auditor' | 'Assassin' | 'Handler';

export class TitleRoleResolver {
  constructor(private readonly engine: IEngineCore) {}

  // ---------------------------------------------------------------------------
  // Assignment (called from RoundManager.startGame)
  // ---------------------------------------------------------------------------

  assignTitleRoles(state: GameState): void {
    const n = state.players.length;
    const count = n <= 6 ? 2 : n <= 8 ? 3 : 4;
    const titles = shuffle<TitleRole>([
      'Assassin',
      'Strategist',
      'Broker',
      'Handler',
      'Auditor',
      'Interdictor',
    ]);
    const players = shuffle([...state.players]);
    for (let i = 0; i < count; i++) {
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

    if (after === 'Auditor') {
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

    if (after === 'Auditor' || after === 'Assassin') {
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
    const prompt = s.titlePrompt;
    if (!prompt) return;

    const player = s.players.find((p) => p.id === prompt.playerId);
    if (!player) {
      s.titlePrompt = undefined;
      return;
    }

    s.titlePrompt = undefined;

    if (abilityData.use) {
      player.titleUsed = true;
      this.engine.io.to(roomId).emit('powerUsed', { role: prompt.role });
      if (player.isAI) this.engine.aiEngine.postAIChat(s, player, CHAT.powerUsage);
      await this.applyTitleAbility(s, roomId, player, prompt.role, abilityData);
    } else {
      this.onTitleAbilityDeclined(s, roomId, player, prompt.role);
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
    }
  }

  private onTitleAbilityDeclined(
    s: GameState,
    roomId: string,
    player: Player,
    role: TitleRole
  ): void {
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
    }
  }
}
