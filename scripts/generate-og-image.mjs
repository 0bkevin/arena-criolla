import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";

// Reuse the lobby's current artwork, typography and palette for the social cover.
// Run `npm run assets:og` to rebuild the lossless master and lightweight social JPEG.
const width = 1200;
const height = 630;
const theme = await readFile("src/arcade-theme.css", "utf8");
function themeColor(token) {
  const color = theme.match(
    new RegExp(`--${token}:\\s*(#[\\da-f]{6})\\s*;`, "i"),
  )?.[1];
  if (!color) throw new Error(`The arcade theme must define --${token}.`);
  return color;
}
const navy = themeColor("bg");
const cream = themeColor("paper");
const yellow = themeColor("coin");
const red = themeColor("vz-red");
const manifest = JSON.parse(
  await readFile("shared/sprite-geometry.json", "utf8"),
);
const fighters = JSON.parse(await readFile("shared/fighters.json", "utf8"));
const svg = (body) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`,
  );
const layers = [];

async function textImage(value, size, color) {
  return sharp({
    text: {
      text: `<span foreground="${color}">${value}</span>`,
      font: `Barlow Condensed ExtraBold, Italic ${size}`,
      fontfile: "public/fonts/barlow-800-italic.ttf",
      dpi: 72,
      rgba: true,
    },
  })
    .png()
    .toBuffer();
}

async function fighter(id, center, top, bodyHeight, mirror = false, pose = 0) {
  top = Math.round(top);
  const file = fighters.find((entry) => entry.id === id).sprite;
  const bounds = manifest.sprites
    .find((sprite) => sprite.id === id)
    .files.find((entry) => entry.file === `public/assets/${file}.webp`)
    .components[pose];
  const frame = await sharp(`public/assets/${file}.webp`)
    .extract({
      left: bounds.minX,
      top: bounds.minY,
      width: bounds.maxX - bounds.minX + 1,
      height: bounds.maxY - bounds.minY + 1,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  // Align heads rather than wide hands/props so every face stays readable.
  let weightedX = 0;
  let weight = 0;
  for (let y = 0; y < Math.ceil(frame.info.height * 0.24); y++) {
    for (let x = 0; x < frame.info.width; x++) {
      const alpha = frame.data[(y * frame.info.width + x) * 4 + 3];
      if (alpha < 40) continue;
      weightedX += x * alpha;
      weight += alpha;
    }
  }
  let image = sharp(frame.data, { raw: frame.info }).resize({
    height: bodyHeight,
  });
  if (mirror) image = image.flop();
  const resized = await image.png().toBuffer({ resolveWithObject: true });
  const head = (weightedX / weight) * (bodyHeight / frame.info.height);
  const left = Math.round(center - (mirror ? resized.info.width - head : head));
  const cropLeft = Math.max(0, -left);
  const input = await sharp(resized.data)
    .extract({
      left: cropLeft,
      top: 0,
      width: Math.min(resized.info.width - cropLeft, width - Math.max(0, left)),
      height: Math.min(bodyHeight, height - top),
    })
    .png()
    .toBuffer();
  const layer = { input, left: Math.max(0, left), top };
  layers.push(layer);
  return layer;
}

const stage = await sharp("public/assets/caracas.webp")
  .resize(width, height, { fit: "cover", position: "centre" })
  .png()
  .toBuffer();
layers.push({ input: stage, left: 0, top: 0 });
layers.push({
  input: svg(`
  <defs>
    <linearGradient id="shade" x2="0" y2="1"><stop stop-color="${navy}" stop-opacity=".45"/><stop offset=".75" stop-color="${navy}" stop-opacity=".25"/><stop offset="1" stop-color="${navy}"/></linearGradient>
    <radialGradient id="glow"><stop stop-color="${yellow}" stop-opacity=".25"/><stop offset="1" stop-color="${yellow}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#shade)"/>
  <ellipse cx="600" cy="270" rx="620" ry="350" fill="url(#glow)"/>
`),
  left: 0,
  top: 0,
});

// The eight pixel stars are the same ornament used by VenezuelaStars in the UI.
layers.push({
  input: svg(
    `<g fill="${cream}" opacity=".8" transform="translate(984 30) scale(1.1)">${[15, 9, 4, 1, 1, 4, 9, 15].map((y, i) => `<path transform="translate(${4 + i * 16} ${y})" d="M4 0h2v3h4v2H8v2h1v3H6V8H4v2H1V7h1V5H0V3h4z"/>`).join("")}</g>`,
  ),
  left: 0,
  top: 0,
});
// Preserve every fighter visible in the approved cover from commit 822dae1.
// That artwork had outgrown the old sixteen-fighter generator. Keep its founders,
// entertainers and folklore cast together, and include Bolívar without Danny Ocean.
// Resolve filenames through fighters.json so future sprite updates carry over.
const back = [
  { id: "silbon", center: 38, top: 113, height: 410 },
  { id: "enrique", center: 161, top: 94, height: 425 },
  { id: "maite", center: 284, top: 86, height: 425 },
  { id: "capriles", center: 412, top: 94, height: 420 },
  { id: "dudamel", center: 534, top: 84, height: 430 },
  { id: "bolivar", center: 665, top: 78, height: 440, mirror: true, pose: 1 },
  { id: "juan", center: 790, top: 94, height: 425, mirror: true },
  { id: "lila", center: 912, top: 89, height: 425, mirror: true },
  { id: "jesus", center: 1030, top: 93, height: 420, mirror: true },
  { id: "lionza", center: 1151, top: 103, height: 420, mirror: true },
];
const front = [
  { id: "vallenilla", center: 46, top: 263, height: 450 },
  { id: "giuseppe", center: 189, top: 250, height: 450 },
  { id: "oscar", center: 327, top: 239, height: 450 },
  { id: "carlos", center: 455, top: 249, height: 450 },
  { id: "conde", center: 597, top: 234, height: 450, mirror: true },
  { id: "victor", center: 740, top: 251, height: 450, mirror: true },
  { id: "simon", center: 871, top: 252, height: 450, mirror: true },
  { id: "zavarce", center: 1012, top: 254, height: 450, mirror: true },
  { id: "tiotigre", center: 1148, top: 252, height: 450, mirror: true },
];
const titleOverlaps = [];
for (const entry of [...back, ...front]) {
  const layer = await fighter(
    entry.id,
    entry.center,
    entry.top,
    entry.height,
    entry.mirror,
    entry.pose,
  );
  if (["giuseppe", "tiotigre"].includes(entry.id)) titleOverlaps.push(layer);
}
layers.push({
  input: svg(
    `<defs>
      <linearGradient id="fade" x2="0" y2="1"><stop stop-color="${navy}" stop-opacity="0"/><stop offset=".7" stop-color="${navy}" stop-opacity=".85"/><stop offset="1" stop-color="${navy}" stop-opacity=".96"/></linearGradient>
      <linearGradient id="ribbon" x2="0" y2="1"><stop stop-color="${navy}" stop-opacity="0"/><stop offset=".3" stop-color="${navy}" stop-opacity=".65"/><stop offset="1" stop-color="${navy}" stop-opacity=".9"/></linearGradient>
    </defs>
    <rect y="480" width="1200" height="150" fill="url(#fade)"/>
    <path d="M110 524H1118L1102 616H94Z" fill="url(#ribbon)"/>
    <path d="M119 555H123L113 610H109Z" fill="${yellow}" opacity=".8"/>
    <path d="M1101 555H1105L1095 610H1091Z" fill="${red}" opacity=".8"/>`,
  ),
  left: 0,
  top: 0,
});
// Reuse the exact sprite silhouettes so the outer figures break the ribbon's
// edge. Fade their lower bodies into the artwork, then place legible type above.
for (const layer of titleOverlaps) {
  const top = 490;
  const { width: detailWidth } = await sharp(layer.input).metadata();
  const detailHeight = height - top;
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${detailWidth}" height="${detailHeight}">
      <defs><linearGradient id="fade" x2="0" y2="1"><stop stop-color="white"/><stop offset=".32" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient></defs>
      <rect width="100%" height="100%" fill="url(#fade)"/>
    </svg>`,
  );
  const input = await sharp(layer.input)
    .extract({
      left: 0,
      top: top - layer.top,
      width: detailWidth,
      height: detailHeight,
    })
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
  layers.push({ input, left: layer.left, top });
}
// Composite the approved logo directly, keeping its silhouette and proportions.
layers.push({
  input: await sharp("public/assets/arena-logo.svg")
    .resize(54, 54)
    .png()
    .toBuffer(),
  left: 40,
  top: 24,
});
const titleSize = 126;
const titleTop = 526;
const arena = await textImage("ARENA", titleSize, cream);
const criolla = await textImage("CRIOLLA", titleSize, yellow);
const arenaWidth = (await sharp(arena).metadata()).width;
const criollaWidth = (await sharp(criolla).metadata()).width;
const titleLeft = Math.round((width - arenaWidth - criollaWidth - 22) / 2);
async function titleWord(value, input, left, edgeColor) {
  const shadow = await textImage(value, titleSize, "#030a12");
  layers.push({
    input: await sharp(shadow)
      .extend({
        top: 12,
        bottom: 12,
        left: 12,
        right: 12,
        background: "#00000000",
      })
      .blur(4)
      .png()
      .toBuffer(),
    left: left - 10,
    top: titleTop - 6,
  });
  const edge = await textImage(value, titleSize, edgeColor);
  for (let offset = 3; offset > 0; offset--) {
    layers.push({ input: edge, left: left + offset, top: titleTop + offset });
  }
  layers.push({ input, left, top: titleTop });
}
await titleWord("ARENA", arena, titleLeft, "#31465f");
await titleWord("CRIOLLA", criolla, titleLeft + arenaWidth + 22, "#8a6a27");

const cover = await sharp({
  create: { width, height, channels: 3, background: navy },
})
  .composite(layers)
  .png({ compressionLevel: 9 })
  .toBuffer();
await writeFile("public/assets/og-arena-criolla.png", cover);
// Full color resolution keeps the colored lettering and illustrated edges crisp.
// Encode directly from the master so rebuilding never compounds JPEG loss.
const social = await sharp(cover)
  .removeAlpha()
  .jpeg({
    quality: 90,
    mozjpeg: true,
    chromaSubsampling: "4:4:4",
    progressive: true,
  })
  .toBuffer();
await writeFile("public/assets/og-arena-criolla.jpg", social);
console.log(
  `Created OG master PNG and social JPEG (1200 × 630, JPEG ${social.length} bytes)`,
);
