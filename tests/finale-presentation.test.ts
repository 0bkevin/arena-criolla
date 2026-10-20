import test from "node:test";
import assert from "node:assert/strict";
import { FIGHTERS } from "../shared/content";
import { createMatch } from "../shared/engine";
import { finaleById } from "../shared/finales";
import perroChoreography from "../shared/perro-mujeriego-choreography.json";
import actorAssets from "../shared/finale-actor-assets.json";
import cafeFurniture from "../shared/finale-cafe-assets.json";
import {
  finaleActorLayout,
  finaleBodyPoint,
  finalePerformerFrame,
  finaleDancePoint,
  sampleFinaleDance,
  drawFinale,
} from "../src/game/finale-renderer";
import { writeFinaleMusic } from "../src/game/finale-sounds";

test("both dancers follow the contiguous six-second source phrase once at its observed timestamps", () => {
  const starts = [0, 60, 102, 144, 186, 222, 270, 318];
  assert.deepEqual(
    perroChoreography.poses.map((pose) => pose.tick),
    starts,
  );
  assert.equal(perroChoreography.durationTicks, 360);
  assert.deepEqual(
    starts.map((tick) => sampleFinaleDance(tick).frame),
    [0, 1, 2, 3, 4, 5, 6, 7],
  );
  for (const [index, tick] of starts.entries()) {
    const pose = sampleFinaleDance(tick);
    assert.equal(
      pose.blend,
      0,
      "the new illustrated gesture is complete at its reference timestamp",
    );
    if (tick > 0) assert.equal(sampleFinaleDance(tick - 1).frame, index - 1);
  }
  assert.equal(sampleFinaleDance(359).frame, 7);
  assert.equal(
    sampleFinaleDance(999).frame,
    7,
    "the phrase never loops through arbitrary poses",
  );
  assert.equal(sampleFinaleDance(57).nextFrame, 1);
  assert.ok(sampleFinaleDance(57).blend > 0 && sampleFinaleDance(57).blend < 1);
  for (let tick = 0; tick < 360; tick++) {
    const owner = sampleFinaleDance(tick),
      rival = sampleFinaleDance(tick);
    assert.deepEqual(owner, rival);
    assert.equal(
      owner.rotate,
      0,
      "both frontal figures preserve the recorded hand direction",
    );
    assert.ok(Math.abs(owner.dx) <= 3 && Math.abs(owner.dy) <= 4);
  }
});

test("the support bounce leaves the painted patitas, heart, arms and face entirely unchanged", () => {
  const feet: number[] = [];
  for (let tick = 0; tick < 360; tick++) {
    const pose = sampleFinaleDance(tick);
    for (const y of [-0.4, -0.2, 0, 0.1, 0.3, 0.5, 0.64])
      for (const x of [-0.6, -0.3, 0, 0.3, 0.6]) {
        const point = { x, y };
        assert.equal(
          finaleDancePoint(point, pose.phase),
          point,
          "the upper bitmap is not re-rigged into a different gesture",
        );
      }
    feet.push(finaleDancePoint({ x: 0.25, y: 1 }, pose.phase).y);
    assert.deepEqual(sampleFinaleDance(tick, true), {
      phase: 0,
      frame: 0,
      nextFrame: 0,
      blend: 0,
      dx: 0,
      dy: 0,
      rotate: 0,
    });
  }
  const amplitude = Math.max(...feet) - Math.min(...feet);
  assert.ok(
    amplitude > 0.003 && amplitude < 0.03,
    "support motion stays subtle beneath the illustrated choreography",
  );
});

test("Nacho's visual drain follows the six-second profile beats, not the short finale clock", () => {
  const messages: string[] = [];
  const gradient = () => ({ addColorStop() {} });
  const context = new Proxy(
    {
      createLinearGradient: gradient,
      createRadialGradient: gradient,
      fillText(value: string) {
        messages.push(value);
      },
    },
    {
      get(target, property) {
        return Reflect.get(target, property) ?? (() => {});
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  const profile = finaleById("nacho")!;
  assert.equal(profile.duration, 360);
  assert.deepEqual(profile.damageBeats, [84, 180, 276]);
  const state = createMatch("caracas", [
    { name: "Nacho", fighter: "nacho", wins: 3 },
    { name: "Rival", fighter: "zavarce", wins: 3 },
  ]);
  state.phase = "playing";
  state.finale = {
    owner: 0,
    target: 1,
    fighter: "nacho",
    startedTick: 1,
    tick: 0,
    duration: profile.duration,
    x: 0,
    y: 0,
    direction: 1,
    damage: 30,
    initialHp: 100,
  };
  for (const tick of [42, 83, 84, 140, 180, 276]) {
    messages.length = 0;
    state.finale.tick = tick;
    drawFinale(context, state, {}, {});
    assert.equal(
      messages.some((message) => message.startsWith("−")),
      profile.damageBeats.includes(tick),
      `visual pulse at tick ${tick}`,
    );
  }
});

test("finale props use world coordinates and never cover or reframe the arena viewport", () => {
  const transforms: { name: string; values: number[] }[] = [];
  const gradient = () => ({ addColorStop() {} });
  const context = new Proxy(
    {
      createLinearGradient: gradient,
      createRadialGradient: gradient,
      scale(...values: number[]) {
        transforms.push({ name: "scale", values });
      },
      translate(...values: number[]) {
        transforms.push({ name: "translate", values });
      },
      fillRect(...values: number[]) {
        transforms.push({ name: "fillRect", values });
      },
    },
    {
      get(target, property) {
        return Reflect.get(target, property) ?? (() => {});
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  const state = createMatch("caracas", [
    { name: "Nacho", fighter: "nacho", wins: 3 },
    { name: "Rival", fighter: "capriles", wins: 3 },
  ]);
  state.finale = {
    owner: 0,
    target: 1,
    fighter: "nacho",
    startedTick: 1,
    tick: 318,
    duration: 360,
    x: 0,
    y: 0,
    direction: 1,
    damage: 30,
    initialHp: 100,
  };
  for (const viewport of [
    { width: 1080, height: 640 },
    { width: 1280, height: 720 },
    { width: 844, height: 390 },
    { width: 390, height: 844 },
  ]) {
    transforms.length = 0;
    drawFinale(context, state, {}, {}, false, viewport);
    assert.deepEqual(transforms.slice(0, 3), [
      { name: "translate", values: [540, 554] },
      { name: "scale", values: [177 / 300, 177 / 300] },
      { name: "translate", values: [-540, -516] },
    ]);
    assert.equal(
      transforms.some((call) => call.name === "fillRect"),
      false,
      "Nacho adds dancers and notes, with no replacement background or floor",
    );
  }
});

test("coffee stages complete chairs behind both actors and one isolated table in front", () => {
  const calls: { image: unknown; args: number[] }[] = [];
  const gradient = () => ({ addColorStop() {} });
  const context = new Proxy(
    {
      createLinearGradient: gradient,
      createRadialGradient: gradient,
      drawImage(image: unknown, ...args: number[]) {
        calls.push({ image, args });
      },
    },
    {
      get(target, property) {
        return Reflect.get(target, property) ?? (() => {});
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  const image = () => ({ width: 2048, height: 1024 }) as HTMLImageElement;
  const furniture = image(),
    capriles = image(),
    rival = image(),
    oldCombined = image();
  const state = createMatch("caracas", [
    { name: "Café", fighter: "capriles", wins: 3 },
    { name: "Rival", fighter: "zavarce", wins: 3 },
  ]);
  state.phase = "playing";
  state.finale = {
    owner: 0,
    target: 1,
    fighter: "capriles",
    startedTick: 1,
    tick: 90,
    duration: 180,
    x: 0,
    y: 0,
    direction: 1,
    damage: 30,
    initialHp: 100,
  };
  drawFinale(
    context,
    state,
    {},
    {
      [cafeFurniture.file]: furniture,
      [actorAssets.caprilesCafe.file]: capriles,
      [actorAssets.seated.zavarce.file]: rival,
      "finales-v1-1": oldCombined,
    },
  );
  const furnitureCalls = calls.filter((call) => call.image === furniture);
  assert.equal(
    furnitureCalls.length,
    4,
    "each chair, the table and the cup are whole isolated images",
  );
  assert.deepEqual(
    furnitureCalls.map((call) => call.args.slice(0, 4)),
    Object.values(cafeFurniture.frames).map((frame) => [
      frame.x,
      frame.y,
      frame.width,
      frame.height,
    ]),
  );
  const actorIndices = calls.flatMap((call, index) =>
    call.image === capriles || call.image === rival ? [index] : [],
  );
  assert.equal(actorIndices.length, 2);
  assert.ok(calls.indexOf(furnitureCalls[0]) < Math.min(...actorIndices));
  assert.ok(calls.indexOf(furnitureCalls[1]) < Math.min(...actorIndices));
  assert.ok(calls.indexOf(furnitureCalls[2]) > Math.max(...actorIndices));
  assert.ok(
    calls.every((call) => call.image !== oldCombined),
    "the old combined set never contributes clipped fragments",
  );
});

test("legacy guest dance poses remain available outside Nacho's dedicated finale", () => {
  assert.deepEqual(
    [0, 18, 42, 55, 85, 105, 136, 160, 179].map((tick) =>
      finalePerformerFrame("nacho", tick),
    ),
    [0, 1, 2, 3, 4, 5, 6, 7, 7],
  );
  for (let tick = 0; tick <= 180; tick++)
    assert.equal(finalePerformerFrame("nacho", tick, true), 0);
});

test("Giuseppe alternates illustrated keyboard presses between preparation and signoff", () => {
  assert.equal(finalePerformerFrame("giuseppe", 0), 0);
  assert.deepEqual(
    [18, 26, 34, 42, 50, 58, 66].map((tick) =>
      finalePerformerFrame("giuseppe", tick),
    ),
    [1, 2, 3, 4, 5, 6, 1],
  );
  assert.equal(finalePerformerFrame("giuseppe", 156), 7);
  assert.equal(finalePerformerFrame("giuseppe", 179), 7);
  assert.equal(finalePerformerFrame("giuseppe", 90, true), 0);
});

test("seated atlas padding does not shrink a rival or move their feet", () => {
  const placement = finaleActorLayout(
    {
      frame: { x: 1280, y: 30, width: 190, height: 310 },
      bodyHeight: 300,
      anchorX: 65,
    },
    270,
  );
  assert.equal(placement.width, 171);
  assert.equal(placement.height, 279);
  assert.equal(
    placement.y + placement.height,
    0,
    "the crop bottom remains at the requested floor",
  );
  assert.equal(
    placement.x + 65 * 0.9,
    0,
    "the head centre stays aligned independently of asymmetric knees or hair",
  );
  const anotherCell = finaleActorLayout(
    {
      frame: { x: 14, y: 720, width: 190, height: 310 },
      bodyHeight: 300,
      anchorX: 65,
    },
    270,
  );
  assert.deepEqual(
    placement,
    anotherCell,
    "gutter size and atlas-cell coordinates do not change the figure's scale",
  );
});

test("captured fighters bend through hips and knees while their head keeps its likeness", () => {
  for (const mode of ["seat", "sip", "talk", "type"] as const) {
    const head = finaleBodyPoint({ x: 0, y: 0.1 }, mode, 0);
    assert.equal(head.x, 0);
    assert.equal(head.y, 0.1);
    const hip = finaleBodyPoint({ x: 0.03, y: 0.57 }, mode, 0);
    const knee = finaleBodyPoint({ x: 0.03, y: 0.79 }, mode, 0);
    const foot = finaleBodyPoint({ x: 0.03, y: 1 }, mode, 0);
    assert.ok(knee.x - hip.x > 0.2, "the thigh extends forward into the seat");
    assert.ok(knee.y - hip.y < 0.12, "the thigh bends across the chair");
    assert.equal(foot.x, knee.x, "the shin drops vertically beneath the knee");
    assert.ok(
      foot.y - knee.y > 0.25,
      "legs have distinct bent knees, not a squashed upright sprite",
    );
  }
});

test("paired dance alternates feet without translating either fighter's face", () => {
  const points = [0, 0.25, 0.5, 0.75].map((phase) => ({
    left: finaleBodyPoint({ x: -0.09, y: 1 }, "dance", phase),
    right: finaleBodyPoint({ x: 0.09, y: 1 }, "dance", phase),
  }));
  assert.ok(points[1].left.y === 1 && points[1].right.y < 0.95);
  assert.ok(points[3].left.y < 0.95 && points[3].right.y === 1);
  assert.notEqual(points[0].left.x, points[2].left.x);
});

test("all built-in finales have distinct finite original scores with safe levels and a silent ending", () => {
  const signatures = new Set<number>();
  for (const fighter of FIGHTERS) {
    const rate = 12000;
    const left = new Float32Array(
        (rate * finaleById(fighter.id)!.duration) / 60,
      ),
      right = new Float32Array(left.length);
    writeFinaleMusic(left, right, rate, fighter.id);
    let signature = 0;
    for (const samples of [left, right]) {
      let peak = 0,
        energy = 0;
      for (let i = 0; i < samples.length; i++) {
        const value = samples[i];
        assert.ok(Number.isFinite(value), fighter.id);
        peak = Math.max(peak, Math.abs(value));
        energy += value * value;
        if (i % 101 === 0) signature += value * (i + 1);
      }
      assert.ok(peak > 0.03 && peak < 0.8, `${fighter.id}: peak=${peak}`);
      assert.ok(energy > 0, fighter.id);
      assert.equal(samples[0], 0);
      assert.ok(Math.abs(samples.at(-1)!) < 0.0001, fighter.id);
    }
    signatures.add(Math.round(signature * 1e5));
    assert.notDeepEqual(left, right, `${fighter.id} has a stereo mix`);
  }
  assert.ok(
    signatures.size >= 20,
    "personal motifs vary within shared musical families",
  );
});
