import sharp from "sharp";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
/** Local, audited source exception: alpha-2 island 2px from TL and 44px from BL.
 * Every retained RGBA pixel is translated exactly; shared normalizer stays strict. */
export async function separateBolivarV4() {
  const base = "assets/source/finales/attack-overhaul/bolivar",
    file = `${base}/raw-v4.png`;
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const seen = new Uint8Array(info.width * info.height),
    main: number[][] = [],
    soft: { q: number[]; max: number }[] = [];
  let discardedAlpha1 = 0;
  for (let i = 0; i < seen.length; i++) {
    if (seen[i] || !data[i * 4 + 3]) continue;
    const q = [i];
    let max = 0,
      core = 0;
    seen[i] = 1;
    for (let j = 0; j < q.length; j++) {
      const n = q[j],
        x = n % info.width,
        y = Math.floor(n / info.width);
      max = Math.max(max, data[n * 4 + 3]);
      if (data[n * 4 + 3] >= 40) core++;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx,
            yy = y + dy,
            nn = yy * info.width + xx;
          if (
            xx < 0 ||
            xx >= info.width ||
            yy < 0 ||
            yy >= info.height ||
            seen[nn] ||
            !data[nn * 4 + 3]
          )
            continue;
          seen[nn] = 1;
          q.push(nn);
        }
    }
    if (core > 1000) main.push(q);
    else if (max > 1) soft.push({ q, max });
    else discardedAlpha1 += q.length;
  }
  if (
    main.length !== 4 ||
    soft.length !== 1 ||
    soft[0].max !== 2 ||
    soft[0].q.length !== 16
  )
    throw Error("Unexpected v4 topology");
  const island = soft[0].q;
  const distances = main.map((q) => {
    let all = Infinity,
      core = Infinity;
    for (const a of island)
      for (const b of q) {
        const d = Math.max(
          Math.abs((a % info.width) - (b % info.width)),
          Math.abs(Math.floor(a / info.width) - Math.floor(b / info.width)),
        );
        all = Math.min(all, d);
        if (data[b * 4 + 3] >= 40) core = Math.min(core, d);
      }
    return { all, core };
  });
  const ordered = distances
    .map((d, i) => ({ ...d, i }))
    .sort((a, b) => a.all - b.all);
  if (ordered[0].all > 3 || ordered[1].all < 20)
    throw Error("Ambiguous soft ownership");
  main[ordered[0].i].push(...island);
  const cell = 900,
    width = 1800,
    height = 1800,
    rgba = Buffer.alloc(width * height * 4),
    restored = Buffer.alloc(data.length),
    retained = Buffer.alloc(data.length);
  const assignments = main.map((q) => {
    let minX = Infinity,
      minY = Infinity,
      maxX = 0,
      maxY = 0;
    for (const n of q) {
      minX = Math.min(minX, n % info.width);
      maxX = Math.max(maxX, n % info.width);
      minY = Math.min(minY, Math.floor(n / info.width));
      maxY = Math.max(maxY, Math.floor(n / info.width));
    }
    const col = (minX + maxX) / 2 < info.width / 2 ? 0 : 1,
      row = (minY + maxY) / 2 < info.height / 2 ? 0 : 1;
    const dx = col * cell + Math.floor((cell - maxX + minX - 1) / 2) - minX,
      dy = row * cell + cell - 40 - maxY;
    for (const n of q) {
      const dst =
        ((Math.floor(n / info.width) + dy) * width + (n % info.width) + dx) * 4;
      data.copy(rgba, dst, n * 4, n * 4 + 4);
      rgba.copy(restored, n * 4, dst, dst + 4);
      data.copy(retained, n * 4, n * 4, n * 4 + 4);
    }
    return {
      col,
      row,
      pixels: q.length,
      bounds: { minX, minY, maxX, maxY },
      dx,
      dy,
    };
  });
  if (!retained.equals(restored)) throw Error("RGBA roundtrip failed");
  await sharp(rgba, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(`${base}/separated-v4.png`);
  await writeFile(
    "docs/finales/attack-overhaul/bolivar/v4-soft-audit.json",
    JSON.stringify(
      {
        method:
          "Whole 8-connected components and uniquely adjacent alpha-2 island, exact RGBA translation",
        rawIsland: { pixels: 16, maxAlpha: 2, bounds: [387, 498, 402, 498] },
        distances,
        owner: ordered[0].i,
        discardedAlpha1,
        assignments,
        exactRetainedRgbaRoundtrip: true,
        sha256: createHash("sha256").update(retained).digest("hex"),
      },
      null,
      2,
    ) + "\n",
  );
}
