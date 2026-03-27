// ─── Rank Tier System ────────────────────────────────────────────────────────

export interface RankTier {
  name: string;
  minElo: number;
  maxElo: number;
  color: string; // Tailwind text colour class
  bg: string; // Tailwind bg colour class
  border: string; // Tailwind border colour class
  icon: string; // Emoji icon
  roman: string; // Subdivision (I / II / III) — computed per ELO
}

const TIERS: Omit<RankTier, 'roman'>[] = [
  {
    name: 'Bronze',
    minElo: 0,
    maxElo: 999,
    color: 'text-amber-700',
    bg: 'bg-amber-900/20',
    border: 'border-amber-800/50',
    icon: '🥉',
  },
  {
    name: 'Silver',
    minElo: 1000,
    maxElo: 1199,
    color: 'text-gray-300',
    bg: 'bg-gray-700/20',
    border: 'border-gray-500/50',
    icon: '🥈',
  },
  {
    name: 'Gold',
    minElo: 1200,
    maxElo: 1399,
    color: 'text-yellow-400',
    bg: 'bg-yellow-900/20',
    border: 'border-yellow-600/50',
    icon: '🥇',
  },
  {
    name: 'Platinum',
    minElo: 1400,
    maxElo: 1599,
    color: 'text-cyan-400',
    bg: 'bg-cyan-900/20',
    border: 'border-cyan-600/50',
    icon: '💎',
  },
  {
    name: 'Diamond',
    minElo: 1600,
    maxElo: 9999,
    color: 'text-blue-300',
    bg: 'bg-blue-900/20',
    border: 'border-blue-500/50',
    icon: '✦',
  },
];

// Each tier (except Diamond) is split into III / II / I (III = entry, I = near promotion)
function getRoman(elo: number, tier: Omit<RankTier, 'roman'>): string {
  if (tier.name === 'Diamond') return '';
  const span = tier.maxElo - tier.minElo + 1;
  const pos = elo - tier.minElo;
  if (pos < span / 3) return 'III';
  if (pos < (span / 3) * 2) return 'II';
  return 'I';
}

export function getRankTier(elo: number): RankTier {
  const tier =
    TIERS.slice()
      .reverse()
      .find((t) => elo >= t.minElo) ?? TIERS[0];
  return { ...tier, roman: getRoman(elo, tier) };
}

export function getRankLabel(elo: number): string {
  const tier = getRankTier(elo);
  return tier.roman ? `${tier.name} ${tier.roman}` : tier.name;
}
