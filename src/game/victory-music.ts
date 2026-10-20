import type { FighterId } from "../../shared/content";
import { victoryById } from "./victory";
import { writeVictoryScore } from "./victory-score";

export function writeVictoryMusic(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  fighter: FighterId | "draw",
) {
  writeVictoryScore(
    left,
    right,
    sampleRate,
    fighter === "draw" ? "strings" : victoryById(fighter).music,
    fighter,
  );
}
