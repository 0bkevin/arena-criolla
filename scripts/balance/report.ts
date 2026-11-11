import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { buildReport, optionsFromEnv } from "./model";

const started = performance.now();
const report = buildReport(optionsFromEnv(process.env));
const runtime = (performance.now() - started) / 1000;
if (process.env.BALANCE_JSON)
  writeFileSync(
    process.env.BALANCE_JSON,
    JSON.stringify(report, null, 2) + "\n",
  );
const n = (value: number | null) => (value === null ? "n/a" : value.toFixed(2));
const pct = (value: number) => `${n(value * 100)}%`;
const s = report.overall.stockSeconds;
const sorted = [...report.fighters].sort(
  (a, b) => b.winRate - a.winRate || a.id.localeCompare(b.id),
);
const summary = (stat: {
  median: number | null;
  q1: number | null;
  q3: number | null;
}) => `${n(stat.median)} (${n(stat.q1)}–${n(stat.q3)})`;
const outlier = (
  value: number,
  stat: { q1: number | null; q3: number | null },
) => {
  if (stat.q1 === null || stat.q3 === null) return false;
  const iqr = stat.q3 - stat.q1;
  return value < stat.q1 - 1.5 * iqr || value > stat.q3 + 1.5 * iqr;
};
const shares = (f: (typeof report.fighters)[number]) => {
  const total = Object.values(f.sources).reduce((a, b) => a + b, 0);
  return ["light", "heavy", "special", "super", "unknown"].map(
    (key) => (f.sources[key] ?? 0) / (total || 1),
  );
};
const wins = report.overall.sideWins;
console.log(`# Balance report

Digest: \`${report.digest}\`  
Runtime: ${n(runtime)} s  
Stages: ${report.options.stages.join(", ")}; difficulty: ${report.options.difficulty}; limit: ${report.options.limit} steps; ${report.matches.length} matches.

Each distinct pair plays both seats in four deterministic paired timing variants ${JSON.stringify(report.phases)} per stage, offsetting only the tick seen by each CPU. Mirror matches are excluded. The default is one stage; BALANCE_STAGES accepts comma-separated stage IDs; BALANCE_DIFFICULTY and BALANCE_LIMIT override difficulty and tick limit. Time uses simulation steps at ${report.tickRate} Hz, including hitstop and cinematics. CPU play is a limited proxy for human play. On hard difficulty its 24-tick attack cadence always selects heavy because those ticks are divisible by 3, so the absence of light damage is a CPU limitation.

HP loss is attributed to a matching new hit effect's owner and impact in the same step; unmatched damage is unknown. Combo bonuses remain included in their attack source: effects do not distinguish their contribution. Capture finale damage beats count individually for largest observed HP drop, while landed hits use the engine's hit counter (one for a capture). DPS uses total HP removed divided by all playing time; seconds per 100 = 100 / DPS, hits per 100 = 100 × landed hits / HP removed. Burst is the largest ${report.burstWindowTicks / report.tickRate}-second rolling sum, not a verified combo. A ring-out is classified as launched if HP was lost in the prior ${report.recentHitTicks} steps, otherwise self; this is a timing proxy, not proof of causation. Timeout winners use engine scoring; limit results have no winner. The CPU steers toward its opponent and only attempts edge jumps every 34 ticks near WORLD.left/right; ground support ends at those edges. Hits launch with base force 4.5 for light and 8 for heavy, amplified as HP falls, so knockback and late or unavailable recovery can carry fighters off the floor. The timing-based classification cannot distinguish those paths conclusively.

## Overall

- Stock time: mean ${n(s.mean)} s; median ${n(s.median)} s; IQR ${n(s.q1)}–${n(s.q3)} s (n=${s.count}).
- HP KOs: ${report.overall.hpKOs}; ring-outs: ${report.overall.ringOuts} (${pct(report.overall.ringOuts / (report.overall.hpKOs + report.overall.ringOuts || 1))}); launched ${report.overall.launched}, self ${report.overall.self}. Ring-out HP median (IQR): ${summary(report.overall.ringOutHp)}.
- Outcomes: ${JSON.stringify(report.overall.outcomes)}.
- Player 0 / player 1 wins: ${wins[0]} / ${wins[1]} (${pct(wins[0]! / (wins[0]! + wins[1]! || 1))} / ${pct(wins[1]! / (wins[0]! + wins[1]! || 1))} of decided matches).
- Cast median (IQR): win rate ${summary(report.overall.fighterWinRates)}; DPS ${summary(report.overall.fighterDps)}; seconds / 100 HP ${summary(report.overall.secondsPer100)}; hits / 100 HP ${summary(report.overall.hitsPer100)}; largest HP drop ${summary(report.overall.biggestHit)}; max burst ${summary(report.overall.maxBurst)}.
- Source share cast median (IQR), as fractions: ${Object.entries(
  report.overall.sourceShares,
)
  .map(([name, stat]) => `${name} ${summary(stat)}`)
  .join("; ")}.

## Fighters

Win rate uses all matches, including draws and unfinished games. Source columns are percentages of HP removed. Flags mark values outside 1.5 × IQR from the cast quartiles; source flags are prefixed by their source name.

| Fighter | Wins / games | Win % | Stock mean / median s | DPS | Sec / 100 | Hits / 100 | Light / heavy / special / definitive / unknown % | HP / ring-out KOs | Largest HP drop | Max burst | Outliers |
|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---:|---|`);
for (const f of sorted) {
  const sourceShares = shares(f);
  const flags = [
    ...(
      [
        ["win", f.winRate, report.overall.fighterWinRates],
        ["DPS", f.damagePerSecond, report.overall.fighterDps],
        ["seconds", f.secondsPer100, report.overall.secondsPer100],
        ["hits", f.hitsPer100, report.overall.hitsPer100],
        ["largest", f.biggestHit, report.overall.biggestHit],
        ["burst", f.maxBurst, report.overall.maxBurst],
      ] as const
    )
      .filter(([, value, stat]) => outlier(value, stat))
      .map(([name]) => name),
    ...Object.entries(report.overall.sourceShares)
      .filter(([, stat], i) => outlier(sourceShares[i]!, stat))
      .map(([name]) => name + " share"),
  ];
  console.log(
    `| ${f.id} | ${f.wins}/${f.games} | ${pct(f.winRate)} | ${n(f.stockSeconds.mean)} / ${n(f.stockSeconds.median)} | ${n(f.damagePerSecond)} | ${n(f.secondsPer100)} | ${n(f.hitsPer100)} | ${sourceShares.map(pct).join(" / ")} | ${f.hpKOs} / ${f.ringOuts} | ${n(f.biggestHit)} | ${n(f.maxBurst)} | ${flags.join(", ")} |`,
  );
}
console.log(
  `\n## Most lopsided matchups\n\nOrdered by absolute win difference divided by games; small sample sizes make individual pairs noisy.\n\n| Pair | Wins | Games | Difference |\n|---|---:|---:|---:|`,
);
for (const p of report.pairs.slice(0, 20))
  console.log(
    `| ${p.a} vs ${p.b} | ${p.aWins}–${p.bWins} | ${p.games} | ${pct(p.difference)} |`,
  );
console.log(
  `\n## Static damage (armor 1, no transformation)\n\nSpecial totals count offered pulses × projectiles, not guaranteed contacts. Counter is separate. Finale budget is nominal, not guaranteed; transformation modes show multiplier and duration. Combo totals assume all hits connect and are formula estimates.\n\n| Fighter | Light | Heavy | Special per hit × count = total | Counter | Definitive | Light-heavy | Light-light-heavy |\n|---|---:|---:|---|---:|---|---:|---:|`,
);
for (const f of report.staticDamage)
  console.log(
    `| ${f.id} | ${n(f.light)} | ${n(f.heavy)} | ${f.ability}: ${n(f.specialHit)} × ${f.specialCount} = ${n(f.specialTotal)} | ${n(f.counter)} | ${f.empowerment ? `transformation ×${f.empowerment.damageMultiplier} / ${f.empowerment.duration} ticks` : `${f.finale}: ${n(f.finaleBudget)}`} | ${n(f.lightHeavy)} | ${n(f.lightLightHeavy)} |`,
  );
