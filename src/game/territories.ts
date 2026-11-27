import type { Territory, TerritoryId } from "./types";

export const TERRITORIES: Territory[] = [
  {
    id: "home",
    name: "Home Yard",
    neighbors: ["docks"],
    champ: null,
    arenaTint: 0x1a1028,
  },
  {
    id: "docks",
    name: "Docks",
    neighbors: ["home", "market", "factory"],
    champ: {
      name: "Rookie Striker",
      level: 2,
      stats: { str: 5, dex: 8, con: 5, spi: 5 },
      bias: "DEX-heavy",
    },
    arenaTint: 0x0e1a22,
  },
  {
    id: "market",
    name: "Market",
    neighbors: ["docks", "oldtown"],
    champ: {
      name: "Street Brawler",
      level: 4,
      stats: { str: 9, dex: 5, con: 7, spi: 5 },
      bias: "STR-heavy",
    },
    arenaTint: 0x221410,
  },
  {
    id: "factory",
    name: "Factory",
    neighbors: ["docks", "arena"],
    champ: {
      name: "Iron Guard",
      level: 5,
      stats: { str: 8, dex: 4, con: 10, spi: 5 },
      bias: "CON-heavy",
    },
    arenaTint: 0x14181c,
  },
  {
    id: "oldtown",
    name: "Old Town",
    neighbors: ["market", "arena"],
    champ: {
      name: "Neon Blade",
      level: 6,
      stats: { str: 7, dex: 10, con: 6, spi: 7 },
      bias: "DEX / SPI",
    },
    arenaTint: 0x180e20,
  },
  {
    id: "arena",
    name: "Arena District",
    neighbors: ["factory", "oldtown", "capital"],
    champ: {
      name: "Rival Ace",
      level: 8,
      stats: { str: 10, dex: 9, con: 9, spi: 8 },
      bias: "Balanced ace",
    },
    arenaTint: 0x1c0a18,
  },
  {
    id: "capital",
    name: "Capital",
    neighbors: ["arena"],
    champ: {
      name: "Warlord Prime",
      level: 11,
      stats: { str: 13, dex: 10, con: 12, spi: 11 },
      bias: "Boss",
    },
    arenaTint: 0x120818,
  },
];

export function getTerritory(id: TerritoryId): Territory {
  const t = TERRITORIES.find((x) => x.id === id);
  if (!t) throw new Error(`Unknown territory ${id}`);
  return t;
}

export function canChallenge(
  owned: TerritoryId[],
  target: TerritoryId,
): boolean {
  if (owned.includes(target)) return false;
  const tile = getTerritory(target);
  return tile.neighbors.some((n) => owned.includes(n));
}

export function empireComplete(owned: TerritoryId[]): boolean {
  return TERRITORIES.every((t) => owned.includes(t.id));
}
