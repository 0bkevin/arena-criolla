import type { FighterId } from "../../shared/content";
import { VICTORY_MUSIC_MS, type VictoryProfile } from "./victory-types";

const TABLE_SIZE = 2048;
const TAU = Math.PI * 2;
const pulse = new Float32Array(TABLE_SIZE);
for (let i = 0; i < TABLE_SIZE; i++)
  for (let harmonic = 1; harmonic <= 12; harmonic++)
    pulse[i] +=
      (Math.sin((i / TABLE_SIZE) * TAU * harmonic) *
        Math.sin(Math.PI * harmonic * 0.28)) /
      harmonic;

function oscillator(phase: number) {
  const position = (phase % 1) * TABLE_SIZE;
  const index = Math.floor(position);
  const fraction = position - index;
  return (
    pulse[index] * (1 - fraction) + pulse[(index + 1) % TABLE_SIZE] * fraction
  );
}

/** Original 156 BPM arcade result theme: FM bass, pulse lead and electronic drums. */
export function writeVictoryScore(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  style: VictoryProfile["music"],
  fighter: FighterId | "draw",
) {
  if (sampleRate <= 0) return;
  const length = Math.min(left.length, right.length);
  const voice = (
    midi: number,
    at: number,
    seconds: number,
    gain: number,
    pan = 0,
    kind: "lead" | "arp" | "chord" | "bass" = "lead",
  ) => {
    const start = Math.round(at * sampleRate);
    const count = Math.min(Math.round(seconds * sampleRate), length - start);
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    const releaseTime = Math.min(
      seconds * 0.35,
      kind === "chord" ? 0.18 : 0.05,
    );
    const leftGain = gain * Math.sqrt((1 - pan) / 2);
    const rightGain = gain * Math.sqrt((1 + pan) / 2);
    for (let i = 0; i < count; i++) {
      const time = i / sampleRate;
      const phase = frequency * time;
      const attack = Math.min(1, time / 0.003);
      const release = Math.max(0, Math.min(1, (seconds - time) / releaseTime));
      const decay = Math.exp(
        -time * (kind === "arp" ? 15 : kind === "bass" ? 8 : 1.4),
      );
      const envelope = attack * release * decay;
      if (kind === "bass") {
        const modulation =
          Math.sin(phase * TAU * 2) * 1.8 * Math.exp(-time * 16);
        const wave =
          Math.sin(phase * TAU + modulation) + Math.sin(phase * TAU * 2) * 0.16;
        left[start + i] += wave * envelope * leftGain;
        right[start + i] += wave * envelope * rightGain;
      } else {
        const fm = Math.sin(
          phase * TAU +
            Math.sin(phase * TAU * 2) *
              Math.exp(-time * 12) *
              (style === "spectral" ? 1.4 : 0.65),
        );
        const detune = kind === "chord" ? 0.002 : 0.0005;
        const round = kind === "arp" || style === "strings" ? 0.45 : 0.25;
        left[start + i] +=
          (oscillator(phase * (1 - detune)) * (1 - round) + fm * round) *
          envelope *
          leftGain;
        right[start + i] +=
          (oscillator(phase * (1 + detune)) * (1 - round) + fm * round) *
          envelope *
          rightGain;
      }
    }
  };
  const drum = (
    at: number,
    kind: "kick" | "snare" | "hat" | "open",
    gain: number,
    pan = 0,
  ) => {
    const seconds =
      kind === "kick"
        ? 0.3
        : kind === "snare"
          ? 0.16
          : kind === "open"
            ? 0.3
            : 0.045;
    const start = Math.round(at * sampleRate);
    const count = Math.min(Math.round(seconds * sampleRate), length - start);
    let seed = (Math.round(at * 10000) + 0x6ac1) >>> 0;
    let previous = 0;
    let filtered = 0;
    const smoothing = 1 - Math.exp((-TAU * 6500) / sampleRate);
    for (let i = 0; i < count; i++) {
      const time = i / sampleRate;
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const noise = seed / 0x80000000 - 1;
      filtered += (noise - filtered) * smoothing;
      const air = filtered - previous * 0.9;
      previous = filtered;
      let wave: number;
      if (kind === "kick")
        wave =
          (Math.sin(TAU * (52 * time + 3.5 * (1 - Math.exp(-time * 42)))) +
            air * 0.12 * Math.exp(-time * 100)) *
          Math.exp(-time * 17);
      else if (kind === "snare")
        wave =
          (air * 0.8 + Math.sin(TAU * 190 * time) * 0.2) * Math.exp(-time * 28);
      else wave = air * Math.exp(-time * (kind === "hat" ? 90 : 17));
      const envelope =
        Math.min(1, time / 0.0015) *
        Math.min(1, Math.max(0, seconds - time) / 0.012);
      const value = wave * envelope * gain;
      left[start + i] += value * Math.sqrt((1 - pan) / 2);
      right[start + i] += value * Math.sqrt((1 + pan) / 2);
    }
  };

  const root = 50;
  const beat = 60 / 156;
  const draw = fighter === "draw";
  const harmonies = draw
    ? [
        { at: 0, bass: 0, notes: [0, 7, 14] },
        { at: 4, bass: 5, notes: [5, 9, 14] },
        { at: 8, bass: 0, notes: [0, 7, 12] },
      ]
    : [
        { at: 0, bass: 0, notes: [0, 4, 7, 12] },
        { at: 4, bass: -3, notes: [-3, 0, 4, 9] },
        { at: 6, bass: -7, notes: [-7, -3, 0, 5] },
        { at: 8, bass: -5, notes: [-5, 2, 7, 11] },
        { at: 10, bass: 0, notes: [0, 4, 7, 12] },
      ];
  const descendingHarmonies = [...harmonies].reverse();
  const harmonyAt = (position: number) =>
    descendingHarmonies.find((harmony) => harmony.at <= position)!;
  // Short gated chords establish a beat; only the resolving chord is sustained.
  for (const harmony of harmonies) {
    const ending = harmony.at === (draw ? 8 : 10);
    for (const [index, note] of harmony.notes.entries())
      voice(
        root + 12 + note,
        0.02 + harmony.at * beat,
        ending ? 1.3 : 0.21,
        draw ? 0.05 : 0.065,
        (index - 1.5) * 0.32,
        "chord",
      );
  }
  const lastBeat = draw ? 8 : 10;
  for (let step = 0; step < lastBeat * 4; step++) {
    const position = step / 4;
    const harmony = harmonyAt(position);
    const at = 0.02 + position * beat;
    const pattern = [0, 2, 1, 3, 2, 1, 3, 2];
    voice(
      root +
        12 +
        harmony.notes[pattern[step % pattern.length] % harmony.notes.length],
      at,
      0.11,
      draw ? 0.035 : 0.065,
      step % 2 ? 0.5 : -0.5,
      "arp",
    );
    if (step % 2 === 0)
      voice(
        root - 12 + harmony.bass + (step % 8 === 6 ? 12 : 0),
        at,
        0.16,
        draw ? 0.1 : 0.22,
        0,
        "bass",
      );
  }
  if (!draw) {
    // Syncopated calls and a sixteenth-note lift give the result forward motion.
    const melody = [
      [24, 0, 0.45],
      [19, 0.75, 0.45],
      [23, 1.5, 0.45],
      [24, 2, 0.65],
      [28, 2.75, 0.45],
      [26, 3.5, 0.35],
      [24, 4, 0.45],
      [21, 4.75, 0.45],
      [24, 5.5, 0.35],
      [26, 6, 0.65],
      [24, 6.75, 0.35],
      [21, 7.5, 0.35],
      [23, 8, 0.65],
      [19, 9, 0.2],
      [24, 9.25, 0.2],
      [28, 9.5, 0.2],
      [31, 9.75, 0.2],
      [24, 10, 2.8],
    ];
    for (const [pitch, at, duration] of melody)
      voice(root + pitch, 0.02 + at * beat, duration * beat, 0.18, -0.06);
    for (let quarter = 0; quarter < 10; quarter++) {
      drum(0.02 + quarter * beat, "kick", quarter % 4 === 0 ? 0.34 : 0.26);
      if (quarter % 2)
        drum(
          0.02 + quarter * beat,
          "snare",
          style === "percussion" ? 0.23 : 0.19,
          0.12,
        );
    }
    for (let eighth = 0; eighth < 20; eighth++)
      drum(
        0.02 + (eighth / 2) * beat,
        eighth % 8 === 7 ? "open" : "hat",
        eighth % 2 ? 0.065 : 0.045,
        eighth % 2 ? 0.45 : -0.3,
      );
    for (const at of [9.25, 9.5, 9.75])
      drum(0.02 + at * beat, "snare", 0.1 + (at - 9) * 0.14, -0.12);
    drum(0.02 + 10 * beat, "kick", 0.4);
    drum(0.02 + 10 * beat, "open", 0.12, 0.35);
  }
  const final = harmonyAt(lastBeat);
  voice(
    root - 12 + final.bass,
    0.02 + lastBeat * beat,
    0.9,
    draw ? 0.1 : 0.22,
    0,
    "bass",
  );

  // Tempo-locked stereo echoes retain the console character without looping.
  const dryLeft = left.slice(),
    dryRight = right.slice();
  for (const [index, delay] of [0.75, 1.5, 2.25].entries()) {
    const offset = Math.round(beat * delay * sampleRate);
    const gain = 0.24 * 0.5 ** index;
    for (let i = offset; i < length; i++) {
      left[i] += dryRight[i - offset] * gain;
      right[i] += dryLeft[i - offset] * gain;
    }
  }
  const seconds = VICTORY_MUSIC_MS / 1000;
  for (let i = 0; i < length; i++) {
    const fade =
      Math.min(1, i / sampleRate / 0.004) *
      Math.max(0, Math.min(1, (seconds - i / sampleRate) / 0.55));
    left[i] = Math.tanh(left[i] * 1.8) * 0.74 * fade;
    right[i] = Math.tanh(right[i] * 1.8) * 0.74 * fade;
  }
}
