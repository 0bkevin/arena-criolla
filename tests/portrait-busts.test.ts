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

test("each bust file holds the pose rows the portrait canvas can show", async () => {
  for (const [id, bust] of Object.entries(manifest)) {
    const file = await readFile(`public/assets/${bust.file}.webp`);
    assert.equal(sha256(file), bust.sha256, id);
    const { width, height } = await sharp(file).metadata();
    assert.ok(bust.x + bust.width <= width!, id);
    assert.ok(bust.y + bust.rows <= height!, id);
    const fighter = FIGHTERS.find((f) => f.id === id)!;
    const { top, scale } = bustPlacement(fighter, bust);
    assert.ok(
      bust.rows === bust.height ||
        top + bust.rows * scale >= PORTRAIT_CANVAS.height,
      `${id}: the stored rows end above the canvas bottom`,
    );
  }
});
