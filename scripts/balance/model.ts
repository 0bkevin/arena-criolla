import { createHash } from "node:crypto";
import { FIGHTERS, STAGES, type StageId } from "../../shared/roster/roster";
import {
  createMatch,
  cpuInput,
  emptyInput,
  stepMatch,
  type PlayerIndex,
} from "../../shared/engine/engine";
import { TECHNIQUES } from "../../shared/engine/techniques";
import { finaleById } from "../../shared/engine/finales/finales";
import {
  LIGHT_DAMAGE,
  HEAVY_DAMAGE,
  SUPER_DAMAGE,
  LIGHT_HEAVY_BONUS,
  LIGHT_LIGHT_HEAVY_BONUS,
  SUPER_BONUS,
  RING_OUT_STOCK_LOSS_THRESHOLD,
  RING_OUT_DAMAGE_FRACTION,
} from "../../shared/engine/damage-values";

const HZ = 60;
const WINDOW = 3 * HZ;
const RECENT_HIT_TICKS = 90;
const PHASES: [number, number][] = [
  [0, 11],
  [11, 0],
  [5, 18],
  [18, 5],
];
type Source = "light" | "heavy" | "special" | "super" | "unknown";
type Difficulty = "easy" | "normal" | "hard";
type Hit = {
  tick: number;
  damage: number;
  hpBefore: number;
  attacker: PlayerIndex;
  victim: PlayerIndex;
  source: Source;
};
type Stock = {
  tick: number;
  loser: PlayerIndex;
  cause: "hp" | "ring-out";
  hp: number;
  elapsedTicks: number;
  ringOutKind: "launched" | "self" | null;
};
/** A ring-out that cost health but kept the stock. */
type Fall = {
  tick: number;
  loser: PlayerIndex;
  hp: number;
  damage: number;
  ringOutKind: "launched" | "self";
};
/** Remove the exact last HP drop for a victim, representing this fall's own loss. */
export function removeFallHpDrop(
  hits: Hit[],
  firstHitIndex: number,
  victim: PlayerIndex,
): Hit {
  for (let index = hits.length - 1; index >= firstHitIndex; index--) {
    if (hits[index]!.victim === victim) return hits.splice(index, 1)[0]!;
  }
  throw new Error(`Surviving ring-out for player ${victim} had no HP drop`);
}
export type Options = {
  stages: StageId[];
  difficulty: Difficulty;
  limit: number;
};
export function optionsFromEnv(env: NodeJS.ProcessEnv): Options {
  const stages = (env.BALANCE_STAGES ?? STAGES[0]!.id).split(",").map((id) => {
    const stage = STAGES.find((s) => s.id === id.trim());
    if (!stage)
      throw new Error(
        `Unknown stage: ${id}. Valid stages: ${STAGES.map((s) => s.id).join(", ")}`,
      );
    return stage.id;
  });
  const difficulty = env.BALANCE_DIFFICULTY ?? "hard";
  if (difficulty !== "easy" && difficulty !== "normal" && difficulty !== "hard")
    throw new Error("BALANCE_DIFFICULTY must be easy, normal, or hard");
  const limit = Number(env.BALANCE_LIMIT ?? 10000);
  if (!Number.isSafeInteger(limit) || limit < 1)
    throw new Error("BALANCE_LIMIT must be a positive tick limit");
  return { stages, difficulty, limit };
}
export function staticDamage() {
  return FIGHTERS.map((fighter) => {
    const technique = TECHNIQUES[fighter.ability];
    const finale = finaleById(fighter.id);
    const count =
      (technique.pulses?.length ?? 1) * (technique.projectile?.count ?? 1);
    return {
      id: fighter.id,
      name: fighter.name,
      ability: fighter.ability,
      armor: fighter.armor,
      light: LIGHT_DAMAGE * fighter.damage,
      heavy: HEAVY_DAMAGE * fighter.damage,
      specialHit: technique.damage * fighter.damage,
      specialCount: count,
      specialTotal: technique.damage * fighter.damage * count,
      counter: technique.counter
        ? technique.counter.damage * fighter.damage
        : null,
      finale: finale?.mode ?? "unknown",
      finaleBudget:
        finale?.mode === "transformation"
          ? null
          : SUPER_DAMAGE * fighter.damage + SUPER_BONUS,
      empowerment: finale?.empowerment ?? null,
      lightHeavy:
        (LIGHT_DAMAGE + HEAVY_DAMAGE) * fighter.damage + LIGHT_HEAVY_BONUS,
      lightLightHeavy:
        (2 * LIGHT_DAMAGE + HEAVY_DAMAGE) * fighter.damage +
        LIGHT_LIGHT_HEAVY_BONUS,
    };
  });
}
export function simulate(
  a: (typeof FIGHTERS)[number],
  b: (typeof FIGHTERS)[number],
  stage: StageId,
  options: Options,
  variant = 0,
) {
  const state = createMatch(
    stage,
    [
      { name: a.name, fighter: a.id, wins: 3 },
      { name: b.name, fighter: b.id, wins: 3 },
    ],
    `balance-${stage}-${a.id}-${b.id}`,
  );
  const hits: Hit[] = [];
  const stocks: Stock[] = [];
  const falls: Fall[] = [];
  let tick = 0;
  let playingStart = 0;
  const previousStock = [0, 0];
  const lastHit = [-Infinity, -Infinity];
  // The hit before the latest one, so a fall's own HP loss is not its cause.
  const previousHit = [-Infinity, -Infinity];
  for (const i of [0, 1] as const) {
    const p = state.players[i];
    let hp = p.hp;
    let count = p.stocks;
    Object.defineProperty(p, "hp", {
      enumerable: true,
      configurable: true,
      get: () => hp,
      set: (value: number) => {
        if (value < hp && count > 0) {
          hits.push({
            tick,
            damage: hp - value,
            hpBefore: hp,
            attacker: i === 0 ? 1 : 0,
            victim: i,
            source: "unknown",
          });
          previousHit[i] = lastHit[i]!;
          lastHit[i] = tick;
        }
        hp = value;
      },
    });
    Object.defineProperty(p, "stocks", {
      enumerable: true,
      configurable: true,
      get: () => count,
      set: (value: number) => {
        if (value < count) {
          stocks.push({
            tick,
            loser: i,
            cause: hp <= 0 ? "hp" : "ring-out",
            hp,
            elapsedTicks: tick - (previousStock[i] || playingStart),
            ringOutKind:
              hp <= 0
                ? null
                : tick - lastHit[i]! <= RECENT_HIT_TICKS
                  ? "launched"
                  : "self",
          });
          previousStock[i] = tick;
          lastHit[i] = -Infinity;
        }
        count = value;
      },
    });
  }
  let inputs: [ReturnType<typeof emptyInput>, ReturnType<typeof emptyInput>] = [
    emptyInput(),
    emptyInput(),
  ];
  inputs[0].actions.dash = 1;
  while (tick < options.limit && state.phase !== "finished") {
    tick++;
    const offsets = PHASES[variant % PHASES.length]!;
    inputs = [
      cpuInput(
        { ...state, tick: state.tick + offsets[0] },
        inputs[0],
        options.difficulty,
        0,
      ),
      cpuInput(
        { ...state, tick: state.tick + offsets[1] },
        inputs[1],
        options.difficulty,
        1,
      ),
    ];
    const phase = state.phase;
    const firstHit = hits.length;
    const nextEffectId = state.nextId;
    const stockCounts = state.players.map((p) => p.stocks);
    stepMatch(state, inputs);
    // The fall setter is the last HP drop for that victim in this step.
    // Remove that observed event by position, preserving any distinct same-step
    // hit even when it happens to deal the same amount as the fall.
    for (const effect of state.effects) {
      if (effect.id < nextEffectId || effect.kind !== "ringout") continue;
      const loser = effect.owner as PlayerIndex;
      if (state.players[loser].stocks !== stockCounts[loser]) continue;
      const fallDrop = removeFallHpDrop(hits, firstHit, loser);
      falls.push({
        tick,
        loser,
        hp: fallDrop.hpBefore,
        damage: fallDrop.damage,
        ringOutKind:
          tick - previousHit[loser]! <= RECENT_HIT_TICKS ? "launched" : "self",
      });
      lastHit[loser] = -Infinity;
    }
    const effects = state.effects.filter(
      (e) => e.id >= nextEffectId && e.kind === "hit",
    );
    for (const hit of hits.slice(firstHit)) {
      const index = effects.findIndex(
        (e) => e.owner === hit.attacker && e.impact,
      );
      if (index >= 0) hit.source = effects.splice(index, 1)[0]!.impact!;
    }
    if (phase === "intro" && state.phase === "playing") playingStart = tick;
  }
  const sides = ([0, 1] as const).map((side) => {
    const own = hits.filter((hit) => hit.attacker === side);
    let burst = 0,
      start = 0,
      sum = 0;
    for (let end = 0; end < own.length; end++) {
      sum += own[end]!.damage;
      while (own[end]!.tick - own[start]!.tick >= WINDOW)
        sum -= own[start++]!.damage;
      burst = Math.max(burst, sum);
    }
    return {
      damage: own.reduce((n, h) => n + h.damage, 0),
      landedHits: state.players[side].hits,
      biggestHit: Math.max(0, ...own.map((h) => h.damage)),
      burst,
    };
  });
  return {
    fighters: [a.id, b.id],
    stage,
    variant,
    winner: state.winner,
    outcome:
      state.phase !== "finished"
        ? "limit"
        : state.remaining <= 0
          ? "timeout"
          : "ko",
    ticks: tick,
    seconds: tick / HZ,
    playingTicks: tick - playingStart,
    stocks,
    falls,
    sides,
    hits,
  };
}
function quantile(values: number[], q: number): number | null {
  if (!values.length) return null;
  const a = [...values].sort((x, y) => x - y);
  const position = (a.length - 1) * q;
  const lo = Math.floor(position);
  const hi = Math.ceil(position);
  return a[lo]! + (a[hi]! - a[lo]!) * (position - lo);
}
function stats(values: number[]) {
  return {
    count: values.length,
    mean: values.length
      ? values.reduce((a, b) => a + b, 0) / values.length
      : null,
    q1: quantile(values, 0.25),
    median: quantile(values, 0.5),
    q3: quantile(values, 0.75),
  };
}
export function buildReport(options: Options) {
  const matches: ReturnType<typeof simulate>[] = [];
  for (const stage of options.stages)
    for (let i = 0; i < FIGHTERS.length; i++)
      for (let j = i + 1; j < FIGHTERS.length; j++) {
        for (let variant = 0; variant < PHASES.length; variant++)
          matches.push(
            simulate(FIGHTERS[i]!, FIGHTERS[j]!, stage, options, variant),
            simulate(FIGHTERS[j]!, FIGHTERS[i]!, stage, options, variant),
          );
      }
  const fighters = FIGHTERS.map((f) => {
    const games = matches.filter((m) => m.fighters.includes(f.id));
    const wins = games.filter(
      (m) =>
        m.winner !== null &&
        m.winner !== "draw" &&
        m.fighters[m.winner] === f.id,
    ).length;
    const stocksTaken = games.flatMap((m) =>
      m.stocks.filter((s) => m.fighters[1 - s.loser] === f.id),
    );
    const stocksLost = games.flatMap((m) =>
      m.stocks.filter((s) => m.fighters[s.loser] === f.id),
    );
    const falls = games.flatMap((m) =>
      m.falls.filter((fall) => m.fighters[fall.loser] === f.id),
    );
    const damage = games.reduce(
      (sum, m) => sum + m.sides[m.fighters.indexOf(f.id)]!.damage,
      0,
    );
    const ownHits = games.flatMap((m) =>
      m.hits.filter((h) => m.fighters[h.attacker] === f.id),
    );
    const sources = Object.fromEntries(
      (["light", "heavy", "special", "super", "unknown"] as const).map(
        (source) => [
          source,
          ownHits
            .filter((h) => h.source === source)
            .reduce((sum, h) => sum + h.damage, 0),
        ],
      ),
    );
    const seconds = games.reduce((sum, m) => sum + m.playingTicks / HZ, 0);
    const bursts = games.map((m) => m.sides[m.fighters.indexOf(f.id)]!.burst);
    return {
      id: f.id,
      games: games.length,
      decided: games.filter((m) => m.winner !== null && m.winner !== "draw")
        .length,
      wins,
      winRate: games.length ? wins / games.length : 0,
      stocksTakenSeconds: stats(stocksTaken.map((s) => s.elapsedTicks / HZ)),
      stocksLost: stocksLost.length,
      stocksLostRingOuts: stocksLost.filter((s) => s.cause === "ring-out")
        .length,
      falls: falls.length,
      fallDamage: stats(falls.map((fall) => fall.damage)),
      damagePerSecond: seconds ? damage / seconds : 0,
      secondsPer100: damage ? (100 * seconds) / damage : 0,
      hitsPer100: damage
        ? (100 *
            games.reduce(
              (sum, m) => sum + m.sides[m.fighters.indexOf(f.id)]!.landedHits,
              0,
            )) /
          damage
        : 0,
      sources,
      biggestHit: Math.max(
        0,
        ...games.map((m) => m.sides[m.fighters.indexOf(f.id)]!.biggestHit),
      ),
      stocksTakenHpKOs: stocksTaken.filter((s) => s.cause === "hp").length,
      stocksTakenRingOuts: stocksTaken.filter((s) => s.cause === "ring-out")
        .length,
      maxBurst: Math.max(0, ...bursts),
    };
  });
  const allStocks = matches.flatMap((m) => m.stocks);
  const allFalls = matches.flatMap((m) => m.falls);
  const pairs = FIGHTERS.flatMap((a, i) =>
    FIGHTERS.slice(i + 1).map((b) => {
      const games = matches.filter(
        (m) => m.fighters.includes(a.id) && m.fighters.includes(b.id),
      );
      const aWins = games.filter(
        (m) => typeof m.winner === "number" && m.fighters[m.winner] === a.id,
      ).length;
      const bWins = games.filter(
        (m) => typeof m.winner === "number" && m.fighters[m.winner] === b.id,
      ).length;
      return {
        a: a.id,
        b: b.id,
        aWins,
        bWins,
        games: games.length,
        difference: Math.abs(aWins - bWins) / games.length,
      };
    }),
  ).sort(
    (a, b) =>
      b.difference - a.difference ||
      a.a.localeCompare(b.a) ||
      a.b.localeCompare(b.b),
  );
  const result = {
    options,
    tickRate: HZ,
    burstWindowTicks: WINDOW,
    recentHitTicks: RECENT_HIT_TICKS,
    ringOutPolicy: {
      fraction: RING_OUT_DAMAGE_FRACTION,
      stockLossThreshold: RING_OUT_STOCK_LOSS_THRESHOLD,
    },
    phases: PHASES,
    staticDamage: staticDamage(),
    matches,
    fighters,
    pairs,
    overall: {
      stockSeconds: stats(allStocks.map((s) => s.elapsedTicks / HZ)),
      matchSeconds: stats(matches.map((m) => m.seconds)),
      fighterWinRates: stats(fighters.map((f) => f.winRate)),
      fighterDps: stats(fighters.map((f) => f.damagePerSecond)),
      secondsPer100: stats(fighters.map((f) => f.secondsPer100)),
      hitsPer100: stats(fighters.map((f) => f.hitsPer100)),
      biggestHit: stats(fighters.map((f) => f.biggestHit)),
      maxBurst: stats(fighters.map((f) => f.maxBurst)),
      sourceShares: Object.fromEntries(
        (["light", "heavy", "special", "super", "unknown"] as const).map(
          (source) => [
            source,
            stats(
              fighters.map(
                (f) =>
                  f.sources[source]! /
                  (Object.values(f.sources).reduce((a, b) => a + b, 0) || 1),
              ),
            ),
          ],
        ),
      ),
      ringOutHp: stats(
        allStocks.filter((s) => s.cause === "ring-out").map((s) => s.hp),
      ),
      launched: allStocks.filter((s) => s.ringOutKind === "launched").length,
      self: allStocks.filter((s) => s.ringOutKind === "self").length,
      hpKOs: allStocks.filter((s) => s.cause === "hp").length,
      ringOuts: allStocks.filter((s) => s.cause === "ring-out").length,
      falls: allFalls.length,
      fallDamage: stats(allFalls.map((fall) => fall.damage)),
      fallHp: stats(allFalls.map((fall) => fall.hp)),
      fallsLaunched: allFalls.filter((fall) => fall.ringOutKind === "launched")
        .length,
      fallsSelf: allFalls.filter((fall) => fall.ringOutKind === "self").length,
      sideWins: [
        matches.filter((m) => m.winner === 0).length,
        matches.filter((m) => m.winner === 1).length,
      ],
      outcomes: {
        ko: matches.filter((m) => m.outcome === "ko").length,
        timeout: matches.filter((m) => m.outcome === "timeout").length,
        limit: matches.filter((m) => m.outcome === "limit").length,
        draw: matches.filter((m) => m.winner === "draw").length,
      },
    },
  };
  return {
    ...result,
    digest: createHash("sha256").update(JSON.stringify(result)).digest("hex"),
  };
}
