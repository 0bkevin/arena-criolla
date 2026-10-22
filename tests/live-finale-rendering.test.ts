import test from "node:test";
import assert from "node:assert/strict";
import {
  createMatch,
  emptyInput,
  stepMatch,
  type Input,
} from "./helpers/charged-finale-engine";
import {
  REVIEWED_FINALISTS,
  activeArenaPerformance,
  isArenaFinalist,
} from "../shared/arena-finales";
import {
  arenaPerformerPose,
  drawArenaPerformer,
  drawArenaFinaleLayer,
} from "../src/game/arena-finale-renderer";

type Matrix = [number, number, number, number, number, number];
function recordingCanvas() {
  let matrix: Matrix = [1, 0, 0, 1, 0, 0];
  const stack: { matrix: Matrix; alpha: number }[] = [];
  const images: HTMLImageElement[] = [];
  let shapes = 0;
  const target = {
    canvas: { width: 1200, height: 640 },
    globalAlpha: 1,
    save() { stack.push({ matrix: [...matrix], alpha: this.globalAlpha }); },
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
      matrix = [matrix[0] * x, matrix[1] * x, matrix[2] * y, matrix[3] * y, matrix[4], matrix[5]];
    },
    rotate(angle: number) {
      const [a, b, c, d, e, f] = matrix;
      const cos = Math.cos(angle), sin = Math.sin(angle);
      matrix = [a * cos + c * sin, b * cos + d * sin, c * cos - a * sin, d * cos - b * sin, e, f];
    },
    getTransform() {
      const [a, b, c, d, e, f] = matrix;
      return { a, b, c, d, e, f };
    },
    drawImage(image: HTMLImageElement) { images.push(image); },
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
    measureText(value: string) { return { width: value.length * 8 }; },
    fill() { shapes++; },
    stroke() { shapes++; },
  };
  return {
    ctx: new Proxy(target, {
      get: (object, key) => Reflect.get(object, key) ?? (() => {}),
    }) as unknown as CanvasRenderingContext2D,
    images,
    get shapes() { return shapes; },
  };
}

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
