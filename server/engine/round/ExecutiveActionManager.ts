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
    if (!target || !target.isAlive || target.id === president.id) return;

    switch (action) {
      case 'Investigate': {
        const result = target.role === 'Civil' ? 'Civil' : 'State';
        addLog(s, `${president.name} investigated ${target.name}.`);
        updateSuspicionFromInvestigation(s, president.id, target.id, result);
        
        // Emit to president
        if (president.socketId) {
          this.round.engine.io.to(president.socketId).emit('investigationResult', { 
            targetName: target.name, 
            role: result 
          });
        }
        break;
      }
      case 'SpecialElection':
        addLog(s, `${president.name} called a Special Election for ${target.name}.`);
        s.lastPresidentIdx = s.presidentIdx;
        s.presidentIdx = s.players.findIndex((p) => p.id === target.id);
        break;
      case 'Execution':
        target.isAlive = false;
        addLog(s, `${president.name} executed ${target.name}!`);
        if (target.role === 'Overseer') {
          await this.round.engine.matchCloser.endGame(s, roomId, 'Civil', 'THE OVERSEER HAS BEEN EXECUTED');
          return;
        }
        break;
      case 'PolicyPeek': {
        const top3 = s.deck.slice(0, 3);
        if (president.socketId) {
          this.round.engine.io.to(president.socketId).emit('policyPeekResult', top3);
        }
        addLog(s, `${president.name} peeked at the top directives.`);
        break;
      }
    }

    this.round.nextRound(s, roomId, true, action === 'SpecialElection');
  }
}

