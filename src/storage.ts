import { isFighter, type FighterId } from "../shared/content";

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
export function readProgress(): Progress {
  try {
    const value = JSON.parse(
      localStorage.getItem("arena-progress-v1") || "null",
    );
    if (
      !value ||
      typeof value !== "object" ||
      !value.wins ||
      typeof value.wins !== "object"
    )
      return defaultProgress();
    return {
      wins: value.wins,
      played: Number(value.played) || 0,
      bestCombo: Number(value.bestCombo) || 0,
      recent: Array.isArray(value.recent)
        ? value.recent
            .filter(
              (match: Progress["recent"][number]) =>
                match && isFighter(match.fighter) && isFighter(match.rival),
            )
            .slice(0, 8)
        : [],
    };
  } catch {
    return defaultProgress();
  }
}
export function saveProgress(progress: Progress) {
  try {
    localStorage.setItem("arena-progress-v1", JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}
export function getPreference<T>(key: string, fallback: T): T {
  try {
    return (
      JSON.parse(localStorage.getItem(`arena-${key}`) || "null") ?? fallback
    );
  } catch {
    return fallback;
  }
}
export function setPreference(key: string, value: unknown) {
  try {
    localStorage.setItem(`arena-${key}`, JSON.stringify(value));
  } catch {}
}
