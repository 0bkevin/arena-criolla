import test from "node:test";
import assert from "node:assert/strict";
import { TouchInputState } from "../src/game/touch-input";

function tracker() {
  const events: string[] = [];
  const input = new TouchInputState(
    (pointer, control) => events.push(`+${pointer}:${control}`),
    (pointer) => events.push(`-${pointer}`),
  );
  return { input, events };
}

test("independent fingers keep a shared direction held until the last release", () => {
  const { input, events } = tracker();
  input.press(11, "right");
  input.press(12, "right");
  input.press(13, "light");
  input.release(11);
  assert.deepEqual(input.pressedControls(), new Set(["right", "light"]));
  input.release(13);
  assert.deepEqual(input.pressedControls(), new Set(["right"]));
  input.release(12);
  assert.deepEqual(input.pressedControls(), new Set());
  assert.deepEqual(events, [
    "+11:right",
    "+12:right",
    "+13:light",
    "-11",
    "-13",
    "-12",
  ]);
});

test("direction slides transfer immediately, cancel in gaps, and can re-enter", () => {
  const { input, events } = tracker();
  input.press(21, "left");
  input.press(22, "right");
  assert.equal(input.move(21, "right"), true);
  assert.deepEqual(input.pressedControls(), new Set(["right"]));
  assert.equal(input.move(21, "light"), true);
  assert.deepEqual(input.pressedControls(), new Set(["right"]));
  assert.equal(input.move(21, "down"), true);
  assert.deepEqual(input.pressedControls(), new Set(["right", "down"]));
  input.release(21);
  assert.deepEqual(input.pressedControls(), new Set(["right"]));
  assert.deepEqual(events, [
    "+21:left",
    "+22:right",
    "-21",
    "+21:right",
    "-21",
    "+21:down",
    "-21",
  ]);
});

test("pointer cancel, reset, and unmount cleanup are idempotent", () => {
  const { input, events } = tracker();
  input.press(31, "block");
  input.press(32, "left");
  input.release(31); // pointercancel and pointerup share the same release path
  assert.equal(input.release(31), false);
  input.releaseAll(); // blur, visibility loss, reset, or component cleanup
  assert.deepEqual(input.pressedControls(), new Set());
  assert.deepEqual(input.pointers(), []);
  assert.equal(input.releaseAll(), false);
  assert.deepEqual(events, ["+31:block", "+32:left", "-31", "-32"]);
});

test("disabled controls release only their own fingers and reused ids release old input", () => {
  const { input, events } = tracker();
  input.press(41, "super");
  input.press(42, "block");
  input.releaseControl("super");
  assert.deepEqual(input.pressedControls(), new Set(["block"]));
  input.press(42, "right");
  assert.deepEqual(input.pressedControls(), new Set(["right"]));
  input.release(42);
  assert.deepEqual(events, [
    "+41:super",
    "+42:block",
    "-41",
    "-42",
    "+42:right",
    "-42",
  ]);
});
