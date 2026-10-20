import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runtimeMetadata } from "../scripts/prepare-runtime-metadata.mjs";

test("runtime metadata preserves every consumed personality and geometry field", async () => {
  const projected = await runtimeMetadata();
  for (const [name, expected] of Object.entries(projected)) {
    assert.deepEqual(
      JSON.parse(
        await readFile(
          new URL(`../src/game/generated/${name}`, import.meta.url),
          "utf8",
        ),
      ),
      expected,
    );
  }
  assert.equal(
    Object.keys(projected["character-personalities.json"].characters).length,
    52,
  );
  assert.equal(projected["sprite-geometry.json"].sprites.length, 52);
});
