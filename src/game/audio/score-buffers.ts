import type { FighterId } from "../../../shared/roster/roster";
import { MUSIC_SECONDS } from "./arcade-music";
import { VICTORY_MUSIC_MS } from "../match/victory-types";
import { victoryMusicStyle } from "./victory-music";
import { preparationWorker } from "../assets/preparation-worker";
import { synthesizeScore, type ScoreRequest } from "./music-preparation";
import { finaleById } from "../../../shared/engine/finales/finales";
import { context, enabled, initAudio } from "./audio-context";

const prepareScore = preparationWorker(
  () =>
    new Worker(new URL("./music.worker.ts", import.meta.url), {
      type: "module",
    }),
  synthesizeScore,
);
const scores = new Map<string, AudioBuffer>();
const pendingScores = new Map<string, Promise<void>>();

export function ambienceRequest(sampleRate: number): ScoreRequest {
  return {
    kind: "ambience",
    sampleRate,
    length: Math.round(sampleRate * MUSIC_SECONDS),
  };
}

/** `ticks` is the scene length at 60 ticks per second. */
export function finaleRequest(
  fighter: FighterId,
  sampleRate: number,
  ticks: number,
): ScoreRequest {
  const finale = finaleById(fighter);
  return {
    kind: "finale",
    profile: finale
      ? {
          duration: finale.duration,
          sound: finale.sound,
          damageBeats: finale.damageBeats,
        }
      : undefined,
    fighter,
    sampleRate,
    length: Math.ceil((sampleRate * ticks) / 60),
  };
}

export function victoryRequest(
  fighter: FighterId | "draw",
  sampleRate: number,
): ScoreRequest {
  return {
    kind: "victory",
    style: fighter === "draw" ? "strings" : victoryMusicStyle(fighter),
    fighter,
    sampleRate,
    length: Math.ceil((sampleRate * VICTORY_MUSIC_MS) / 1000),
  };
}

/** The cached buffer, or undefined while a worker prepares it. */
export function scoreBuffer(request: ScoreRequest): AudioBuffer | undefined {
  const key = JSON.stringify(request);
  const cached = scores.get(key);
  if (cached) {
    scores.delete(key);
    scores.set(key, cached);
    return cached;
  }
  if (!context || pendingScores.has(key)) return undefined;
  const ctx = context;
  const save = ({ left, right }: ReturnType<typeof synthesizeScore>) => {
    const buffer = ctx.createBuffer(2, request.length, request.sampleRate);
    buffer.getChannelData(0).set(left);
    buffer.getChannelData(1).set(right);
    scores.set(key, buffer);
    // Playing sources own their buffers; eviction only affects future preparation.
    while (scores.size > 12) scores.delete(scores.keys().next().value!);
  };
  const result = prepareScore(request);
  if (result instanceof Promise) {
    pendingScores.set(
      key,
      result.then(save).finally(() => pendingScores.delete(key)),
    );
    return undefined;
  }
  save(result);
  return scores.get(key);
}

export function pendingScore(request: ScoreRequest) {
  return pendingScores.get(JSON.stringify(request));
}

/** Prepare only the selected scores; playback always uses the current scene clock. */
export async function prepareMatchAudio(fighters: FighterId[]) {
  initAudio();
  if (!context || !enabled) return;
  const sampleRate = context.sampleRate;
  scoreBuffer(ambienceRequest(sampleRate));
  for (const fighter of new Set(fighters)) {
    const finale = finaleById(fighter);
    if (finale)
      scoreBuffer(finaleRequest(fighter, sampleRate, finale.duration));
  }
  for (const fighter of new Set<FighterId | "draw">([...fighters, "draw"]))
    scoreBuffer(victoryRequest(fighter, sampleRate));
  await Promise.all(pendingScores.values());
}
