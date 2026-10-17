import test from "node:test";
import assert from "node:assert/strict";
import {
  ControlSources,
  GamepadControls,
  makeInputs,
  type Control,
} from "../src/game/controls";
import { createMatch, stepMatch } from "../shared/engine";
import { INTRO_TOTAL_TICKS } from "../shared/presentation";

test("releasing one finger does not release another finger or key on the same direction", () => {
  const [input] = makeInputs(),
    sources = new ControlSources(input);
  sources.press("touch:1", "right");
  sources.press("touch:2", "right");
  sources.press("key:KeyD", "right");
  sources.release("touch:1");
  assert.equal(input.right, true);
  sources.release("key:KeyD");
  assert.equal(input.right, true);
  sources.release("touch:2");
  assert.equal(input.right, false);
  sources.release("touch:2");
  assert.equal(input.right, false);
});

test("moving, blocking and jumping work together; repeated pointer events do not repeat attacks", () => {
  const [input] = makeInputs(),
    sources = new ControlSources(input);
  sources.press("thumb", "left");
  sources.press("shield", "block");
  sources.press("jump", "jump");
  sources.press("jump", "jump");
  assert.equal(input.left, true);
  assert.equal(input.block, true);
  assert.equal(input.actions.jump, 1);
  sources.release("jump");
  sources.press("jump", "jump");
  assert.equal(input.actions.jump, 2);
  sources.clear();
  assert.equal(input.left, false);
  assert.equal(input.block, false);
  assert.equal(
    input.actions.jump,
    2,
    "action counters stay monotonic across pause/cancel",
  );
});

test("a reused pointer switches direction without leaving the old control down", () => {
  const [input] = makeInputs(),
    sources = new ControlSources(input);
  sources.press("touch:7", "left");
  sources.press("touch:7", "right");
  assert.equal(input.left, false);
  assert.equal(input.right, true);
  sources.clear();
  sources.press("touch:7", "down");
  assert.equal(input.down, true);
  sources.release("touch:7");
  assert.equal(input.down, false);
});

test("controller release and disconnect preserve an independently held touch control", () => {
  const inputs = makeInputs(),
    sources: [ControlSources, ControlSources] = [
      new ControlSources(inputs[0]),
      new ControlSources(inputs[1]),
    ];
  const controls = new GamepadControls(sources);
  const pad = {
    axes: [1, 0],
    buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
  };
  let pads: (Gamepad | null)[] = [pad as unknown as Gamepad];
  const original = Object.getOwnPropertyDescriptor(navigator, "getGamepads");
  Object.defineProperty(navigator, "getGamepads", {
    configurable: true,
    value: () => pads,
  });
  try {
    sources[0].press("finger", "right");
    controls.update(inputs, 1);
    pad.axes[0] = 0;
    controls.update(inputs, 1);
    assert.equal(inputs[0].right, true);
    pad.axes[0] = 1;
    controls.update(inputs, 1);
    pads = [];
    controls.update(inputs, 1);
    assert.equal(inputs[0].right, true);
    sources[0].release("finger");
    assert.equal(inputs[0].right, false);
  } finally {
    if (original) Object.defineProperty(navigator, "getGamepads", original);
    else Reflect.deleteProperty(navigator, "getGamepads");
  }
});

test("disconnecting P1's controller preserves P2's controls and assigns replacements to P1", () => {
  const inputs = makeInputs();
  const sources: [ControlSources, ControlSources] = [
    new ControlSources(inputs[0]),
    new ControlSources(inputs[1]),
  ];
  const controls = new GamepadControls(sources);
  const pad = (index: number) => ({
    index,
    connected: true,
    axes: [0, 0],
    buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
  });
  const first = pad(0),
    second = pad(1);
  let pads: (ReturnType<typeof pad> | null)[] = [first, second];
  const original = Object.getOwnPropertyDescriptor(navigator, "getGamepads");
  Object.defineProperty(navigator, "getGamepads", {
    configurable: true,
    value: () => pads,
  });
  try {
    first.axes[0] = 1;
    second.axes[0] = -1;
    controls.update(inputs, 2);
    assert.equal(inputs[0].right, true);
    assert.equal(inputs[1].left, true);
    // Browsers retain a hole when a gamepad disconnects.
    pads[0] = null;
    second.buttons[2].pressed = true;
    controls.update(inputs, 2);
    assert.equal(
      inputs[0].right,
      false,
      "the disconnected controller releases its hold",
    );
    assert.equal(inputs[0].left, false, "P2 must not take over P1");
    assert.equal(inputs[1].left, true);
    assert.deepEqual(
      inputs.map((input) => input.actions.light),
      [0, 1],
    );
    second.buttons[2].pressed = false;
    controls.update(inputs, 2);
    const replacement = pad(2);
    replacement.buttons[0].pressed = true;
    pads = [null, second, replacement];
    controls.update(inputs, 2);
    assert.deepEqual(
      inputs.map((input) => input.actions.jump),
      [1, 0],
    );
    assert.equal(inputs[1].left, true);
  } finally {
    if (original) Object.defineProperty(navigator, "getGamepads", original);
    else Reflect.deleteProperty(navigator, "getGamepads");
  }
});

for (const control of [
  "jump",
  "light",
  "heavy",
  "special",
  "super",
  "dash",
] as Control[]) {
  test(`touch ${control} reaches the real combat engine`, () => {
    const match = createMatch("caracas", [
      { fighter: "zavarce", name: "Touch", wins: 3 },
      { fighter: "vallenilla", name: "Rival", wins: 3 },
    ]);
    // Start immediately after the shared introduction.
    match.phase = "playing";
    match.tick = INTRO_TOTAL_TICKS;
    match.players[0].energy = 100;
    const inputs = makeInputs(),
      sources = new ControlSources(inputs[0]);
    sources.press("finger", control);
    stepMatch(match, inputs);
    const player = match.players[0];
    if (control === "jump") assert.ok(player.vy < 0 && player.jumps === 1);
    else if (control === "dash") assert.ok(player.dash > 0);
    else assert.equal(player.attack, control);
  });
}
