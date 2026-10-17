import { FIGHTERS, type FighterId } from "../shared/content";
import { CHOREOGRAPHIES, sampleGesture } from "../shared/choreography";
import {
  INTRO_PLAYER_TICKS,
  presentationById,
  samplePose,
} from "../shared/presentation";
import { createMatch } from "../shared/engine";
import { drawSprite, loadSprite } from "../src/game/assets";
import { deformRigPoint, drawArticulatedSprite } from "../src/game/gesture-rig";
import { drawIntroCinematic, introCamera } from "../src/game/intro-renderer";
import { drawPresentation } from "../src/game/presentation-renderer";
import { drawEntranceAction } from "../src/game/entrance-renderer";

function canvas(width: number, height: number) {
  const node = document.createElement("canvas");
  node.width = width;
  node.height = height;
  return node;
}
function equalPixels(a: Uint8ClampedArray, b: Uint8ClampedArray) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
export async function auditEntrances(ids: FighterId[]) {
  const sprites = Object.fromEntries(
    await Promise.all(ids.map(async (id) => [id, await loadSprite(id)])),
  );
  const node = canvas(1080, 640),
    ctx = node.getContext("2d")!;
  const a = canvas(400, 500),
    b = canvas(400, 500);
  const ca = a.getContext("2d", { willReadFrequently: true })!,
    cb = b.getContext("2d", { willReadFrequently: true })!;
  let renders = 0,
    cameras = 0;
  const timings: number[] = [],
    entries = [],
    errors: string[] = [];
  for (const id of ids) {
    const sprite = sprites[id],
      profile = presentationById(id),
      rig = CHOREOGRAPHIES[id];
    const state = createMatch("caracas", [
      { name: id, fighter: id, wins: 0 },
      { name: id, fighter: id, wins: 0 },
    ]);
    const bounds = {
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity,
    };
    for (const side of [0, 1] as const)
      for (const reduced of [false, true])
        for (const tick of [0, 20, 50, 75, 102, 129, 151, 168, 179]) {
          state.tick = side * INTRO_PLAYER_TICKS + tick;
          const start = performance.now();
          drawIntroCinematic(ctx, state, sprites, reduced);
          timings.push(performance.now() - start);
          renders++;
          const progress = Math.min(1, (tick * 1000) / 60 / profile.durationMs),
            pose = samplePose(profile.introBeats, progress);
          const frame = reduced ? profile.battleFrame : pose.frame,
            camera = introCamera(sprite, frame, side, state.tick, reduced, id);
          const point = reduced
            ? { x: 0, y: 0.12 }
            : deformRigPoint(
                { x: 0, y: 0.12 },
                rig,
                sampleGesture(id, progress),
                frame,
              );
          const scale = camera.height / sprite.bodyHeight;
          const headX =
            camera.targetX +
            (reduced ? 0 : pose.dx * camera.height * camera.facing) +
            point.x * sprite.frames[frame].height * scale * camera.facing;
          const headY =
            camera.feet +
            (reduced ? 0 : pose.dy * camera.height) +
            (frame === 4
              ? -camera.height
              : -sprite.frames[frame].height * scale) +
            point.y * sprite.frames[frame].height * scale;
          bounds.minX = Math.min(bounds.minX, headX);
          bounds.maxX = Math.max(bounds.maxX, headX);
          bounds.minY = Math.min(bounds.minY, headY);
          bounds.maxY = Math.max(bounds.maxY, headY);
          if (!Object.values(camera).every(Number.isFinite))
            errors.push(`${id}:camera`);
          if (
            headY < 24 ||
            headY > 500 ||
            headX < (side === 0 ? 40 : 580) ||
            headX > (side === 0 ? 500 : 1040)
          )
            errors.push(`${id}:head-clipped:${tick}`);
        }
    for (const side of [0, 1] as const)
      for (let frame = 0; frame < 8; frame++)
        for (const reduced of [false, true]) {
          if (
            !Object.values(
              introCamera(sprite, frame, side, 73, reduced, id),
            ).every(Number.isFinite)
          )
            errors.push(`${id}:finite-camera`);
          cameras++;
        }
    let difference = 0;
    for (const progress of [0.28, 0.48, 0.68]) {
      const pose = samplePose(profile.introBeats, progress);
      ca.clearRect(0, 0, 400, 500);
      cb.clearRect(0, 0, 400, 500);
      drawSprite(ca, sprite, pose.frame, 200, 491, 450, 1);
      cb.save();
      cb.translate(200, 491);
      if (!drawEntranceAction(cb, sprite, id, progress, 450, 1))
        drawArticulatedSprite(
          cb,
          sprite,
          id,
          pose.frame,
          450,
          1,
          sampleGesture(id, progress),
        );
      cb.restore();
      const da = ca.getImageData(0, 0, 400, 500).data,
        db = cb.getImageData(0, 0, 400, 500).data;
      let count = 0,
        opaque = 0;
      for (let i = 0; i < da.length; i += 4)
        if (da[i + 3] > 40 || db[i + 3] > 40) {
          opaque++;
          if (
            Math.abs(da[i] - db[i]) +
              Math.abs(da[i + 1] - db[i + 1]) +
              Math.abs(da[i + 2] - db[i + 2]) +
              Math.abs(da[i + 3] - db[i + 3]) >
            32
          )
            count++;
        }
      difference = Math.max(difference, count / opaque);
    }
    let neutral = true,
      reducedExact = true;
    for (const facing of [-1, 1]) {
      ca.clearRect(0, 0, 400, 500);
      cb.clearRect(0, 0, 400, 500);
      drawSprite(ca, sprite, profile.battleFrame, 200, 491, 450, facing);
      drawPresentation(cb, sprite, id, 1, 200, 491, 450, facing, "intro");
      const reference = ca.getImageData(0, 0, 400, 500).data;
      neutral &&= equalPixels(reference, cb.getImageData(0, 0, 400, 500).data);
      cb.clearRect(0, 0, 400, 500);
      drawPresentation(
        cb,
        sprite,
        id,
        0.3,
        200,
        491,
        450,
        facing,
        "intro",
        true,
      );
      reducedExact &&= equalPixels(
        reference,
        cb.getImageData(0, 0, 400, 500).data,
      );
    }
    if (!neutral || !reducedExact || difference < 0.04)
      errors.push(`${id}:motion-check`);
    entries.push({
      id,
      name: FIGHTERS.find((f) => f.id === id)!.name,
      gesture: rig.name,
      renderedBothSides: true,
      reducedMotionExact: reducedExact,
      finalGuardExact: neutral,
      bodyChangedFraction: +difference.toFixed(3),
      headBounds: Object.fromEntries(
        Object.entries(bounds).map(([key, value]) => [key, +value.toFixed(1)]),
      ),
    });
  }
  return { entries, errors, renders, cameras, timings };
}

export async function renderEntranceStrip(id: FighterId) {
  const sprite = await loadSprite(id),
    profile = presentationById(id),
    sprites = { [id]: sprite };
  const state = createMatch("caracas", [
    { name: id, fighter: id, wins: 0 },
    { name: id, fighter: id, wins: 0 },
  ]);
  const full = canvas(1080, 640),
    out = canvas(800, 238),
    ctx = full.getContext("2d")!,
    strip = out.getContext("2d")!;
  const phases = [
    [0, 0.27],
    [0, 0.6],
    [1, 0.35],
    [1, 0.72],
  ] as const;
  for (let i = 0; i < phases.length; i++) {
    const [side, progress] = phases[i];
    state.tick =
      side * INTRO_PLAYER_TICKS +
      Math.floor((progress * profile.durationMs * 60) / 1000);
    drawIntroCinematic(ctx, state, sprites);
    strip.drawImage(full, side * 540, 0, 540, 640, i * 200, 0, 200, 238);
  }
  return out.toDataURL("image/webp", 0.72).split(",")[1];
}
