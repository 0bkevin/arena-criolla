import type { Ability } from "../../../shared/roster/roster";
import { TECHNIQUES } from "../../../shared/engine/techniques";
import { CULTURE_SOUNDS } from "./culture-sounds";
import { noise, tone } from "./synth";

type CultureSound = NonNullable<(typeof CULTURE_SOUNDS)[Ability]>;
type Signature = (
  spatial: AudioNode | null,
  ability: Ability,
  superImpact: boolean,
) => void;

function cultureSignature(
  cultureSound: CultureSound,
  spatial: AudioNode | null,
) {
  cultureSound.notes.forEach((frequency, index) =>
    tone(
      frequency,
      frequency * cultureSound.sweep,
      cultureSound.duration,
      cultureSound.wave,
      cultureSound.wave === "square" ? 0.025 : 0.055,
      index * cultureSound.spacing,
      spatial,
    ),
  );
  noise(0.16, cultureSound.noise, 0.05, cultureSound.filter, 0, spatial);
}

const commandOrWhirl: Signature = (_spatial, ability) => {
  tone(ability === "command" ? 90 : 150, 42, 0.36, "triangle", 0.19);
  noise(0.26, ability === "command" ? 750 : 2000, 0.15);
};

const cuatroOrSalsa: Signature = (_spatial, ability) => {
  const notes = ability === "cuatro" ? [294, 370, 440, 587] : [392, 523, 659];
  notes.forEach((frequency, index) =>
    tone(frequency, frequency * 0.995, 0.17, "triangle", 0.075, index * 0.06),
  );
  noise(0.09, 4500, 0.09, "highpass");
};

const echoOrPunchline: Signature = (_spatial, ability) => {
  [0, 0.27].forEach((delay, index) => {
    tone(index ? 190 : 310, 95, 0.17, "triangle", 0.095, delay);
    noise(0.12, ability === "echo" ? 2400 : 1400, 0.08, "bandpass", delay);
  });
};

/** Hand-written signatures for abilities without a CULTURE_SOUNDS cue. */
const SIGNATURES: Partial<Record<Ability, Signature>> = {
  whistle: (spatial) => {
    [880, 988, 1175, 1319].forEach((frequency, index) =>
      tone(
        frequency,
        frequency * 1.03,
        0.12,
        "sine",
        0.045,
        index * 0.075,
        spatial,
      ),
    );
    noise(0.2, 4600, 0.035, "bandpass", 0, spatial);
  },
  undertow: (spatial) => {
    noise(0.42, 1150, 0.11, "lowpass", 0, spatial);
    [0, 0.09, 0.18].forEach((delay) =>
      tone(460, 180, 0.18, "sine", 0.04, delay, spatial),
    );
  },
  haunt: (spatial) => {
    noise(0.24, 3600, 0.07, "highpass", 0, spatial);
    tone(740, 170, 0.3, "sine", 0.06, 0, spatial);
    tone(170, 740, 0.16, "sine", 0.04, 0.16, spatial);
  },
  wildspirit: (spatial) => {
    [0, 0.1, 0.2, 0.3].forEach((delay) => {
      tone(125, 55, 0.1, "triangle", 0.1, delay, spatial);
      noise(0.09, 700, 0.06, "lowpass", delay, spatial);
    });
  },
  verse: (spatial) => {
    [330, 440, 554, 660].forEach((frequency, index) =>
      tone(
        frequency,
        frequency * 0.99,
        0.19,
        "triangle",
        0.06,
        index * 0.055,
        spatial,
      ),
    );
  },
  hellfire: (spatial) => {
    noise(0.45, 850, 0.13, "lowpass", 0, spatial);
    tone(170, 48, 0.4, "sawtooth", 0.045, 0, spatial);
    noise(0.19, 2800, 0.07, "bandpass", 0.15, spatial);
  },
  elixir: (spatial) => {
    [1320, 1760, 2093].forEach((frequency, index) =>
      tone(
        frequency,
        frequency * 0.94,
        0.12,
        "sine",
        0.035,
        index * 0.04,
        spatial,
      ),
    );
    noise(0.1, 5800, 0.04, "highpass", 0.12, spatial);
  },
  roots: (spatial) => {
    noise(0.33, 900, 0.095, "bandpass", 0, spatial);
    tone(160, 70, 0.26, "triangle", 0.075, 0, spatial);
  },
  pounce: (spatial) => {
    noise(0.25, 2300, 0.1, "bandpass", 0, spatial);
    tone(140, 65, 0.24, "sawtooth", 0.04, 0, spatial);
    noise(0.14, 3200, 0.08, "highpass", 0.22, spatial);
  },
  trickster: (spatial) => {
    tone(180, 850, 0.19, "triangle", 0.075, 0, spatial);
    tone(640, 270, 0.16, "sine", 0.06, 0.14, spatial);
    noise(0.12, 3000, 0.04, "bandpass", 0.1, spatial);
  },
  broadcast: () => {
    [180, 240, 300].forEach((f, i) =>
      tone(f, f * 1.8, 0.36, "triangle", 0.09, i * 0.055),
    );
    noise(0.19, 950, 0.08);
    tone(880, 880, 0.07, "sine", 0.09, 0.26);
    noise(0.11, 6200, 0.07, "highpass", 0.32);
  },
  courier: (spatial) => {
    // Layer the engines of the compact formation, all summoned on the same tick.
    const technique = TECHNIQUES.courier;
    Array.from(
      { length: technique.projectile?.count ?? 1 },
      (_, index) => index,
    ).forEach((index) => {
      const delay = technique.startup / 60 + index * 0.025;
      tone(85, 230, 0.2, "sawtooth", 0.035, delay, spatial);
      tone(170, 380, 0.16, "triangle", 0.04, delay, spatial);
      noise(0.15, 800, 0.035, "lowpass", delay, spatial);
    });
  },
  installments: () => {
    [660, 880, 1100].forEach((frequency, index) =>
      tone(frequency, frequency, 0.09, "sine", 0.08, index / 6),
    );
    noise(0.11, 3800, 0.045, "highpass");
  },
  spin: () => {
    tone(160, 800, 0.26, "triangle", 0.12);
    noise(0.29, 3800, 0.14);
    tone(940, 740, 0.17, "sine", 0.08, 0.23);
  },
  command: commandOrWhirl,
  whirl: commandOrWhirl,
  cuatro: cuatroOrSalsa,
  salsa: cuatroOrSalsa,
  echo: echoOrPunchline,
  punchline: echoOrPunchline,
  spotlight: (spatial, _ability, superImpact) => {
    if (superImpact) {
      // Original resonant pressure sweep; no sampled voice or recording.
      [180, 360, 720].forEach((frequency, index) =>
        tone(
          frequency,
          frequency * 0.55,
          0.72,
          "triangle",
          0.065 / (index + 1),
          index * 0.025,
          spatial,
        ),
      );
      noise(0.5, 1150, 0.12, "bandpass", 0, spatial);
      tone(110, 52, 0.42, "sine", 0.09, 0.03, spatial);
    } else {
      tone(570, 1800, 0.25, "sine", 0.07);
      tone(1350, 920, 0.26, "triangle", 0.055, 0.17);
      noise(0.07, 7200, 0.09, "highpass", 0.22);
    }
  },
  roar: () => {
    [110, 165, 220].forEach((frequency) =>
      tone(frequency, 50, 0.42, "sawtooth", 0.035),
    );
    noise(0.35, 680, 0.11);
  },
  static: () => {
    tone(630, 230, 0.25, "square", 0.035);
    noise(0.22, 5400, 0.09, "highpass");
    tone(240, 740, 0.18, "sine", 0.05, 0.4);
  },
};

const fallbackSignature: Signature = () => {
  noise(0.32, 3000, 0.14);
  tone(350, 1100, 0.3, "triangle", 0.075);
  [0.02, 0.13, 0.24].forEach((delay) =>
    tone(125, 65, 0.075, "sine", 0.1, delay),
  );
};

/** A fighter's special cue: its culture cue, a hand-written signature or the fallback. */
export function specialSound(
  ability: Ability,
  superImpact: boolean,
  spatial: AudioNode | null,
) {
  const cultureSound = CULTURE_SOUNDS[ability];
  if (cultureSound) cultureSignature(cultureSound, spatial);
  else
    (SIGNATURES[ability] ?? fallbackSignature)(spatial, ability, superImpact);
}
