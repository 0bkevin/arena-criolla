// Complementary engine audit, not a substitute for the browser walkthrough.
// Run: node --import tsx scripts/character-physics-stress.ts [output.json]
import { writeFileSync } from "node:fs";
import { BUILT_IN_FIGHTERS, STAGES, platformsAtTick } from "../shared/content";
import { createMatch, emptyInput, stepMatch, WORLD } from "../shared/engine";

const initialSeed = 20261017;
let seed = initialSeed;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
const result = {
  seed: initialSeed,
  roster: BUILT_IN_FIGHTERS.length,
  stages: STAGES.length,
  runs: 0,
  steps: 0,
  elevatedLandings: 0,
  specialsObserved: 0,
  finished: 0,
  violations: [] as unknown[],
  edgeOverhangSamples: 0,
  edgeSamples: [] as unknown[],
  cases: [] as unknown[],
};

for (const [fighterIndex, fighter] of BUILT_IN_FIGHTERS.entries()) {
  for (const stage of STAGES) {
    const opponent =
      BUILT_IN_FIGHTERS[(fighterIndex + 13) % BUILT_IN_FIGHTERS.length];
    const state = createMatch(stage.id, [
      { name: "Audit A", fighter: fighter.id, wins: 0 },
      { name: "Audit B", fighter: opponent.id, wins: 0 },
    ]);
    const inputs: [
      ReturnType<typeof emptyInput>,
      ReturnType<typeof emptyInput>,
    ] = [emptyInput(), emptyInput()];
    const totals = {
      fighter: fighter.id,
      opponent: opponent.id,
      stage: stage.id,
      steps: 0,
      elevatedLandings: 0,
      specialsObserved: 0,
    };
    const lastSupport: (number | null)[] = [-1, -1];
    const lastAttack: (string | null)[] = [null, null];

    // Every run starts with the real introduction and ends naturally or at the
    // fixed input budget. Only inputs change: fighter state is never assigned.
    for (let n = 0; n < 2400 && state.phase !== "finished"; n++) {
      for (let i = 0; i < 2; i++) {
        const player = state.players[i];
        const other = state.players[1 - i];
        const input = inputs[i];
        if (n % 35 === i) {
          const toward = Math.sign(other.x - player.x);
          const direction = random() < 0.75 ? toward : -toward;
          input.left = direction < 0;
          input.right = direction > 0;
          input.down = random() < 0.12;
          input.block = random() < 0.08;
        }
        if (n % (43 + i * 7) === 0) input.actions.jump++;
        if (n % (23 + i * 6) === 0) input.actions.light++;
        if (n % (41 + i * 2) === 0) input.actions.heavy++;
        if (n % (107 + i * 12) === 0) input.actions.special++;
        if (n % (173 + i * 8) === 0) input.actions.dash++;
      }
      stepMatch(state, inputs);
      result.steps++;
      totals.steps++;
      if (state.phase !== "playing") continue;
      const platforms = platformsAtTick(stage.id, state.tick);
      for (let i = 0; i < 2; i++) {
        const player = state.players[i];
        const fields = [
          "x",
          "y",
          "vx",
          "vy",
          "hp",
          "energy",
          "jumps",
          "stocks",
        ] as const;
        const invalidField = fields.find(
          (field) => !Number.isFinite(player[field]),
        );
        let reason: string | undefined = invalidField
          ? `non-finite ${invalidField}`
          : undefined;
        if (!reason && player.grounded) {
          const surface =
            player.supportPlatform === -1
              ? {
                  x: WORLD.left,
                  y: WORLD.floor,
                  width: WORLD.right - WORLD.left,
                }
              : player.supportPlatform === null
                ? undefined
                : platforms[player.supportPlatform];
          if (!surface) reason = "grounded without support";
          else if (Math.abs(player.y - surface.y) > 0.002 || player.vy !== 0)
            reason = "grounded height/velocity mismatch";
          else if (
            player.x < surface.x - 5.001 ||
            player.x > surface.x + surface.width + 5.001
          ) {
            // A body push must invalidate support after leaving this interval.
            reason = "grounded outside support";
            result.edgeOverhangSamples++;
            if (result.edgeSamples.length < 30)
              result.edgeSamples.push({
                ...totals,
                n,
                tick: state.tick,
                player: i,
                support: player.supportPlatform,
                surface,
                pose: { ...player },
                other: { ...state.players[1 - i] },
                inputs: structuredClone(inputs),
              });
          }
        } else if (!reason && player.supportPlatform !== null) {
          reason = "airborne retains support";
        }
        if (reason && result.violations.length < 20)
          result.violations.push({
            ...totals,
            n,
            tick: state.tick,
            player: i,
            reason,
            pose: { ...player },
          });
        if (
          player.grounded &&
          player.supportPlatform !== null &&
          player.supportPlatform >= 0 &&
          player.supportPlatform !== lastSupport[i]
        ) {
          result.elevatedLandings++;
          totals.elevatedLandings++;
        }
        if (player.attack === "special" && lastAttack[i] !== "special") {
          result.specialsObserved++;
          totals.specialsObserved++;
        }
        lastSupport[i] = player.supportPlatform;
        lastAttack[i] = player.attack;
      }
    }
    result.runs++;
    if (state.phase === "finished") result.finished++;
    result.cases.push(totals);
  }
}

const output = process.argv[2];
if (output) writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
const { cases, violations, edgeSamples, ...summary } = result;
console.log(
  JSON.stringify({
    ...summary,
    violations: violations.length,
    ...(output && { output }),
  }),
);
if (violations.length) process.exitCode = 1;
