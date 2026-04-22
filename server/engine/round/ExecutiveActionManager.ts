import { GameState, Player } from '../../../shared/types';
import { addLog } from '../utils';
import { getExecutiveAction } from '../../game/gameRules';
import { updateSuspicionFromInvestigation } from '../../game/suspicion';

export class ExecutiveActionManager {
  constructor(private readonly round: any) {}

  async apply(s: GameState, roomId: string, targetId: string): Promise<void> {
    const action = getExecutiveAction(s);
    if (action === 'None') return;

    const president = s.players.find((p) => p.isPresident);
    if (!president || president.hasActed) return;
    president.hasActed = true;

    const target = s.players.find((p) => p.id === targetId);
    if (action !== 'PolicyPeek' && (!target || !target.isAlive || target.id === president.id)) return;

    switch (action) {
      case 'Investigate': if (target) {
        const result = target.role === 'Civil' ? 'Civil' : 'State';
        addLog(s, `${president.name} investigated ${target.name}.`);
        updateSuspicionFromInvestigation(s, president.id, target.id, result);
        
        if (president.socketId) {
          this.round.engine.io.to(president.socketId).emit('investigationResult', { 
            targetName: target.name, 
            role: result 
          });
        }
        this.round.nextRound(s, roomId, true);
        break;
      }
      case 'SpecialElection': if (target) {
        addLog(s, `${president.name} called a Special Election for ${target.name}.`);
        s.lastPresidentIdx = s.presidentIdx;
        s.presidentIdx = s.players.findIndex((p) => p.id === target.id);
        this.round.nextRound(s, roomId, true, true);
        break;
      }
      case 'Execution': if (target) {
        target.isAlive = false;
        addLog(s, `${president.name} executed ${target.name}!`);
        if (target.role === 'Overseer') {
          await this.round.engine.matchCloser.endGame(s, roomId, 'Civil', 'THE OVERSEER HAS BEEN EXECUTED');
          return;
        }
        this.round.nextRound(s, roomId, true);
        break;
      }
      case 'PolicyPeek': {
        const top3 = s.deck.slice(0, 3);
        if (president.socketId) {
          this.round.engine.io.to(president.socketId).emit('policyPeekResult', top3);
        }
        addLog(s, `${president.name} peeked at the top directives.`);
        s.peekDeclarationPending = true;
        this.round.engine.broadcastState(roomId);

        if (president.isAI) {
          // AI declares immediately
          this.round.legislative.autoDeclareMissing(s, roomId, true);
        } else {
          // Human gets a timer
          this.round.startActionTimer(roomId);
          this.round.legislative.scheduleAutoDeclarations(s, roomId);
        }
        break;
      }
      default:
        this.round.nextRound(s, roomId, true);
    }
  }
}

