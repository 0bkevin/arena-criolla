import type { StageId } from "../../../shared/roster/roster";
import { context, enabled, initAudio, musicBus } from "./audio-context";
import { ambienceRequest, pendingScore, scoreBuffer } from "./score-buffers";
import { resetSoundView } from "./sound-view";

/** The stage the game asked for, even while muted or still preparing. */
export let ambienceStage: StageId | null = null;
let activeAmbienceStage: StageId | null = null;
let ambienceNodes: AudioNode[] = [];
let ambienceGain: GainNode | null = null;
let ambiencePaused = false;
let ambienceTicket = 0;

export function stopAmbience() {
  ambienceTicket++;
  for (const node of ambienceNodes) {
    try {
      if ("stop" in node) (node as AudioBufferSourceNode).stop();
      node.disconnect();
    } catch {}
  }
  ambienceNodes = [];
  ambienceGain = null;
  activeAmbienceStage = null;
  ambienceStage = null;
  resetSoundView();
}

export function setAmbiencePaused(paused: boolean) {
  if (ambiencePaused === paused) return;
  ambiencePaused = paused;
  if (context && ambienceGain)
    ambienceGain.gain.setTargetAtTime(
      paused ? 0 : 1,
      context.currentTime,
      0.06,
    );
}

export function startAmbience(stage: StageId) {
  ambienceStage = stage;
  if (!enabled) return;
  initAudio();
  if (!context || !musicBus || activeAmbienceStage === stage) return;
  stopAmbience();
  ambienceStage = stage;
  const request = ambienceRequest(context.sampleRate);
  const musicBuffer = scoreBuffer(request);
  if (!musicBuffer) {
    const ticket = ambienceTicket;
    void pendingScore(request)?.then(() => {
      if (ticket === ambienceTicket && ambienceStage === stage && enabled)
        startAmbience(stage);
    });
    return;
  }
  activeAmbienceStage = stage;
  const source = context.createBufferSource();
  source.buffer = musicBuffer;
  source.loop = true;
  ambienceGain = context.createGain();
  ambienceGain.gain.value = ambiencePaused ? 0 : 1;
  source.connect(ambienceGain);
  ambienceGain.connect(musicBus);
  ambienceNodes = [source, ambienceGain];
  source.start();
}
