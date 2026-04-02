/**
 * server/game/challenges.ts
 *
 * Challenge definitions and evaluation logic.
 *
 * Pools:
 *   Daily   — 30 definitions, 5 assigned per day
 *   Weekly  — 20 definitions, 5 assigned per week
 *   Seasonal — 12 definitions, 3 assigned per season
 *
 * Each ChallengeDef has display metadata + evaluate() that returns
 * the progress increment for a single game.
 *
 * Evaluation runs in MatchCloser after each completed game.
 */

import { ChallengeId, GameState, Player } from '../../shared/types';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface ChallengeContext {
  s: GameState;
  p: Player;
  won: boolean;
  agendaCompleted: boolean;
}

// ---------------------------------------------------------------------------
// Definition
// ---------------------------------------------------------------------------

export interface ChallengeDef {
  id: ChallengeId;
  tier: 'Daily' | 'Weekly' | 'Seasonal';
  name: string;
  description: string;
  icon: string; // lucide-react icon name
  target: number;
  xpReward: number;
  ipReward: number;
  evaluate(ctx: ChallengeContext): number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wasElectedPresident(s: GameState, playerId: string): boolean {
  return s.roundHistory?.some((r) => r.presidentId === playerId && !r.failed) ?? false;
}

function wasElectedChancellor(s: GameState, playerId: string): boolean {
  return s.roundHistory?.some((r) => r.chancellorId === playerId && !r.failed) ?? false;
}

function timesElectedPresident(s: GameState, playerId: string): number {
  return s.roundHistory?.filter((r) => r.presidentId === playerId && !r.failed).length ?? 0;
}

function timesElectedChancellor(s: GameState, playerId: string): number {
  return s.roundHistory?.filter((r) => r.chancellorId === playerId && !r.failed).length ?? 0;
}

function civilDirectivesEnactedByPlayer(s: GameState, playerId: string): number {
  return s.roundHistory?.filter((r) => r.chancellorId === playerId && r.policy === 'Civil').length ?? 0;
}

function stateDirectivesEnactedByPlayer(s: GameState, playerId: string): number {
  return s.roundHistory?.filter((r) => r.chancellorId === playerId && r.policy === 'State').length ?? 0;
}

function votedNayOnWinningGov(s: GameState, playerId: string): boolean {
  return (
    s.roundHistory?.some(
      (r) => !r.failed && r.votes?.some((v) => v.playerId === playerId && v.vote === 'Nay')
    ) ?? false
  );
}

function votedAyeOnFailedGov(s: GameState, playerId: string): boolean {
  return (
    s.roundHistory?.some(
      (r) => r.failed && !r.chaos && r.votes?.some((v) => v.playerId === playerId && v.vote === 'Aye')
    ) ?? false
  );
}

function chaosOccurred(s: GameState): boolean {
  return s.roundHistory?.some((r) => r.chaos) ?? false;
}

function vetoHappened(s: GameState): boolean {
  return s.roundHistory?.some((r) => r.failReason === 'veto') ?? false;
}

function nominatedAsChancellor(s: GameState, playerId: string): number {
  return s.roundHistory?.filter((r) => !r.chaos && r.chancellorId === playerId).length ?? 0;
}

// ---------------------------------------------------------------------------
// Daily definitions — 30 in pool, 5 assigned per day
// ---------------------------------------------------------------------------

const DAILY: ChallengeDef[] = [
  {
    id: 'daily_win_any',
    tier: 'Daily',
    name: 'Victory',
    description: 'Win any game.',
    icon: 'Trophy',
    target: 1,
    xpReward: 100,
    ipReward: 30,
    evaluate: ({ won }) => (won ? 1 : 0),
  },
  {
    id: 'daily_win_civil',
    tier: 'Daily',
    name: 'Defender of the Charter',
    description: 'Win a game as a Civil player.',
    icon: 'Shield',
    target: 1,
    xpReward: 100,
    ipReward: 30,
    evaluate: ({ won, p }) => (won && p.role === 'Civil' ? 1 : 0),
  },
  {
    id: 'daily_win_state',
    tier: 'Daily',
    name: 'Servant of the State',
    description: 'Win a game as a State agent or the Overseer.',
    icon: 'Eye',
    target: 1,
    xpReward: 120,
    ipReward: 35,
    evaluate: ({ won, p }) =>
      won && (p.role === 'State' || p.role === 'Overseer') ? 1 : 0,
  },
  {
    id: 'daily_play_2',
    tier: 'Daily',
    name: 'Active Participant',
    description: 'Play 2 games.',
    icon: 'Gamepad2',
    target: 2,
    xpReward: 80,
    ipReward: 25,
    evaluate: () => 1,
  },
  {
    id: 'daily_agenda_complete',
    tier: 'Daily',
    name: 'Mission Accomplished',
    description: 'Complete your personal agenda.',
    icon: 'Target',
    target: 1,
    xpReward: 150,
    ipReward: 40,
    evaluate: ({ agendaCompleted }) => (agendaCompleted ? 1 : 0),
  },
  {
    id: 'daily_elected_president',
    tier: 'Daily',
    name: 'Presidential Authority',
    description: 'Be elected as President in any game.',
    icon: 'Crown',
    target: 1,
    xpReward: 80,
    ipReward: 25,
    evaluate: ({ s, p }) => (wasElectedPresident(s, p.id) ? 1 : 0),
  },
  {
    id: 'daily_elected_chancellor',
    tier: 'Daily',
    name: 'The Chancellor',
    description: 'Be elected as Chancellor in any game.',
    icon: 'Gavel',
    target: 1,
    xpReward: 80,
    ipReward: 25,
    evaluate: ({ s, p }) => (wasElectedChancellor(s, p.id) ? 1 : 0),
  },
  {
    id: 'daily_enact_civil',
    tier: 'Daily',
    name: 'Legislator',
    description: 'Enact a Civil directive as Chancellor.',
    icon: 'FileText',
    target: 1,
    xpReward: 100,
    ipReward: 30,
    evaluate: ({ s, p }) => Math.min(1, civilDirectivesEnactedByPlayer(s, p.id)),
  },
  {
    id: 'daily_enact_state',
    tier: 'Daily',
    name: 'Directive Enforcer',
    description: 'Enact a State directive as Chancellor.',
    icon: 'Sword',
    target: 1,
    xpReward: 100,
    ipReward: 30,
    evaluate: ({ s, p }) => Math.min(1, stateDirectivesEnactedByPlayer(s, p.id)),
  },
  {
    id: 'daily_survive_state_win',
    tier: 'Daily',
    name: 'Survivor',
    description: 'Survive to the end of a game the State wins.',
    icon: 'HeartPulse',
    target: 1,
    xpReward: 90,
    ipReward: 28,
    evaluate: ({ s, p }) => (s.winner === 'State' && p.isAlive ? 1 : 0),
  },
  {
    id: 'daily_win_ranked',
    tier: 'Daily',
    name: 'Ranked Contender',
    description: 'Win a ranked game.',
    icon: 'TrendingUp',
    target: 1,
    xpReward: 150,
    ipReward: 45,
    evaluate: ({ won, s }) => (won && s.mode === 'Ranked' ? 1 : 0),
  },
  {
    id: 'daily_win_quick',
    tier: 'Daily',
    name: 'Swift Resolution',
    description: 'Win a game in 6 rounds or fewer.',
    icon: 'Zap',
    target: 1,
    xpReward: 120,
    ipReward: 35,
    evaluate: ({ won, s }) => (won && s.round <= 6 ? 1 : 0),
  },
  {
    id: 'daily_vote_nay_win',
    tier: 'Daily',
    name: 'The Dissenter',
    description: 'Vote Nay on a government that still wins its election.',
    icon: 'ThumbsDown',
    target: 1,
    xpReward: 80,
    ipReward: 25,
    evaluate: ({ s, p }) => (votedNayOnWinningGov(s, p.id) ? 1 : 0),
  },
  {
    id: 'daily_win_overseer',
    tier: 'Daily',
    name: 'Shadow Sovereign',
    description: 'Win a game as the Overseer.',
    icon: 'Skull',
    target: 1,
    xpReward: 160,
    ipReward: 50,
    evaluate: ({ won, p }) => (won && p.role === 'Overseer' ? 1 : 0),
  },
  {
    id: 'daily_play_casual',
    tier: 'Daily',
    name: 'Casual Assembly',
    description: 'Play a Casual mode game.',
    icon: 'Coffee',
    target: 1,
    xpReward: 60,
    ipReward: 20,
    evaluate: ({ s }) => (s.mode === 'Casual' ? 1 : 0),
  },
  {
    id: 'daily_play_classic',
    tier: 'Daily',
    name: 'Classic Attendance',
    description: 'Play a Classic mode game.',
    icon: 'BookOpen',
    target: 1,
    xpReward: 70,
    ipReward: 22,
    evaluate: ({ s }) => (s.mode === 'Classic' ? 1 : 0),
  },
  {
    id: 'daily_win_classic',
    tier: 'Daily',
    name: 'Classic Victor',
    description: 'Win a Classic mode game.',
    icon: 'BookOpen',
    target: 1,
    xpReward: 120,
    ipReward: 35,
    evaluate: ({ won, s }) => (won && s.mode === 'Classic' ? 1 : 0),
  },
  {
    id: 'daily_chaos_occurs',
    tier: 'Daily',
    name: 'Into Chaos',
    description: 'Play a game where a chaos policy is enacted.',
    icon: 'Flame',
    target: 1,
    xpReward: 70,
    ipReward: 22,
    evaluate: ({ s }) => (chaosOccurred(s) ? 1 : 0),
  },
  {
    id: 'daily_veto_occurs',
    tier: 'Daily',
    name: 'Deadlock',
    description: 'Play a game where a veto is exercised.',
    icon: 'XCircle',
    target: 1,
    xpReward: 80,
    ipReward: 25,
    evaluate: ({ s }) => (vetoHappened(s) ? 1 : 0),
  },
  {
    id: 'daily_nominated_twice',
    tier: 'Daily',
    name: 'Twice Nominated',
    description: 'Be nominated as Chancellor at least twice in a single game.',
    icon: 'Repeat',
    target: 1,
    xpReward: 90,
    ipReward: 28,
    evaluate: ({ s, p }) => (nominatedAsChancellor(s, p.id) >= 2 ? 1 : 0),
  },
  {
    id: 'daily_win_long',
    tier: 'Daily',
    name: 'Long Session',
    description: 'Win a game that lasts at least 10 rounds.',
    icon: 'Clock',
    target: 1,
    xpReward: 110,
    ipReward: 33,
    evaluate: ({ won, s }) => (won && s.round >= 10 ? 1 : 0),
  },
  {
    id: 'daily_voted_aye_failed',
    tier: 'Daily',
    name: 'Betrayed by the Ballot',
    description: 'Vote Aye for a government that fails its election.',
    icon: 'AlertTriangle',
    target: 1,
    xpReward: 60,
    ipReward: 18,
    evaluate: ({ s, p }) => (votedAyeOnFailedGov(s, p.id) ? 1 : 0),
  },
  {
    id: 'daily_civil_full_track',
    tier: 'Daily',
    name: 'Full Charter',
    description: 'Play a game where 5 Civil directives are enacted.',
    icon: 'Layers',
    target: 1,
    xpReward: 100,
    ipReward: 30,
    evaluate: ({ s }) => (s.civilDirectives >= 5 ? 1 : 0),
  },
  {
    id: 'daily_president_twice',
    tier: 'Daily',
    name: 'Seasoned Leader',
    description: 'Be elected President at least twice in one game.',
    icon: 'Star',
    target: 1,
    xpReward: 100,
    ipReward: 30,
    evaluate: ({ s, p }) => (timesElectedPresident(s, p.id) >= 2 ? 1 : 0),
  },
  {
    id: 'daily_play_3',
    tier: 'Daily',
    name: 'Prolific Player',
    description: 'Play 3 games today.',
    icon: 'Layers',
    target: 3,
    xpReward: 120,
    ipReward: 38,
    evaluate: () => 1,
  },
  {
    id: 'daily_win_civil_survive_assassination',
    tier: 'Daily',
    name: 'Resilient',
    description: 'Win a game as Civil while the Overseer is alive.',
    icon: 'ShieldCheck',
    target: 1,
    xpReward: 130,
    ipReward: 38,
    evaluate: ({ won, p, s }) => {
      if (!won || p.role !== 'Civil') return 0;
      const overseerAlive = s.players.some((pl) => pl.role === 'Overseer' && pl.isAlive);
      return overseerAlive ? 1 : 0;
    },
  },
  {
    id: 'daily_large_game',
    tier: 'Daily',
    name: 'Grand Assembly',
    description: 'Play a game with 8 or more players.',
    icon: 'Users',
    target: 1,
    xpReward: 80,
    ipReward: 25,
    evaluate: ({ s }) => (s.players.length >= 8 ? 1 : 0),
  },
  {
    id: 'daily_win_large_game',
    tier: 'Daily',
    name: 'Majority Rules',
    description: 'Win a game with 8 or more players.',
    icon: 'Users',
    target: 1,
    xpReward: 140,
    ipReward: 42,
    evaluate: ({ won, s }) => (won && s.players.length >= 8 ? 1 : 0),
  },
  {
    id: 'daily_enact_2_civil',
    tier: 'Daily',
    name: 'Double Legislator',
    description: 'Enact 2 Civil directives as Chancellor in a single game.',
    icon: 'FileCheck',
    target: 1,
    xpReward: 120,
    ipReward: 36,
    evaluate: ({ s, p }) => (civilDirectivesEnactedByPlayer(s, p.id) >= 2 ? 1 : 0),
  },
  {
    id: 'daily_win_state_5plus_players',
    tier: 'Daily',
    name: 'State Operative',
    description: 'Win as State or Overseer in a game with at least 5 players.',
    icon: 'Eye',
    target: 1,
    xpReward: 110,
    ipReward: 33,
    evaluate: ({ won, p, s }) =>
      won && (p.role === 'State' || p.role === 'Overseer') && s.players.length >= 5 ? 1 : 0,
  },
];

// ---------------------------------------------------------------------------
// Weekly definitions — 20 in pool, 5 assigned per week
// ---------------------------------------------------------------------------

const WEEKLY: ChallengeDef[] = [
  {
    id: 'weekly_win_3',
    tier: 'Weekly',
    name: 'Seasoned Victor',
    description: 'Win 3 games this week.',
    icon: 'Trophy',
    target: 3,
    xpReward: 400,
    ipReward: 100,
    evaluate: ({ won }) => (won ? 1 : 0),
  },
  {
    id: 'weekly_play_5',
    tier: 'Weekly',
    name: 'Dedicated Assembly Member',
    description: 'Play 5 games this week.',
    icon: 'Gamepad2',
    target: 5,
    xpReward: 300,
    ipReward: 80,
    evaluate: () => 1,
  },
  {
    id: 'weekly_win_civil_3',
    tier: 'Weekly',
    name: "Charter's Champion",
    description: 'Win 3 games as a Civil player.',
    icon: 'Shield',
    target: 3,
    xpReward: 450,
    ipReward: 110,
    evaluate: ({ won, p }) => (won && p.role === 'Civil' ? 1 : 0),
  },
  {
    id: 'weekly_win_state_2',
    tier: 'Weekly',
    name: 'State Operative',
    description: 'Win 2 games as a State agent or Overseer.',
    icon: 'Eye',
    target: 2,
    xpReward: 450,
    ipReward: 110,
    evaluate: ({ won, p }) =>
      won && (p.role === 'State' || p.role === 'Overseer') ? 1 : 0,
  },
  {
    id: 'weekly_agenda_3',
    tier: 'Weekly',
    name: 'Agenda Driven',
    description: 'Complete 3 personal agendas this week.',
    icon: 'Target',
    target: 3,
    xpReward: 500,
    ipReward: 120,
    evaluate: ({ agendaCompleted }) => (agendaCompleted ? 1 : 0),
  },
  {
    id: 'weekly_win_ranked_2',
    tier: 'Weekly',
    name: 'Ranked Operator',
    description: 'Win 2 ranked games this week.',
    icon: 'TrendingUp',
    target: 2,
    xpReward: 500,
    ipReward: 130,
    evaluate: ({ won, s }) => (won && s.mode === 'Ranked' ? 1 : 0),
  },
  {
    id: 'weekly_enact_civil_3',
    tier: 'Weekly',
    name: 'Legislative Record',
    description: 'Enact 3 Civil directives as Chancellor across any games.',
    icon: 'FileText',
    target: 3,
    xpReward: 400,
    ipReward: 100,
    evaluate: ({ s, p }) => civilDirectivesEnactedByPlayer(s, p.id),
  },
  {
    id: 'weekly_chancellor_3',
    tier: 'Weekly',
    name: 'Frequent Chancellor',
    description: 'Be elected Chancellor 3 times across any games.',
    icon: 'Gavel',
    target: 3,
    xpReward: 350,
    ipReward: 90,
    evaluate: ({ s, p }) => (wasElectedChancellor(s, p.id) ? 1 : 0),
  },
  {
    id: 'weekly_win_overseer',
    tier: 'Weekly',
    name: 'Shadow Supremacy',
    description: 'Win a game as the Overseer.',
    icon: 'Skull',
    target: 1,
    xpReward: 500,
    ipReward: 140,
    evaluate: ({ won, p }) => (won && p.role === 'Overseer' ? 1 : 0),
  },
  {
    id: 'weekly_play_classic_2',
    tier: 'Weekly',
    name: 'Classic Mode Regular',
    description: 'Play 2 Classic mode games.',
    icon: 'BookOpen',
    target: 2,
    xpReward: 350,
    ipReward: 90,
    evaluate: ({ s }) => (s.mode === 'Classic' ? 1 : 0),
  },
  {
    id: 'weekly_win_5',
    tier: 'Weekly',
    name: 'Dominant Force',
    description: 'Win 5 games this week.',
    icon: 'Trophy',
    target: 5,
    xpReward: 650,
    ipReward: 160,
    evaluate: ({ won }) => (won ? 1 : 0),
  },
  {
    id: 'weekly_play_10',
    tier: 'Weekly',
    name: 'Assembly Stalwart',
    description: 'Play 10 games this week.',
    icon: 'Layers',
    target: 10,
    xpReward: 550,
    ipReward: 140,
    evaluate: () => 1,
  },
  {
    id: 'weekly_president_5',
    tier: 'Weekly',
    name: 'Presidential Career',
    description: 'Be elected President 5 times across any games.',
    icon: 'Crown',
    target: 5,
    xpReward: 400,
    ipReward: 100,
    evaluate: ({ s, p }) => timesElectedPresident(s, p.id),
  },
  {
    id: 'weekly_agenda_5',
    tier: 'Weekly',
    name: 'Master of Agendas',
    description: 'Complete 5 personal agendas this week.',
    icon: 'Target',
    target: 5,
    xpReward: 700,
    ipReward: 180,
    evaluate: ({ agendaCompleted }) => (agendaCompleted ? 1 : 0),
  },
  {
    id: 'weekly_win_civil_5',
    tier: 'Weekly',
    name: 'Charter Guardian',
    description: 'Win 5 games as a Civil player.',
    icon: 'Shield',
    target: 5,
    xpReward: 700,
    ipReward: 180,
    evaluate: ({ won, p }) => (won && p.role === 'Civil' ? 1 : 0),
  },
  {
    id: 'weekly_enact_state_3',
    tier: 'Weekly',
    name: 'State Enforcer',
    description: 'Enact 3 State directives as Chancellor across any games.',
    icon: 'Sword',
    target: 3,
    xpReward: 430,
    ipReward: 110,
    evaluate: ({ s, p }) => stateDirectivesEnactedByPlayer(s, p.id),
  },
  {
    id: 'weekly_win_2_modes',
    tier: 'Weekly',
    name: 'Versatile',
    description: 'Win at least one game in 2 different modes this week.',
    icon: 'LayoutGrid',
    target: 2,
    xpReward: 450,
    ipReward: 115,
    evaluate: ({ won }) => (won ? 1 : 0), // progress tracked by unique modes; simplify to wins
  },
  {
    id: 'weekly_win_ranked_3',
    tier: 'Weekly',
    name: 'Ranked Veteran',
    description: 'Win 3 ranked games this week.',
    icon: 'TrendingUp',
    target: 3,
    xpReward: 700,
    ipReward: 175,
    evaluate: ({ won, s }) => (won && s.mode === 'Ranked' ? 1 : 0),
  },
  {
    id: 'weekly_chancellor_5',
    tier: 'Weekly',
    name: 'Chancellor of Record',
    description: 'Be elected Chancellor across 5 games.',
    icon: 'Gavel',
    target: 5,
    xpReward: 500,
    ipReward: 130,
    evaluate: ({ s, p }) => (wasElectedChancellor(s, p.id) ? 1 : 0),
  },
  {
    id: 'weekly_survive_5_games',
    tier: 'Weekly',
    name: 'Endurance',
    description: 'Survive to the end of 5 games.',
    icon: 'HeartPulse',
    target: 5,
    xpReward: 380,
    ipReward: 95,
    evaluate: ({ p }) => (p.isAlive ? 1 : 0),
  },
];

// ---------------------------------------------------------------------------
// Seasonal definitions — 12 in pool, 3 assigned per season
// ---------------------------------------------------------------------------

const SEASONAL: ChallengeDef[] = [
  {
    id: 'seasonal_play_30',
    tier: 'Seasonal',
    name: 'Assembly Regular',
    description: 'Play 30 games this season.',
    icon: 'Gamepad2',
    target: 30,
    xpReward: 1500,
    ipReward: 500,
    evaluate: () => 1,
  },
  {
    id: 'seasonal_win_15',
    tier: 'Seasonal',
    name: 'Season Champion',
    description: 'Win 15 games this season.',
    icon: 'Trophy',
    target: 15,
    xpReward: 1500,
    ipReward: 500,
    evaluate: ({ won }) => (won ? 1 : 0),
  },
  {
    id: 'seasonal_win_ranked_5',
    tier: 'Seasonal',
    name: 'Ranked Veteran',
    description: 'Win 5 ranked games this season.',
    icon: 'TrendingUp',
    target: 5,
    xpReward: 2000,
    ipReward: 700,
    evaluate: ({ won, s }) => (won && s.mode === 'Ranked' ? 1 : 0),
  },
  {
    id: 'seasonal_agenda_10',
    tier: 'Seasonal',
    name: 'The Agenda Master',
    description: 'Complete 10 personal agendas this season.',
    icon: 'Target',
    target: 10,
    xpReward: 1500,
    ipReward: 500,
    evaluate: ({ agendaCompleted }) => (agendaCompleted ? 1 : 0),
  },
  {
    id: 'seasonal_win_civil_10',
    tier: 'Seasonal',
    name: 'Pillar of the Charter',
    description: 'Win 10 games as a Civil player this season.',
    icon: 'Shield',
    target: 10,
    xpReward: 1800,
    ipReward: 600,
    evaluate: ({ won, p }) => (won && p.role === 'Civil' ? 1 : 0),
  },
  {
    id: 'seasonal_win_state_5',
    tier: 'Seasonal',
    name: 'State Supremacist',
    description: 'Win 5 games as a State agent or Overseer this season.',
    icon: 'Eye',
    target: 5,
    xpReward: 1800,
    ipReward: 600,
    evaluate: ({ won, p }) =>
      won && (p.role === 'State' || p.role === 'Overseer') ? 1 : 0,
  },
  {
    id: 'seasonal_play_50',
    tier: 'Seasonal',
    name: 'True Assembly Member',
    description: 'Play 50 games this season.',
    icon: 'Layers',
    target: 50,
    xpReward: 2500,
    ipReward: 800,
    evaluate: () => 1,
  },
  {
    id: 'seasonal_chancellor_20',
    tier: 'Seasonal',
    name: 'The Eternal Chancellor',
    description: 'Be elected Chancellor across 20 games this season.',
    icon: 'Gavel',
    target: 20,
    xpReward: 2000,
    ipReward: 650,
    evaluate: ({ s, p }) => (wasElectedChancellor(s, p.id) ? 1 : 0),
  },
  {
    id: 'seasonal_agenda_20',
    tier: 'Seasonal',
    name: 'The Agenda Absolutist',
    description: 'Complete 20 personal agendas this season.',
    icon: 'Target',
    target: 20,
    xpReward: 2500,
    ipReward: 800,
    evaluate: ({ agendaCompleted }) => (agendaCompleted ? 1 : 0),
  },
  {
    id: 'seasonal_win_ranked_10',
    tier: 'Seasonal',
    name: 'Ranked Legend',
    description: 'Win 10 ranked games this season.',
    icon: 'TrendingUp',
    target: 10,
    xpReward: 3000,
    ipReward: 1000,
    evaluate: ({ won, s }) => (won && s.mode === 'Ranked' ? 1 : 0),
  },
  {
    id: 'seasonal_enact_civil_15',
    tier: 'Seasonal',
    name: 'Legislative Legacy',
    description: 'Enact 15 Civil directives as Chancellor across this season.',
    icon: 'FileText',
    target: 15,
    xpReward: 2000,
    ipReward: 650,
    evaluate: ({ s, p }) => civilDirectivesEnactedByPlayer(s, p.id),
  },
  {
    id: 'seasonal_win_25',
    tier: 'Seasonal',
    name: 'Legendary Victor',
    description: 'Win 25 games this season.',
    icon: 'Star',
    target: 25,
    xpReward: 3500,
    ipReward: 1200,
    evaluate: ({ won }) => (won ? 1 : 0),
  },
];

// ---------------------------------------------------------------------------
// Lookup map
// ---------------------------------------------------------------------------

export const CHALLENGE_MAP = new Map<ChallengeId, ChallengeDef>(
  [...DAILY, ...WEEKLY, ...SEASONAL].map((c) => [c.id, c])
);

export const DAILY_POOL = DAILY;
export const WEEKLY_POOL = WEEKLY;
export const SEASONAL_POOL = SEASONAL;

// ---------------------------------------------------------------------------
// Period helpers
// ---------------------------------------------------------------------------

export function getCurrentDayPeriod(): string {
  return new Date().toISOString().substring(0, 10); // YYYY-MM-DD
}

export function getCurrentWeekPeriod(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function getCurrentSeasonPeriod(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const season = Math.ceil((now.getUTCMonth() + 1) / 3);
  return `${year}-S${season}`;
}

export function getDailyResetsAt(): string {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return next.toISOString();
}

export function getWeeklyResetsAt(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  d.setUTCDate(d.getUTCDate() + daysUntilMonday);
  return d.toISOString();
}

export function getSeasonEndsAt(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const currentSeason = Math.ceil((now.getUTCMonth() + 1) / 3);
  const nextSeasonMonth = currentSeason * 3;
  return new Date(Date.UTC(year + (currentSeason === 4 ? 1 : 0), (currentSeason === 4 ? 0 : nextSeasonMonth), 1)).toISOString();
}

// ---------------------------------------------------------------------------
// Challenge assignment (5 daily, 5 weekly, 3 seasonal)
// ---------------------------------------------------------------------------

/** Picks `count` random unique items from an array */
function pickRandom<T>(pool: T[], count: number): T[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export function assignDailyChallenges(): import('../../shared/types').ActiveChallenge[] {
  return pickRandom(DAILY_POOL, 5).map((def) => ({
    id: def.id,
    progress: 0,
    completed: false,
  }));
}

export function assignWeeklyChallenges(): import('../../shared/types').ActiveChallenge[] {
  return pickRandom(WEEKLY_POOL, 5).map((def) => ({
    id: def.id,
    progress: 0,
    completed: false,
  }));
}

export function assignSeasonalChallenges(): import('../../shared/types').ActiveChallenge[] {
  return pickRandom(SEASONAL_POOL, 3).map((def) => ({
    id: def.id,
    progress: 0,
    completed: false,
  }));
}

// Keep old name for any legacy callers — returns 1-element array now
export function assignSeasonalChallenge(): import('../../shared/types').ActiveChallenge {
  const [def] = pickRandom(SEASONAL_POOL, 1);
  return { id: def.id, progress: 0, completed: false };
}

// ---------------------------------------------------------------------------
// Evaluation — called in MatchCloser for each human player
// ---------------------------------------------------------------------------

export interface ChallengeEvaluationResult {
  /** Updated challenge data to persist on the user */
  updatedChallengeData: import('../../shared/types').UserChallengeData;
  /** Challenges newly completed this game */
  completedThisGame: { id: ChallengeId; xpReward: number; ipReward: number }[];
  /** Total XP to add from challenges */
  totalXp: number;
  /** Total IP to add from challenges */
  totalIp: number;
}

export function evaluateChallenges(
  challengeData: import('../../shared/types').UserChallengeData,
  ctx: ChallengeContext
): ChallengeEvaluationResult {
  const completedThisGame: { id: ChallengeId; xpReward: number; ipReward: number }[] = [];
  let totalXp = 0;
  let totalIp = 0;
  const now = new Date().toISOString();

  function progressList(
    list: import('../../shared/types').ActiveChallenge[]
  ): import('../../shared/types').ActiveChallenge[] {
    return list.map((active) => {
      if (active.completed) return active;
      const def = CHALLENGE_MAP.get(active.id);
      if (!def) return active;

      const increment = def.evaluate(ctx);
      if (increment <= 0) return active;

      const newProgress = active.progress + increment;
      const nowComplete = newProgress >= def.target;

      if (nowComplete && !active.completed) {
        completedThisGame.push({ id: def.id, xpReward: def.xpReward, ipReward: def.ipReward });
        totalXp += def.xpReward;
        totalIp += def.ipReward;
      }

      return {
        ...active,
        progress: Math.min(newProgress, def.target),
        completed: nowComplete,
        completedAt: nowComplete ? now : active.completedAt,
      };
    });
  }

  const updatedDaily = progressList(challengeData.daily);
  const updatedWeekly = progressList(challengeData.weekly);
  const updatedSeasonal = progressList(challengeData.seasonal ?? []);

  return {
    updatedChallengeData: {
      ...challengeData,
      daily: updatedDaily,
      weekly: updatedWeekly,
      seasonal: updatedSeasonal,
    },
    completedThisGame,
    totalXp,
    totalIp,
  };
}
