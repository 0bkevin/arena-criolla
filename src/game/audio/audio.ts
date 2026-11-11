// Public entry point for game audio. Each subsystem lives in its own module.
export { initAudio } from "./audio-context";
export { listenForAudioActivation, setSound } from "./audio-lifecycle";
export { prepareMatchAudio } from "./score-buffers";
export { setSoundView } from "./sound-view";
export { setAmbiencePaused, startAmbience, stopAmbience } from "./ambience";
export {
  startVictoryMusic,
  stopFinaleMusic,
  stopVictoryMusic,
  syncFinaleMusic,
  syncVictoryMusic,
} from "./music-playback";
export {
  playReaction,
  preloadReactions,
  setReactionsPaused,
  stopReactions,
} from "./reaction-playback";
export { sound, type SoundOptions } from "./sound-effects";
