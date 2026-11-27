export type Stats = {
  str: number;
  dex: number;
  con: number;
  spi: number;
};

export type FighterProgress = {
  name: string;
  level: number;
  xp: number;
  xpToNext: number;
  statPoints: number;
  stats: Stats;
};

export type TerritoryId =
  | "home"
  | "docks"
  | "market"
  | "factory"
  | "oldtown"
  | "arena"
  | "capital";

export type ChampDef = {
  name: string;
  level: number;
  stats: Stats;
  bias: string;
};

export type Territory = {
  id: TerritoryId;
  name: string;
  neighbors: TerritoryId[];
  champ: ChampDef | null;
  arenaTint: number;
};

export type SaveData = {
  version: 1;
  fighter: FighterProgress;
  owned: TerritoryId[];
};

export type Screen =
  | "menu"
  | "map"
  | "stats"
  | "challenge"
  | "fight"
  | "results";

export type RoundResult = "player" | "rival" | null;

export type MatchOutcome = {
  won: boolean;
  territoryId: TerritoryId;
  xpGained: number;
  leveledUp: boolean;
  claimed: boolean;
};
