import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import sharp from "sharp";
import { BUILT_IN_FIGHTERS } from "../shared/content";
import {
  FINALES,
  FINALE_ASSET_GROUPS,
  CANONICAL_FINALE_FIGHTERS,
  finaleAsset,
} from "../shared/finales";
import { ATTACK_ART } from "../src/game/attack-art";

test("the 46 original prop cells and later canonical or painted arena finales cover the roster", async () => {
  const expected = new Set<string>(FINALE_ASSET_GROUPS.flat());
  const roster = BUILT_IN_FIGHTERS.map(({ id }) => id).sort();
  assert.deepEqual(Object.keys(FINALES).sort(), roster);
  assert.deepEqual(
    [
      ...new Set([
        ...expected,
        ...CANONICAL_FINALE_FIGHTERS,
        ...Object.keys(ATTACK_ART),
      ]),
    ].sort(),
    roster,
  );
  assert.equal(FINALES.kevin.mode, "field");
  assert.equal(finaleAsset("kevin"), undefined);
  assert.equal(FINALES.dorangel.mode, "field");
  assert.equal(finaleAsset("dorangel"), undefined);
  for (const id of CANONICAL_FINALE_FIGHTERS)
    assert.equal(finaleAsset(id), undefined);
  const cells = new Set<string>();
  assert.equal(Object.keys(FINALES).length, roster.length);
  assert.equal(
    new Set(Object.values(FINALES).map((finale) => finale.title)).size,
    roster.length,
  );
  for (const [group, fighters] of FINALE_ASSET_GROUPS.entries()) {
    const file = `public/assets/finales-v1-${group + 1}.webp`;
    const buffer = await readFile(file);
    const { data, info } = await sharp(buffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    assert.equal(info.width % 4, 0);
    assert.equal(info.height % 2, 0);
    const cellWidth = info.width / 4;
    const cellHeight = info.height / 2;
    for (const [index, id] of fighters.entries()) {
      assert.ok(expected.delete(id), `${id}: unique built-in fighter`);
      const asset = finaleAsset(id)!;
      const key = `${asset.file}:${asset.column}:${asset.row}`;
      assert.ok(!cells.has(key), `${id}: unique artwork`);
      cells.add(key);
      let visible = 0;
      let transparent = 0;
      for (let y = 0; y < cellHeight; y++)
        for (let x = 0; x < cellWidth; x++) {
          const alpha =
            data[
              ((Math.floor(index / 4) * cellHeight + y) * info.width +
                (index % 4) * cellWidth +
                x) *
                4 +
                3
            ];
          if (alpha > 128) visible++;
          if (alpha < 16) transparent++;
        }
      assert.ok(
        visible > cellWidth * cellHeight * 0.025,
        `${id}: prop actually present`,
      );
      assert.ok(
        transparent > cellWidth * cellHeight * 0.04,
        `${id}: true transparent background`,
      );
    }
  }
  assert.equal(cells.size, 46);
  assert.equal(expected.size, 0);
});
