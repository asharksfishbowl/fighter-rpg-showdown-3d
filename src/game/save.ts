import type { SaveData, TerritoryId } from "./types";
import { makeStarterFighter } from "./progression";

const KEY = "frs3d-save-v1";

export function newGame(): SaveData {
  return {
    version: 1,
    fighter: makeStarterFighter(),
    owned: ["home"],
  };
}

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    if (data.version !== 1 || !data.fighter || !Array.isArray(data.owned)) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function writeSave(data: SaveData): void {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function clearSave(): void {
  localStorage.removeItem(KEY);
}

export function claimTerritory(data: SaveData, id: TerritoryId): void {
  if (!data.owned.includes(id)) data.owned.push(id);
}
