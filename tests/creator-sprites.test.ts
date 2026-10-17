import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { mkdtemp, readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  packCharacterSprites,
  SpriteValidationError,
} from "../server/creator/sprites";
import {
  makeDefinition,
  validateGeneratedGameplay,
} from "../server/creator/pipeline";
import { buildSpritePrompt, DesignSchema } from "../server/creator/provider";
import type { CharacterDesign } from "../server/creator/provider";

const design: CharacterDesign = {
  title: "El pana",
  specialName: "Paso con estilo",
  outfit: "Chaqueta azul y zapatillas claras.",
  likeness: "Cabello corto y lentes de montura negra.",
  welcome: "Saludo con la mano",
  welcomeStyle: "wave",
  combos: ["Primer paso", "Segundo compás", "Gran final"],
};
async function atlas(
  options: { opaque?: boolean; missing?: number; clipped?: number } = {},
) {
  let shapes = options.opaque
    ? '<rect width="1536" height="1024" fill="white"/>'
    : "";
  for (let n = 0; n < 8; n++)
    if (n !== options.missing) {
      const x = (n % 4) * 384 + (n === options.clipped ? 0 : 140),
        y = Math.floor(n / 4) * 512 + 40;
      shapes += `<rect x="${x}" y="${y}" width="${100 + n * 2}" height="400" rx="25" fill="#6483ac"/>`;
    }
  return sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024">${shapes}</svg>`,
    ),
  )
    .png()
    .toBuffer();
}
test("sprite packing preserves eight complete poses, transparent margins and a shared baseline", async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), "arena-packing-test-"));
  const geometry = await packCharacterSprites(await atlas(), folder);
  assert.equal(geometry.frames.length, 8);
  assert.equal(geometry.width, 2048);
  assert.equal(geometry.height, 1024);
  for (const f of geometry.frames) {
    assert.equal(f.y - f.slotY + f.height, geometry.baseline);
    assert.ok(f.x - f.slotX > 4);
    assert.ok(f.x - f.slotX + f.width < geometry.cellWidth - 4);
  }
  const stored = JSON.parse(
    await readFile(path.join(folder, "geometry.json"), "utf8"),
  );
  assert.deepEqual(stored, geometry);
  const { data } = await sharp(path.join(folder, "sprite.webp"))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(data[3], 0);
});
test("opaque, missing and cropped model poses fail validation before publication", async () => {
  const folder = await mkdtemp(
    path.join(os.tmpdir(), "arena-packing-invalid-"),
  );
  for (const options of [{ opaque: true }, { missing: 4 }, { clipped: 6 }])
    await assert.rejects(
      async () => packCharacterSprites(await atlas(options), folder),
      SpriteValidationError,
    );
});
test("all three creator styles use balanced playable recipes and different welcome gestures", async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), "arena-style-test-"));
  const geometry = await packCharacterSprites(await atlas(), folder);
  const abilities = new Set<string>(),
    gestures = new Set<string>();
  for (const [style, welcomeStyle] of [
    ["agile", "wave"],
    ["technical", "nod"],
    ["power", "bow"],
  ] as const) {
    const character = makeDefinition(
      "custom_" +
        (style === "agile" ? "a" : style === "technical" ? "b" : "c").repeat(
          32,
        ),
      {
        name: "Pana",
        description: "Una persona creativa y deportista.",
        style,
        color: "#669bff",
      },
      { ...design, welcomeStyle },
      geometry,
      "Creador",
    );
    abilities.add(character.fighter.ability);
    gestures.add(JSON.stringify(character.choreography.beats[2]));
    assert.doesNotThrow(() => validateGeneratedGameplay(character));
    assert.deepEqual(character.presentation.frameFacing, Array(8).fill(1));
    assert.equal(character.presentation.battleFrame, 0);
  }
  assert.equal(abilities.size, 3);
  assert.equal(gestures.size, 3);
});
test("provider instructions specify likeness, all right-facing poses and private references as data", () => {
  const prompt = buildSpritePrompt(
    {
      name: "Pana",
      description: "Soy creativo.",
      style: "agile",
      color: "#ffd45a",
    },
    design,
  );
  for (const required of [
    "EIGHT",
    "4-column by 2-row",
    "face RIGHT",
    "background alpha transparent",
    "no crop",
    "same person",
  ])
    assert.ok(prompt.toLowerCase().includes(required.toLowerCase()), required);
  assert.equal(
    DesignSchema.safeParse({ ...design, combos: ["Only one"] }).success,
    false,
  );
});
