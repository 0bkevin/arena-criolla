import type { Ability } from "../../shared/content";

interface FounderSound {
  notes: number[];
  wave: OscillatorType;
  spacing: number;
  duration: number;
  sweep: number;
  noise: number;
  filter: BiquadFilterType;
}

// Short original synth cues; total note trains stay below half a second.
export const FOUNDER_SOUNDS = {
  ledger: {
    notes: [392, 523, 659],
    wave: "triangle",
    spacing: 0.045,
    duration: 0.11,
    sweep: 0.78,
    noise: 1900,
    filter: "lowpass",
  },
  settlement: {
    notes: [220, 330, 440, 660],
    wave: "sine",
    spacing: 0.05,
    duration: 0.13,
    sweep: 1.4,
    noise: 950,
    filter: "lowpass",
  },
  ignition: {
    notes: [110, 165, 220, 330],
    wave: "sawtooth",
    spacing: 0.028,
    duration: 0.085,
    sweep: 2.3,
    noise: 2100,
    filter: "bandpass",
  },
  slash: {
    notes: [1047, 784, 523],
    wave: "sine",
    spacing: 0.035,
    duration: 0.07,
    sweep: 0.48,
    noise: 5000,
    filter: "highpass",
  },
  grid: {
    notes: [330, 495, 660, 880],
    wave: "triangle",
    spacing: 0.045,
    duration: 0.1,
    sweep: 1.08,
    noise: 2800,
    filter: "highpass",
  },
} satisfies Partial<Record<Ability, FounderSound>>;
