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
  const second = createPad(1);
  return { first, second, pads: [first] };
}

test("the four attack keys preview individually and repeated heavy presses stay heavy", () => {
  const input = new MovePreviewInput();
  assert.equal(input.press("KeyK", 0), "heavy");
  assert.equal(input.press("KeyK", 10), "heavy");
  assert.equal(input.press("KeyJ", 20), "light");
  assert.equal(input.press("KeyL", 30), "special");
  assert.equal(input.press("KeyI", 40), "final");
});

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

test("specials, definitives and unrelated keys break a pending combo", () => {
  for (const code of ["KeyL", "KeyI", "KeyA", "Tab", "Enter"]) {
    const input = new MovePreviewInput();
    input.press("KeyJ", 0);
    input.press(code, 100);
    assert.equal(input.press("KeyK", 200), "heavy", code);
  }
});

test("resetting after a pointer action, blur or visibility change clears pending keys", () => {
  const input = new MovePreviewInput();
  input.press("KeyJ", 0);
  input.press("KeyJ", 100);
  input.reset();
  assert.equal(input.press("KeyK", 200), "heavy");
  assert.equal(input.press("KeyJ", 300), "light");
  assert.equal(input.press("KeyK", 400), "combo1");
});

test("a rolling light chain retains the latest two presses", () => {
  const input = new MovePreviewInput();
  input.press("KeyJ", 0);
  input.press("KeyJ", 100);
  input.press("KeyJ", 200);
  assert.equal(input.press("KeyK", 2600), "combo1");
  input.press("KeyJ", 3000);
  input.press("KeyJ", 3100);
  input.press("KeyJ", 3200);
  assert.equal(input.press("KeyK", 3300), "combo2");
});

test("controller attack buttons use combat bindings and do not repeat while held", () => {
  withGamepads(({ first }) => {
    const input = new MovePreviewGamepads();
    input.resume();
    for (const [button, move] of [
      [2, "light"],
      [1, "heavy"],
      [3, "special"],
      [7, "final"],
    ] as const) {
      input.reset();
      first.buttons[button].pressed = true;
      assert.deepEqual(input.poll(100), [move]);
      assert.deepEqual(input.poll(200), []);
      first.buttons[button].pressed = false;
      assert.deepEqual(input.poll(300), []);
    }
  });
});

test("controller X B and X X B preview combos with the same expiry as keyboard", () => {
  withGamepads(({ first }) => {
    const input = new MovePreviewGamepads();
    input.resume();
    const press = (button: number, now: number) => {
      first.buttons[button].pressed = true;
      const moves = input.poll(now);
      first.buttons[button].pressed = false;
      input.poll(now + 1);
      return moves;
    };
    assert.deepEqual(press(2, 100), ["light"]);
    assert.deepEqual(press(1, 200), ["combo1"]);
    press(2, 300);
    press(2, 400);
    assert.deepEqual(press(1, 500), ["combo2"]);
    press(2, 600);
    assert.deepEqual(press(1, 3100), ["heavy"]);
  });
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

test("two controllers keep independent combo chains", () => {
  withGamepads((fixture) => {
    fixture.pads = [fixture.first, fixture.second];
    const input = new MovePreviewGamepads();
    input.resume();
    fixture.first.buttons[2].pressed = true;
    assert.deepEqual(input.poll(0), ["light"]);
    fixture.second.buttons[1].pressed = true;
    assert.deepEqual(input.poll(100), ["heavy"]);
    fixture.first.buttons[2].pressed = false;
    input.poll(200);
    fixture.first.buttons[1].pressed = true;
    assert.deepEqual(input.poll(300), ["combo1"]);
  });
});
