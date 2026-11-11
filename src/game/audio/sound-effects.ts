import { fighterById, type FighterId } from "../../../shared/roster/roster";
import { presentationById } from "../../../shared/engine/presentation";
import { context, effectsBus, enabled, pageHidden } from "./audio-context";
import { stereoPosition } from "./sound-view";
import { noise, tone } from "./synth";
import { specialSound } from "./special-sounds";

type SoundKind =
  | "select"
  | "hit"
  | "block"
  | "jump"
  | "swing"
  | "land"
  | "step"
  | "dash"
  | "special"
  | "ringout"
  | "win"
  | "entrance"
  | "ready";
export interface SoundOptions {
  x?: number;
  impact?: "light" | "heavy" | "special" | "super";
  strength?: number;
}

const SPATIAL_KINDS: readonly SoundKind[] = [
  "hit",
  "block",
  "swing",
  "land",
  "step",
  "dash",
  "jump",
  "entrance",
];

/** Positional kinds get a short-lived panner in front of the effects bus. */
function spatialDestination(kind: SoundKind, x: number | undefined) {
  if (!SPATIAL_KINDS.includes(kind) || !context || !effectsBus)
    return effectsBus;
  const pan = context.createStereoPanner();
  pan.pan.value = stereoPosition(x);
  pan.connect(effectsBus);
  setTimeout(() => pan.disconnect(), 700);
  return pan;
}

function entranceSound(fighter: FighterId, spatial: AudioNode | null) {
  const style = presentationById(fighter).introStyle;
  if (style === "strum" || style === "bass" || style === "conduct") {
    const base = style === "bass" ? 145 : style === "conduct" ? 440 : 290;
    tone(base, base * 0.94, 0.22, "triangle", 0.055, 0, spatial);
    tone(base * 1.5, base * 1.46, 0.15, "sine", 0.025, 0.1, spatial);
  } else if (style === "spectral" || style === "ritual" || style === "stalk") {
    noise(0.32, 1400, 0.035, "bandpass", 0, spatial);
    tone(190, 255, 0.26, "sine", 0.025, 0, spatial);
  } else if (
    style === "phone" ||
    style === "card" ||
    style === "inspect" ||
    style === "broadcast"
  ) {
    tone(740, 740, 0.06, "sine", 0.04, 0, spatial);
    tone(990, 990, 0.09, "sine", 0.025, 0.09, spatial);
  } else {
    noise(0.13, 2500, 0.035, "bandpass", 0, spatial);
    tone(
      style === "hop" ? 540 : 330,
      460,
      0.11,
      "triangle",
      0.025,
      0.04,
      spatial,
    );
  }
}

function readySound(strength: number | undefined) {
  const final = (strength ?? 1) > 1;
  tone(
    final ? 740 : 510,
    final ? 1040 : 510,
    final ? 0.18 : 0.075,
    "triangle",
    final ? 0.055 : 0.035,
  );
}

function hitSound(
  options: SoundOptions,
  weight: number,
  spatial: AudioNode | null,
) {
  const heavy = options.impact === "heavy" || options.impact === "super";
  const power = Math.min(
    1.6,
    (options.strength ?? (heavy ? 1.3 : 0.85)) * weight,
  );
  // Blend the original low punch and short crack with the softer new release.
  tone(
    heavy ? 115 : 175,
    heavy ? 40 : 55,
    heavy ? 0.2 : 0.13,
    "triangle",
    0.21 * power,
    0,
    spatial,
  );
  tone(heavy ? 240 : 360, 85, 0.105, "sine", 0.075 * power, 0.006, spatial);
  noise(heavy ? 0.12 : 0.065, 1400, 0.15 * power, "bandpass", 0, spatial);
  noise(0.018, 3400, 0.045 * power, "highpass", 0, spatial);
  if (heavy) {
    noise(0.1, 400, 0.06 * power, "lowpass", 0.015, spatial);
    tone(80, 38, 0.18, "sine", 0.07 * power, 0.018, spatial);
  }
}

function swingSound(heavy: boolean, spatial: AudioNode | null) {
  noise(
    heavy ? 0.15 : 0.095,
    heavy ? 1700 : 2400,
    heavy ? 0.08 : 0.05,
    "bandpass",
    0,
    spatial,
  );
  tone(heavy ? 190 : 260, 100, 0.1, "sine", 0.025, 0, spatial);
}

export function sound(
  kind: SoundKind,
  fighter?: FighterId,
  options: SoundOptions = {},
) {
  if (!enabled || pageHidden || !context || context.state !== "running") return;
  const weight = fighter ? fighterById(fighter).damage : 1;
  const spatial = spatialDestination(kind, options.x);
  if (kind === "entrance" && fighter) {
    entranceSound(fighter, spatial);
  } else if (kind === "ready") {
    readySound(options.strength);
  } else if (kind === "select") {
    tone(620, 920, 0.08, "sine", 0.055);
    tone(1240, 1320, 0.08, "sine", 0.025, 0.03);
  } else if (kind === "hit") {
    hitSound(options, weight, spatial);
  } else if (kind === "block") {
    tone(760, 540, 0.11, "triangle", 0.1, 0, spatial);
    tone(1480, 1120, 0.07, "sine", 0.04, 0.012, spatial);
    noise(0.035, 2400, 0.05, "bandpass", 0, spatial);
  } else if (kind === "swing") {
    swingSound(options.impact === "heavy", spatial);
  } else if (kind === "land") {
    tone(110, 42, 0.095, "sine", 0.065, 0, spatial);
    noise(0.05, 800, 0.04, "lowpass", 0, spatial);
  } else if (kind === "step") {
    tone(100, 70, 0.04, "sine", 0.018, 0, spatial);
    noise(0.025, 700, 0.015, "lowpass", 0, spatial);
  } else if (kind === "dash") {
    tone(180, 100, 0.1, "sine", 0.022, 0, spatial);
    noise(0.1, 1600, 0.055, "bandpass", 0, spatial);
  } else if (kind === "jump") {
    tone(210, 340, 0.11, "sine", 0.035, 0, spatial);
    noise(0.08, 1200, 0.04, "bandpass", 0, spatial);
  } else if (kind === "ringout") {
    tone(240, 72, 0.28, "triangle", 0.05);
    noise(0.16, 1100, 0.05, "bandpass");
  } else if (kind === "win") {
    [392, 494, 587, 784].forEach((f, i) =>
      tone(f, f, 0.36, "triangle", 0.08, i * 0.115),
    );
    tone(1174, 1568, 0.55, "sine", 0.035, 0.3);
  } else {
    specialSound(
      fighter ? fighterById(fighter).ability : "broadcast",
      options.impact === "super",
      spatial,
    );
  }
}
