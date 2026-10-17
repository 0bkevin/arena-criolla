import type { Ability } from "../../shared/content";

interface CultureSound {
  notes: number[];
  wave: OscillatorType;
  spacing: number;
  duration: number;
  sweep: number;
  noise: number;
  filter: BiquadFilterType;
}

// Original short arcade cues. These contain no recordings, speech or song samples.
export const CULTURE_SOUNDS: Partial<Record<Ability, CultureSound>> = {
  strum: {
    notes: [196, 294, 392, 587],
    wave: "triangle",
    spacing: 0.03,
    duration: 0.2,
    sweep: 0.98,
    noise: 1700,
    filter: "bandpass",
  },
  tremolo: {
    notes: [440, 554, 440, 659, 554],
    wave: "triangle",
    spacing: 0.045,
    duration: 0.09,
    sweep: 0.97,
    noise: 4200,
    filter: "highpass",
  },
  lasso: {
    notes: [380, 220, 150],
    wave: "sine",
    spacing: 0.08,
    duration: 0.16,
    sweep: 0.6,
    noise: 2100,
    filter: "bandpass",
  },
  cadenza: {
    notes: [523, 784, 1046],
    wave: "sine",
    spacing: 0.09,
    duration: 0.21,
    sweep: 1.005,
    noise: 5600,
    filter: "highpass",
  },
  crescendo: {
    notes: [110, 220, 440],
    wave: "sine",
    spacing: 0.09,
    duration: 0.28,
    sweep: 1.8,
    noise: 950,
    filter: "lowpass",
  },
  syncopate: {
    notes: [165, 330, 220, 660],
    wave: "triangle",
    spacing: 0.075,
    duration: 0.09,
    sweep: 0.6,
    noise: 1700,
    filter: "bandpass",
  },
  jackpot: {
    notes: [740, 988, 1480],
    wave: "triangle",
    spacing: 0.055,
    duration: 0.14,
    sweep: 1.04,
    noise: 3800,
    filter: "highpass",
  },
  fountain: {
    notes: [620, 930, 1240],
    wave: "sine",
    spacing: 0.09,
    duration: 0.2,
    sweep: 0.5,
    noise: 1900,
    filter: "bandpass",
  },
  cocotero: {
    notes: [392, 494, 659, 988],
    wave: "triangle",
    spacing: 0.04,
    duration: 0.19,
    sweep: 1.2,
    noise: 3200,
    filter: "highpass",
  },
  zapateo: {
    notes: [130, 160, 130, 220],
    wave: "triangle",
    spacing: 0.1,
    duration: 0.08,
    sweep: 0.4,
    noise: 650,
    filter: "lowpass",
  },
  runway: {
    notes: [550, 1100],
    wave: "sine",
    spacing: 0.08,
    duration: 0.22,
    sweep: 1.5,
    noise: 4100,
    filter: "highpass",
  },
  pivot: {
    notes: [180, 540, 320],
    wave: "triangle",
    spacing: 0.075,
    duration: 0.16,
    sweep: 1.8,
    noise: 2500,
    filter: "bandpass",
  },
  mirror: {
    notes: [660, 830, 660],
    wave: "sine",
    spacing: 0.13,
    duration: 0.2,
    sweep: 0.99,
    noise: 4900,
    filter: "highpass",
  },
  curtain: {
    notes: [180, 270, 405],
    wave: "triangle",
    spacing: 0.09,
    duration: 0.21,
    sweep: 0.8,
    noise: 1100,
    filter: "lowpass",
  },
  audit: {
    notes: [330, 660, 990, 1320],
    wave: "square",
    spacing: 0.045,
    duration: 0.075,
    sweep: 1.08,
    noise: 5200,
    filter: "highpass",
  },
  prank: {
    notes: [240, 960, 360],
    wave: "square",
    spacing: 0.065,
    duration: 0.08,
    sweep: 1.3,
    noise: 3400,
    filter: "bandpass",
  },
};
