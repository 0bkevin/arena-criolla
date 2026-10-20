import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import sharp from "sharp";
import { webpChunks } from "../scripts/audit-lossless-assets.mjs";

const files = [
  "dayana-v49",
  "deyna-v1",
  "dayana-runway-attack-v3",
  "deyna-squad-attack-v2",
  "dayana-seated-v1",
  "deyna-seated-v1",
  "perro-mujeriego-dayana-v1",
  "perro-mujeriego-deyna-v1",
];
test("both identities ship compact native-resolution lossless artwork with real alpha and no obsolete football queen files", async () => {
  let total = 0;
  for (const file of files) {
    const bytes = await fs.readFile(`public/assets/${file}.webp`);
    total += bytes.length;
    assert.ok(
      webpChunks(bytes).includes("VP8L"),
      `${file}: lossless RGB and alpha`,
    );
    const { data, info } = await sharp(bytes)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    assert.ok(
      info.width <= 2048 && info.height <= 2048,
      `${file}: bounded decode dimensions`,
    );
    assert.ok(
      bytes.length < 3 * 1024 * 1024,
      `${file}: compressed transfer budget`,
    );
    let transparent = 0,
      opaque = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (!data[i]) transparent++;
      else opaque++;
    }
    assert.ok(
      transparent > info.width * info.height * 0.2,
      `${file}: genuine transparent backdrop`,
    );
    assert.ok(opaque > 4000, `${file}: visible painted body`);
  }
  assert.ok(
    total < 11 * 1024 * 1024,
    "all eight files stay below the combined transfer budget",
  );
  for (const obsolete of [
    "dayana-v40",
    "dayana-football-attack-v1",
    "dayana-pageant-attack-v1",
    "dayana-runway-attack-v2",
    "deyna-football-attack-v1",
  ])
    await assert.rejects(fs.access(`public/assets/${obsolete}.webp`), {
      code: "ENOENT",
    });
});
