import sharp from "sharp";
import { readFile } from "node:fs/promises";

const geometry = JSON.parse(
  await readFile("shared/sprite-geometry.json", "utf8"),
);
const roster = JSON.parse(await readFile("shared/fighters.json", "utf8"));
const requested = process.argv.indexOf("--sprite");
const fighters =
  requested < 0
    ? roster
    : roster.filter(({ id, sprite }) =>
        [id, sprite].includes(process.argv[requested + 1]),
      );
if (!fighters.length) throw new Error("Unknown fighter or sprite");
const sprites = [];
for (const { id, sprite } of fighters) {
  const results = [];
  for (const file of [`public/assets/${sprite}.webp`]) {
    const { data, info } = await sharp(file)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;
    const seen = new Uint8Array(width * height);
    const queue = new Int32Array(seen.length);
    const components = [];
    let transparent = 0;
    for (let pixel = 0; pixel < seen.length; pixel++) {
      if (data[pixel * channels + 3] === 0) transparent++;
      if (seen[pixel] || data[pixel * channels + 3] < 40) continue;
      let head = 0,
        tail = 1;
      queue[0] = pixel;
      seen[pixel] = 1;
      let minX = width,
        minY = height,
        maxX = 0,
        maxY = 0;
      while (head < tail) {
        const p = queue[head++],
          x = p % width,
          y = Math.floor(p / width);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        for (const n of [
          x > 0 ? p - 1 : -1,
          x < width - 1 ? p + 1 : -1,
          y > 0 ? p - width : -1,
          y < height - 1 ? p + width : -1,
        ]) {
          if (n >= 0 && !seen[n] && data[n * channels + 3] >= 40) {
            seen[n] = 1;
            queue[tail++] = n;
          }
        }
      }
      if (tail > 4000)
        components.push({ minX, minY, maxX, maxY, pixels: tail });
    }
    const top = components
      .filter((c) => c.minY < height / 4)
      .sort((a, b) => a.minX - b.minX);
    const bottom = components
      .filter((c) => c.minY >= height / 4)
      .sort((a, b) => a.minX - b.minX);
    const ordered = [...top, ...bottom];
    const passed =
      transparent > width * height * 0.1 &&
      components.length === 8 &&
      top.length === 4 &&
      bottom.length === 4 &&
      ordered.every(
        (c) =>
          c.minX > 0 && c.minY > 0 && c.maxX < width - 1 && c.maxY < height - 1,
      );
    const result = {
      file,
      width,
      height,
      transparentFraction: transparent / (width * height),
      components: ordered,
      rows: [top.length, bottom.length],
      passed,
    };
    results.push(result);
    if (!passed) throw new Error(`Atlas inválido: ${file}`);
  }
  const expected = geometry.sprites
    .find((entry) => entry.id === id)
    ?.files.find((entry) => entry.file === `public/assets/${sprite}.webp`);
  const actual = results[0];
  const bounds = actual.components.map(({ minX, minY, maxX, maxY }) => ({
    minX,
    minY,
    maxX,
    maxY,
  }));
  if (
    !expected ||
    expected.width !== actual.width ||
    expected.height !== actual.height ||
    JSON.stringify(expected.components) !== JSON.stringify(bounds)
  )
    throw new Error(
      `Runtime geometry does not match the shipped sprite: ${id}`,
    );
  console.log(
    `${id}: eight complete transparent poses and matching runtime geometry.`,
  );
}
