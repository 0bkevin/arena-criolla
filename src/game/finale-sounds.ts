import type { FighterId } from "../../shared/content";
import { finaleById } from "../../shared/finales";
import { writeFinaleScore } from "./finale-score";

export function writeFinaleMusic(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  fighter: FighterId,
) {
  writeFinaleScore(left, right, sampleRate, fighter, finaleById(fighter));
}
