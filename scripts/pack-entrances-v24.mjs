import sharp from "sharp";
import { writeFile } from "node:fs/promises";

// Asset preparation only: isolate the generated silhouettes, preserve their
// soft alpha, align their hips/feet, and encode them. No pose is painted here.
async function silhouettes(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const seen = new Int32Array(info.width * info.height),
    queue = new Int32Array(seen.length),
    components = [];
  let label = 0;
  for (let p = 0; p < seen.length; p++) {
    if (seen[p] || data[p * 4 + 3] < 40) continue;
    const own = ++label;
    seen[p] = own;
    queue[0] = p;
    let head = 0,
      tail = 1,
      minX = info.width,
      minY = info.height,
      maxX = 0,
      maxY = 0;
    while (head < tail) {
      const n = queue[head++],
        x = n % info.width,
        y = Math.floor(n / info.width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      for (const next of [
        x > 0 ? n - 1 : -1,
        x < info.width - 1 ? n + 1 : -1,
        y > 0 ? n - info.width : -1,
        y < info.height - 1 ? n + info.width : -1,
      ]) {
        if (next >= 0 && !seen[next] && data[next * 4 + 3] >= 40) {
          seen[next] = own;
          queue[tail++] = next;
        }
      }
    }
    if (tail > 4000)
      components.push({ minX, minY, maxX, maxY, label: own, pixels: tail });
  }
  if (components.length !== 12)
    throw new Error(`Expected 12 isolated poses: ${file}`);
  components.sort(
    (a, b) =>
      Math.floor((a.minY + a.maxY) / 2 / (info.height / 3)) -
        Math.floor((b.minY + b.maxY) / 2 / (info.height / 3)) ||
      a.minX + a.maxX - (b.minX + b.maxX),
  );
  return { components, data, info, seen };
}
const result = {},
  cell = 512,
  bodyHeight = 400,
  baseline = 492;
for (const id of ["oscar", "dudamel"]) {
  const original = `assets/references/entrances-v24/${id}.png`;
  const { components, data, info, seen } = await silhouettes(original);
  const reference = components[0],
    scale = bodyHeight / (reference.maxY - reference.minY + 1),
    layers = [],
    frames = [];
  for (const [index, b] of components.entries()) {
    const width = b.maxX - b.minX + 1,
      height = b.maxY - b.minY + 1,
      isolated = Buffer.alloc(width * height * 4);
    let hipX = 0,
      weight = 0;
    const hipTop = b.maxY - (reference.maxY - reference.minY) * 0.43,
      hipBottom = b.maxY - (reference.maxY - reference.minY) * 0.31;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const sx = b.minX + x,
          sy = b.minY + y,
          p = sy * info.width + sx;
        let own = seen[p] === b.label;
        if (!own && data[p * 4 + 3] < 40)
          for (let dy = -2; dy <= 2 && !own; dy++)
            for (let dx = -2; dx <= 2; dx++) {
              const nx = sx + dx,
                ny = sy + dy;
              if (
                nx >= 0 &&
                nx < info.width &&
                ny >= 0 &&
                ny < info.height &&
                seen[ny * info.width + nx] === b.label
              ) {
                own = true;
                break;
              }
            }
        if (own) {
          data.copy(isolated, (y * width + x) * 4, p * 4, p * 4 + 4);
          if (sy >= hipTop && sy <= hipBottom && data[p * 4 + 3] > 40) {
            hipX += x * data[p * 4 + 3];
            weight += data[p * 4 + 3];
          }
        }
      }
    hipX = weight ? hipX / weight : width / 2;
    const outWidth = Math.round(width * scale),
      outHeight = Math.round(height * scale);
    const localLeft = Math.round(cell / 2 - hipX * scale),
      localTop = baseline - outHeight;
    if (localLeft < 6 || localLeft + outWidth > cell - 6 || localTop < 6)
      throw new Error(`Pose ${id}/${index} crosses a cell boundary`);
    const buffer = await sharp(isolated, {
      raw: { width, height, channels: 4 },
    })
      .resize(outWidth, outHeight)
      .png()
      .toBuffer();
    const slotX = (index % 4) * cell,
      slotY = Math.floor(index / 4) * cell;
    layers.push({
      input: buffer,
      left: slotX + localLeft,
      top: slotY + localTop,
    });
    frames.push({
      x: slotX + localLeft,
      y: slotY + localTop,
      width: outWidth,
      height: outHeight,
      slotX,
      slotY,
    });
  }
  const source = `assets/source/${id}-entrance-v24.png`,
    file = `${id}-entrance-v24`;
  await sharp({
    create: {
      width: cell * 4,
      height: cell * 3,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(layers)
    .png()
    .toFile(source);
  await sharp(source)
    .webp({ lossless: true, effort: 6 })
    .toFile(`public/assets/${file}.webp`);
  result[id] = {
    file,
    cell,
    bodyHeight,
    baseline,
    anchorX: cell / 2,
    width: cell * 4,
    height: cell * 3,
    frames,
  };
}
await writeFile(
  "shared/entrance-assets.json",
  JSON.stringify(result, null, 2) + "\n",
);
await writeFile(
  "docs/entrances-v24/atlas-packing.json",
  JSON.stringify(
    {
      method:
        "Generated alpha silhouettes isolated and aligned without repainting",
      assets: result,
    },
    null,
    2,
  ) + "\n",
);
console.log("Packed 24 distinct entrance poses with transparent margins.");
