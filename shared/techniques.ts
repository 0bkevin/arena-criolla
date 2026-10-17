import type { Ability } from "./content";
import { CULTURE_TECHNIQUES } from "./culture-techniques";
import { FOUNDER_TECHNIQUES } from "./founder-techniques";

export interface Technique {
  startup: number;
  recovery: number;
  range: number;
  height: number;
  damage: number;
  force: number;
  pulses?: number[];
  radial?: boolean;
  groundOnly?: boolean;
  requiresGround?: boolean;
  aimed?: boolean;
  pulseRangeStep?: number;
  finisherForce?: number;
  hitInvincibility?: number;
  mirrorPulse?: number;
  reflect?: { from: number; to: number; radius: number };
  counter?: {
    from: number;
    to: number;
    damage: number;
    force: number;
    range: number;
  };
  steps?: { pulse: number; speed: number; ticks: number; lift?: number }[];
  dash?: {
    speed: number;
    ticks: number;
    invincibility: number;
    lift?: number;
    brake?: number;
  };
  lift?: number;
  blink?: { reach: number; gap: number; invincibility: number };
  snare?: number;
  projectile?: {
    speed: number;
    life: number;
    count?: number;
    spread?: number;
    returnAfter?: number;
    wave?: { amplitude: number; period: number };
    acceleration?: number;
    maxSpeed?: number;
    initialVy?: number;
    gravity?: number;
    homing?: number;
    pulls?: boolean;
    groundOnly?: boolean;
    slowTicks?: number;
    blastRadius?: number;
    bounces?: number;
    radius?: number;
    growth?: number;
    maxRadius?: number;
    plantAfter?: number;
    armAfter?: number;
  };
}

// Timings are simulation frames (60 Hz), shared by local and network combat.
export const TECHNIQUES: Record<Ability, Technique> = {
  ...CULTURE_TECHNIQUES,
  ...FOUNDER_TECHNIQUES,
  courier: {
    startup: 6,
    recovery: 37,
    range: 170,
    height: 120,
    damage: 14,
    force: 8,
    dash: { speed: 20, ticks: 10, invincibility: 5, brake: 0.3 },
  },
  installments: {
    startup: 11,
    recovery: 54,
    range: 500,
    height: 115,
    damage: 6,
    force: 4,
    pulses: [0, 10, 20],
    projectile: { speed: 9, life: 72 },
  },
  spin: {
    startup: 9,
    recovery: 40,
    range: 170,
    height: 185,
    damage: 16,
    force: 8,
    radial: true,
    lift: -9,
  },
  sprint: {
    startup: 9,
    recovery: 40,
    range: 215,
    height: 110,
    damage: 16,
    force: 8,
    dash: { speed: 16, ticks: 12, invincibility: 10, brake: 0.3 },
  },
  broadcast: {
    startup: 10,
    recovery: 46,
    range: 520,
    height: 120,
    damage: 8,
    force: 5,
    pulses: [0, 16],
    projectile: { speed: 7.5, life: 95 },
  },
  command: {
    startup: 17,
    recovery: 49,
    range: 205,
    height: 65,
    damage: 21,
    force: 11,
    radial: true,
    groundOnly: true,
  },
  cuatro: {
    startup: 12,
    recovery: 43,
    range: 500,
    height: 180,
    damage: 9,
    force: 5,
    projectile: { speed: 8, life: 90, count: 3, spread: 3.2 },
  },
  whirl: {
    startup: 14,
    recovery: 47,
    range: 165,
    height: 105,
    damage: 20,
    force: 10,
    dash: { speed: 12, ticks: 9, invincibility: 3, brake: 0.3 },
  },
  echo: {
    startup: 8,
    recovery: 51,
    range: 150,
    height: 135,
    damage: 10,
    force: 4.5,
    pulses: [0, 16],
  },
  spotlight: {
    startup: 15,
    recovery: 45,
    range: 300,
    height: 180,
    damage: 16,
    force: 7,
    aimed: true,
  },
  salsa: {
    startup: 8,
    recovery: 39,
    range: 140,
    height: 225,
    damage: 16,
    force: 8,
    radial: true,
    lift: -12,
  },
  roar: {
    startup: 16,
    recovery: 48,
    range: 260,
    height: 150,
    damage: 16,
    force: 12,
  },
  static: {
    startup: 11,
    recovery: 44,
    range: 460,
    height: 120,
    damage: 12,
    force: 6,
    projectile: { speed: 10, life: 75, returnAfter: 24 },
  },
  punchline: {
    startup: 14,
    recovery: 55,
    range: 190,
    height: 110,
    damage: 10,
    force: 6,
    pulses: [0, 16],
  },
  rally: {
    startup: 10,
    recovery: 43,
    range: 180,
    height: 160,
    damage: 15,
    force: 7,
    dash: { speed: 13, ticks: 14, invincibility: 5, lift: -6.5, brake: 0.3 },
  },
  whistle: {
    startup: 13,
    recovery: 47,
    range: 570,
    height: 140,
    damage: 13,
    force: 7,
    projectile: {
      speed: 4,
      life: 85,
      wave: { amplitude: 28, period: 32 },
      acceleration: 0.22,
      maxSpeed: 12,
    },
  },
  undertow: {
    startup: 15,
    recovery: 49,
    range: 480,
    height: 140,
    damage: 12,
    force: 7,
    projectile: { speed: 7, life: 68, pulls: true },
  },
  haunt: {
    startup: 12,
    recovery: 46,
    range: 120,
    height: 145,
    damage: 15,
    force: 7,
    blink: { reach: 210, gap: 86, invincibility: 7 },
  },
  wildspirit: {
    requiresGround: true,
    startup: 21,
    recovery: 57,
    range: 560,
    height: 65,
    damage: 19,
    force: 10,
    projectile: { speed: 6, life: 92, groundOnly: true },
  },
  verse: {
    startup: 14,
    recovery: 46,
    range: 580,
    height: 190,
    damage: 11,
    force: 5.5,
    projectile: { speed: 8, life: 74, homing: 2.8 },
  },
  hellfire: {
    startup: 19,
    recovery: 56,
    range: 540,
    height: 180,
    damage: 17,
    force: 8,
    projectile: {
      speed: 7,
      life: 90,
      initialVy: -6,
      gravity: 0.32,
      blastRadius: 130,
    },
  },
  elixir: {
    startup: 13,
    recovery: 45,
    range: 490,
    height: 160,
    damage: 10,
    force: 4.5,
    projectile: {
      speed: 8,
      life: 72,
      initialVy: -3.5,
      gravity: 0.18,
      slowTicks: 60,
    },
  },
  roots: {
    startup: 18,
    recovery: 50,
    range: 265,
    height: 65,
    damage: 12,
    force: 3,
    aimed: true,
    groundOnly: true,
    snare: 38,
  },
  pounce: {
    startup: 8,
    recovery: 43,
    range: 145,
    height: 180,
    damage: 8,
    force: 5,
    radial: true,
    pulses: [0, 16],
    dash: { speed: 18, ticks: 8, invincibility: 2, lift: -9, brake: 0.8 },
  },
  trickster: {
    startup: 9,
    recovery: 43,
    range: 500,
    height: 160,
    damage: 12,
    force: 6,
    dash: { speed: -12, ticks: 9, invincibility: 4, lift: -8, brake: 0.8 },
    projectile: {
      speed: 10,
      life: 70,
      initialVy: -1,
      gravity: 0.24,
      bounces: 1,
    },
  },
};
