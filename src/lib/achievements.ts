// ---------------------------------------------------------------------------
// Achievement definitions — shared between client and server.
// Keep this file free of server-only imports.
// ---------------------------------------------------------------------------

export type AchievementTier = 'Bronze' | 'Silver' | 'Gold';

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  tier: AchievementTier;
  xpReward: number;
  cpReward: number;
  /** Lucide icon name (string key) for rendering on the client */
  icon: string;
  /** Broad category for grouping in the UI */
  category: 'Milestone' | 'Role' | 'Title' | 'Gameplay';
}

// XP/IP per tier
const TIER_REWARDS: Record<AchievementTier, { xp: number; cp: number }> = {
  Bronze: { xp: 75,  cp: 15  },
  Silver: { xp: 200, cp: 40  },
  Gold:   { xp: 500, cp: 100 },
};

function def(
  id: string,
  name: string,
  description: string,
  tier: AchievementTier,
  icon: string,
  category: AchievementDef['category'],
): AchievementDef {
  const { xp, cp } = TIER_REWARDS[tier];
  return { id, name, description, tier, xpReward: xp, cpReward: cp, icon, category };
}

// ---------------------------------------------------------------------------
// The 25 achievements
// ---------------------------------------------------------------------------

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  // ── Milestone ────────────────────────────────────────────────────────────
  def('first_assembly',     'First Session',          'Play your first game.',                          'Bronze', 'Play',       'Milestone'),
  def('veteran',            'Seasoned Delegate',      'Play 25 games.',                                 'Silver', 'Shield',     'Milestone'),
  def('elder',              'Elder of the Assembly',  'Play 100 games.',                                'Gold',   'Crown',      'Milestone'),
  def('first_victory',      'For the Record',         'Win your first game.',                           'Bronze', 'Trophy',     'Milestone'),
  def('ten_wins',           'Proven Commander',       'Win 10 games.',                                  'Silver', 'Trophy',     'Milestone'),
  def('fifty_wins',         'Grand Champion',         'Win 50 games.',                                  'Gold',   'Trophy',     'Milestone'),

  // ── Role ─────────────────────────────────────────────────────────────────
  def('civil_first_win',    'Civil Servant',          'Win your first game as Civil.',                  'Bronze', 'Scale',      'Role'),
  def('civil_ten_wins',     'Charter Defender',       'Win 10 games as Civil.',                         'Silver', 'Scale',      'Role'),
  def('civil_twenty_wins',  'Guardian of the Charter','Win 20 games as Civil.',                         'Gold',   'Scale',      'Role'),
  def('state_first_win',    'Shadow Agent',           'Win your first game as State.',                  'Bronze', 'Eye',        'Role'),
  def('state_ten_wins',     'State Operative',        'Win 10 games as State.',                         'Silver', 'Eye',        'Role'),
  def('state_twenty_wins',  'Iron Fist',              'Win 20 games as State.',                         'Gold',   'Eye',        'Role'),
  def('overseer_played',    'The Architect',          'Play a game as the Overseer.',                   'Bronze', 'Fingerprint','Role'),
  def('overseer_win',       'Untouchable',            'Win a game as the Overseer.',                    'Gold',   'Fingerprint','Role'),

  // ── Title Role ───────────────────────────────────────────────────────────
  def('power_used',         'Cards on the Table',     'Use any title role ability.',                    'Bronze', 'Zap',        'Title'),
  def('assassins_mark',     "Assassin's Mark",        'Execute a player using the Assassin ability.',   'Silver', 'Crosshair',  'Title'),
  def('overseer_hunter',    "Overseer's End",         'Kill the Overseer as the Assassin.',             'Gold',   'Crosshair',  'Title'),

  // ── Gameplay ─────────────────────────────────────────────────────────────
  def('agenda_first',       'Hidden Agenda',          'Complete a personal agenda.',                    'Bronze', 'Target',     'Gameplay'),
  def('agenda_ten',         'Agenda Master',          'Complete 10 personal agendas.',                  'Silver', 'Target',     'Gameplay'),
  def('agenda_twentyfive',  'Master Tactician',       'Complete 25 personal agendas.',                  'Gold',   'Target',     'Gameplay'),
  def('first_kill',         'Executive Decision',     'Execute a player as President.',                 'Bronze', 'Skull',      'Gameplay'),
  def('five_kills',         'Purge',                  'Execute 5 players across all games.',            'Silver', 'Skull',      'Gameplay'),
  def('clean_sweep',        'Clean Sweep',            'Win a game without a single State directive.',   'Silver', 'Sparkles',   'Gameplay'),
  def('long_game',          'War of Attrition',       'Survive a game that reaches round 12.',          'Bronze', 'Clock',      'Gameplay'),
  def('landslide',          'Landslide',              'Win an election where every player votes Aye.',  'Bronze', 'CheckCircle','Gameplay'),
];

/** Lookup by id */
export const ACHIEVEMENT_MAP = new Map<string, AchievementDef>(
  ACHIEVEMENT_DEFS.map(a => [a.id, a])
);
