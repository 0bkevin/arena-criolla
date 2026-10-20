import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { BUILT_IN_FIGHTERS } from "../shared/content";
import { personalityById } from "../src/game/personality";
import personalities from "../shared/character-personalities.json";
import geometry from "../shared/sprite-geometry.json";
import actors from "../shared/finale-actor-assets.json";
import dancers from "../shared/perro-mujeriego-assets.json";
import furniture from "../shared/finale-cafe-assets.json";
import desk from "../shared/finale-desk-assets.json";
import { FINALE_ASSET_GROUPS } from "../shared/finales";

test("runtime personality and geometry metadata cover the complete shipped roster", () => {
  const ids = BUILT_IN_FIGHTERS.map((fighter) => fighter.id).sort();
  assert.deepEqual(Object.keys(personalities.characters).sort(), ids);
  assert.deepEqual(geometry.sprites.map((sprite) => sprite.id).sort(), ids);
  for (const fighter of BUILT_IN_FIGHTERS) {
    const personality = personalityById(fighter.id);
    assert.ok(personality.realName.length && personality.portrayal.length);
    assert.ok(Array.isArray(personality.sources));
    const sprite = geometry.sprites.find((entry) => entry.id === fighter.id)!;
    assert.equal(sprite.files.length, 1);
    assert.equal(sprite.files[0].file, `public/assets/${fighter.sprite}.webp`);
    assert.equal(sprite.files[0].passed, true);
    assert.equal(sprite.files[0].components.length, 8);
  }
});

test("every seated guest, dancer, performer and furniture frame has visible artwork inside its shipped atlas", async () => {
  const ids = [
    ...FINALE_ASSET_GROUPS.flat(),
    "dayana",
    "deyna",
    "kevin",
  ].sort();
  assert.deepEqual(Object.keys(actors.seated).sort(), ids);
  assert.deepEqual(Object.keys(actors.dancers).sort(), ids);
  assert.deepEqual(Object.keys(dancers.dancers).sort(), ids);
  assert.deepEqual(Object.keys(actors.performers).sort(), [
    "giuseppe",
    "nacho",
  ]);
  assert.equal(actors.caprilesCafe.frames.length, 4);
  assert.deepEqual(Object.keys(furniture.frames), [
    "leftChair",
    "rightChair",
    "table",
    "cup",
  ]);

  type Frame = { x: number; y: number; width: number; height: number };
  const images = new Map<string, Awaited<ReturnType<typeof decode>>>();
  async function decode(file: string) {
    return sharp(`public/assets/${file}.webp`)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
  }
  async function check(file: string, frame: Frame, label: string) {
    let image = images.get(file);
    if (!image) {
      image = await decode(file);
      images.set(file, image);
    }
    assert.ok(frame.width > 0 && frame.height > 0, label);
    assert.ok(
      frame.x >= 0 &&
        frame.y >= 0 &&
        frame.x + frame.width <= image.info.width &&
        frame.y + frame.height <= image.info.height,
      `${label}: atlas bounds`,
    );
    let visible = 0;
    for (let y = frame.y; y < frame.y + frame.height; y++)
      for (let x = frame.x; x < frame.x + frame.width; x++)
        if (image.data[(y * image.info.width + x) * 4 + 3] >= 40) visible++;
    assert.ok(visible > 10, `${label}: missing silhouette`);
  }
  for (const [id, actor] of Object.entries(actors.seated)) {
    assert.ok(
      actor.bodyHeight > 0 &&
        actor.anchorX > 0 &&
        actor.anchorX < actor.frame.width,
      id,
    );
    await check(actor.file, actor.frame, `${id}/seated`);
  }
  for (const [id, actor] of Object.entries(actors.dancers))
    await check(actor.file, actor.frame, `${id}/dance fallback`);
  for (const [id, dancer] of Object.entries(dancers.dancers)) {
    assert.equal(dancer.frames.length, 8, id);
    for (const [pose, frame] of dancer.frames.entries())
      await check(dancer.file, frame, `${id}/dance/${pose}`);
  }
  for (const [id, actor] of Object.entries(actors.performers))
    for (const [pose, frame] of actor.frames.entries())
      await check(actor.file, frame, `${id}/performer/${pose}`);
  for (const [pose, frame] of actors.caprilesCafe.frames.entries())
    await check(actors.caprilesCafe.file, frame, `capriles/cafe/${pose}`);
  for (const [name, frame] of Object.entries(furniture.frames))
    await check(furniture.file, frame, `cafe/${name}`);
  await check(desk.file, desk.frame, "giuseppe/desk");
});
