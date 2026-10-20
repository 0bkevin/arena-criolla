import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  REVIEWED_FINALISTS,
  activeArenaPerformance,
  isArenaFinalist,
} from "../shared/arena-finales";
import {
  createMatch,
  emptyInput,
  stepMatch,
  type Input,
} from "../shared/engine";
import { fighterById, type FighterId } from "../shared/content";
import geometry from "../shared/sprite-geometry.json";
import { presentationById } from "../shared/presentation";
import { ATTACK_ART } from "../src/game/attack-art";
import { renderMatch, type Assets } from "../src/game/renderer";
import {
  arenaPerformerPose,
  arenaHelperPose,
  drawArenaPerformer,
  drawArenaFinaleLayer,
} from "../src/game/arena-finale-renderer";
import type { SpriteAsset } from "../src/game/assets";
import courier from "../shared/courier-assets.json";
import { cameraBounds } from "../src/game/arena-camera";
import { WORLD } from "../shared/arena";

type Matrix = [number, number, number, number, number, number];
function recordingCanvas() {
  let matrix: Matrix = [1, 0, 0, 1, 0, 0];
  const stack: { matrix: Matrix; alpha: number }[] = [],
    images: { image: HTMLImageElement; args: number[]; matrix: Matrix }[] = [];
  let shapes = 0;
  const target = {
    canvas: { width: 1200, height: 640 },
    globalAlpha: 1,
    save() {
      stack.push({ matrix: [...matrix], alpha: this.globalAlpha });
    },
    restore() {
      const s = stack.pop();
      assert.ok(s, "balanced canvas saves");
      matrix = s.matrix;
      this.globalAlpha = s.alpha;
    },
    translate(x: number, y: number) {
      matrix[4] += matrix[0] * x + matrix[2] * y;
      matrix[5] += matrix[1] * x + matrix[3] * y;
    },
    scale(x: number, y: number) {
      matrix = [
        matrix[0] * x,
        matrix[1] * x,
        matrix[2] * y,
        matrix[3] * y,
        matrix[4],
        matrix[5],
      ];
    },
    rotate(r: number) {
      const [a, b, c, d, e, f] = matrix,
        cos = Math.cos(r),
        sin = Math.sin(r);
      matrix = [
        a * cos + c * sin,
        b * cos + d * sin,
        c * cos - a * sin,
        d * cos - b * sin,
        e,
        f,
      ];
    },
    getTransform() {
      const [a, b, c, d, e, f] = matrix;
      return { a, b, c, d, e, f };
    },
    drawImage(image: HTMLImageElement, ...args: number[]) {
      images.push({ image, args, matrix: [...matrix] });
    },
    createLinearGradient() {
      return { addColorStop() {} };
    },
    createRadialGradient() {
      return { addColorStop() {} };
    },
    measureText(s: string) {
      return { width: s.length * 8 };
    },
    fill() {
      shapes++;
    },
    stroke() {
      shapes++;
    },
  };
  return {
    ctx: new Proxy(target, {
      get: (t, k) => Reflect.get(t, k) ?? (() => {}),
    }) as unknown as CanvasRenderingContext2D,
    images,
    stack,
    get shapes() {
      return shapes;
    },
  };
}

const bitmap = (width: number, height: number) =>
  ({ width, height, complete: true }) as HTMLImageElement;
function sprite(id: FighterId): SpriteAsset {
  const f = fighterById(id),
    p = presentationById(id),
    sheet = geometry.sprites
      .find((s) => s.id === id)!
      .files.find((s) => s.file === `public/assets/${f.sprite}.webp`)!;
  return {
    image: bitmap(sheet.width, sheet.height),
    cellWidth: sheet.width / 4,
    cellHeight: sheet.height / 2,
    baseline: sheet.components[0].maxY + 1,
    bodyHeight: sheet.components[0].maxY - sheet.components[0].minY,
    portraitCenters: Array(8).fill(sheet.width / 8),
    frames: sheet.components.map((b, i) => ({
      x: b.minX,
      y: b.minY,
      width: b.maxX - b.minX + 1,
      height: b.maxY - b.minY + 1,
      slotX: ((i % 4) * sheet.width) / 4,
      slotY: (Math.floor(i / 4) * sheet.height) / 2,
    })),
    frameFacing: p.frameFacing,
    battleFrame: p.battleFrame,
  };
}

const images: Record<string, HTMLImageElement> = {};
test.before(async () => {
  for (const sheet of Object.values(ATTACK_ART)) {
    const m = await sharp(`public/assets/${sheet.file}.webp`).metadata();
    images[sheet.file] = bitmap(m.width, m.height);
  }
  const m = await sharp(`public/assets/${courier.file}.webp`).metadata();
  images[courier.file] = bitmap(m.width, m.height);
});

test("the reviewed batch contains all 21 painted attack sets and the Yummy couriers", () => {
  assert.equal(REVIEWED_FINALISTS.length, 22);
  assert.deepEqual(
    [...Object.keys(ATTACK_ART), "zavarce"].sort(),
    [...REVIEWED_FINALISTS].sort(),
  );
});

for (const id of REVIEWED_FINALISTS) {
  test(`${id}: production rendering keeps one real defender, stable body scale and bounded props in both directions`, () => {
    for (const side of [0, 1] as const)
      for (const reduced of [false, true]) {
        const a = { name: id, fighter: id, wins: 3 },
          b = { name: "rival", fighter: "capriles" as const, wins: 3 },
          state = createMatch("caracas", side ? [b, a] : [a, b]);
        state.phase = "playing";
        const source = state.players[side],
          rival = state.players[1 - side];
        source.x = side ? 760 : 320;
        rival.x = source.x + (side ? -200 : 200);
        state.players.forEach((p) => {
          p.energy = 100;
          p.invincible = 0;
          p.stocks = 5;
        });
        const own = sprite(id),
          other = sprite("capriles"),
          stage = bitmap(1774, 887),
          assets: Assets = {
            sprites: Object.fromEntries([
              [id, own],
              ["capriles", other],
            ]) as Record<FighterId, SpriteAsset>,
            stages: { caracas: stage },
            courier: images[courier.file],
            finaleProps: images,
          },
          inputs: [Input, Input] = [emptyInput(), emptyInput()];
        inputs[side].actions.super++;
        for (let frame = 0; frame < 170; frame++) {
          stepMatch(state, inputs);
          if (![9, 24, 42, 65, 100, 150].includes(frame)) continue;
          const r = recordingCanvas(),
            before = JSON.stringify(state),
            camera = { x: 540, zoom: 1 },
            bounds = cameraBounds(camera, 1200, 640),
            shakeX =
              !reduced && state.shake > 0.3
                ? Math.sin(((frame * 1000) / 60) * 0.07) * state.shake
                : 0,
            shakeY =
              !reduced && state.shake > 0.3
                ? Math.cos(((frame * 1000) / 60) * 0.08) * state.shake * 0.4
                : 0;
          renderMatch(
            r.ctx,
            state,
            assets,
            (frame * 1000) / 60,
            reduced,
            camera,
          );
          assert.equal(
            JSON.stringify(state),
            before,
            "painting cannot move or rescale physics",
          );
          assert.equal(r.stack.length, 0);
          const defender = r.images.filter((c) => c.image === other.image);
          assert.equal(
            defender.length,
            1,
            "the rival is drawn once, at its live position",
          );
          assert.ok(
            Math.abs(defender[0].matrix[4] - (rival.x - bounds.x + shakeX)) <
              1e-8,
          );
          assert.ok(
            Math.abs(defender[0].matrix[5] - (rival.y - bounds.y + shakeY)) <=
              1.5 + 1e-8,
            "only the ordinary1.5px idle breathing offset may differ",
          );
          for (const call of r.images.filter((c) => c.image !== stage)) {
            assert.ok(call.args.every(Number.isFinite), id);
            const w = call.args.at(-2)!,
              h = call.args.at(-1)!;
            assert.ok(
              w > 0 && w <= 500,
              `${id}: prop width ${w} stays in arena units`,
            );
            assert.ok(
              h > 0 && h <= 270,
              `${id}: height ${h} stays comparable to a177px fighter`,
            );
          }
          const field = activeArenaPerformance(state, source);
          if (field) {
            const pose = arenaPerformerPose(field, 177, reduced);
            if (pose) {
              const crop = ATTACK_ART[id].frames[pose.pose],
                bodies = r.images.filter(
                  (c) =>
                    c.image === images[ATTACK_ART[id].file] &&
                    c.args[0] === crop.x &&
                    c.args[1] === crop.y &&
                    c.args[2] === crop.width &&
                    c.args[3] === crop.height,
                );
              assert.equal(
                bodies.length,
                1,
                "the authored performer replaces, rather than duplicates, its canonical body",
              );
              assert.ok(
                Math.abs(bodies[0].matrix[4] - (source.x - bounds.x + shakeX)) <
                  1e-8,
              );
              assert.ok(
                Math.abs(bodies[0].matrix[5] - (source.y - bounds.y + shakeY)) <
                  1e-8,
              );
            }
          }
        }
      }
  });
}

test("standing bodies share a177px reference; stance bends never enlarge a whole character", () => {
  for (const id of REVIEWED_FINALISTS) {
    const s = sprite(id),
      guard = (s.frames[s.battleFrame].height / s.bodyHeight) * 177;
    assert.ok(guard >= 155 && guard <= 181, `${id}: ready stance ${guard}`);
    assert.ok((s.frames[0].height / s.bodyHeight) * 177 < 181, id);
  }
});

test("missing performer crops decline before painting; missing helper art remains physically visible", () => {
  for (const id of REVIEWED_FINALISTS.filter(isArenaFinalist)) {
    const state = createMatch("caracas", [
      { name: id, fighter: id, wins: 3 },
      { name: "rival", fighter: "capriles", wins: 3 },
    ]);
    state.phase = "playing";
    state.players.forEach((p) => {
      p.energy = 100;
      p.invincible = 0;
    });
    const inputs: [Input, Input] = [emptyInput(), emptyInput()];
    inputs[0].actions.super++;
    for (let n = 0; n < 45; n++) stepMatch(state, inputs);
    const source = state.players[0],
      field = activeArenaPerformance(state, source);
    if (field && arenaPerformerPose(field)) {
      const r = recordingCanvas();
      assert.equal(drawArenaPerformer(r.ctx, {}, state, source, 177), false);
      assert.equal(r.images.length, 0);
    }
    if (state.fieldFinales?.some((f) => f.actors?.length)) {
      const r = recordingCanvas();
      drawArenaFinaleLayer(r.ctx, {}, state, "back");
      drawArenaFinaleLayer(r.ctx, {}, state, "front");
      assert.ok(
        r.shapes > 0,
        `${id}: visible fallback for live helper collision`,
      );
    }
  }
});

test("each of Bolívar's six llaneros has its own crop and stays behind the mounted commander", () => {
  const state = createMatch("caracas", [
    { name: "Bolívar", fighter: "bolivar", wins: 3 },
    { name: "rival", fighter: "capriles", wins: 3 },
  ]);
  state.phase = "playing";
  state.players.forEach((p) => {
    p.energy = 100;
    p.invincible = 0;
  });
  state.players[1].x = 1000;
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  inputs[0].actions.super++;
  for (let n = 0; n < 100; n++) stepMatch(state, inputs);
  const field = state.fieldFinales![0],
    actors = field.actors!;
  assert.equal(actors.length, 6);
  assert.equal(
    new Set(actors.map((a) => arenaHelperPose(field, a)!.pose)).size,
    6,
  );
  const main = state.players[0];
  for (const actor of actors) {
    assert.ok(
      actor.x < main.x,
      "an escort is never spawned inside the commander",
    );
    assert.ok(actor.height <= 220);
  }
});

test("chorus and orchestra stand on the arena floor when their performer casts on an elevated platform", () => {
  for (const id of ["ali", "dudamel"] as const) {
    const state = createMatch("caracas", [
      { name: id, fighter: id, wins: 3 },
      { name: "rival", fighter: "capriles", wins: 3 },
    ]);
    state.phase = "playing";
    state.players.forEach((p) => {
      p.energy = 100;
      p.invincible = 0;
    });
    const source = state.players[0];
    source.x = 230;
    source.y = 392;
    source.grounded = true;
    source.supportPlatform = 0;
    const inputs: [Input, Input] = [emptyInput(), emptyInput()];
    inputs[0].actions.super++;
    for (let n = 0; n < 9; n++) stepMatch(state, inputs);
    assert.ok(source.y < WORLD.floor);
    const r = recordingCanvas();
    drawArenaFinaleLayer(r.ctx, images, state, "back");
    assert.equal(r.images.length, id === "ali" ? 6 : 1);
    for (const call of r.images)
      assert.equal(
        call.matrix[5],
        WORLD.floor,
        "a background ensemble never floats at the caster's old platform height",
      );
  }
});

test("a bow lowers George's head rather than enlarging his crouched full-body crop", () => {
  const state = createMatch("caracas", [
    { name: "George", fighter: "george", wins: 3 },
    { name: "rival", fighter: "capriles", wins: 3 },
  ]);
  state.phase = "playing";
  state.players.forEach((p) => {
    p.energy = 100;
    p.invincible = 0;
  });
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  inputs[0].actions.super++;
  for (let n = 0; n < 9; n++) stepMatch(state, inputs);
  const field = state.fieldFinales![0];
  const upright = arenaPerformerPose(field)!;
  field.tick = 30;
  const bowed = arenaPerformerPose(field)!;
  assert.equal(upright.pose, "present");
  assert.equal(bowed.pose, "bow");
  assert.ok(bowed.height < upright.height * 0.85);
});

test("edge casts preserve world scale and let helpers leave through the edge, in either facing", () => {
  for (const id of REVIEWED_FINALISTS.filter(isArenaFinalist))
    for (const facing of [-1, 1]) {
      const state = createMatch("caracas", [
        { name: id, fighter: id, wins: 3 },
        { name: "rival", fighter: "capriles", wins: 3 },
      ]);
      state.phase = "playing";
      state.players.forEach((p) => {
        p.energy = 100;
        p.invincible = 0;
        p.stocks = 5;
      });
      const p = state.players[0];
      p.x = facing > 0 ? WORLD.left + 35 : WORLD.right - 35;
      p.facing = facing;
      state.players[1].x = p.x + facing * 150;
      const inputs: [Input, Input] = [emptyInput(), emptyInput()];
      inputs[0].actions.super++;
      for (let n = 0; n < 70; n++) stepMatch(state, inputs);
      const r = recordingCanvas();
      drawArenaFinaleLayer(r.ctx, images, state, "back", false);
      drawArenaFinaleLayer(r.ctx, images, state, "front", false);
      assert.equal(r.stack.length, 0);
      for (const call of r.images) {
        assert.ok(call.args.every(Number.isFinite));
        assert.ok(call.args.at(-2)! <= 500);
        assert.ok(call.args.at(-1)! <= 270);
      }
      assert.ok(p.x >= WORLD.left && p.x <= WORLD.right, id);
    }
});
