import sharp from "sharp";
import { readFile } from "node:fs/promises";

// Reuse the lobby's artwork, typography and palette for a sixteen-fighter cover.
// Run `npm run assets:og` to rebuild the committed social image.
const width = 1200;
const height = 630;
const navy = "#091524";
const cream = "#fff5db";
const yellow = "#ffd45a";
const manifest = JSON.parse(
  await readFile("docs/character-sprite-qa.json", "utf8"),
);
const fighters = JSON.parse(await readFile("shared/fighters.json", "utf8"));
const stages = JSON.parse(await readFile("shared/stages.json", "utf8"));
const svg = (body) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`,
  );
const layers = [];

async function textImage(value, size, color, family = "display") {
  const fonts = {
    display: ["Barlow Condensed ExtraBold, Italic", "barlow-800-italic.ttf"],
    body: ["DM Sans", "dm-sans-400.ttf"],
    pixel: ["Pixelify Sans", "pixelify-sans.ttf"],
  };
  const [font, file] = fonts[family];
  return sharp({
    text: {
      text: `<span foreground="${color}">${value}</span>`,
      font: `${font} ${size}`,
      fontfile: `public/fonts/${file}`,
      dpi: 72,
      rgba: true,
    },
  })
    .png()
    .toBuffer();
}

async function text(value, left, top, size, color, family = "display") {
  const input = await textImage(value, size, color, family);
  layers.push({ input, left, top });
}

async function centeredText(value, top, size, color, family = "display") {
  const input = await textImage(value, size, color, family);
  const { width: textWidth } = await sharp(input).metadata();
  layers.push({ input, left: Math.round((width - textWidth) / 2), top });
}

async function fighter(id, center, top, bodyHeight, mirror = false) {
  top = Math.round(top);
  const file = fighters.find((entry) => entry.id === id).sprite;
  const bounds = manifest.sprites
    .find((sprite) => sprite.id === id)
    .files.find((entry) => entry.file === `public/assets/${file}.webp`)
    .components[0];
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
  layers.push({ input, left: Math.max(0, left), top });
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
    <radialGradient id="glow"><stop stop-color="#ffd45a" stop-opacity=".25"/><stop offset="1" stop-color="#ffd45a" stop-opacity="0"/></radialGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#bdd6f3" stroke-opacity=".035"/></pattern>
  </defs>
  <rect width="1200" height="630" fill="url(#shade)"/>
  <ellipse cx="600" cy="270" rx="620" ry="350" fill="url(#glow)"/>
  <rect width="1200" height="630" fill="url(#grid)"/>
  <path d="M0 0H480V8H0Z" fill="${yellow}"/><path d="M480 0H840V8H480Z" fill="#315caa"/><path d="M840 0H1200V8H840Z" fill="#e86658"/>
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
// Two staggered rows span culture, entertainment, founders and folklore.
const back = [
  "silbon",
  "capriles",
  "emilio",
  "dudamel",
  "puma",
  "javier",
  "lila",
  "lionza",
];
const front = [
  "vallenilla",
  "maite",
  "oscar",
  "simon",
  "renny",
  "conde",
  "mcm",
  "zavarce",
];
for (const [index, id] of back.entries()) {
  await fighter(
    id,
    66 + index * 148,
    86 + Math.abs(3.5 - index) * 5,
    390,
    index > 3,
  );
}
for (const [index, id] of front.entries()) {
  await fighter(
    id,
    112 + index * 141,
    205 + Math.abs(3.5 - index) * 5,
    420,
    index > 3,
  );
}
layers.push({
  input: svg(
    `<defs><linearGradient id="fade" x2="0" y2="1"><stop stop-color="${navy}" stop-opacity="0"/><stop offset=".6" stop-color="${navy}" stop-opacity=".98"/><stop offset="1" stop-color="${navy}"/></linearGradient></defs>
    <rect y="358" width="1200" height="272" fill="url(#fade)"/>
    <path d="M174 445H1030L1014 551H158Z" fill="${navy}" stroke="#30455f"/>
    <path d="M174 445H180L164 551H158Z" fill="${yellow}"/>
    <path d="M1030 445H1036L1020 551H1014Z" fill="#e86658"/>
    <rect x="48" y="37" width="6" height="18" fill="${yellow}"/>`,
  ),
  left: 0,
  top: 0,
});
await text("EL JUEGO DE PELEA VENEZOLANO", 68, 38, 19, cream, "pixel");
const arena = await textImage("ARENA", 123, cream);
const criolla = await textImage("CRIOLLA", 123, yellow);
const arenaWidth = (await sharp(arena).metadata()).width;
const criollaWidth = (await sharp(criolla).metadata()).width;
const titleLeft = Math.round((width - arenaWidth - criollaWidth - 22) / 2);
layers.push({ input: arena, left: titleLeft, top: 450 });
layers.push({ input: criolla, left: titleLeft + arenaWidth + 22, top: 450 });
await centeredText(
  "Piques de aquí. Revanchas infinitas.",
  565,
  23,
  cream,
  "body",
);
await centeredText(
  `${fighters.length} LUCHADORES  /  ${stages.length} ESCENARIOS  /  SIN REGISTRO`,
  604,
  16,
  "#a9c1dd",
  "pixel",
);

await sharp({ create: { width, height, channels: 3, background: navy } })
  .composite(layers)
  .png({ compressionLevel: 9 })
  .toFile("public/assets/og-arena-criolla.png");
console.log("Created public/assets/og-arena-criolla.png (1200 × 630)");
