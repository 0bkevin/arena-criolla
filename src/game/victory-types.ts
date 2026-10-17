import type { Gesture } from "../../shared/choreography";

export const VICTORY_DURATION_MS = 3500;

export interface VictoryProfile {
  name: string;
  frame: 0 | 1 | 4;
  movement: "hop" | "sway" | "rise" | "plant";
  gesture: Partial<Omit<Gesture, "at">>;
  lift: number;
  travel: number;
  twist: number;
  music: "brass" | "strings" | "spectral" | "percussion";
}
