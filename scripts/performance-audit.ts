import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { BUILT_IN_FIGHTERS, STAGES } from "../shared/content";
import {
  createMatch,
  cpuInput,
  emptyInput,
  stepMatch,
  type MatchState,
} from "../shared/engine";

// Fixed IDs and input schedules make the replay digest a behavior guard as well
// as a benchmark. Run before/after on the same host and Node version.
const rounds = Number(process.env.ARENA_PERF_ROUNDS || 3);
if (!Number.isSafeInteger(rounds) || rounds < 1 || rounds > 10)
  throw new Error("ARENA_PERF_ROUNDS must be an integer between 1 and 10.");
const runs: { ms: number; steps: number; digest: string }[] = [];
const snapshots: MatchState[] = [];
for (let round = 0; round < rounds; round++) {
  const hash = createHash("sha256");
  let steps = 0;
  const began = performance.now();
  for (const [index, fighter] of BUILT_IN_FIGHTERS.entries()) {
    for (const stage of STAGES) {
      const opponent =
        BUILT_IN_FIGHTERS[(index + 13) % BUILT_IN_FIGHTERS.length];
      const state = createMatch(
        stage.id,
        [
          { name: "Perf A", fighter: fighter.id, wins: 3 },
          { name: "Perf B", fighter: opponent.id, wins: 3 },
        ],
        `performance-${fighter.id}-${stage.id}`,
      );
      const a = emptyInput();
      let b = emptyInput();
      a.actions.dash = 1;
      for (let tick = 0; tick < 1200 && state.phase !== "finished"; tick++) {
        const gap = state.players[1].x - state.players[0].x;
        a.left = gap < -80;
        a.right = gap > 80;
        a.block = tick % 160 < 18;
        if (tick % 31 === 0) a.actions.light++;
        if (tick % 53 === 0) a.actions.heavy++;
        if (tick % 107 === 0) a.actions.special++;
        if (tick % 151 === 0) a.actions.jump++;
        if (tick % 211 === 0) a.actions.super++;
        b = cpuInput(state, b, "hard");
        stepMatch(state, [a, b]);
        steps++;
        if (round === 0 && tick === 599) snapshots.push(structuredClone(state));
      }
      hash.update(JSON.stringify(state));
    }
  }
  runs.push({
    ms: performance.now() - began,
    steps,
    digest: hash.digest("hex"),
  });
}
const encoded = snapshots.map((state) => ({ type: "state", state }));
let serializationBytes = 0;
const serializationBegan = performance.now();
for (let i = 0; i < 100; i++)
  for (const snapshot of encoded)
    serializationBytes += JSON.stringify(snapshot).length;
const serializationMs = performance.now() - serializationBegan;
const report = {
  recordedAt: new Date().toISOString(),
  node: process.version,
  fighters: BUILT_IN_FIGHTERS.length,
  stages: STAGES.length,
  scenariosPerRound: BUILT_IN_FIGHTERS.length * STAGES.length,
  engine: runs.map((run) => ({
    ...run,
    microsecondsPerStep: (run.ms * 1000) / run.steps,
  })),
  stableReplay: new Set(runs.map((run) => run.digest)).size === 1,
  serialization: {
    count: encoded.length * 100,
    ms: serializationMs,
    bytes: serializationBytes,
  },
  memoryMiB: process.memoryUsage().rss / 1024 ** 2,
};
console.log(JSON.stringify(report, null, 2));
if (process.argv[2])
  writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + "\n");
if (!report.stableReplay) process.exitCode = 1;
