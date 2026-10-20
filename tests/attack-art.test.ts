import test from "node:test";
import assert from "node:assert/strict";

import { createHash } from "node:crypto";
import sharp from "sharp";
import manifest from "../shared/attack-assets.json";
import { ATTACK_ART } from "../src/game/attack-art";
import { finaleById } from "../shared/finales";
import { combatLabel } from "../src/game/combat-label";
import { FIGHTERS } from "../shared/content";
import { createMatch } from "../shared/engine";
import { drawFinale } from "../src/game/finale-renderer";

const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
for (const [id, sheet] of Object.entries(ATTACK_ART)) {
  test(`${id}: shipped attack art contains complete, visible frames inside its transparent atlas`, async () => {
    const decoded = await sharp(`public/assets/${sheet.file}.webp`)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const alpha = await sharp(`public/assets/${sheet.file}.webp`)
      .extractChannel("alpha")
      .raw()
      .toBuffer();
    assert.deepEqual(manifest[id as keyof typeof manifest], {
      file: sheet.file,
      frames: sheet.frames,
    });
    assert.ok(Object.keys(sheet.frames).length > 0);
    for (const frame of Object.values(sheet.frames)) {
      assert.ok(
        frame.width > 0 &&
          frame.height > 0 &&
          frame.anchorX >= 0 &&
          frame.anchorX <= frame.width,
      );
      assert.ok(
        frame.x >= 0 &&
          frame.y >= 0 &&
          frame.x + frame.width <= decoded.info.width &&
          frame.y + frame.height <= decoded.info.height,
      );
      let visible = 0;
      for (let y = frame.y; y < frame.y + frame.height; y++)
        for (let x = frame.x; x < frame.x + frame.width; x++)
          if (alpha[y * decoded.info.width + x] >= 40) visible++;
      assert.ok(visible > 1000, "the runtime frame contains a real silhouette");
    }
  });
}

test("every definitive has one generic combat category heading", () => {
  for (const fighter of FIGHTERS) {
    const state = createMatch("caracas", [
      { name: "P1", fighter: fighter.id, wins: 3 },
      { name: "P2", fighter: "capriles", wins: 3 },
    ]);
    state.phase = "playing";
    state.finale = {
      owner: 0,
      target: 1,
      fighter: fighter.id,
      startedTick: 0,
      tick: 50,
      duration: 180,
      x: 540,
      y: 555,
      direction: 1,
      damage: 40,
      initialHp: 100,
    };
    const labels: string[] = [];
    const context = new Proxy(
      {
        fillText(text: string) {
          labels.push(text);
        },
      },
      {
        get(target, key) {
          return Reflect.get(target, key) ?? (() => {});
        },
      },
    ) as unknown as CanvasRenderingContext2D;
    drawFinale(context, state, {}, {});
    if (finaleById(fighter.id)?.mode !== "capture") {
      assert.equal(
        labels.length,
        0,
        "obsolete capture state must not render theater props or damage",
      );
      state.players[0].attack = "super";
      assert.equal(combatLabel(state.players[0], state.tick), "Definitiva");
      continue;
    }
    assert.equal(
      labels.filter((label) => label === "DEFINITIVA").length,
      1,
      fighter.id,
    );
  }
});
