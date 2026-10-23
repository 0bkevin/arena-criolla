import assert from "node:assert/strict";
import test from "node:test";
import {
  createMatch,
  emptyInput,
  stepMatch,
  type Input,
} from "../shared/engine";
import { ATTACK_ART } from "../src/game/attack-art";
import { drawArenaPerformer } from "../src/game/arena-finale-renderer";
import {
  drawInakiAction,
  drawInakiFormation,
  drawInakiProjectile,
  INAKI_BODY_POSES,
} from "../src/game/finales/inaki";

function canvas() {
  type Matrix = [number, number, number, number, number, number];
  let matrix: Matrix = [1, 0, 0, 1, 0, 0];
  const stack: { matrix: Matrix; alpha: number }[] = [];
  const draws: { pose: string; x: number; y: number; height: number }[] = [];
  let shapes = 0;
  const target = {
    globalAlpha: 0.8,
    save() {
      stack.push({ matrix: [...matrix], alpha: this.globalAlpha });
    },
    restore() {
      const saved = stack.pop();
      assert.ok(saved, "balanced canvas saves");
      matrix = saved.matrix;
      this.globalAlpha = saved.alpha;
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
    rotate(angle: number) {
      const [a, b, c, d, e, f] = matrix,
        co = Math.cos(angle),
        si = Math.sin(angle);
      matrix = [
        a * co + c * si,
        b * co + d * si,
        c * co - a * si,
        d * co - b * si,
        e,
        f,
      ];
    },
    drawImage(
      _image: HTMLImageElement,
      sx: number,
      sy: number,
      _sw: number,
      _sh: number,
      dx: number,
      dy: number,
      width: number,
      height: number,
    ) {
      const pose = Object.entries(ATTACK_ART.inaki.frames).find(
        ([, f]) => f.x === sx && f.y === sy,
      )?.[0];
      assert.ok(pose, "only authored banknote and body crops");
      const x = dx + width / 2,
        y = dy + height / 2;
      draws.push({
        pose,
        x: matrix[0] * x + matrix[2] * y + matrix[4],
        y: matrix[1] * x + matrix[3] * y + matrix[5],
        height,
      });
    },
    fill() {
      shapes++;
    },
    stroke() {
      shapes++;
    },
  };
  const ctx = new Proxy(target, {
    get: (object, key) => Reflect.get(object, key) ?? (() => {}),
  }) as unknown as CanvasRenderingContext2D;
  return {
    ctx,
    draws,
    get shapes() {
      return shapes;
    },
    balanced() {
      assert.equal(stack.length, 0);
      assert.equal(target.globalAlpha, 0.8);
    },
  };
}
const images = {
  [ATTACK_ART.inaki.file]: {
    width: 2048,
    height: 2048,
    complete: true,
  } as HTMLImageElement,
};
function setup(side: 0 | 1) {
  const a = { name: "Iñaki", fighter: "inaki" as const, wins: 0 },
    b = { name: "Rival", fighter: "capriles" as const, wins: 0 };
  const state = createMatch("caracas", side ? [b, a] : [a, b]);
  state.phase = "playing";
  const player = state.players[side];
  player.energy = 100;
  player.invincible = 0;
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  inputs[side].superHeld = true;
  inputs[side].actions.super++;
  return { state, player, inputs };
}

test("charging, firing and recovery paint one normally sized Iñaki on either side, including reduced motion", () => {
  for (const side of [0, 1] as const)
    for (const reduced of [false, true]) {
      const r = setup(side);
      for (let tick = 0; tick < 150; tick++) {
        stepMatch(r.state, r.inputs);
        const c = canvas();
        const preparing = drawInakiAction(
          c.ctx,
          images,
          r.player,
          177,
          reduced,
        );
        const firing = drawArenaPerformer(
          c.ctx,
          images,
          r.state,
          r.player,
          177,
          reduced,
        );
        const bodies = c.draws.filter((d) =>
          (INAKI_BODY_POSES as readonly string[]).includes(d.pose),
        );
        assert.equal(bodies.length, Number(preparing) + Number(firing));
        assert.ok(bodies.length <= 1, `one body at tick ${tick}`);
        for (const body of bodies)
          assert.ok(body.height > 155 && body.height < 185, body.pose);
        c.balanced();
      }
    }
});

test("loose notes gather around a messy paper ball between the hands, mirrored without losing alpha", () => {
  for (const side of [0, 1] as const)
    for (const reduced of [false, true]) {
      const { player } = setup(side);
      player.facing = side ? -1 : 1;
      const early = canvas(),
        halfway = canvas(),
        ready = canvas();
      drawInakiFormation(
        early.ctx,
        images,
        player,
        0.1,
        "charge-cup",
        177,
        reduced,
      );
      drawInakiFormation(
        halfway.ctx,
        images,
        player,
        0.5,
        "charge-cup",
        177,
        reduced,
      );
      drawInakiFormation(
        ready.ctx,
        images,
        player,
        1,
        "charge-cup",
        177,
        reduced,
      );
      assert.ok(early.draws.some((d) => d.pose.startsWith("note-")));
      assert.ok(
        halfway.draws.filter((d) => d.pose.startsWith("note-")).length >
          early.draws.length,
      );
      const orb = ready.draws.find((d) => d.pose === "cash-orb");
      assert.ok(orb);
      assert.ok(Math.abs(orb.x - (player.x + player.facing * 43)) < 1e-8);
      assert.ok(Math.abs(orb.y - (player.y - 99)) < 1e-8);
      assert.ok(
        !ready.draws.some(
          (d) => d.pose === "bundle" || d.pose === "stack-small",
        ),
      );
      const notes = ready.draws.filter((d) => d.pose.startsWith("note-"));
      assert.ok(notes.length >= 8);
      assert.ok(
        Math.max(...notes.map((d) => d.y)) -
          Math.min(...notes.map((d) => d.y)) >
          10,
      );
      early.balanced();
      halfway.balanced();
      ready.balanced();
    }
});

test("a failed optional sheet declines before painting the body, while real projectiles keep a visible fallback", () => {
  const r = setup(0);
  for (let n = 0; n < 80; n++) stepMatch(r.state, r.inputs);
  const c = canvas();
  assert.equal(drawArenaPerformer(c.ctx, {}, r.state, r.player, 177), false);
  assert.equal(c.draws.length, 0);
  const shot = r.state.projectiles[0];
  assert.ok(shot);
  assert.equal(drawInakiProjectile(c.ctx, {}, shot), true);
  assert.ok(c.shapes >= 2, "physical packet stays visible without its image");
  c.balanced();
});

test("the ultimate uses a tumbling cash ball and scattered notes; the special keeps its compact fajo", () => {
  const r = setup(0);
  for (let n = 0; n < 80; n++) stepMatch(r.state, r.inputs);
  const shot = r.state.projectiles[0];
  assert.ok(shot);
  assert.equal(shot.finaleArt?.pose, "cash-orb-release");
  for (const reduced of [false, true]) {
    const c = canvas();
    drawInakiProjectile(c.ctx, images, shot, reduced);
    const orb = c.draws.find((d) => d.pose === "cash-orb-release");
    assert.ok(orb);
    assert.ok(Math.abs(orb.x) < 1e-8 && Math.abs(orb.y) < 1e-8);
    const crop = ATTACK_ART.inaki.frames[orb.pose];
    const visibleHeight =
      (orb.height * (crop.bodyHeight ?? crop.height)) / crop.height;
    assert.ok(Math.abs(visibleHeight - (shot.radius ?? 0) * 2) < 1e-8);
    assert.ok(
      !c.draws.some((d) => d.pose === "bundle" || d.pose === "stack-small"),
    );
    const notes = c.draws.filter((d) => d.pose.startsWith("note-"));
    assert.equal(notes.length, 4);
    assert.ok(
      Math.max(...notes.map((d) => d.y)) - Math.min(...notes.map((d) => d.y)) >
        20,
    );
    c.balanced();
  }
  const special = canvas();
  drawInakiProjectile(special.ctx, images, {
    ...shot,
    impact: "special",
    radius: 15,
  });
  assert.deepEqual(
    special.draws.map((d) => d.pose),
    ["bundle"],
  );
  special.balanced();
});
