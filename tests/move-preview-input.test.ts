import assert from "node:assert/strict";
import test from "node:test";
import {
  MovePreviewGamepads,
  MovePreviewInput,
} from "../src/game/move-preview-input";

function withGamepads(
  run: (fixture: ReturnType<typeof gamepadFixture>) => void,
) {
  const fixture = gamepadFixture();
  const original = Object.getOwnPropertyDescriptor(navigator, "getGamepads");
  Object.defineProperty(navigator, "getGamepads", {
    configurable: true,
    value: () => fixture.pads,
  });
  try {
    run(fixture);
  } finally {
    if (original) Object.defineProperty(navigator, "getGamepads", original);
    else Reflect.deleteProperty(navigator, "getGamepads");
  }
}

function gamepadFixture() {
  const createPad = (index: number) => ({
    index,
    id: "Standard controller " + index,
    connected: true,
    axes: [0, 0],
    buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
  });
  const first = createPad(0);
  return { first, pads: [first] };
}

test("J, K and J, J, K choose their corresponding combo and consume the sequence", () => {
  const input = new MovePreviewInput();
  assert.equal(input.press("KeyJ", 100), "light");
  assert.equal(input.press("KeyK", 300), "combo1");
  assert.equal(input.press("KeyK", 400), "heavy");
  input.press("KeyJ", 500);
  input.press("KeyJ", 700);
  assert.equal(input.press("KeyK", 900), "combo2");
  assert.equal(input.press("KeyK", 1000), "heavy");
});

test("combo input expires at the combat window boundary", () => {
  const input = new MovePreviewInput();
  input.press("KeyJ", 0);
  assert.equal(input.press("KeyK", 2499), "combo1");
  input.press("KeyJ", 3000);
  assert.equal(input.press("KeyK", 5500), "heavy");
  input.press("KeyJ", 6000);
  input.press("KeyJ", 8000);
  assert.equal(input.press("KeyK", 8600), "combo1");
});

test("opening or refocusing with a held controller button requires a fresh press", () => {
  withGamepads(({ first }) => {
    const input = new MovePreviewGamepads();
    first.buttons[2].pressed = true;
    input.resume();
    assert.deepEqual(input.poll(0), []);
    first.buttons[2].pressed = false;
    input.poll(10);
    first.buttons[2].pressed = true;
    assert.deepEqual(input.poll(20), ["light"]);
    input.suspend();
    input.resume();
    assert.deepEqual(input.poll(30), []);
    first.buttons[2].pressed = false;
    input.poll(40);
    first.buttons[1].pressed = true;
    assert.deepEqual(input.poll(50), ["heavy"]);
  });
});

test("controller disconnect clears pending combos and reconnect ignores held buttons", () => {
  withGamepads((fixture) => {
    const input = new MovePreviewGamepads();
    input.resume();
    assert.equal(input.connected, true);
    fixture.first.buttons[2].pressed = true;
    assert.deepEqual(input.poll(0), ["light"]);
    fixture.pads = [];
    assert.deepEqual(input.poll(100), []);
    assert.equal(input.connected, false);
    fixture.first.buttons[1].pressed = true;
    fixture.pads = [fixture.first];
    assert.deepEqual(input.poll(200), []);
    assert.equal(input.connected, true);
    fixture.first.buttons[1].pressed = false;
    fixture.first.buttons[2].pressed = false;
    input.poll(300);
    fixture.first.buttons[1].pressed = true;
    assert.deepEqual(input.poll(400), ["heavy"]);
  });
});
