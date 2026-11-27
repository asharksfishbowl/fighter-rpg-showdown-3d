import type { FighterProgress, Stats } from "./types";

export const BASE_HP = 100;
export const BASE_SPEED = 4.2;
export const BASE_LIGHT = 8;
export const BASE_HEAVY = 16;
export const BASE_SPECIAL = 28;

export function makeStarterFighter(): FighterProgress {
  return {
    name: "Fishbowl Brawler",
    level: 1,
    xp: 0,
    xpToNext: 40,
    statPoints: 0,
    stats: { str: 6, dex: 6, con: 6, spi: 6 },
  };
}

export function maxHp(stats: Stats): number {
  return Math.round(BASE_HP + stats.con * 12);
}

export function moveSpeed(stats: Stats): number {
  return BASE_SPEED * (1 + stats.dex * 0.01);
}

export function lightDamage(stats: Stats): number {
  return Math.round(BASE_LIGHT + stats.str * 0.4);
}

export function heavyDamage(stats: Stats): number {
  return Math.round(BASE_HEAVY + stats.str * 0.8);
}

export function specialDamage(stats: Stats): number {
  return Math.round(BASE_SPECIAL + stats.spi * 0.6 + stats.str * 0.3);
}

export function meterGain(stats: Stats): number {
  return 8 * (1 + stats.spi * 0.02);
}

export function attackRate(stats: Stats): number {
  return 1 + stats.dex * 0.012;
}

export function xpForWin(rivalLevel: number, playerLevel: number): number {
  const gap = Math.max(0, rivalLevel - playerLevel);
  return 28 + rivalLevel * 6 + gap * 8;
}

export function xpForLoss(rivalLevel: number): number {
  return 10 + rivalLevel * 2;
}

export function applyXp(fighter: FighterProgress, amount: number): boolean {
  fighter.xp += amount;
  let leveled = false;
  while (fighter.xp >= fighter.xpToNext) {
    fighter.xp -= fighter.xpToNext;
    fighter.level += 1;
    fighter.statPoints += 1;
    fighter.stats.con += 1; // automatic HP bump via CON
    fighter.xpToNext = Math.round(36 + fighter.level * 14);
    leveled = true;
  }
  return leveled;
}

export function spendStat(
  fighter: FighterProgress,
  key: keyof Stats,
): boolean {
  if (fighter.statPoints <= 0) return false;
  fighter.statPoints -= 1;
  fighter.stats[key] += 1;
  return true;
}

export function cloneStats(stats: Stats): Stats {
  return { ...stats };
}

export function scaleChampStats(base: Stats, level: number): Stats {
  const bump = Math.max(0, level - 1);
  return {
    str: base.str + Math.floor(bump * 0.8),
    dex: base.dex + Math.floor(bump * 0.7),
    con: base.con + Math.floor(bump * 0.9),
    spi: base.spi + Math.floor(bump * 0.6),
  };
}
