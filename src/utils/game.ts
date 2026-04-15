
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

export function extractBigPlays(gameState: GameState, t: any): BigPlay[] {
  const plays: BigPlay[] = [];
  const rh = gameState.roundHistory ?? [];

  // Assassination
  const assassin = gameState.players.find((p) => p.assassinKilledId);
  if (assassin) {
    const killed = gameState.players.find((p) => p.id === assassin.assassinKilledId);
    if (killed) {
      plays.push({
        icon: 'swords',
        text: t('game.debrief.plays.assassin', { 
          assassin: assassin.name.replace(' (AI)', ''), 
          killed: killed.name.replace(' (AI)', '') 
        }),
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
      text: executed.length === 1 
        ? t('game.debrief.plays.execution_one', { name: names }) 
        : t('game.debrief.plays.execution_many', { names }),
    });
  }

  // Chaos directives
  const chaosCount = rh.filter((r) => r.chaos).length;
  if (chaosCount > 0) {
    plays.push({
      icon: 'alert',
      text:
        chaosCount === 1
          ? t('game.debrief.plays.chaos_one')
          : t('game.debrief.plays.chaos_many', { count: chaosCount }),
    });
  }

  // Vetoes
  const vetoCount = rh.filter((r) => r.failReason === 'veto').length;
  if (vetoCount > 0) {
    plays.push({
      icon: 'shield',
      text:
        vetoCount === 1
          ? t('game.debrief.plays.veto_one')
          : t('game.debrief.plays.veto_many', { count: vetoCount }),
    });
  }

  // Marathon game
  if (gameState.round > 9) {
    plays.push({ icon: 'clock', text: t('game.debrief.plays.marathon', { count: gameState.round }) });
  }

  // Deadlocked race
  if (gameState.civilDirectives >= 4 && gameState.stateDirectives >= 4) {
    plays.push({
      icon: 'target',
      text: t('game.debrief.plays.deadlock'),
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
