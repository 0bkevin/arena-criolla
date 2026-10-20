const { BUILT_IN_FIGHTERS } = await import("/shared/content.ts");
const baseline = await import("/docs/performance/runtime/baseline.js");
const current = await import("/src/game/assets.ts");
const results = { portraits: [], timings: [], errors: [] };
const canvas = () => {
  const c = document.createElement("canvas");
  c.width = 400;
  c.height = 500;
  return c.getContext("2d", { willReadFrequently: true });
};
const a = canvas(),
  b = canvas();

async function portraits() {
  for (const fighter of BUILT_IN_FIGHTERS) {
    const before = await baseline.loadSprite(fighter.id, { entrance: false });
    const after = await current.loadSprite(fighter.id, { entrance: false });
    let comparisons = 0;
    for (let frame = 0; frame < 8; frame++)
      for (const facing of [-1, 1])
        for (const bust of [false, true]) {
          for (const [api, ctx, sprite] of [
            [baseline, a, before],
            [current, b, after],
          ]) {
            const height = bust ? 690 * (fighter.portraitScale ?? 1) : 480;
            const offset = bust
              ? (((sprite.portraitCenters[frame] - sprite.cellWidth / 2) *
                  height) /
                  sprite.bodyHeight) *
                facing *
                sprite.frameFacing[frame]
              : 0;
            ctx.clearRect(0, 0, 400, 500);
            api.drawSprite(
              ctx,
              sprite,
              frame,
              200 - offset,
              bust ? height + 30 - height * (fighter.portraitLift ?? 0) : 496,
              height,
              facing,
            );
          }
          const ap = a.getImageData(0, 0, 400, 500).data,
            bp = b.getImageData(0, 0, 400, 500).data;
          if (!ap.every((x, i) => x === bp[i]))
            throw Error(`${fighter.id}: portrait ${frame}/${facing}/${bust}`);
          comparisons++;
        }
    results.portraits.push({
      id: fighter.id,
      comparisons,
      differingChannels: 0,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

async function timing(id, optimized, repeat) {
  const token = `${optimized}-${repeat}-${id}-${Date.now()}`;
  const api = await import(
    optimized
      ? `/src/game/assets.ts?bench=${token}`
      : `/docs/performance/runtime/baseline.js?bench=${token}`
  );
  const fighter = BUILT_IN_FIGHTERS.find((f) => f.id === id);
  await api.loadImage(fighter.sprite); // Exclude network and JS parse; keep decode/readback/analysis.
  let last = performance.now(),
    maxGap = 0;
  const interval = setInterval(() => {
    const now = performance.now();
    maxGap = Math.max(maxGap, now - last);
    last = now;
  }, 4);
  await new Promise((resolve) => setTimeout(resolve, 20));
  const start = performance.now();
  await api.loadSprite(id, { entrance: false });
  const elapsedMs = performance.now() - start;
  await new Promise((resolve) => setTimeout(resolve, 20));
  clearInterval(interval);
  results.timings.push({ id, optimized, repeat, elapsedMs, maxGap });
}

globalThis.spriteAudit = { results, portraits, timing };
