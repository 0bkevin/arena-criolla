import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";

// Preparation only: separate the painted poses, retain their alpha, and align
// their hips and feet. Rebuild with node scripts/pack-defiant-entrances.mjs.
const groups = [
  ["zavarce", "vallenilla", "javier", "capriles"],
  ["renny", "gomez", "emilio", "maite"],
  ["puma", "chataing", "george", "mcm"],
  ["reynaldo", "danny", "nacho", "sarcos"],
  ["yordano", "lila", "rummy", "chiqui"],
  ["norkys", "gabriela", "amanda", "giuseppe"],
];

async function silhouettes(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const seen = new Int32Array(info.width * info.height);
  const queue = new Int32Array(seen.length);
  const components = [];
  let label = 0;
  for (let pixel = 0; pixel < seen.length; pixel++) {
    if (seen[pixel] || data[pixel * 4 + 3] < 40) continue;
    const own = ++label;
    seen[pixel] = own;
    queue[0] = pixel;
    let head = 0,
      tail = 1;
    let minX = info.width,
      minY = info.height,
      maxX = 0,
      maxY = 0;
    while (head < tail) {
      const p = queue[head++];
      const x = p % info.width,
        y = Math.floor(p / info.width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      for (const n of [
        x > 0 ? p - 1 : -1,
        x < info.width - 1 ? p + 1 : -1,
        y > 0 ? p - info.width : -1,
        y < info.height - 1 ? p + info.width : -1,
      ]) {
        if (n >= 0 && !seen[n] && data[n * 4 + 3] >= 40) {
          seen[n] = own;
          queue[tail++] = n;
        }
      }
    }
    if (tail > 1000) components.push({ minX, minY, maxX, maxY, label: own });
  }
  if (components.length !== 24)
    throw new Error(
      `${file}: expected 24 separate poses, got ${components.length}`,
    );
  components.sort((a, b) => a.minY + a.maxY - b.minY - b.maxY);
  const rows = Array.from({ length: 4 }, (_, row) =>
    components.slice(row * 6, row * 6 + 6).sort((a, b) => a.minX - b.minX),
  );
  return { data, info, rows, seen };
}

const manifest = JSON.parse(
  await readFile("shared/entrance-assets.json", "utf8"),
);
const cell = 512,
  bodyHeight = 400,
  baseline = 492,
  anchorX = 256;
const requested = process.argv.indexOf("--group");
for (const [group, ids] of groups.entries()) {
  if (requested >= 0 && group + 1 !== Number(process.argv[requested + 1]))
    continue;
  const { data, info, rows, seen } = await silhouettes(
    `assets/source/defiant-entrances-group-${group + 1}.png`,
  );
  for (const [row, id] of ids.entries()) {
    const poses = rows[row];
    const referenceHeight = poses[1].maxY - poses[1].minY + 1;
    const scale = bodyHeight / referenceHeight;
    const layers = [],
      frames = [];
    for (const [index, bounds] of poses.entries()) {
      const left = Math.max(0, bounds.minX - 2);
      const top = Math.max(0, bounds.minY - 2);
      const width = Math.min(info.width, bounds.maxX + 3) - left;
      const height = Math.min(info.height, bounds.maxY + 3) - top;
      const isolated = Buffer.alloc(width * height * 4);
      let hipX = 0,
        weight = 0;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const sx = left + x,
            sy = top + y,
            p = sy * info.width + sx;
          let own = seen[p] === bounds.label;
          // Keep the soft edge, without borrowing a hat or shoe from the next
          // row when the original painted figures have overlapping bounds.
          if (!own && data[p * 4 + 3] < 40) {
            for (let dy = -2; dy <= 2 && !own; dy++) {
              for (let dx = -2; dx <= 2; dx++) {
                const nx = sx + dx,
                  ny = sy + dy;
                if (
                  nx >= 0 &&
                  nx < info.width &&
                  ny >= 0 &&
                  ny < info.height &&
                  seen[ny * info.width + nx] === bounds.label
                ) {
                  own = true;
                  break;
                }
              }
            }
          }
          if (!own) continue;
          data.copy(isolated, (y * width + x) * 4, p * 4, p * 4 + 4);
          if (y < height * 0.57 || y > height * 0.69) continue;
          const alpha = isolated[(y * width + x) * 4 + 3];
          if (alpha < 40) continue;
          hipX += x * alpha;
          weight += alpha;
        }
      }
      hipX = weight ? hipX / weight : width / 2;
      const outWidth = Math.round(width * scale);
      const outHeight = Math.round(height * scale);
      const localX = Math.round(anchorX - hipX * scale);
      const localY = Math.round(baseline - (bounds.maxY + 1 - top) * scale);
      if (
        localX < 6 ||
        localX + outWidth > cell - 6 ||
        localY < 6 ||
        localY + outHeight >= cell
      )
        throw new Error(`${id}/${index}: pose crosses its cell boundary`);
      const input = await sharp(isolated, {
        raw: { width, height, channels: 4 },
      })
        .resize(outWidth, outHeight)
        .png()
        .toBuffer();
      const slotX = (index % 3) * cell,
        slotY = Math.floor(index / 3) * cell;
      layers.push({ input, left: slotX + localX, top: slotY + localY });
      frames.push({
        x: slotX + localX,
        y: slotY + localY,
        width: outWidth,
        height: outHeight,
        slotX,
        slotY,
      });
    }
    const file = `${id}-defiant-entrance`;
    const atlas = sharp({
      create: {
        width: cell * 3,
        height: cell * 2,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    }).composite(layers);
    // The standard asset preparation command reads one PNG per manifest file.
    // Keep the packed, editable source alongside the original group artwork.
    await atlas.clone().png().toFile(`assets/source/${file}.png`);
    await atlas
      .clone()
      .webp({ lossless: true })
      .toFile(`public/assets/${file}.webp`);
    manifest[id] = {
      file,
      cell,
      bodyHeight,
      baseline,
      anchorX,
      width: cell * 3,
      height: cell * 2,
      frames,
    };
    console.log(`${id}: six aligned transparent entrance poses`);
  }
}
await writeFile(
  "shared/entrance-assets.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
