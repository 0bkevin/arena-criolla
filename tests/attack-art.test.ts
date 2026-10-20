import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
  test(`${id}: revised attack art retains raw source provenance, complete frames and exact runtime alpha`, async () => {
    const report = JSON.parse(
      await readFile(`docs/finales/attack-overhaul/${id}/assets.json`, "utf8"),
    );
    const [source, packed, runtime] = await Promise.all(
      [report.source, report.normalized, report.destination].map((path) =>
        readFile(path),
      ),
    );
    assert.equal(sha(source), report.sourceSha256);
    assert.equal(sha(packed), report.normalizedSha256);
    assert.equal(sha(runtime), report.runtimeSha256);
    const decoded = await sharp(runtime)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    assert.equal(sha(decoded.data), report.rgbaSha256);
    const png = await sharp(packed).ensureAlpha().raw().toBuffer();
    assert.ok(
      png.equals(decoded.data),
      "all runtime RGBA pixels equal the packed original",
    );
    const alpha = await sharp(runtime).extractChannel("alpha").raw().toBuffer();
    assert.equal(sha(alpha), report.alphaSha256);
    assert.deepEqual(manifest[id as keyof typeof manifest], {
      file: sheet.file,
      frames: report.frames,
    });
    assert.equal(Object.keys(sheet.frames).length, report.poses.length);
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
