import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import {
  actorDanceAnchor,
  alignActorAtlas,
  normalizeActorPoses,
  validateActorAtlas,
} from "./prepare-finale-actors";

// Raw image_gen outputs and prompts live in the private artwork workspace.
// Only complete silhouettes are isolated, uniformly scaled and packed; no
// facial compositing, recoloring or anatomy editing happens in this step.
const source = "assets/source/inaki-v5";
const definitions = [
  { key: "combat", file: "inaki-v5", columns: 4, rows: 2 },
  { key: "entrance", file: "inaki-defiant-entrance-v5", columns: 3, rows: 2 },
  { key: "attack", file: "inaki-rial-attack-v5", columns: 4, rows: 4 },
  { key: "cafe", file: "inaki-cafe-reactions-v5", columns: 2, rows: 2 },
  { key: "dance", file: "perro-mujeriego-inaki-v5", columns: 4, rows: 2 },
] as const;
const attackPoses = [
  "special-ready",
  "special-release",
  "charge-start",
  "charge-cup",
  "blast-release",
  "blast-sustain",
  "recover",
  "victory",
  "note-flat",
  "note-curl",
  "note-tilt",
  "stack-small",
  "bundle",
  "cash-cloud-small",
  "cash-orb",
  "cash-orb-release",
];
const json = async (name: string) =>
  JSON.parse(await readFile(`shared/${name}.json`, "utf8"));
const save = async (name: string, value: unknown) =>
  writeFile(
    `shared/${name}.json`,
    JSON.stringify(value, null, name === "sprite-geometry" ? undefined : 2) +
      "\n",
  );
const hash = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
const reports = [];

for (const definition of definitions) {
  const { key, file, columns, rows } = definition;
  const raw = await readFile(`${source}/${key}-generated.png`);
  // The generator can leave only two clear pixels at the canvas edge. Padding
  // preserves the complete silhouette and allows the shared normalizer's
  // antialiasing gutter; it never reconstructs a clipped limb.
  const padded = await sharp(raw)
    .extend({ top: 20, bottom: 20, left: 20, right: 20, background: "#0000" })
    .png()
    .toBuffer();
  const png = await alignActorAtlas(
    await normalizeActorPoses(padded, columns, rows),
    columns,
    rows,
  );
  const webp = await sharp(png)
    .webp({ lossless: true, exact: true, effort: 6 })
    .toBuffer();
  const result = await validateActorAtlas(
    png,
    webp,
    columns,
    rows,
    key !== "attack",
    key === "cafe" ? "head" : "dance",
  );
  const { data, info } = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const frames = result.frames.map(({ frame: f, bodyHeight, anchorX }) => ({
    x: f.x - 4,
    y: f.y - 4,
    width: f.width + 8,
    height: f.height + 8,
    anchorX: anchorX + 4,
    anchorY: f.height + 4,
    bodyHeight,
  }));
  await writeFile(`public/assets/${file}.webp`, webp);

  if (key === "combat") {
    const roster = await json("fighters");
    roster.find((fighter: { id: string }) => fighter.id === "inaki").sprite =
      file;
    const geometry = await json("sprite-geometry");
    const components = result.frames.map(({ frame: f }) => {
      let minX = info.width,
        minY = info.height,
        maxX = -1,
        maxY = -1;
      for (let y = f.y; y < f.y + f.height; y++)
        for (let x = f.x; x < f.x + f.width; x++) {
          if (data[(y * info.width + x) * 4 + 3] < 40) continue;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      assert.ok(minX <= maxX && minY <= maxY);
      return { minX, minY, maxX, maxY };
    });
    geometry.sprites.find(
      (sprite: { id: string }) => sprite.id === "inaki",
    ).files = [
      {
        file: `public/assets/${file}.webp`,
        passed: true,
        width: info.width,
        height: info.height,
        components,
      },
    ];
    await save("fighters", roster);
    await save("sprite-geometry", geometry);
  } else if (key === "entrance") {
    const manifest = await json("entrance-assets");
    manifest.inaki = {
      file,
      cell: 512,
      bodyHeight: frames[0].bodyHeight,
      baseline: 482,
      anchorX: frames[0].anchorX,
      width: info.width,
      height: info.height,
      frames: frames.map((frame, index) => ({
        ...frame,
        slotX: (index % columns) * 512,
        slotY: Math.floor(index / columns) * 512,
      })),
    };
    await save("entrance-assets", manifest);
  } else if (key === "attack") {
    const manifest = await json("attack-assets");
    manifest.inaki = {
      file,
      frames: Object.fromEntries(
        frames.map((frame, i) => [
          attackPoses[i],
          {
            ...frame,
            anchorX:
              i < 8
                ? actorDanceAnchor(data, info.width, result.frames[i].frame) + 4
                : frame.width / 2,
          },
        ]),
      ),
    };
    await save("attack-assets", manifest);
  } else if (key === "cafe") {
    const manifest = await json("finale-actor-assets");
    manifest.seated.inaki = {
      file,
      frame: frames[0],
      bodyHeight: frames[0].bodyHeight,
      anchorX: frames[0].anchorX,
      frames,
    };
    await save("finale-actor-assets", manifest);
  } else {
    const manifest = await json("perro-mujeriego-assets");
    manifest.dancers.inaki = { file, frames };
    await save("perro-mujeriego-assets", manifest);
  }
  reports.push({
    ...definition,
    sourceSha256: hash(raw),
    runtimeSha256: hash(webp),
    rgbaSha256: result.rgbaSha256,
    alphaSha256: result.alphaSha256,
    frames,
  });
  console.log(
    `${file}: ${frames.length} complete poses, ${info.width}×${info.height}, exact RGBA WebP`,
  );
}
await writeFile(
  `${source}/packing.json`,
  JSON.stringify({ tool: "image_gen.imagegen", reports }, null, 2) + "\n",
);
