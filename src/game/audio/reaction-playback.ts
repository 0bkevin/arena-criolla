import type { FighterId } from "../../../shared/roster/roster";
import {
  REACTION_CLIPS,
  type ReactionBank,
  type ReactionKind,
} from "./reactions";
import { assetUrl } from "../assets/asset-url";
import { context, enabled, pageHidden, reactionsBus } from "./audio-context";
import { stereoPosition } from "./sound-view";
import type { SoundOptions } from "./sound-effects";

const FEMALE_VOICES: readonly string[] = [
  "maite",
  "mcm",
  "llorona",
  "sayona",
  "lionza",
  "lila",
  "rummy",
  "chiqui",
  "norkys",
  "gabriela",
  "amanda",
  "lele",
];

interface ReactionChannel {
  source: AudioBufferSourceNode | null;
  ticket: number;
  lastAt: number;
  priority: number;
  previous: string;
}

let reactionsPaused = false;
// One voice per player seat.
const reactions = [0, 1].map((): ReactionChannel => ({
  source: null,
  ticket: 0,
  lastAt: -Infinity,
  priority: 0,
  previous: "",
}));
const buffers = new Map<string, Promise<AudioBuffer | null>>();

export function stopReactions() {
  for (const reaction of reactions) {
    reaction.ticket++;
    reaction.source?.stop();
    reaction.source = null;
    reaction.lastAt = -Infinity;
    reaction.priority = 0;
  }
}

export function setReactionsPaused(paused: boolean) {
  if (reactionsPaused === paused) return;
  reactionsPaused = paused;
  if (paused) stopReactions();
}

function loadReaction(file: string) {
  if (!context) return Promise.resolve(null);
  if (!buffers.has(file)) {
    const ctx = context;
    buffers.set(
      file,
      fetch(assetUrl(file))
        .then((r) => {
          if (!r.ok) throw new Error("Audio no disponible");
          return r.arrayBuffer();
        })
        .then((data) => ctx.decodeAudioData(data))
        .catch(() => {
          buffers.delete(file);
          return null;
        }),
    );
  }
  return buffers.get(file)!;
}

export function preloadReactions() {
  if (!enabled || !context) return;
  for (const bank of Object.values(REACTION_CLIPS))
    for (const clips of Object.values(bank))
      for (const file of clips) void loadReaction(file);
}

const reactionBank = (fighter: FighterId): ReactionBank =>
  FEMALE_VOICES.includes(fighter) ? "female" : "male";

function reactionVolume(kind: ReactionKind, impact: SoundOptions["impact"]) {
  const heavy = impact === "heavy" || impact === "super";
  return kind === "jump"
    ? 0.46
    : kind === "attack"
      ? heavy
        ? 0.65
        : 0.52
      : heavy
        ? 0.78
        : 0.65;
}

/** Whether a reaction may start now; also rechecked once its clip has loaded. */
const canPlay = (): boolean =>
  enabled &&
  !pageHidden &&
  !reactionsPaused &&
  context !== null &&
  reactionsBus !== null &&
  context.state === "running";

export function playReaction(
  kind: ReactionKind,
  fighter: FighterId,
  options: SoundOptions & { player: 0 | 1 },
) {
  if (!canPlay()) return;
  const reaction = reactions[options.player];
  const priority = kind === "hurt" ? 2 : 1;
  const now = performance.now();
  // Damage can interrupt effort. Never stack a fighter's cries or chatter every frame.
  if (
    priority <= reaction.priority &&
    now - reaction.lastAt < (kind === "hurt" ? 140 : 230)
  )
    return;
  if (reaction.source && priority < reaction.priority) return;
  const clips = REACTION_CLIPS[reactionBank(fighter)][kind];
  const alternatives = clips.filter((file) => file !== reaction.previous);
  const file = alternatives[Math.floor(Math.random() * alternatives.length)];
  reaction.source?.stop();
  reaction.source = null;
  const ticket = ++reaction.ticket;
  reaction.lastAt = now;
  reaction.priority = priority;
  reaction.previous = file;
  void loadReaction(file).then((buffer) => {
    if (
      !buffer ||
      ticket !== reaction.ticket ||
      !canPlay() ||
      performance.now() - now > 180
    )
      return;
    startReaction(reaction, buffer, kind, options);
  });
}

function startReaction(
  reaction: ReactionChannel,
  buffer: AudioBuffer,
  kind: ReactionKind,
  options: SoundOptions,
) {
  // Already guaranteed by canPlay(); repeated here for type narrowing.
  if (!context || !reactionsBus) return;
  const source = context.createBufferSource();
  source.buffer = buffer;
  const pan = context.createStereoPanner();
  pan.pan.value = stereoPosition(options.x);
  const envelope = context.createGain();
  envelope.gain.value = reactionVolume(kind, options.impact);
  source.connect(envelope);
  envelope.connect(pan);
  pan.connect(reactionsBus);
  reaction.source = source;
  source.onended = () => {
    source.disconnect();
    envelope.disconnect();
    pan.disconnect();
    if (reaction.source === source) {
      reaction.source = null;
      reaction.priority = 0;
    }
  };
  // Let the impact's transient through before its short pain response.
  source.start(context.currentTime + (kind === "hurt" ? 0.035 : 0));
}
