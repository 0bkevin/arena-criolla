import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
const fighters = JSON.parse(await readFile("shared/fighters.json", "utf8"));
const qa = JSON.parse(await readFile("docs/character-sprite-qa.json", "utf8"));
const groups = [
  fighters.slice(0, 8).map((x) => x.id),
  fighters.slice(8, 16).map((x) => x.id),
  fighters.slice(16, 24).map((x) => x.id),
  fighters.slice(24, 32).map((x) => x.id),
  fighters.slice(32, 40).map((x) => x.id),
  [...fighters.slice(40).map((x) => x.id), "tioconejo", "juan"],
];
const summary = [];
for (const [group, ids] of groups.entries()) {
  const layers = [];
  for (const [slot, id] of ids.entries()) {
    const f = fighters.find((x) => x.id === id);
    const audit = qa.sprites
      .find((x) => x.id === id)
      .files.find((x) => x.file === `public/assets/${f.sprite}.webp`);
    const b = audit.components[0];
    const crop = {
      left: b.minX,
      top: b.minY,
      width: b.maxX - b.minX + 1,
      height: b.maxY - b.minY + 1,
    };
    const s = Math.min(420 / crop.width, 525 / crop.height);
    const w = Math.round(crop.width * s),
      h = Math.round(crop.height * s);
    const figure = await sharp(`public/assets/${f.sprite}.webp`)
      .extract(crop)
      .resize(w, h)
      .png()
      .toBuffer();
    layers.push({
      input: figure,
      left: (slot % 4) * 512 + Math.floor((512 - w) / 2),
      top: Math.floor(slot / 4) * 640 + 565 - h,
    });
    const label =
      `${slot + 1}. ${f.shortName}${group === 5 && slot > 5 ? " (alternativa)" : ""}`
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;");
    const svg = Buffer.from(
      `<svg width="512" height="58"><text x="256" y="37" font-family="DejaVu Sans" font-size="27" fill="#ffffff" text-anchor="middle">${label}</text></svg>`,
    );
    layers.push({
      input: svg,
      left: (slot % 4) * 512,
      top: Math.floor(slot / 4) * 640 + 575,
    });
  }
  const file = `assets/source/finales/references/seated-reference-${group + 1}.png`;
  await sharp({
    create: { width: 2048, height: 1280, channels: 4, background: "#1c2330" },
  })
    .composite(layers)
    .png()
    .toFile(file);
  summary.push({
    group: group + 1,
    file,
    characters: ids.map((id) => ({
      id,
      name: fighters.find((x) => x.id === id).name,
      sprite: fighters.find((x) => x.id === id).sprite,
    })),
  });
  console.log(file);
}
await writeFile(
  "docs/finales/seated-references.json",
  JSON.stringify(summary, null, 2) + "\n",
);
