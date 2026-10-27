import test from "node:test";
import assert from "node:assert/strict";
import { createMatch } from "../shared/engine";
import { finaleById } from "../shared/finales";
import { drawFinale } from "../src/game/finale-renderer";

test("Nacho's visual drain pulses exactly on the profile's damage beats", () => {
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
  assert.ok(profile.damageBeats.length > 1);
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
  const ticks = profile.damageBeats.flatMap((beat) => [beat - 1, beat]);
  for (const tick of ticks) {
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
  let reference: typeof transforms | undefined;
  for (const viewport of [
    { width: 1080, height: 640 },
    { width: 1280, height: 720 },
    { width: 844, height: 390 },
    { width: 390, height: 844 },
  ]) {
    transforms.length = 0;
    drawFinale(context, state, {}, {}, false, viewport);
    assert.ok(transforms.length > 0, "the finale paints props");
    reference ??= structuredClone(transforms);
    assert.deepEqual(
      transforms,
      reference,
      "props are placed in world space, independent of the viewport",
    );
    assert.equal(
      transforms.some((call) => call.name === "fillRect"),
      false,
      "Nacho adds dancers and notes, with no replacement background or floor",
    );
  }
});
