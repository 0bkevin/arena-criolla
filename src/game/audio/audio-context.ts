// The shared Web Audio graph. This module is the only writer of the context,
// its buses and the sound/visibility flags; other modules read the live bindings.
export const MUSIC_GAIN = 0.12;
export let context: AudioContext | null = null;
let masterBus: GainNode | null = null;
export let effectsBus: GainNode | null = null;
export let reactionsBus: GainNode | null = null;
export let musicBus: GainNode | null = null;
export let enabled = true;
export let pageHidden = false;
let resumeAttempt: Promise<void> | null = null;

export function setSoundEnabled(value: boolean) {
  enabled = value;
}

export function initAudio(retryResume = false) {
  if (!enabled) return;
  try {
    if (!context) {
      context = new AudioContext();
      createBuses(context);
    }
    // Mobile browsers can leave a context interrupted after a call or app switch.
    // A blocked autoplay resume may remain pending: a fresh gesture must retry it.
    if (
      !pageHidden &&
      (context.state === "suspended" || context.state === "interrupted") &&
      (!resumeAttempt || retryResume)
    ) {
      const attempt = context
        .resume()
        .catch(() => {})
        .finally(() => {
          if (resumeAttempt === attempt) resumeAttempt = null;
        });
      resumeAttempt = attempt;
    }
  } catch {}
}

/** Route every bus through one limiter into the master gain. */
function createBuses(ctx: AudioContext) {
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -12;
  limiter.knee.value = 12;
  limiter.ratio.value = 8;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.18;
  masterBus = ctx.createGain();
  masterBus.gain.value = pageHidden ? 0 : 0.85;
  limiter.connect(masterBus);
  masterBus.connect(ctx.destination);
  effectsBus = ctx.createGain();
  effectsBus.gain.value = 0.8;
  effectsBus.connect(limiter);
  reactionsBus = ctx.createGain();
  reactionsBus.gain.value = 0.7;
  reactionsBus.connect(limiter);
  musicBus = ctx.createGain();
  musicBus.gain.value = MUSIC_GAIN;
  musicBus.connect(limiter);
}

/** Fade the effect, reaction and music buses for mute and unmute. */
export function fadeBuses(audible: boolean) {
  if (!context) return;
  effectsBus?.gain.setTargetAtTime(
    audible ? 0.8 : 0,
    context.currentTime,
    0.02,
  );
  reactionsBus?.gain.setTargetAtTime(
    audible ? 0.7 : 0,
    context.currentTime,
    0.02,
  );
  musicBus?.gain.setTargetAtTime(
    audible ? MUSIC_GAIN : 0,
    context.currentTime,
    0.02,
  );
}

/** Silence the whole graph while hidden; retry playback when the page returns. */
export function setPageHidden(hidden: boolean) {
  pageHidden = hidden;
  if (context) {
    masterBus?.gain.setTargetAtTime(
      hidden ? 0 : 0.85,
      context.currentTime,
      0.02,
    );
    if (!hidden) initAudio(true);
  }
}
