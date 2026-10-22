import test from "node:test";
import assert from "node:assert/strict";
import { createMatch } from "../shared/engine";
import { finaleById } from "../shared/finales";
import { drawFinale } from "../src/game/finale-renderer";

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

