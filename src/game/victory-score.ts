import type { FighterId } from "../../shared/content";
import { VICTORY_DURATION_MS, type VictoryProfile } from "./victory-types";

/** Original one-shot fanfare: rising phrase, answering chord, then a soft release. */
export function writeVictoryScore(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  style: VictoryProfile["music"],
  fighter: FighterId | "draw",
) {
  const duration = VICTORY_DURATION_MS / 1000;
  const note = (
    midi: number,
    at: number,
    length: number,
    volume: number,
    pan = 0,
  ) => {
    const start = Math.round(at * sampleRate);
    const count = Math.round(length * sampleRate);
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    for (let n = 0; n < count && start + n < left.length; n++) {
      const time = n / sampleRate;
      const phase = time * Math.PI * 2 * frequency;
      const attack = Math.min(1, time / 0.012);
      const release = Math.min(1, (length - time) / 0.12);
      const decay = Math.exp(-time * (style === "strings" ? 5 : 2.5));
      const brightness = Math.exp(-time * 7);
      const wave =
        Math.sin(phase) +
        Math.sin(phase * 2) * brightness * (style === "brass" ? 0.3 : 0.12) +
        Math.sin(phase * 3) *
          brightness *
          (style === "percussion" ? 0.22 : 0.07);
      const fade = Math.min(1, Math.max(0, duration - (at + time)) / 0.18);
      const value = wave * attack * release * decay * fade * volume;
      left[start + n] += value * Math.sqrt((1 - pan) / 2);
      right[start + n] += value * Math.sqrt((1 + pan) / 2);
    }
  };
  if (fighter === "draw") {
    [60, 64, 67].forEach((pitch, i) =>
      note(pitch, i * 0.12, 1.3, 0.075, (i - 1) * 0.3),
    );
    [60, 65, 69].forEach((pitch, i) =>
      note(pitch, 1.8 + i * 0.025, 1.5, 0.065, (i - 1) * 0.3),
    );
    return;
  }
  const root = style === "spectral" ? 62 : style === "strings" ? 67 : 60;
  const third = style === "spectral" ? 3 : 4;
  const melody = [0, third, 7, 12, 7, 12, 16, 12];
  const times = [0.04, 0.21, 0.38, 0.63, 1.02, 1.28, 1.55, 2.02];
  melody.forEach((interval, i) =>
    note(root + interval, times[i], i === 7 ? 1.45 : 0.4, 0.12, 0.1),
  );
  for (const at of [0.04, 0.64, 1.28, 2.02]) {
    note(root - 24, at, 0.55, 0.14);
    [0, third, 7].forEach((pitch, i) =>
      note(
        root + pitch,
        at + i * 0.015,
        at > 2 ? 1.43 : 0.5,
        0.065,
        (i - 1) * 0.5,
      ),
    );
    // A rounded low drum supplies the accent without sampled or licensed audio.
    note(35, at, 0.16, 0.09, -0.15);
  }
}
