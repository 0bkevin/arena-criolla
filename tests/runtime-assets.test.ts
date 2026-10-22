import test from "node:test";
import assert from "node:assert/strict";
import { BUILT_IN_FIGHTERS } from "../shared/content";
import { personalityById } from "../src/game/personality";
import personalities from "../shared/character-personalities.json";
import geometry from "../shared/sprite-geometry.json";

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
