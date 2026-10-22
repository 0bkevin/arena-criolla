import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { fighterById, type FighterId } from "../shared/content";
import {
  createMatch,
  emptyInput,
  stepMatch,
  WORLD,
  type Input,
} from "./helpers/charged-finale-engine";
import { finaleById } from "../shared/finales";
import { TECHNIQUES } from "../shared/techniques";
import geometry from "../shared/sprite-geometry.json";
import entrances from "../shared/entrance-assets.json";
import attacks from "../shared/attack-assets.json";
import actors from "../shared/finale-actor-assets.json";
import dancers from "../shared/perro-mujeriego-assets.json";
import { ENTRANCE_ACTIONS } from "../shared/entrance-actions";
import { personalityById } from "../src/game/personality";
import { victoryById } from "../src/game/victory";
import { drawCocoProjectile } from "../src/game/finales/coco";

function setup(side: 0 | 1, gap = 400, rival: FighterId = "capriles") {
  const config = { name: "Coco", fighter: "kevin" as const, wins: 3 },
    other = { name: "Rival", fighter: rival, wins: 3 },
    state = createMatch("caracas", side ? [other, config] : [config, other]);
  state.phase = "playing";
  const player = state.players[side],
    target = state.players[1 - side];
  player.x = side ? 850 : 350;
  player.facing = side ? -1 : 1;
  target.x = player.x + player.facing * gap;
  target.facing = -player.facing;
  for (const p of state.players) {
    p.y = WORLD.floor;
    p.grounded = true;
    p.invincible = 0;
    p.energy = 100;
  }
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (ticks: number) => {
    for (let i = 0; i < ticks; i++) stepMatch(state, inputs);
  };
  return { state, player, target, inputs, advance };
}

test("Kevin Charles is an independently selectable Coco founder with sourced identity and a live finale", () => {
  const f = fighterById("kevin");
  assert.equal(f.name, "Kevin Charles");
  assert.equal(f.category, "founders");
  assert.equal(f.ability, "remittance");
  assert.equal(f.special, "Pago al toque");
  assert.equal(new Set(f.combos).size, 3);
  assert.equal(f.displayHeight ?? 177, 177);
  assert.deepEqual(
    personalityById("kevin").sources.map((s) => new URL(s.url).hostname),
    ["www.ycombinator.com", "cocowallet.app"],
  );
  assert.equal(finaleById("kevin")!.mode, "field");
  assert.deepEqual(finaleById("kevin")!.damageBeats, []);
  assert.equal(victoryById("kevin").paintedPose, "celebrate");
});

test("Coco has every native painted pose needed by combat, entrances, victory, Capriles and Nacho", async () => {
  const combat = geometry.sprites.find((s) => s.id === "kevin")!.files[0];
  assert.equal(combat.components.length, 8);
  assert.equal(entrances.kevin.frames.length, 8);
  assert.equal(actors.seated.kevin.frames.length, 4);
  assert.equal(dancers.dancers.kevin.frames.length, 8);
  for (const key of ENTRANCE_ACTIONS.kevin!.frames)
    assert.ok(entrances.kevin.frames[key.frame]);
  const required = [
    "draw",
    "tap",
    "send",
    "network",
    "recover",
    "celebrate",
    "token",
    "receipt",
  ];
  assert.deepEqual(Object.keys(attacks.kevin.frames), required);
  const sheets = [
    {
      file: fighterById("kevin").sprite,
      frames: combat.components.map((f) => ({
        x: f.minX,
        y: f.minY,
        width: f.maxX - f.minX + 1,
        height: f.maxY - f.minY + 1,
      })),
    },
    { file: entrances.kevin.file, frames: entrances.kevin.frames },
    { file: attacks.kevin.file, frames: Object.values(attacks.kevin.frames) },
    { file: actors.seated.kevin.file, frames: actors.seated.kevin.frames },
    { file: dancers.dancers.kevin.file, frames: dancers.dancers.kevin.frames },
  ];
  assert.equal(new Set(sheets.map((s) => s.file)).size, 5);
  assert.equal(
    sheets.reduce((sum, s) => sum + s.frames.length, 0),
    36,
  );
  let transfer = 0,
    nativePixels = 0;
  for (const sheet of sheets) {
    const bytes = await readFile(`public/assets/${sheet.file}.webp`);
    transfer += bytes.length;
    assert.equal(
      bytes.toString("ascii", 12, 16),
      "VP8L",
      `${sheet.file}: lossless color and alpha`,
    );
    const image = sharp(bytes),
      meta = await image.metadata();
    nativePixels += meta.width! * meta.height!;
    assert.ok(meta.hasAlpha && meta.width! <= 2048 && meta.height! <= 2048);
    const fingerprints = new Set<string>();
    for (const f of sheet.frames) {
      assert.ok(
        f.x > 0 &&
          f.y > 0 &&
          f.x + f.width < meta.width! &&
          f.y + f.height < meta.height!,
        sheet.file,
      );
      const crop = image
        .clone()
        .extract({ left: f.x, top: f.y, width: f.width, height: f.height });
      const pixels = await crop.ensureAlpha().raw().toBuffer();
      let transparent = 0,
        visible = 0;
      for (let n = 3; n < pixels.length; n += 4) {
        if (!pixels[n]) transparent++;
        else if (pixels[n] >= 40) visible++;
      }
      assert.ok(
        transparent > 100 && visible > 4000,
        `${sheet.file}: complete isolated artwork`,
      );
      fingerprints.add(createHash("sha256").update(pixels).digest("hex"));
    }
    assert.equal(
      fingerprints.size,
      sheet.frames.length,
      `${sheet.file}: poses are distinct`,
    );
  }
  assert.ok(
    transfer < 4 * 1024 * 1024,
    "all 36 native poses and props fit below 4 MiB",
  );
  assert.ok(
    nativePixels < 7_500_000,
    "compact native atlases avoid decoding excess transparent padding",
  );
});

test("a missing Coco projectile bitmap stays visible with the official closed-ring shape", () => {
  const arcs: number[][] = [];
  const ctx = new Proxy(
    {
      arc(...args: number[]) {
        arcs.push(args);
      },
    },
    {
      get(target, key) {
        return Reflect.get(target, key) ?? (() => {});
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  assert.equal(
    drawCocoProjectile(
      ctx,
      {},
      {
        id: 1,
        owner: 0,
        x: 0,
        y: 0,
        vx: 9.5,
        life: 64,
        damage: 8,
        kind: "remittance",
        radius: 15,
      },
    ),
    true,
  );
  assert.equal(arcs.length, 2, "visible token plus hollow Coco ring");
  for (const arc of arcs) assert.deepEqual(arc.slice(3), [0, Math.PI * 2]);
});

test("Coco's two paid special pulses travel before contact and can be guarded or missed on either side", () => {
  for (const side of [0, 1] as const)
    for (const mode of [
      "hit",
      "guard",
      "miss",
      "energy",
      "interrupt",
    ] as const) {
      const r = setup(side, mode === "interrupt" ? 70 : 400),
        origin = r.player.x;
      if (mode === "guard") r.inputs[1 - side].block = true;
      if (mode === "energy") r.player.energy = 24;
      if (mode === "interrupt") {
        r.inputs[1 - side].actions.light++;
        r.advance(3);
      }
      r.inputs[side].actions.special++;
      r.advance(1);
      if (mode === "energy" || mode === "interrupt") {
        r.advance(80);
        assert.equal(r.player.hits, 0);
        assert.equal(r.state.projectiles.length, 0);
        continue;
      }
      assert.equal(r.player.energy, 75);
      if (mode === "miss") r.target.x = r.player.x - r.player.facing * 280;
      r.advance(TECHNIQUES.remittance.startup - 1);
      assert.equal(r.state.projectiles.length, 1);
      assert.equal(r.target.hp, 100, "startup does not assign remote damage");
      r.advance(14);
      assert.equal(r.state.projectiles.length, 2);
      assert.equal(new Set(r.state.projectiles.map((s) => s.id)).size, 2);
      assert.ok(
        r.state.projectiles.every(
          (s) =>
            s.kind === "remittance" &&
            Math.sign(s.vx) === (side ? -1 : 1) &&
            s.homing === undefined,
        ),
      );
      r.advance(140);
      assert.equal(r.player.x, origin);
      assert.equal(r.state.finale, undefined);
      assert.equal(r.state.projectiles.length, 0);
      if (mode === "hit") assert.ok(r.target.hp < 100);
      else assert.equal(r.target.hp, 100);
    }
});

test("raised hands and the victory phone do not move or shrink Kevin's painted head and body", () => {
  // Independently measured crown, sole and head centres in the approved native crops.
  const landmarks = {
    network: { crown: 9, sole: 444, headX: 170 },
    celebrate: { crown: 49, sole: 433, headX: 155 },
  };
  for (const [pose, mark] of Object.entries(landmarks)) {
    const frame = attacks.kevin.frames[pose as keyof typeof landmarks],
      scale = 177 / frame.bodyHeight;
    assert.ok(Math.abs((mark.sole - mark.crown) * scale - 177) < 7, pose);
    assert.ok(Math.abs((mark.headX - frame.anchorX) * scale) < 6, pose);
    assert.ok(
      frame.height * scale < 220,
      "the raised phone remains proportionate",
    );
  }
});

test("the Coco finale emits five independent physical transfers, retains live movement and causes no remote damage", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 240);
    r.inputs[side].actions.super++;
    r.advance(1);
    assert.equal(r.player.energy, 10);
    r.advance(8);
    r.target.x = r.player.x - r.player.facing * 300;
    r.inputs[1 - side].actions.jump++;
    const emitted = new Map<number, string>();
    const tick = r.state.tick,
      remaining = r.state.remaining;
    for (let n = 0; n < 220; n++) {
      r.advance(1);
      for (const shot of r.state.projectiles) {
        assert.equal(shot.kind, "remittance");
        assert.equal(shot.finaleArt?.fighter, "kevin");
        assert.equal(shot.homing, undefined);
        emitted.set(shot.id, shot.finaleArt!.pose);
      }
      assert.equal(r.state.finale, undefined);
      assert.equal(r.target.hp, 100);
    }
    assert.deepEqual(
      [...emitted.values()],
      ["token", "receipt", "token", "receipt", "token"],
    );
    assert.ok(r.state.tick > tick && r.state.remaining < remaining);
    assert.equal(r.state.fieldFinales, undefined);
    assert.equal(r.state.projectiles.length, 0);
    assert.equal(r.player.attack, null);
  }
});
