import assert from "node:assert/strict";
import test from "node:test";
import { isArenaFinalist } from "../shared/arena-finales";
import {
  BUILT_IN_FIGHTERS,
  STAGES,
  platformsAtTick,
  type FighterId,
  type StageId,
} from "../shared/content";
import {
  WORLD,
  createMatch,
  emptyInput,
  stepMatch,
  type Input,
  type MatchState,
} from "./helpers/charged-finale-engine";
import actorAssets from "../shared/finale-actor-assets.json";
import {
  FINALE_CAPTURE_TICK,
  finaleAsset,
  finaleById,
} from "../shared/finales";
import { advanceArenaCamera, cameraBounds } from "../src/game/arena-camera";
import { drawFinale } from "../src/game/finale-renderer";
import { renderMatch, type Assets } from "../src/game/renderer";
import { drawStage } from "../src/game/stage-renderer";

function setup(
  fighter: FighterId,
  stage: StageId,
  owner: 0 | 1,
  direction: -1 | 1,
) {
  const rival = fighter === "javier" ? "capriles" : "javier";
  const state = createMatch(stage, [
    { name: "Uno", fighter: owner === 0 ? fighter : rival, wins: 3 },
    { name: "Dos", fighter: owner === 1 ? fighter : rival, wins: 3 },
  ]);
  state.phase = "playing";
  for (const p of state.players) {
    p.energy = 100;
    p.invincible = 0;
  }
  state.players[owner].x = direction === 1 ? WORLD.left + 5 : WORLD.right - 5;
  state.players[1 - owner].x = state.players[owner].x + direction * 120;
  state.players[owner].facing = direction;
  state.players[1 - owner].facing = -direction;
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (frames: number) => {
    for (let i = 0; i < frames; i++) stepMatch(state, inputs);
  };
  const start = () => {
    const wasGrounded = state.players[owner].grounded;
    inputs[owner].actions.super++;
    advance(FINALE_CAPTURE_TICK);
    if ((fighter === "dayana" || isArenaFinalist(fighter)) && !wasGrounded) {
      assert.equal(state.fieldFinales, undefined);
      return;
    }
    assert.ok(
      state.finale ||
        state.fieldFinales?.length ||
        state.players[owner].transformation ||
        state.projectiles.some((p) => p.impact === "super"),
    );
  };
  return { state, inputs, advance, start };
}
const positions = (state: MatchState) =>
  state.players.map(({ x, y }) => ({ x, y }));

test("all built-in finales keep both fighters in their arena on either side of both ledges", () => {
  let scenes = 0;
  for (const fighter of BUILT_IN_FIGHTERS)
    for (const stage of STAGES)
      for (const owner of [0, 1] as const)
        for (const direction of [-1, 1] as const) {
          const r = setup(fighter.id, stage.id, owner, direction);
          const original = positions(r.state);
          r.start();
          const scene = r.state.finale!;
          const context = `${fighter.id}/${stage.id}/owner${owner}/direction${direction}`;
          if (finaleById(fighter.id)!.mode === "field") {
            assert.equal(scene, undefined, context);
            assert.equal(r.state.fieldFinales?.length, 1, context);
            const tick = r.state.tick;
            r.advance(400);
            assert.ok(r.state.tick > tick, context);
            assert.equal(r.state.stage, stage.id, context);
            assert.equal(r.state.fieldFinales, undefined, context);
            scenes++;
            continue;
          }
          if (finaleById(fighter.id)!.mode === "projectile") {
            assert.equal(scene, undefined, context);
            assert.equal(r.state.projectiles.length, 1, context);
            assert.deepEqual(positions(r.state), original, context);
            r.advance(20);
            assert.equal(r.state.stage, stage.id, context);
            assert.equal(r.state.players[owner].hits, 1, context);
            scenes++;
            continue;
          }
          if (finaleById(fighter.id)!.mode === "transformation") {
            assert.equal(scene, undefined, context);
            assert.equal(
              r.state.players[owner].transformation?.ticks,
              360,
              context,
            );
            assert.deepEqual(positions(r.state), original, context);
            const tick = r.state.tick;
            r.advance(360);
            assert.equal(
              r.state.players[owner].transformation,
              undefined,
              context,
            );
            assert.equal(r.state.tick, tick + 360, context);
            assert.equal(r.state.stage, stage.id, context);
            assert.equal(r.state.players[1 - owner].hp, 100, context);
            scenes++;
            continue;
          }
          assert.deepEqual(
            positions(r.state),
            original,
            context + ": capture must not relocate bodies",
          );
          assert.equal(scene.x, (original[0].x + original[1].x) / 2, context);
          assert.equal(
            scene.y,
            Math.min(original[0].y, original[1].y),
            context,
          );
          assert.equal(scene.direction, direction, context);
          const captureTick = r.state.tick,
            remaining = r.state.remaining;
          for (let frame = 0; frame < scene.duration; frame++) {
            r.advance(1);
            assert.equal(r.state.stage, stage.id, context);
            assert.deepEqual(
              positions(r.state),
              original,
              context + ": scene and release retain world coordinates",
            );
            assert.equal(r.state.tick, captureTick, context);
            assert.equal(r.state.remaining, remaining, context);
          }
          assert.equal(r.state.finale, undefined);
          assert.equal(
            Math.sign(r.state.players[1 - owner].vx),
            finaleById(fighter.id)?.release?.force === 0 ? 0 : direction,
            context + ": normal world knockback follows the attacker",
          );
          scenes++;
        }
  assert.equal(scenes, BUILT_IN_FIGHTERS.length * STAGES.length * 4);
});

test("a finale uses the unchanged normal camera on desktop, mobile and reduced-motion views", () => {
  for (const fighter of BUILT_IN_FIGHTERS)
    for (const owner of [0, 1] as const)
      for (const direction of [-1, 1] as const)
        for (const [width, height] of [
          [1440, 800],
          [844, 390],
          [390, 844],
        ])
          for (const reducedMotion of [false, true]) {
            const r = setup(fighter.id, "merida", owner, direction);
            r.start();
            const ordinary: MatchState = { ...r.state, finale: undefined };
            let camera = advanceArenaCamera(
              undefined,
              ordinary,
              width,
              height,
              16,
              reducedMotion,
            );
            let ordinaryCamera = camera;
            for (const elapsed of [0, 16, 33, 100]) {
              camera = advanceArenaCamera(
                camera,
                r.state,
                width,
                height,
                elapsed,
                reducedMotion,
              );
              ordinaryCamera = advanceArenaCamera(
                ordinaryCamera,
                ordinary,
                width,
                height,
                elapsed,
                reducedMotion,
              );
              assert.deepEqual(
                camera,
                ordinaryCamera,
                `${fighter.id}: cinematic must not introduce a separate framing mode`,
              );
              assert.deepEqual(
                cameraBounds(camera, width, height),
                cameraBounds(ordinaryCamera, width, height),
              );
            }
          }
});

test("moving platforms keep their exact captured phase and resume carrying the attacker after every mirrored finale", () => {
  let mechanisms = 0;
  for (const stage of STAGES)
    for (const [index, definition] of stage.platforms.entries()) {
      if (!definition.motion) continue;
      mechanisms++;
      for (const fighter of ["capriles", "nacho", "giuseppe"] as const)
        for (const owner of [0, 1] as const)
          for (const direction of [-1, 1] as const)
            for (const fraction of [0, 0.25, 0.5, 0.75]) {
              const r = setup(fighter, stage.id, owner, direction);
              r.state.tick = Math.round(definition.motion.period * fraction);
              const before = platformsAtTick(stage.id, r.state.tick)[index];
              r.state.players[owner].x =
                before.x + (direction === 1 ? 20 : before.width - 20);
              r.state.players[1 - owner].x =
                before.x + (direction === 1 ? before.width - 20 : 20);
              for (const p of r.state.players) {
                p.y = before.y;
                p.supportPlatform = index;
              }
              r.start();
              const original = positions(r.state),
                tick = r.state.tick;
              const captured = platformsAtTick(stage.id, tick)[index];
              assert.equal(
                r.state.finale!.x,
                (original[0].x + original[1].x) / 2,
              );
              assert.equal(r.state.finale!.y, captured.y);
              r.advance(r.state.finale!.duration);
              assert.deepEqual(positions(r.state), original);
              assert.equal(r.state.tick, tick);
              assert.deepEqual(
                platformsAtTick(stage.id, r.state.tick)[index],
                captured,
              );
              r.advance(1);
              const next = platformsAtTick(stage.id, tick + 1)[index];
              const attacker = r.state.players[owner];
              assert.equal(attacker.supportPlatform, index);
              assert.equal(attacker.y, next.y);
              assert.ok(
                Math.abs(
                  attacker.x - original[owner].x - (next.x - captured.x),
                ) < 1e-8,
              );
            }
    }
  assert.equal(mechanisms, 5);
});

test("airborne and unequal-height captures preserve each fighter's own position instead of moving them to a common scene baseline", () => {
  for (const fighter of BUILT_IN_FIGHTERS)
    for (const owner of [0, 1] as const)
      for (const direction of [-1, 1] as const) {
        const r = setup(fighter.id, "guaira", owner, direction);
        r.state.players[owner].x =
          direction === 1 ? WORLD.x - 80 : WORLD.x + WORLD.width + 80;
        r.state.players[1 - owner].x =
          r.state.players[owner].x + direction * 120;
        r.state.players.forEach((p, index) => {
          p.y = index === owner ? 270 : 220;
          p.vy = index === owner ? -3 : 0;
          p.grounded = false;
          p.supportPlatform = null;
        });
        r.start();
        const original = positions(r.state);
        assert.notEqual(original[0].y, original[1].y);
        if (finaleById(fighter.id)!.mode === "field") {
          assert.equal(r.state.finale, undefined);
          if (fighter.id === "dayana" || isArenaFinalist(fighter.id)) {
            assert.equal(r.state.fieldFinales, undefined);
            assert.equal(r.state.players[owner].energy, 100);
          } else assert.equal(r.state.fieldFinales?.[0]?.fighter, "deyna");
          const y = r.state.players[owner].y;
          r.advance(1);
          assert.notEqual(r.state.players[owner].y, y);
          assert.equal(r.state.stage, "guaira");
          continue;
        }
        if (finaleById(fighter.id)!.mode === "projectile") {
          assert.equal(r.state.finale, undefined);
          const y = r.state.players[owner].y;
          r.advance(1);
          assert.notEqual(
            r.state.players[owner].y,
            y,
            "airborne physics continue during ranged finale",
          );
          assert.equal(r.state.stage, "guaira");
          continue;
        }
        if (finaleById(fighter.id)!.mode === "transformation") {
          assert.equal(r.state.finale, undefined);
          assert.equal(r.state.players[owner].transformation?.ticks, 360);
          const y = r.state.players[owner].y;
          r.advance(1);
          assert.notEqual(
            r.state.players[owner].y,
            y,
            "airborne physics continue during transformation",
          );
          assert.equal(r.state.stage, "guaira");
          continue;
        }
        assert.equal(r.state.finale!.y, Math.min(original[0].y, original[1].y));
        assert.equal(r.state.finale!.direction, direction);
        r.advance(r.state.finale!.duration);
        assert.deepEqual(positions(r.state), original);
        assert.equal(r.state.stage, "guaira");
        assert.ok(r.state.players.every((p) => p.stocks === 2));
      }
});

type Matrix = [number, number, number, number, number, number];
function recordingContext(width: number, height: number) {
  let matrix: Matrix = [1, 0, 0, 1, 0, 0];
  const stack: Matrix[] = [];
  const images: { image: unknown; arguments: number[]; matrix: Matrix }[] = [];
  const labels: { value: string; matrix: Matrix }[] = [];
  const rectangles: { x: number; y: number; width: number; height: number }[] =
    [];
  const properties: Record<string | symbol, unknown> = {
    canvas: { width, height },
    globalAlpha: 1,
    save() {
      stack.push([...matrix]);
    },
    restore() {
      matrix = stack.pop()!;
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
    translate(x: number, y: number) {
      matrix[4] += matrix[0] * x + matrix[2] * y;
      matrix[5] += matrix[1] * x + matrix[3] * y;
    },
    drawImage(image: unknown, ...args: number[]) {
      images.push({ image, arguments: args, matrix: [...matrix] });
    },
    fillText(value: string) {
      labels.push({ value, matrix: [...matrix] });
    },
    fillRect(x: number, y: number, w: number, h: number) {
      rectangles.push({ x, y, width: w, height: h });
    },
    createLinearGradient() {
      return { addColorStop() {} };
    },
    createRadialGradient() {
      return { addColorStop() {} };
    },
  };
  const context = new Proxy(properties, {
    get(target, key) {
      return target[key] ?? (() => {});
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { context, images, labels, rectangles };
}

test("vehicle finales keep both painted passengers beside their capture positions throughout the ride", () => {
  for (const fighter of ["carlos", "juan"] as const)
    for (const owner of [0, 1] as const)
      for (const direction of [-1, 1] as const) {
        const r = setup(fighter, "caracas", owner, direction);
        r.state.players[owner].x = direction === 1 ? 435 : 625;
        r.state.players[1 - owner].x = direction === 1 ? 625 : 435;
        r.start();
        const passengers = [
          actorAssets.seated[fighter],
          actorAssets.seated.javier,
        ];
        const props = Object.fromEntries(
          [
            ...passengers.map((asset) => asset.file),
            finaleAsset(fighter)!.file,
          ].map((file) => [
            file,
            { width: 2048, height: 1024 } as HTMLImageElement,
          ]),
        );
        for (let tick = 0; tick < r.state.finale!.duration; tick++) {
          r.state.finale!.tick = tick;
          const actual = recordingContext(1080, 640);
          drawFinale(actual.context, r.state, {}, props);
          for (const [index, passenger] of passengers.entries()) {
            const calls = actual.images.filter(
              (call) =>
                call.image === props[passenger.file] &&
                call.arguments[0] === passenger.frame.x &&
                call.arguments[1] === passenger.frame.y,
            );
            assert.equal(calls.length, 1);
            const player = r.state.players[index === 0 ? owner : 1 - owner];
            assert.ok(
              Math.abs(calls[0].matrix[4] - player.x) < 24,
              `${fighter}/owner${owner}/direction${direction}/tick${tick}: the passenger rode out of the captured fight`,
            );
          }
          for (const label of actual.labels.filter(({ value }) =>
            value.endsWith(" VIDA"),
          ))
            assert.ok(
              Math.abs(label.matrix[4] - r.state.players[1 - owner].x) < 24,
              `${fighter}/tick${tick}: damage label must follow the captured rival`,
            );
        }
      }
});

test("renderMatch draws every finale over its selected stage and platform surfaces using the normal world camera", () => {
  for (const fighter of BUILT_IN_FIGHTERS)
    for (const stage of STAGES)
      for (const direction of [-1, 1] as const) {
        const r = setup(fighter.id, stage.id, 0, direction);
        r.start();
        if (r.state.finale)
          r.state.finale.tick = finaleById(fighter.id)!.damageBeats[0];
        const width = 1440,
          height = 800;
        const camera = advanceArenaCamera(undefined, r.state, width, height);
        const bounds = cameraBounds(camera, width, height);
        const background = {
          naturalWidth: 1080,
          naturalHeight: 640,
        } as HTMLImageElement;
        const assets = {
          sprites: r.state.finale
            ? {}
            : Object.fromEntries(
                r.state.players.map((player) => [
                  player.config.fighter,
                  {
                    image: { width: 2048, height: 1024 },
                    cellWidth: 512,
                    cellHeight: 512,
                    baseline: 482,
                    bodyHeight: 300,
                    battleFrame: 1,
                    portraitCenters: Array(8).fill(256),
                    frameFacing: Array(8).fill(1),
                    frames: Array.from({ length: 8 }, (_, frame) => ({
                      x: (frame % 4) * 512,
                      y: Math.floor(frame / 4) * 512,
                      width: 200,
                      height: 300,
                      slotX: (frame % 4) * 512,
                    })),
                  },
                ]),
              ),
          stages: { [stage.id]: background },
          finaleProps: {},
        } as Assets;
        const actual = recordingContext(width, height);
        renderMatch(actual.context, r.state, assets, 0, true, camera);
        const expected = recordingContext(width, height);
        expected.context.scale(camera.zoom, camera.zoom);
        expected.context.translate(-bounds.x, -bounds.y);
        drawStage(expected.context, stage, background, r.state.tick, bounds);
        const stageCalls = actual.images.filter(
          (call) => call.image === background,
        );
        assert.ok(
          stageCalls.length > 0,
          `${fighter.id}/${stage.id}: selected scenery disappeared during the final attack`,
        );
        assert.deepEqual(
          stageCalls,
          expected.images,
          `${fighter.id}/${stage.id}: scenery moved to a different camera or scene`,
        );
        for (const surface of platformsAtTick(stage.id, r.state.tick)) {
          assert.ok(
            actual.rectangles.some(
              (rect) =>
                rect.height === 4 &&
                rect.width === surface.width &&
                Math.abs(rect.x - surface.x) <= 1 &&
                Math.abs(rect.y - surface.y) <= 1,
            ),
            `${fighter.id}/${stage.id}: platform surface disappeared`,
          );
        }
      }
});
