import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { FIGHTERS } from "../shared/content";
import busts from "../shared/portrait-busts.json";
import {
  bustPlacement,
  PORTRAIT_CANVAS,
  type PortraitBust,
} from "../shared/portrait-busts";
import entranceManifest from "../shared/entrance-assets.json";
import atlasManifest from "../shared/sprite-geometry.json";
import { selectionBodyHeight } from "../src/game/entrance-framing";
import type { EntranceAsset } from "../src/game/assets";
import { presentationById } from "../shared/presentation";

const manifest: Record<string, PortraitBust> = busts;
const sha256 = (data: Buffer) =>
  createHash("sha256").update(data).digest("hex");
const builtIn = FIGHTERS.filter((fighter) => fighter.category !== "community");

test("every built-in roster card has a bust cut from its current atlas", async () => {
  assert.deepEqual(
    Object.keys(manifest).sort(),
    builtIn.map((fighter) => fighter.id).sort(),
  );
  for (const fighter of builtIn) {
    const bust = manifest[fighter.id];
    assert.equal(bust.source, fighter.sprite, fighter.id);
    assert.equal(
      bust.sourceSha256,
      sha256(await readFile(`public/assets/${fighter.sprite}.webp`)),
      `${fighter.id}: atlas changed; run npx tsx scripts/generate-portrait-busts.ts`,
    );
    assert.equal(bust.frame, presentationById(fighter.id).battleFrame);
  }
});

test("each bust file holds the full pose and matches selection framing", async () => {
  for (const [id, bust] of Object.entries(manifest)) {
    const file = await readFile(`public/assets/${bust.file}.webp`);
    assert.equal(sha256(file), bust.sha256, id);
    const { width, height } = await sharp(file).metadata();
    assert.ok(bust.x + bust.width <= width!, id);
    assert.ok(bust.y + bust.rows <= height!, id);
    assert.equal(bust.rows, bust.height, id);
    const checked = atlasManifest.sprites.find((sprite) => sprite.id === id)!
      .files[0];
    const cellWidth = checked.width / 4;
    const cellHeight = checked.height / 2;
    const frames = checked.components.map((bounds, index) => ({
      x: bounds.minX,
      y: bounds.minY,
      width: bounds.maxX - bounds.minX + 1,
      height: bounds.maxY - bounds.minY + 1,
      slotX: (index % 4) * cellWidth,
      slotY: Math.floor(index / 4) * cellHeight,
    }));
    const entrance = (
      entranceManifest as Record<string, Omit<EntranceAsset, "image">>
    )[id];
    assert.equal(
      bust.selectionHeight,
      entrance
        ? selectionBodyHeight({
            entrance,
            frames,
            battleFrame: bust.frame,
            cellWidth,
            bodyHeight: bust.bodyHeight,
            baseline: checked.components[0].maxY + 1,
          })
        : 450,
      id,
    );
    const fighter = FIGHTERS.find((f) => f.id === id)!;
    const { top, scale } = bustPlacement(fighter, bust);
    assert.ok(
      bust.rows === bust.height ||
        top + bust.rows * scale >= PORTRAIT_CANVAS.height,
      `${id}: the stored rows end above the canvas bottom`,
    );
  }
});
