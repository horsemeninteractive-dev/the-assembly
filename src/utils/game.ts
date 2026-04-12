
import { GameState, Role } from '../../shared/types';
import { Swords, Zap, AlertTriangle, Shield, Clock, Target } from 'lucide-react';
import React from 'react';

export interface BigPlay {
  icon: 'swords' | 'zap' | 'alert' | 'shield' | 'clock' | 'target';
  text: string;
}

export const BIG_PLAY_ICON: Record<BigPlay['icon'], any> = {
  swords: Swords,
  zap: Zap,
  alert: AlertTriangle,
  shield: Shield,
  clock: Clock,
  target: Target,
};

export function extractBigPlays(gameState: GameState): BigPlay[] {
  const plays: BigPlay[] = [];
  const rh = gameState.roundHistory ?? [];

  // Assassination
  const assassin = gameState.players.find((p) => p.assassinKilledId);
  if (assassin) {
    const killed = gameState.players.find((p) => p.id === assassin.assassinKilledId);
    if (killed) {
      plays.push({
        icon: 'swords',
        text: `${assassin.name.replace(' (AI)', '')} eliminated ${killed.name.replace(' (AI)', '')} as the Assassin`,
      });
    }
  }

  // Executive execution (player not alive, not via assassin)
  const assassinatedIds = new Set(
    gameState.players.filter((p) => p.assassinKilledId).map((p) => p.assassinKilledId!)
  );
  const executed = gameState.players.filter(
    (p) => !p.isAlive && !assassinatedIds.has(p.id) && !p.assassinKilledId
  );
  if (executed.length > 0) {
    const names = executed.map((p) => p.name.replace(' (AI)', '')).join(' and ');
    plays.push({
      icon: 'zap',
      text: `${names} ${executed.length === 1 ? 'was' : 'were'} executed by presidential decree`,
    });
  }

  // Chaos directives
  const chaosCount = rh.filter((r) => r.chaos).length;
  if (chaosCount > 0) {
    plays.push({
      icon: 'alert',
      text:
        chaosCount === 1
          ? 'A chaos directive was forced upon the Assembly'
          : `${chaosCount} chaos directives destabilised the Assembly`,
    });
  }

  // Vetoes
  const vetoCount = rh.filter((r) => r.failReason === 'veto').length;
  if (vetoCount > 0) {
    plays.push({
      icon: 'shield',
      text:
        vetoCount === 1
          ? 'The government invoked their veto power'
          : `The veto was exercised ${vetoCount} times`,
    });
  }

  // Marathon game
  if (gameState.round > 9) {
    plays.push({ icon: 'clock', text: `An epic ${gameState.round}-round battle of wills` });
  }

  // Deadlocked race
  if (gameState.civilDirectives >= 4 && gameState.stateDirectives >= 4) {
    plays.push({
      icon: 'target',
      text: 'Both factions held the Assembly in a knife-edge deadlock',
    });
  }

  return plays.slice(0, 4);
}

export function getFactionCounts(gameState: GameState) {
  const counts = { Civil: 0, State: 0, Overseer: 0 };
  gameState.players.forEach((p) => {
    if (p.role) counts[p.role]++;
  });
  return counts;
}
