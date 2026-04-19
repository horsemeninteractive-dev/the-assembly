import { CosmeticItem } from '../shared/types';

// Safely resolve version across both Vite (client) and Node.js (server) environments
const getAppVersion = (): string => {
  try {
    // Vite-specific environment variable injected at build time
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_APP_VERSION) {
      return `v${(import.meta as any).env.VITE_APP_VERSION}`;
    }
  } catch {}

  try {
    // Node.js environment variable
    if (typeof process !== 'undefined' && process.env?.APP_VERSION) {
      return process.env.APP_VERSION.startsWith('v') 
        ? process.env.APP_VERSION 
        : `v${process.env.APP_VERSION}`;
    }
  } catch {}

  return 'v0.10.0'; // Fallback
};

export const CLIENT_VERSION = getAppVersion();

export interface CPPackage {
  id: string;
  name: string;
  cp: number;
  price: number; // in cents/pence for Stripe
  displayPrice: string;
  description: string;
  popular?: boolean;
  stripeProductId?: string; // Link to actual Stripe Product ID (prod_...)
}

export const CP_PACKAGES: CPPackage[] = [
  {
    id: 'starter',
    name: 'Starter Bundle',
    cp: 500,
    price: 499,
    displayPrice: '£4.99',
    description: 'Perfect for your first few cosmetic unlocks.',
    stripeProductId: 'prod_UMkZT6yb54eUI3',
  },
  {
    id: 'pro',
    name: 'Pro Pack',
    cp: 1200,
    price: 999,
    displayPrice: '£9.99',
    description: 'Most popular. Great value for serious players.',
    popular: true,
    stripeProductId: 'prod_UCCrzTEnhgpgMV',
  },
  {
    id: 'elite',
    name: 'Elite Vault',
    cp: 3000,
    price: 1999,
    displayPrice: '£19.99',
    description: 'Build your collection fast with this elite stash.',
    stripeProductId: 'prod_UMkbjihIquGQQ5',
  },
  {
    id: 'master',
    name: 'Assembly Master',
    cp: 10000,
    price: 4999,
    displayPrice: '£49.99',
    description: 'The ultimate reserve for true masters of the Assembly.',
    stripeProductId: 'prod_UMkdsYuYq1NSkg',
  },
];

export const DEFAULT_ITEMS: CosmeticItem[] = [
  // Defaults
  {
    id: 'frame-default',
    name: 'Default Frame',
    price: 0,
    type: 'frame',
    description: 'Standard Issue',
  },
  {
    id: 'policy-default',
    name: 'Default Policy',
    price: 0,
    type: 'policy',
    description: 'Standard Issue',
  },
  {
    id: 'vote-default',
    name: 'Default Vote',
    price: 0,
    type: 'vote',
    description: 'Standard Issue',
  },
  {
    id: 'music-default',
    name: 'Shadows in the Hall',
    price: 0,
    type: 'music',
    description: 'The standard atmospheric theme of the Assembly.',
  },
  {
    id: 'sound-default',
    name: 'Default Sound',
    price: 0,
    type: 'sound',
    description: 'Standard Issue',
  },
  {
    id: 'background-default',
    name: 'Default Background',
    price: 0,
    type: 'background',
    description: 'Standard Issue',
  },

  // Frames
  {
    id: 'frame-red',
    name: 'Iron Vanguard',
    price: 500,
    type: 'frame',
    description: 'A standard State-faction border.',
  },
  {
    id: 'frame-gold',
    name: 'Golden Assembly',
    price: 1500,
    type: 'frame',
    description: 'For the most distinguished delegates.',
  },
  {
    id: 'frame-blue',
    name: 'Civil Guard',
    price: 500,
    type: 'frame',
    description: 'A standard Civil-faction border.',
  },
  {
    id: 'frame-rainbow',
    name: 'Spectrum Delegate',
    price: 3000,
    type: 'frame',
    description: 'A vibrant, shifting spectrum of colors.',
  },
  {
    id: 'frame-neon',
    name: 'Neon Resistance',
    price: 2000,
    type: 'frame',
    description: 'Glows with the energy of the underground.',
  },
  {
    id: 'frame-shadow',
    name: 'Shadow Cabal',
    price: 1000,
    type: 'frame',
    description: 'A dark, brooding frame for the secretive.',
  },
  {
    id: 'frame-thorns',
    name: 'Crown of Thorns',
    price: 2500,
    type: 'frame',
    description: 'Intricate thorny vines wrapping around your avatar.',
  },
  {
    id: 'frame-cyber',
    name: 'Cybernetic Link',
    price: 3500,
    type: 'frame',
    description: 'High-tech circuitry and glowing data streams.',
  },
  {
    id: 'frame-inferno',
    name: 'Eternal Inferno',
    price: 4000,
    type: 'frame',
    description: 'Animated flames licking the edges of your profile.',
  },
  {
    id: 'frame-glitch',
    name: 'System Glitch',
    price: 3000,
    type: 'frame',
    description: 'Digital artifacts and chromatic aberration.',
  },
  {
    id: 'frame-royal',
    name: 'Royal Crest',
    price: 5000,
    type: 'frame',
    description: 'Ornate silver and sapphire decorations.',
  },
  {
    id: 'frame-common-basic',
    name: 'Basic Border',
    price: 0,
    type: 'frame',
    description: 'A simple, clean border.',
  },
  {
    id: 'frame-uncommon-bronze',
    name: 'Bronze Edge',
    price: 500,
    type: 'frame',
    description: 'A sturdy bronze-tinted frame.',
  },
  {
    id: 'frame-rare-silver',
    name: 'Silver Lining',
    price: 1500,
    type: 'frame',
    description: 'A polished silver frame for the refined.',
  },
  {
    id: 'frame-epic-violet',
    name: 'Violet Aura',
    price: 2500,
    type: 'frame',
    description: 'A mystical violet glow.',
  },
  {
    id: 'frame-legendary-cosmic',
    name: 'Cosmic Vortex',
    price: 4000,
    type: 'frame',
    description: 'LEGENDARY: A swirling cosmic vortex that bends space and time.',
  },

  // Policy Cards
  {
    id: 'policy-vintage',
    name: 'Vintage Press',
    price: 1200,
    type: 'policy',
    description: 'A classic, weathered newspaper aesthetic.',
  },
  {
    id: 'policy-modern',
    name: 'Modern Minimal',
    price: 1000,
    type: 'policy',
    description: 'Clean lines and bold typography.',
  },
  {
    id: 'policy-blueprint',
    name: 'State Blueprint',
    price: 1500,
    type: 'policy',
    description: 'Technical drawings on blueprint paper.',
  },
  {
    id: 'policy-blood',
    name: 'Blood & Iron',
    price: 2000,
    type: 'policy',
    description: 'Industrial metal with crimson accents.',
  },
  {
    id: 'policy-gold',
    name: 'Golden Decree',
    price: 3500,
    type: 'policy',
    description: 'Ornate gold-leafed policy cards for the elite.',
  },
  {
    id: 'policy-neon',
    name: 'Neon Directive',
    price: 5000,
    type: 'policy',
    description: 'Holographic interface with glowing data streams.',
  },
  {
    id: 'policy-animated',
    name: 'The Living Charter',
    price: 10000,
    type: 'policy',
    description: 'LEGENDARY: Shifting ink and glowing runes that pulse with power.',
  },

  // Voting Cards
  {
    id: 'vote-classic',
    name: 'Classic Ballot',
    price: 800,
    type: 'vote',
    description: 'Traditional paper ballots.',
  },
  {
    id: 'vote-wax',
    name: 'Wax Seal',
    price: 1800,
    type: 'vote',
    description: 'Official documents sealed with red wax.',
  },
  {
    id: 'vote-digital',
    name: 'Digital Consensus',
    price: 1500,
    type: 'vote',
    description: 'Holographic voting interface.',
  },
  {
    id: 'vote-ancient',
    name: 'Ancient Ostracon',
    price: 2500,
    type: 'vote',
    description: 'Pottery shards used in ancient democracy.',
  },
  {
    id: 'vote-neon',
    name: 'Neon Pulse',
    price: 5000,
    type: 'vote',
    description: 'LEGENDARY: A high-energy holographic vote that pulses with neon light.',
  },
  {
    id: 'vote-royal',
    name: 'Royal Decree',
    price: 3500,
    type: 'vote',
    description: 'EPIC: An ornate, gold-trimmed ballot for the ruling class.',
  },
  {
    id: 'vote-cyber',
    name: 'Cyber Protocol',
    price: 2000,
    type: 'vote',
    description: 'RARE: A sleek, data-driven interface for the modern age.',
  },

  // Music
  {
    id: 'music-fog',
    name: 'Fog In The Alley',
    price: 1500,
    type: 'music',
    description: 'Mysterious and low-profile noir vibes.',
  },
  {
    id: 'music-tense',
    name: 'Final Countdown',
    price: 2500,
    type: 'music',
    description: 'High-stakes rhythmic tension for the endgame.',
  },
  {
    id: 'music-victory',
    name: 'Triumph of the New Age',
    price: 4000,
    type: 'music',
    description: 'A grand orchestral anthem for the victors.',
  },
  {
    id: 'music-parliament',
    name: 'Shadows Over Parliament',
    price: 500,
    type: 'music',
    description: 'The classic, moody theme of the old Assembly halls.',
  },

  // Sound Packs
  {
    id: 'sound-retro',
    name: 'Retro 8-bit',
    price: 1500,
    type: 'sound',
    description: 'Classic arcade sound effects.',
  },
  {
    id: 'sound-industrial',
    name: 'Industrial Clang',
    price: 2500,
    type: 'sound',
    description: 'Heavy, metallic sound effects.',
  },

  // Backgrounds
  {
    id: 'bg-leather',
    name: 'Dark Leather',
    price: 1000,
    type: 'background',
    description: 'A sophisticated dark leather texture.',
    imageUrl: 'https://www.transparenttextures.com/patterns/dark-leather.png',
  },
  {
    id: 'bg-brushed',
    name: 'Brushed Metal',
    price: 1500,
    type: 'background',
    description: 'Cold, industrial brushed aluminum.',
    imageUrl: 'https://www.transparenttextures.com/patterns/brushed-alum.png',
  },
  {
    id: 'bg-diamonds',
    name: 'Diamond Plate',
    price: 1200,
    type: 'background',
    description: 'Reinforced steel diamond pattern.',
    imageUrl: 'https://www.transparenttextures.com/patterns/diagmonds-light.png',
  },
  {
    id: 'bg-wood',
    name: 'Dark Mahogany',
    price: 2000,
    type: 'background',
    description: 'Rich, polished dark wood grain.',
    imageUrl: 'https://www.transparenttextures.com/patterns/dark-wood.png',
  },
  {
    id: 'bg-paper',
    name: 'Aged Parchment',
    price: 1800,
    type: 'background',
    description: 'Weathered, historical paper texture.',
    imageUrl: 'https://www.transparenttextures.com/patterns/old-mathematics.png',
  },
  {
    id: 'bg-concrete',
    name: 'Urban Concrete',
    price: 1400,
    type: 'background',
    description: 'Rough, brutalist concrete wall.',
    imageUrl: 'https://www.transparenttextures.com/patterns/concrete-wall.png',
  },
  {
    id: 'bg-nebula-void',
    name: 'Nebula Void',
    price: 15000,
    type: 'background',
    description:
      'LEGENDARY: A swirling, animated cosmic nebula that transforms the assembly hall into deep space.',
  },

  // Assembly Pass Rewards (Free Tier)
  {
    id: 'bg-pass-0',
    name: 'Season 0: Geometric Grid',
    price: 0,
    type: 'background',
    description: 'Exclusive Season 0 background.',
    imageUrl: 'https://www.transparenttextures.com/patterns/gplay.png',
  },
  {
    id: 'vote-pass-0',
    name: 'Season 0: Purple Rain',
    price: 0,
    type: 'vote',
    description: 'Exclusive Season 0 animated voting card.',
    imageUrl: 'https://www.transparenttextures.com/patterns/diagonal-striped-brick.png',
  },
  {
    id: 'music-pass-0',
    name: 'Season 0: Static Noise',
    price: 0,
    type: 'music',
    description: 'Exclusive Season 0 music track.',
    imageUrl: 'https://www.transparenttextures.com/patterns/noise-lines-small.png',
  },
  {
    id: 'frame-pass-0',
    name: 'Season 0: Purple Pill',
    price: 0,
    type: 'frame',
    description: 'Exclusive Season 0 animated avatar frame.',
    imageUrl: 'https://www.transparenttextures.com/patterns/circles-light.png',
  },

  // --- SEASON 1: OBSIDIAN & GOLD ---
  // Free Tier Items
  { id: 'frame-s1-free-10', name: 'Obsidian Iron Frame', price: 0, type: 'frame', description: 'Season 1 Reward: A rugged frame of dark volcanic iron.' },
  { id: 'bg-s1-free-20', name: 'Obsidian Halls', price: 0, type: 'background', description: 'Season 1 Reward: The cold, dark stone of the lower Assembly.', imageUrl: 'https://www.transparenttextures.com/patterns/dark-matter.png' },
  { id: 'vote-s1-free-40', name: 'Obsidian Seal', price: 0, type: 'vote', description: 'Season 1 Reward: A heavy stone-carved voting ballot.' },
  { id: 'policy-s1-free-50', name: 'Obsidian Executive', price: 0, type: 'policy', description: 'Season 1 Reward: Dark, professional policy stationery.' },

  // Premium Tier Items
  { id: 'frame-s1-prem-5', name: 'Gilded Accent Frame', price: 0, type: 'frame', description: 'Season 1 Premium: Subtle gold filigree on dark iron.' },
  { id: 'bg-s1-prem-10', name: 'Golden Atrium', price: 0, type: 'background', description: 'Season 1 Premium: The opulent halls of the high council.', imageUrl: 'https://www.transparenttextures.com/patterns/gold-dust.png' },
  { id: 'music-s1-prem-15', name: 'Obsidian Requiem', price: 0, type: 'music', description: 'Season 1 Premium: A deep, orchestral theme for the ruling class.' },
  { id: 'frame-s1-prem-20', name: 'Molten Gold Frame', price: 0, type: 'frame', description: 'Season 1 Premium: ANIMATED: Liquid gold flowing through obsidian veins.' },
  { id: 'policy-s1-prem-25', name: 'Royal Decree', price: 0, type: 'policy', description: 'Season 1 Premium: Policy cards embossed with 24k gold leaf.' },
  { id: 'bg-s1-prem-30', name: 'Living Obsidian', price: 0, type: 'background', description: 'Season 1 Premium: ANIMATED: Shifting volcanic glass pulsing with heat.', imageUrl: 'https://www.transparenttextures.com/patterns/carbon-fibre.png' },
  { id: 'vote-s1-prem-35', name: 'Golden Authority', price: 0, type: 'vote', description: 'Season 1 Premium: A pure gold ballot that shines with power.' },
  { id: 'frame-s1-prem-40', name: 'Vanguard of Gold', price: 0, type: 'frame', description: 'Season 1 Premium: The ultimate symbol of political wealth.' },
  { id: 'sound-s1-prem-45', name: 'Golden Chime', price: 0, type: 'sound', description: 'Season 1 Premium: Resonant metallic chimes for game actions.' },
  { id: 'policy-s1-prem-50', name: 'Obsidian Monarch', price: 0, type: 'policy', description: 'Season 1 Premium: LEGENDARY: The final word in political strategy.' },
];

export interface PassReward {
  level: number;
  rewardId: string;       // e.g. 'pass-1-lvl10' — namespaced by season, no claimedRewards collision
  labelKey: string;       // i18n key
  cp?: number;
  itemId?: string;        // references an id in DEFAULT_ITEMS
  isPremium?: boolean;    // false / undefined = free track, true = premium track (scaffold for future)
}

export const SEASON_PASS_CONTENT: Record<number, PassReward[]> = {
  0: [
    { level: 10, rewardId: 'pass-0-lvl10', labelKey: 'profile.pass.rewards.geometric_grid', itemId: 'bg-pass-0' },
    { level: 20, rewardId: 'pass-0-lvl20', labelKey: 'profile.pass.rewards.purple_rain', itemId: 'vote-pass-0' },
    { level: 30, rewardId: 'pass-0-lvl30', labelKey: 'profile.pass.reward_types.cp_count', cp: 500 },
    { level: 40, rewardId: 'pass-0-lvl40', labelKey: 'profile.pass.rewards.static_noise', itemId: 'music-pass-0' },
    { level: 50, rewardId: 'pass-0-lvl50', labelKey: 'profile.pass.rewards.purple_pill', itemId: 'frame-pass-0' },
  ],
  1: [
    // Free Tier (5 slots: 10, 20, 30, 40, 50)
    { level: 10, rewardId: 'pass-1-free-10', labelKey: 'profile.pass.rewards.s1_iron_frame', itemId: 'frame-s1-free-10' },
    { level: 20, rewardId: 'pass-1-free-20', labelKey: 'profile.pass.rewards.s1_halls', itemId: 'bg-s1-free-20' },
    { level: 30, rewardId: 'pass-1-free-30', labelKey: 'profile.pass.reward_types.cp_count', cp: 300 },
    { level: 40, rewardId: 'pass-1-free-40', labelKey: 'profile.pass.rewards.s1_seal', itemId: 'vote-s1-free-40' },
    { level: 50, rewardId: 'pass-1-free-50', labelKey: 'profile.pass.rewards.s1_executive', itemId: 'policy-s1-free-50' },

    // Premium Tier (10 slots: Every 5 levels)
    { level: 5, rewardId: 'pass-1-prem-5', labelKey: 'profile.pass.rewards.s1_gilded_accent', itemId: 'frame-s1-prem-5', isPremium: true },
    { level: 10, rewardId: 'pass-1-prem-10', labelKey: 'profile.pass.reward_types.cp_count', cp: 300, isPremium: true },
    { level: 15, rewardId: 'pass-1-prem-15', labelKey: 'profile.pass.rewards.s1_requiem', itemId: 'music-s1-prem-15', isPremium: true },
    { level: 20, rewardId: 'pass-1-prem-20', labelKey: 'profile.pass.rewards.s1_molten_gold', itemId: 'frame-s1-prem-20', isPremium: true },
    { level: 25, rewardId: 'pass-1-prem-25', labelKey: 'profile.pass.reward_types.cp_count', cp: 300, isPremium: true },
    { level: 30, rewardId: 'pass-1-prem-30', labelKey: 'profile.pass.rewards.s1_living_obsidian', itemId: 'bg-s1-prem-30', isPremium: true },
    { level: 35, rewardId: 'pass-1-prem-35', labelKey: 'profile.pass.rewards.s1_golden_authority', itemId: 'vote-s1-prem-35', isPremium: true },
    { level: 40, rewardId: 'pass-1-prem-40', labelKey: 'profile.pass.rewards.s1_vanguard', itemId: 'frame-s1-prem-40', isPremium: true },
    { level: 45, rewardId: 'pass-1-prem-45', labelKey: 'profile.pass.reward_types.cp_count', cp: 300, isPremium: true },
    { level: 50, rewardId: 'pass-1-prem-50', labelKey: 'profile.pass.rewards.s1_monarch', itemId: 'policy-s1-prem-50', isPremium: true },
  ],
};

/** Replaces PASS_ITEM_LEVELS — looks up required level for a cosmetic item in a given season. */
export function getPassItemLevel(itemId: string, seasonNumber: number): number | undefined {
  return SEASON_PASS_CONTENT[seasonNumber]?.find((r) => r.itemId === itemId)?.level;
}

export const RANK_TIERS = {
  BRONZE: { name: 'Bronze', minElo: 0, maxElo: 999, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  SILVER: { name: 'Silver', minElo: 1000, maxElo: 1199, color: 'text-slate-400', bg: 'bg-slate-400/10', border: 'border-slate-400/30' },
  GOLD: { name: 'Gold', minElo: 1200, maxElo: 1399, color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/30' },
  PLATINUM: { name: 'Platinum', minElo: 1400, maxElo: 1599, color: 'text-cyan-400', bg: 'bg-cyan-400/10', border: 'border-cyan-400/30' },
  ELITE: { name: 'Elite', minElo: 1600, maxElo: Infinity, color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/30' },
} as const;

export type RankTier = keyof typeof RANK_TIERS;

export const RANK_REWARDS = {
  BRONZE: { ip: 500, cp: 0 },
  SILVER: { ip: 1000, cp: 100 },
  GOLD: { ip: 2000, cp: 250 },
  PLATINUM: { ip: 3500, cp: 500 },
  ELITE: { ip: 5000, cp: 1000 },
} as const;


