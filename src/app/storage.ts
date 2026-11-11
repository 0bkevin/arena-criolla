import { isFighter, type FighterId } from "../../shared/roster/roster";

export interface Progress {
  wins: Partial<Record<FighterId, number>>;
  played: number;
  bestCombo: number;
  recent: {
    fighter: FighterId;
    rival: FighterId;
    won: boolean;
    date: string;
  }[];
}
const defaultProgress = (): Progress => ({
  wins: {},
  played: 0,
  bestCombo: 0,
  recent: [],
});
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Saved progress, keeping only well-formed wins and matches. */
export function readProgress(): Progress {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem("arena-progress-v1") || "null",
    );
    if (!isRecord(value) || !isRecord(value.wins)) return defaultProgress();
    const wins: Progress["wins"] = {};
    for (const [fighter, count] of Object.entries(value.wins))
      if (isFighter(fighter) && Number.isFinite(Number(count)))
        wins[fighter] = Number(count);
    const recent: Progress["recent"] = [];
    if (Array.isArray(value.recent))
      for (const match of value.recent)
        if (
          isRecord(match) &&
          isFighter(match.fighter) &&
          isFighter(match.rival)
        )
          recent.push({
            fighter: match.fighter,
            rival: match.rival,
            won: match.won === true,
            date: typeof match.date === "string" ? match.date : "",
          });
    return {
      wins,
      played: Number(value.played) || 0,
      bestCombo: Number(value.bestCombo) || 0,
      recent: recent.slice(0, 8),
    };
  } catch {
    return defaultProgress();
  }
}
export function saveProgress(progress: Progress) {
  try {
    localStorage.setItem("arena-progress-v1", JSON.stringify(progress));
  } catch {}
}
/** A saved preference of the fallback's type, or the fallback. */
export function getPreference(key: string, fallback: boolean): boolean;
export function getPreference(key: string, fallback: string): string;
export function getPreference(
  key: string,
  fallback: boolean | string,
): boolean | string {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(`arena-${key}`) || "null",
    );
    if (typeof fallback === "boolean")
      return typeof value === "boolean" ? value : fallback;
    return typeof value === "string" ? value : fallback;
  } catch {
    return fallback;
  }
}
export function setPreference(key: string, value: unknown) {
  try {
    localStorage.setItem(`arena-${key}`, JSON.stringify(value));
  } catch {}
}
