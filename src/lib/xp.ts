const BASE_XP = 600;
const XP_EXPONENT = 1.04;

export const getLevelFromXp = (xp: number): number => {
  let level = 1;
  let totalXpNeeded = 0;
  while (true) {
    const xpNeeded = Math.floor(BASE_XP * Math.pow(XP_EXPONENT, level - 1));
    if (xp < totalXpNeeded + xpNeeded) break;
    totalXpNeeded += xpNeeded;
    level++;
    if (level >= 999) break; // safety cap
  }
  return level;
};

export const getXpForNextLevel = (level: number): number => {
  return Math.floor(BASE_XP * Math.pow(XP_EXPONENT, level - 1));
};

export const getXpInCurrentLevel = (xp: number): number => {
  let level = 1;
  let totalXpNeeded = 0;
  while (true) {
    const xpNeeded = Math.floor(BASE_XP * Math.pow(XP_EXPONENT, level - 1));
    if (xp < totalXpNeeded + xpNeeded) break;
    totalXpNeeded += xpNeeded;
    level++;
    if (level >= 999) break;
  }
  return xp - totalXpNeeded;
};

// Total XP required to reach a given level (from level 1)
export const getTotalXpForLevel = (targetLevel: number): number => {
  let total = 0;
  for (let lvl = 1; lvl < targetLevel; lvl++) {
    total += Math.floor(BASE_XP * Math.pow(XP_EXPONENT, lvl - 1));
  }
  return total;
};

export const calculateXpGain = (stats: {
  win: boolean;
  kills: number;
}): number => {
  let xp = 50; // Base for playing
  if (stats.win) xp += 100;
  xp += stats.kills * 50;
  return xp;
};
