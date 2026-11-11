// Original instrumental: a quiet 6/8 cuatro-style accompaniment, no recordings.
// Render once and loop a buffer so background tabs cannot drift or stack timers.
const EIGHTH = 60 / 116 / 2;
const BARS = 16;
export const MUSIC_SECONDS = BARS * 6 * EIGHTH;

export function writeArcadeMusic(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
) {
  const note = (
    midi: number,
    at: number,
    duration: number,
    volume: number,
    pan = 0,
    bass = false,
  ) => {
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    const start = Math.round(at * sampleRate);
    const count = Math.round(duration * sampleRate);
    for (let n = 0; n < count; n++) {
      // Wrap the last release into the beginning for a seamless musical loop.
      const index = (start + n) % left.length;
      const t = n / sampleRate;
      const phase = Math.PI * 2 * frequency * t;
      const attack = Math.min(1, t / 0.007);
      const release = Math.min(1, (duration - t) / 0.035);
      const envelope = attack * release * Math.exp(-t * (bass ? 6 : 13));
      const brightness = Math.exp(-t * 18);
      const wave =
        Math.sin(phase) +
        (bass ? 0.14 : 0.34 * brightness) * Math.sin(phase * 2) +
        (bass ? 0 : 0.13 * brightness) * Math.sin(phase * 3);
      const value = wave * envelope * volume;
      left[index] += value * Math.sqrt((1 - pan) / 2);
      right[index] += value * Math.sqrt((1 + pan) / 2);
    }
  };
  let percussionSeed = 0x6ac1;
  const maraca = (at: number, volume: number, pan: number) => {
    const start = Math.round(at * sampleRate);
    const duration = 0.045;
    let previous = 0;
    for (let n = 0; n < duration * sampleRate; n++) {
      percussionSeed = (Math.imul(percussionSeed, 1664525) + 1013904223) >>> 0;
      const noise = percussionSeed / 0x80000000 - 1;
      const t = n / sampleRate;
      const envelope =
        Math.min(1, t / 0.003) *
        Math.exp(-t * 105) *
        Math.min(1, (duration - t) / 0.008);
      const value = (noise - previous * 0.75) * envelope * volume;
      previous = noise;
      const index = (start + n) % left.length;
      left[index] += value * Math.sqrt((1 - pan) / 2);
      right[index] += value * Math.sqrt((1 + pan) / 2);
    }
  };
  // Low D-minor voicings keep the cuatro rhythm without a bright nursery melody.
  const chords = [
    [57, 62, 65, 69],
    [58, 62, 65, 69],
    [57, 60, 65, 69],
    [55, 61, 64, 69],
  ];
  const roots = [38, 34, 41, 33];
  const melody = [
    [65, 64],
    [62, 60],
    [60, 57],
    [61, 64],
  ];
  for (let bar = 0; bar < BARS; bar++) {
    const harmony = Math.floor(bar / 2) % chords.length;
    const time = bar * 6 * EIGHTH;
    note(roots[harmony], time, 0.42, 0.13, 0, true);
    note(roots[harmony] + 7, time + 3 * EIGHTH, 0.32, 0.095, 0, true);
    if (bar % 2 === 1)
      note(roots[harmony] + 12, time + 2.5 * EIGHTH, 0.16, 0.04, 0, true);
    if (bar % 4 === 3) {
      const nextRoot = roots[Math.floor((bar + 1) / 2) % roots.length];
      note(nextRoot - 1, time + 5.5 * EIGHTH, 0.16, 0.045, 0, true);
    }
    const strums = bar % 2 === 0 ? [0, 1.5, 3, 4, 5] : [0, 2, 3, 4.5, 5.5];
    for (const beat of strums) {
      chords[harmony].forEach((pitch, string) =>
        note(
          pitch,
          time + beat * EIGHTH + string * 0.009,
          0.21,
          beat === 0 || beat === 3 ? 0.046 : 0.028,
          (string - 1.5) * 0.18,
        ),
      );
    }
    // Dry maracas supply a pulse; four-bar fills give the loop a little lift.
    const shakerBeats = bar % 4 === 3 ? [0, 1, 2, 3, 4, 5, 5.5] : [0, 2, 3, 5];
    for (const beat of shakerBeats)
      maraca(
        time + beat * EIGHTH,
        beat === 0 || beat === 3 ? 0.018 : 0.011,
        beat % 2 ? 0.32 : -0.32,
      );
    // Low answering phrases leave space for combat instead of repeating a jingle.
    if (bar % 2 === 1)
      melody[harmony].forEach((pitch, i) =>
        note(pitch, time + (i * 1.5 + 1.5) * EIGHTH, 0.23, 0.017, 0.12),
      );
  }
}
