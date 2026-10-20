import type { FighterId } from "../../shared/content";
import { writeArcadeMusic } from "./arcade-music";
import { writeFinaleScore } from "./finale-score";
import type { FinaleDefinition } from "../../shared/finales";
import type { VictoryProfile } from "./victory-types";
import { writeVictoryScore } from "./victory-score";

export type ScoreRequest = { sampleRate: number; length: number } & (
  | { kind: "ambience" }
  | {
      kind: "finale";
      fighter: FighterId;
      profile?: Pick<FinaleDefinition, "duration" | "sound" | "damageBeats">;
    }
  | {
      kind: "victory";
      fighter: FighterId | "draw";
      style: VictoryProfile["music"];
    }
);

export function synthesizeScore(request: ScoreRequest) {
  const left = new Float32Array(request.length);
  const right = new Float32Array(request.length);
  if (request.kind === "ambience")
    writeArcadeMusic(left, right, request.sampleRate);
  else if (request.kind === "finale")
    writeFinaleScore(
      left,
      right,
      request.sampleRate,
      request.fighter,
      request.profile,
    );
  else
    writeVictoryScore(
      left,
      right,
      request.sampleRate,
      request.style,
      request.fighter,
    );
  return { left, right };
}
