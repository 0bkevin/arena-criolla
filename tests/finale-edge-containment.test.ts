import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { createMatch, emptyInput, stepMatch, WORLD } from "../shared/engine";
import { FINALE_CAPTURE_TICK } from "../shared/finales";
import { fighterById } from "../shared/content";
import { presentationById } from "../shared/presentation";
import spriteManifest from "../shared/sprite-geometry.json";
import type { SpriteAsset } from "../src/game/assets";
import { ATTACK_ART, type AttackArtFrame } from "../src/game/attack-art";
import { advanceArenaCamera, cameraBounds } from "../src/game/arena-camera";
import { drawFinale } from "../src/game/finale-renderer";

type Fighter = "renny" | "vallenilla";
type Matrix = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
};
type Point = { x: number; y: number };
type Draw = {
  pose: string;
  frame: AttackArtFrame;
  matrix: Matrix;
  alpha: number;
  destination: { x: number; y: number; width: number; height: number };
  bounds: { left: number; top: number; right: number; bottom: number };
};
const width = 1440,
  height = 800;
const close = (actual: number, expected: number, message: string) =>
  assert.ok(
    Math.abs(actual - expected) < 1e-7,
    `${message}: ${actual} != ${expected}`,
  );
const project = (m: Matrix, x: number, y: number): Point => ({
  x: m.a * x + m.c * y + m.e,
  y: m.b * x + m.d * y + m.f,
});

async function loadedRival(): Promise<SpriteAsset> {
  const file = `public/assets/${fighterById("javier").sprite}.webp`;
  const checked = spriteManifest.sprites
    .find((entry) => entry.id === "javier")!
    .files.find((entry) => entry.file === file)!;
  const metadata = await sharp(file).metadata();
  assert.equal(metadata.width, checked.width);
  assert.equal(metadata.height, checked.height);
  const cellWidth = checked.width / 4,
    cellHeight = checked.height / 2;
  return {
    image: { width: checked.width, height: checked.height } as HTMLImageElement,
    cellWidth,
    cellHeight,
    baseline: checked.components[0].maxY + 1,
    bodyHeight: checked.components[0].maxY - checked.components[0].minY,
    frames: checked.components.map((frame, index) => ({
      x: frame.minX,
      y: frame.minY,
      width: frame.maxX - frame.minX + 1,
      height: frame.maxY - frame.minY + 1,
      slotX: (index % 4) * cellWidth,
      slotY: Math.floor(index / 4) * cellHeight,
    })),
    portraitCenters: [],
    frameFacing: presentationById("javier").frameFacing,
    battleFrame: presentationById("javier").battleFrame,
  };
}
const rivalSprite = loadedRival();

async function loadedSheet(fighter: Fighter) {
  const sheet = ATTACK_ART[fighter];
  const { data, info } = await sharp(`public/assets/${sheet.file}.webp`)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    sheet,
    data,
    width: info.width,
    rival: await rivalSprite,
    image: { width: info.width, height: info.height } as HTMLImageElement,
  };
}
type LoadedSheet = Awaited<ReturnType<typeof loadedSheet>>;
const sheets = Promise.all([loadedSheet("renny"), loadedSheet("vallenilla")]);

function recordingContext(loaded: LoadedSheet, dpr: number) {
  let matrix: Matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const stack: { matrix: Matrix; alpha: number }[] = [];
  const draws: Draw[] = [];
  const order: (
    { kind: "art"; pose: string } | { kind: "rival"; frame: number }
  )[] = [];
  const properties: Record<string | symbol, unknown> = {
    canvas: { width: width * dpr, height: height * dpr },
    globalAlpha: 1,
    getTransform: () => ({ ...matrix }),
    save() {
      stack.push({
        matrix: { ...matrix },
        alpha: Number(properties.globalAlpha),
      });
    },
    restore() {
      const saved = stack.pop();
      assert.ok(saved, "every restore has a matching save");
      matrix = saved.matrix;
      properties.globalAlpha = saved.alpha;
    },
    scale(x: number, y: number) {
      matrix.a *= x;
      matrix.b *= x;
      matrix.c *= y;
      matrix.d *= y;
    },
    translate(x: number, y: number) {
      matrix.e += matrix.a * x + matrix.c * y;
      matrix.f += matrix.b * x + matrix.d * y;
    },
    drawImage(image: unknown, ...args: number[]) {
      assert.equal(args.length, 8, "art uses an explicit complete source crop");
      const [sx, sy, sw, sh, x, y, dw, dh] = args;
      if (image === loaded.rival.image) {
        const frame = loaded.rival.frames.findIndex(
          (frame) =>
            frame.x === sx &&
            frame.y === sy &&
            frame.width === sw &&
            frame.height === sh,
        );
        assert.ok(
          frame >= 0,
          "the rival uses a complete canonical sprite frame",
        );
        order.push({ kind: "rival", frame });
        return;
      }
      assert.equal(
        image,
        loaded.image,
        "the revised scene uses its loaded runtime sheet",
      );
      const entry = Object.entries(loaded.sheet.frames).find(
        ([, frame]) =>
          frame.x === sx &&
          frame.y === sy &&
          frame.width === sw &&
          frame.height === sh,
      );
      assert.ok(entry, "every crop matches a published pose");
      order.push({ kind: "art", pose: entry[0] });
      assert.ok(
        sx >= 0 &&
          sy >= 0 &&
          sx + sw <= loaded.image.width &&
          sy + sh <= loaded.image.height,
      );
      const corners = [
        project(matrix, x, y),
        project(matrix, x + dw, y),
        project(matrix, x, y + dh),
        project(matrix, x + dw, y + dh),
      ];
      draws.push({
        pose: entry[0],
        frame: entry[1],
        matrix: { ...matrix },
        alpha: Number(properties.globalAlpha),
        destination: { x, y, width: dw, height: dh },
        bounds: {
          left: Math.min(...corners.map((p) => p.x)),
          top: Math.min(...corners.map((p) => p.y)),
          right: Math.max(...corners.map((p) => p.x)),
          bottom: Math.max(...corners.map((p) => p.y)),
        },
      });
    },
  };
  const ctx = new Proxy(properties, {
    get: (target, key) => target[key] ?? (() => {}),
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, draws, order, stack, matrix: () => ({ ...matrix }) };
}

function capture(fighter: Fighter, direction: -1 | 1, reducedMotion: boolean) {
  const owner = direction === 1 ? 0 : 1;
  const state = createMatch("poliedro", [
    { name: "Uno", fighter: owner === 0 ? fighter : "javier", wins: 3 },
    { name: "Dos", fighter: owner === 1 ? fighter : "javier", wins: 3 },
  ]);
  state.phase = "playing";
  const actor = state.players[owner],
    rival = state.players[1 - owner];
  actor.x = direction === 1 ? 925 : 155;
  rival.x = direction === 1 ? 1045 : 35;
  actor.facing = direction;
  rival.facing = -direction;
  for (const player of state.players) {
    player.y = WORLD.floor;
    player.vx = player.vy = player.invincible = 0;
    player.energy = 100;
    player.grounded = true;
  }
  const inputs = [emptyInput(), emptyInput()] as const;
  inputs[owner].actions.super++;
  for (let tick = 0; tick < FINALE_CAPTURE_TICK; tick++)
    stepMatch(state, [...inputs]);
  assert.ok(
    state.finale,
    "an actual definitive input captures the ledge rival",
  );
  assert.equal(state.finale.direction, direction);
  const camera = advanceArenaCamera(
    undefined,
    state,
    width,
    height,
    16,
    reducedMotion,
  );
  assert.deepEqual(
    camera,
    advanceArenaCamera(
      undefined,
      { ...state, finale: undefined },
      width,
      height,
      16,
      reducedMotion,
    ),
  );
  return { state, actor, camera, bounds: cameraBounds(camera, width, height) };
}

function render(
  run: ReturnType<typeof capture>,
  loaded: LoadedSheet,
  dpr: number,
  reducedMotion: boolean,
) {
  const recorded = recordingContext(loaded, dpr);
  recorded.ctx.scale(dpr, dpr);
  recorded.ctx.scale(run.camera.zoom, run.camera.zoom);
  recorded.ctx.translate(-run.bounds.x, -run.bounds.y);
  const cameraTransform = recorded.matrix();
  drawFinale(
    recorded.ctx,
    run.state,
    { javier: loaded.rival },
    { [loaded.sheet.file]: loaded.image },
    reducedMotion,
  );
  assert.deepEqual(
    recorded.matrix(),
    cameraTransform,
    "the scene restores the original camera transform",
  );
  assert.equal(recorded.ctx.globalAlpha, 1);
  assert.equal(recorded.stack.length, 0);
  return recorded;
}

test("loaded Renny and Cashea finale crops remain complete at both ledges without changing body scale, camera or world positions", async () => {
  const loaded = await sheets;
  const rennyHeights: Record<string, number> = {
    ladder: 318,
    present: 388,
    kick: 392,
    push: 370,
  };
  for (const [index, fighter] of (["renny", "vallenilla"] as const).entries())
    for (const direction of [-1, 1] as const)
      for (const reducedMotion of [false, true])
        for (const dpr of [1, 2]) {
          const run = capture(fighter, direction, reducedMotion);
          const positions = run.state.players.map(({ x, y }) => ({ x, y }));
          const clock = {
            tick: run.state.tick,
            remaining: run.state.remaining,
          };
          const camera = { ...run.camera };
          for (let tick = 0; tick < run.state.finale!.duration; tick++) {
            run.state.finale!.tick = tick;
            const label = `${fighter}/direction${direction}/reduced${reducedMotion}/dpr${dpr}/tick${tick}`;
            const { draws } = render(run, loaded[index], dpr, reducedMotion);
            assert.equal(
              draws.length,
              3,
              `${label}: presenter plus exactly two helpers use loaded art`,
            );
            const helperHeights: number[] = [];
            for (const draw of draws) {
              const b = draw.bounds;
              assert.ok(
                b.left >= -1e-7 &&
                  b.right <= width * dpr + 1e-7 &&
                  b.top >= -1e-7 &&
                  b.bottom <= height * dpr + 1e-7,
                `${label}/${draw.pose}: complete projected crop ${JSON.stringify(b)} fits the backing canvas`,
              );
              const bodyHeight =
                (draw.destination.height *
                  (draw.frame.bodyHeight ?? draw.frame.height)) /
                draw.frame.height;
              if (fighter === "renny")
                close(
                  bodyHeight,
                  rennyHeights[draw.pose],
                  `${label}: unchanged ${draw.pose} body height`,
                );
              else if (draw.pose === "summon")
                close(bodyHeight, 292, `${label}: unchanged Pedro body height`);
              else helperHeights.push(bodyHeight);
              close(
                b.right - b.left,
                draw.destination.width * run.camera.zoom * (177 / 300) * dpr,
                `${label}: clamping preserves drawn width`,
              );
            }
            if (fighter === "vallenilla") {
              helperHeights.sort((a, b) => a - b);
              close(
                helperHeights[0],
                236,
                `${label}: first mascot keeps its scale`,
              );
              close(
                helperHeights[1],
                260,
                `${label}: second mascot keeps its scale`,
              );
            }
            const presenter = draws.find(
              (draw) =>
                draw.pose === (fighter === "renny" ? "ladder" : "summon"),
            )!;
            close(
              presenter.matrix.e,
              (run.actor.x - run.bounds.x) * run.camera.zoom * dpr,
              `${label}: presenter retains captured x`,
            );
            close(
              presenter.matrix.f,
              (run.actor.y - run.bounds.y) * run.camera.zoom * dpr,
              `${label}: presenter retains captured feet`,
            );
          }
          assert.deepEqual(
            run.state.players.map(({ x, y }) => ({ x, y })),
            positions,
          );
          assert.deepEqual(
            { tick: run.state.tick, remaining: run.state.remaining },
            clock,
          );
          assert.deepEqual(run.camera, camera);
        }
});

function sourcePoint(draw: Draw, x: number, y: number) {
  const d = draw.destination;
  return project(
    draw.matrix,
    d.x + ((x + 0.5) * d.width) / draw.frame.width,
    d.y + ((y + 0.5) * d.height) / draw.frame.height,
  );
}

function alphaAt(loaded: LoadedSheet, draw: Draw, point: Point) {
  const m = draw.matrix,
    determinant = m.a * m.d - m.b * m.c;
  const x = (m.d * (point.x - m.e) - m.c * (point.y - m.f)) / determinant;
  const y = (-m.b * (point.x - m.e) + m.a * (point.y - m.f)) / determinant;
  const d = draw.destination;
  const sx = Math.floor(((x - d.x) * draw.frame.width) / d.width);
  const sy = Math.floor(((y - d.y) * draw.frame.height) / d.height);
  if (sx < 0 || sx >= draw.frame.width || sy < 0 || sy >= draw.frame.height)
    return 0;
  return (
    loaded.data[
      ((draw.frame.y + sy) * loaded.width + draw.frame.x + sx) * 4 + 3
    ] * draw.alpha
  );
}

test("Renny's inward ledge choreography preserves recognizable helper faces and paints the presenter in front", async () => {
  const [loaded] = await sheets;
  // Face regions inspected in the published runtime crops. A majority stays
  // visible while arms and feathers can overlap; exact pixels need not match.
  const faces: Record<string, readonly [number, number, number, number]> = {
    ladder: [220, 80, 22, 30],
    present: [120, 120, 25, 35],
    kick: [145, 120, 24, 35],
    push: [278, 124, 25, 35],
  };
  for (const direction of [-1, 1] as const)
    for (const reducedMotion of [false, true]) {
      const run = capture("renny", direction, reducedMotion);
      for (const tick of [18, 42, 90, 138]) {
        run.state.finale!.tick = tick;
        const { draws } = render(run, loaded, 1, reducedMotion);
        const helpers = draws.filter((draw) => draw.pose !== "ladder");
        const label = `direction${direction}/reduced${reducedMotion}/tick${tick}`;
        assert.equal(helpers.length, 2);
        assert.ok(
          helpers.every((draw) => Math.sign(draw.matrix.a) === direction),
          `${label}: both helpers approach from the arena interior`,
        );
        assert.equal(
          draws.at(-1)!.pose,
          "ladder",
          `${label}: the foreground presenter cannot be hidden by a later dancer`,
        );
        const faceLanes = helpers
          .map((draw) => {
            const [left, top, width, height] = faces[draw.pose];
            const a = sourcePoint(draw, left, top);
            const b = sourcePoint(draw, left + width - 1, top + height - 1);
            return { left: Math.min(a.x, b.x), right: Math.max(a.x, b.x) };
          })
          .sort((a, b) => a.left - b.left);
        assert.ok(
          faceLanes[0].right < faceLanes[1].left,
          `${label}: the two inspected helper face regions occupy separate lanes`,
        );
        for (const draw of draws) {
          const [left, top, width, height] = faces[draw.pose];
          let opaque = 0,
            exposed = 0;
          for (let y = top; y < top + height; y++)
            for (let x = left; x < left + width; x++) {
              const face = sourcePoint(draw, x, y);
              if (alphaAt(loaded, draw, face) < 200) continue;
              opaque++;
              const foreground = [...draws]
                .reverse()
                .find((candidate) => alphaAt(loaded, candidate, face) >= 40);
              if (foreground === draw) exposed++;
            }
          assert.ok(
            opaque > 0,
            `${label}/${draw.pose}: the face region contains opaque art`,
          );
          assert.ok(
            exposed * 2 >= opaque,
            `${label}/${draw.pose}: a majority of the inspected face remains visible (${exposed}/${opaque} pixels)`,
          );
        }
      }
    }
});

test("Cashea impact scenes paint the canonical rival after both mascots so close edge captures preserve the defender", async () => {
  const [, loaded] = await sheets;
  for (const direction of [-1, 1] as const)
    for (const reducedMotion of [false, true]) {
      const run = capture("vallenilla", direction, reducedMotion);
      for (const tick of [34, 44, 62, 80, 98, 116, 134]) {
        run.state.finale!.tick = tick;
        const { order } = render(run, loaded, 1, reducedMotion);
        const rival = order.findIndex((draw) => draw.kind === "rival");
        const helpers = order.flatMap((draw, index) =>
          draw.kind === "art" && draw.pose !== "summon" ? [index] : [],
        );
        const label = `direction${direction}/reduced${reducedMotion}/tick${tick}`;
        assert.equal(helpers.length, 2);
        assert.ok(
          helpers.every((index) => index < rival),
          `${label}: both helpers paint behind the rival`,
        );
        assert.deepEqual(
          order[rival],
          { kind: "rival", frame: tick === 34 ? loaded.rival.battleFrame : 7 },
          `${label}: impacts use the rival's canonical hurt frame`,
        );
      }
    }
});
