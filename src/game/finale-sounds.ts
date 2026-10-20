import type { FighterId } from "../../shared/content";
import { finaleById } from "../../shared/finales";

/** Original score, synthesized locally. No commercial song or sampled recording. */
export function writeFinaleMusic(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  fighter: FighterId,
) {
  const profile = finaleById(fighter);
  if (!profile || sampleRate <= 0) return;
  const duration = profile.duration / 60;
  const identity = [...fighter].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const root = 48 + (identity % 7);
  const style = profile.sound;
  const tone = (
    midi: number,
    at: number,
    length: number,
    gain: number,
    pan = 0,
    timbre = style,
  ) => {
    const start = Math.round(at * sampleRate);
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    for (
      let i = 0;
      i < Math.round(length * sampleRate) &&
      start + i < Math.min(left.length, right.length);
      i++
    ) {
      const time = i / sampleRate;
      const phase = time * frequency * Math.PI * 2;
      const attack = Math.min(1, time / 0.008);
      const release = Math.max(0, Math.min(1, (length - time) / 0.06));
      const tail = Math.max(0, Math.min(1, (duration - at - time) / 0.16));
      const decay = Math.exp(
        -time * (timbre === "coffee" || timbre === "music" ? 6 : 3),
      );
      const overtones =
        timbre === "hack"
          ? 0.22
          : timbre === "engine"
            ? 0.32
            : timbre === "mystic"
              ? 0.07
              : 0.14;
      const wave =
        Math.sin(phase + (timbre === "mystic" ? Math.sin(time * 9) * 0.7 : 0)) +
        Math.sin(phase * 2.005) * overtones * Math.exp(-time * 8);
      const value = wave * attack * release * tail * decay * gain;
      left[start + i] += value * Math.sqrt((1 - pan) / 2);
      right[start + i] += value * Math.sqrt((1 + pan) / 2);
    }
  };
  const drum = (at: number, kick: boolean, pan = 0) => {
    const length = kick ? 0.18 : 0.075;
    const start = Math.round(at * sampleRate);
    let seed = identity * 71 + Math.round(at * 1000);
    for (
      let i = 0;
      i < Math.round(length * sampleRate) &&
      start + i < Math.min(left.length, right.length);
      i++
    ) {
      const time = i / sampleRate;
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
      const noise = (seed >>> 0) / 2147483648 - 1;
      const wave = kick
        ? Math.sin(2 * Math.PI * (48 * time + 6 * (1 - Math.exp(-time * 28))))
        : noise;
      const value =
        wave *
        Math.exp(-time * (kick ? 23 : 75)) *
        Math.min(1, time / 0.003) *
        (kick ? 0.18 : 0.045);
      left[start + i] += value * (0.7 - pan * 0.25);
      right[start + i] += value * (0.7 + pan * 0.25);
    }
  };
  if (fighter === "llorona") {
    // Newly synthesized descending lament and watery impacts. No recording or voice.
    [0, 12, 25].forEach((tick, i) =>
      tone(76 - i * 5, tick / 60, 0.65, 0.09, 0, "mystic"),
    );
    [36, 60, 100, 138, 148, 168].forEach((tick, i) => {
      tone([43, 39, 35, 31, 43, 55][i], tick / 60, 0.28, 0.12, 0, "mystic");
      tone([79, 74, 69, 64, 69, 76][i], tick / 60, 0.24, 0.045, 0, "mystic");
    });
    profile.damageBeats.forEach((tick) => drum(tick / 60, true));
  } else if (fighter === "dudamel") {
    // Three newly composed orchestral chords: gesture, travel, arrival.
    profile.damageBeats.forEach((tick, index) => {
      [48, 55, 60, 64, 67].forEach((midi, voice) => {
        tone(
          midi + [0, 2, 5][index],
          (tick - 24) / 60,
          0.55,
          0.045,
          (voice - 2) * 0.24,
        );
        tone(
          midi + [0, 2, 5][index],
          tick / 60,
          0.32,
          0.055,
          (voice - 2) * 0.24,
        );
      });
      drum(tick / 60, true);
    });
  } else if (fighter === "simon") {
    // A newly composed, quiet plucked phrase; no recording or quoted melody.
    // Four-note strums land on the exact three wooden-horse contacts.
    const strum = (at: number, inversion: number) => {
      [0, 5, 9, 2].forEach((interval, string) =>
        tone(
          root + 7 + interval + inversion,
          at + string * 0.008,
          0.36,
          0.065,
          (string - 1.5) * 0.18,
        ),
      );
    };
    strum(0.04, 0);
    for (const [i, interval] of [0, 2, 7, 5, 4, 2].entries())
      tone(root + 19 + interval, 0.16 + i * 0.42, 0.3, 0.065, 0.1);
    profile.damageBeats.forEach((tick, index) =>
      strum(tick / 60, [0, 2, 0][index]),
    );
  } else if (fighter === "ali") {
    // Four nylon-like plucks, reentrant A3/D4/F#4/B3. A synthetic vowel choir
    // joins at tick60 and grows into the last impact; no recording or real voice.
    for (const tick of [18, 34, 50, 66, 82, 98, 114, 132])
      [57, 62, 66, 59].forEach((midi, string) =>
        tone(
          midi,
          tick / 60 + string * 0.009,
          0.34,
          0.065,
          (string - 1.5) * 0.18,
        ),
      );
    for (let voice = 0; voice < 6; voice++) {
      const at = (60 + voice * 3) / 60;
      const start = Math.round(at * sampleRate);
      const frequency =
        440 * 2 ** (([50, 57, 62, 66, 69, 74][voice] - 69) / 12);
      const length = 2.68 - at;
      for (
        let i = 0;
        i < length * sampleRate &&
        start + i < Math.min(left.length, right.length);
        i++
      ) {
        const time = i / sampleRate;
        const phase = 2 * Math.PI * frequency * time;
        const envelope =
          Math.min(1, time / 0.18) * Math.min(1, (length - time) / 0.3);
        const growth = 0.55 + 0.45 * Math.min(1, time / 1.2);
        const vowel =
          Math.sin(phase) +
          0.28 * Math.sin(phase * 2) +
          0.12 * Math.sin(phase * 3);
        const value = vowel * envelope * growth * 0.026;
        left[start + i] += value * (0.85 - voice * 0.1);
        right[start + i] += value * (0.35 + voice * 0.1);
      }
    }
    profile.damageBeats.forEach((tick, index) => {
      tone(57 + index * 5, tick / 60, 0.22, 0.09 + index * 0.025);
      drum(tick / 60, true);
    });
  } else if (fighter === "dayana") {
    // One synchronized boot strike and one collective arrival; buffer plays once.
    drum(66 / 60, true, -0.25);
    drum(66 / 60, false, 0.25);
    drum(100 / 60, true);
    tone(45, 100 / 60, 0.16, 0.1);
  } else if (fighter === "bolivar") {
    // Original hoof rhythm and short bugle-like interval; no historical song sample.
    for (let tick = 36; tick < 138; tick += 9) {
      drum(tick / 60, true, -0.25);
      drum((tick + 3) / 60, false, 0.25);
    }
    [55, 62, 67].forEach((note, i) => tone(note, 0.08 + i * 0.14, 0.22, 0.07));
    drum(96 / 60, true);
    tone(43, 96 / 60, 0.24, 0.12);
  } else if (fighter === "lorenzo") {
    // Original engine hum: acceleration starts with the convoy, one bumper thud.
    for (let i = 0; i < 6; i++)
      tone(
        30 + i * 2,
        (54 + i * 7) / 60,
        0.24,
        0.08,
        ((i % 3) - 1) * 0.35,
        "engine",
      );
    drum(96 / 60, true);
    drum(96 / 60, false);
    tone(32, 122 / 60, 0.35, 0.055, 0, "engine");
  } else if (fighter === "melanio") {
    // One recording chirp, one local shutter, one phone contact; synthesized once
    // into the finale buffer, never retriggered by a render frame.
    tone(root + 31, 18 / 60, 0.09, 0.055);
    tone(root + 36, 22 / 60, 0.09, 0.04);
    drum(66 / 60, false);
    tone(root + 43, 66 / 60, 0.045, 0.06);
    drum(114 / 60, true);
    drum(114 / 60, false, 0.15);
  } else if (fighter === "oscar") {
    // Original pizzicato bass phrase. Each launch and arrival is audible;
    // no commercial melody, vocal impersonation or sampled performance.
    profile.damageBeats.forEach((tick, index) => {
      tone(root - 19 + [0, 7, 5][index], (tick - 24) / 60, 0.48, 0.22);
      tone(root - 7 + [0, 7, 5][index], tick / 60, 0.24, 0.1, 0.15);
      drum(tick / 60, false, index % 2 ? -0.4 : 0.4);
    });
    [0.06, 0.92, 1.72, 2.55].forEach((at, index) =>
      tone(root - 19 + [0, 2, 7, 0][index], at, 0.2, 0.08),
    );
  } else if (style === "dance") {
    // A new dembow/salsa groove follows the on-screen steps. It does not quote
    // Perro Mujeriego's melody or reproduce its recording.
    const beat = fighter === "nacho" ? 0.375 : fighter === "lila" ? 0.333 : 0.3;
    for (let i = 0; i * beat < duration - 0.15; i++) {
      drum(i * beat, true);
      drum(i * beat + beat * 0.75, false, i % 2 ? -0.6 : 0.6);
      tone(root - 12 + [0, 0, 7, 3][i % 4], i * beat, 0.22, 0.11);
      if (i % 2 === 1)
        for (const [n, chord] of [0, 3, 7].entries())
          tone(root + 12 + chord, i * beat, 0.15, 0.065, (n - 1) * 0.5);
    }
  } else if (style === "coffee") {
    [0, 4, 7, 11].forEach((interval, i) =>
      tone(root + 12 + interval, 0.04 + i * 0.04, 0.8, 0.07, (i - 1.5) * 0.3),
    );
    for (const at of [0.4, 1.2, 2]) {
      tone(root + 24, at, 0.12, 0.075, -0.3);
      tone(root + 31, at + 0.035, 0.12, 0.04, 0.3);
      for (let i = 0; i < 3; i++)
        tone(root + [4, 7, 2][i], at + 0.16 + i * 0.07, 0.07, 0.035, -0.15);
    }
  } else if (style === "hack") {
    for (let i = 0; i < 16; i++) {
      tone(
        root + 24 + [0, 7, 12, 3][(i + identity) % 4],
        0.07 + i * 0.145,
        0.045,
        0.05,
        i % 2 ? 0.5 : -0.5,
      );
      if (i % 4 === 0) drum(0.07 + i * 0.145, false);
    }
  } else if (style === "engine") {
    for (let i = 0; i < 9; i++) {
      tone(root - 24 + i, i * 0.28, 0.42, 0.095, ((i % 3) - 1) * 0.5);
      drum(i * 0.28, true);
    }
  } else if (style === "mystic") {
    [0, 7, 15].forEach((interval, i) =>
      tone(root + interval, i * 0.22, 2.1, 0.09, (i - 1) * 0.6),
    );
    for (let i = 0; i < 6; i++)
      tone(root + 36 - i * 2, 0.26 + i * 0.38, 0.5, 0.06, Math.sin(i) * 0.6);
  } else {
    const intervals =
      style === "music"
        ? [0, 7, 12, 4, 7, 16, 12, 7]
        : [0, 4, 7, 12, 7, 4, 12, 16];
    for (const [i, interval] of intervals.entries()) {
      tone(
        root + 12 + interval,
        0.03 + i * 0.3,
        0.4,
        0.09,
        ((i % 3) - 1) * 0.35,
      );
      if (i % 2 === 0) drum(0.03 + i * 0.3, true);
    }
  }
  for (const [i, tick] of profile.damageBeats.entries()) {
    const at = tick / 60;
    tone(root + 12 + i * 7, at, 0.22, 0.1, 0.3);
    tone(root - 12, at, 0.17, 0.11, -0.2);
  }
  // Percussion may straddle the final beat; taper the complete mix to silence.
  const end = Math.min(
    left.length,
    right.length,
    Math.round(duration * sampleRate),
  );
  for (let i = Math.max(0, end - Math.round(sampleRate * 0.08)); i < end; i++) {
    const fade = (end - i - 1) / (sampleRate * 0.08);
    left[i] *= fade;
    right[i] *= fade;
  }
}
