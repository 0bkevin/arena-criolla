import test from "node:test";
import assert from "node:assert/strict";
import {
  ControlSources,
  GamepadControls,
  KEY_MAP,
  makeInputs,
  type Control,
} from "../src/game/controls";
import { createMatch, stepMatch } from "../shared/engine";
import { INTRO_TOTAL_TICKS } from "../shared/presentation";

test("J remains Vicente's basic punch before and after unlocking his special", () => {
  for (const wins of [0, 3]) {
    const match = createMatch("poliedro", [
      { fighter: "zavarce", name: "Vicente", wins },
      { fighter: "vallenilla", name: "Rival", wins: 0 },
    ]);
    match.phase = "playing";
    match.players.forEach((player) => {
      player.invincible = 0;
    });
    match.players[1].x = match.players[0].x + 80;
    const inputs = makeInputs();
    const [player, control] = KEY_MAP.KeyJ;
    new ControlSources(inputs[player]).press("key:KeyJ", control);
    stepMatch(match, inputs);
    assert.equal(match.players[0].attack, "light");
    for (let frame = 0; frame < 24; frame++) stepMatch(match, inputs);
    assert.equal(match.players[0].hits, 1);
    assert.equal(match.projectiles.length, 0);
    assert.equal(
      match.effects.some((effect) => effect.kind === "special"),
      false,
    );
  }
});

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
    assert.equal(
      inputs[0].actions.jump,
      0,
      "a replacement must release held actions first",
    );
    replacement.buttons[0].pressed = false;
    controls.update(inputs, 2);
    replacement.buttons[0].pressed = true;
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

function withController(
  run: (fixture: {
    pad: {
      index: number;
      connected: boolean;
      axes: number[];
      buttons: { pressed: boolean }[];
    };
    pads: {
      index: number;
      connected: boolean;
      axes: number[];
      buttons: { pressed: boolean }[];
    }[];
    inputs: ReturnType<typeof makeInputs>;
    sources: [ControlSources, ControlSources];
    controls: GamepadControls;
  }) => void,
  players = 1,
) {
  const inputs = makeInputs();
  const sources: [ControlSources, ControlSources] = [
    new ControlSources(inputs[0]),
    new ControlSources(inputs[1]),
  ];
  const pads = Array.from({ length: players }, (_, index) => ({
    index,
    connected: true,
    axes: [0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false })),
  }));
  const pad = pads[0];
  const original = Object.getOwnPropertyDescriptor(navigator, "getGamepads");
  Object.defineProperty(navigator, "getGamepads", {
    configurable: true,
    value: () => pads,
  });
  try {
    run({ pad, pads, inputs, sources, controls: new GamepadControls(sources) });
  } finally {
    if (original) Object.defineProperty(navigator, "getGamepads", original);
    else Reflect.deleteProperty(navigator, "getGamepads");
  }
}

test("Start requests pause once per press, including while gameplay is suspended", () => {
  withController(({ pad, inputs, controls }) => {
    pad.buttons[9].pressed = true;
    pad.buttons[2].pressed = true;
    assert.equal(controls.update(inputs, 1), true);
    assert.equal(
      inputs[0].actions.light,
      0,
      "opening pause cannot also attack",
    );
    assert.equal(controls.update(inputs, 1, { gameplay: false }), false);
    pad.buttons[9].pressed = false;
    controls.update(inputs, 1, { gameplay: false });
    pad.buttons[9].pressed = true;
    assert.equal(controls.update(inputs, 1, { gameplay: false }), true);
  });
});

test("suspended controllers release their holds without releasing keyboard sources", () => {
  withController(({ pad, inputs, sources, controls }) => {
    sources[0].press("key:KeyD", "right");
    pad.axes[0] = 1;
    pad.buttons[4].pressed = true;
    controls.update(inputs, 1);
    controls.update(inputs, 1, { gameplay: false });
    assert.equal(inputs[0].right, true);
    assert.equal(inputs[0].block, false);
    sources[0].release("key:KeyD");
    controls.update(inputs, 1, { gameplay: false });
    assert.equal(inputs[0].right, false);
  });
});

test("actions first held during pause require release and a fresh press after resuming", () => {
  withController(({ pad, inputs, controls }) => {
    controls.update(inputs, 1, { gameplay: false });
    pad.buttons[2].pressed = true;
    controls.update(inputs, 1, { gameplay: false });
    controls.update(inputs, 1);
    assert.equal(inputs[0].actions.light, 0);
    pad.buttons[2].pressed = false;
    controls.update(inputs, 1);
    pad.buttons[2].pressed = true;
    controls.update(inputs, 1);
    assert.equal(inputs[0].actions.light, 1);
  });
});

test("either player's fresh actions are accepted on the first poll after explicit resume", () => {
  const buttons = [
    [0, "jump"],
    [1, "heavy"],
    [2, "light"],
    [3, "special"],
    [5, "dash"],
    [7, "super"],
  ] as const;
  for (const useSources of [true, false])
    for (const player of [0, 1])
      for (const [button, action] of buttons)
        withController(({ pads, inputs, sources }) => {
          const controls = new GamepadControls(
            useSources ? sources : undefined,
          );
          controls.update(inputs, 2);
          controls.suspend(inputs, { menu: true });
          controls.update(inputs, 2, { gameplay: false });
          controls.suspend(inputs, { menu: true });
          controls.resume(inputs, 2);
          pads[player].buttons[button].pressed = true;
          controls.update(inputs, 2);
          assert.equal(
            inputs[player].actions[action],
            1,
            `P${player + 1} ${action}`,
          );
          assert.equal(inputs[1 - player].actions[action], 0);
          controls.update(inputs, 2);
          assert.equal(
            inputs[player].actions[action],
            1,
            "holding must not repeat",
          );
        }, 2);
});

test("resume captures buttons first held since the last paused poll without suppressing other fresh actions", () => {
  withController(({ pads, inputs, controls }) => {
    controls.update(inputs, 2);
    controls.suspend(inputs, { menu: true });
    controls.update(inputs, 2, { gameplay: false });
    // These presses occur during pause, between the last RAF and clicking Resume.
    pads[0].buttons[2].pressed = true;
    pads[1].buttons[0].pressed = true;
    controls.suspend(inputs, { menu: true });
    controls.resume(inputs, 2);
    pads[1].buttons[5].pressed = true; // Fresh dodge after Resume.
    controls.update(inputs, 2);
    assert.equal(inputs[0].actions.light, 0);
    assert.equal(inputs[1].actions.jump, 0);
    assert.equal(inputs[1].actions.dash, 1);
    controls.update(inputs, 2);
    assert.equal(inputs[0].actions.light, 0);
    assert.equal(inputs[1].actions.jump, 0);
    pads[0].buttons[2].pressed = false;
    pads[1].buttons[0].pressed = false;
    controls.update(inputs, 2);
    pads[0].buttons[2].pressed = true;
    pads[1].buttons[0].pressed = true;
    controls.update(inputs, 2);
    assert.equal(inputs[0].actions.light, 1);
    assert.equal(inputs[1].actions.jump, 1);
  }, 2);
});

test("Start resume suppresses simultaneous attacks but accepts a new button on the next poll", () => {
  withController(({ pad, inputs, controls }) => {
    controls.update(inputs, 1, { gameplay: false });
    pad.buttons[9].pressed = true;
    pad.buttons[2].pressed = true;
    assert.equal(controls.update(inputs, 1, { gameplay: false }), true);
    controls.suspend(inputs, { menu: true });
    controls.resume(inputs, 1);
    pad.buttons[0].pressed = true;
    assert.equal(
      controls.update(inputs, 1),
      false,
      "held Start must not repause",
    );
    assert.equal(inputs[0].actions.light, 0);
    assert.equal(inputs[0].actions.jump, 1);
  });
});

test("explicit resume after an unobserved blur keeps held Start and attacks disarmed", () => {
  withController(({ pad, inputs, controls }) => {
    controls.update(inputs, 1);
    controls.suspend(inputs);
    pad.buttons[9].pressed = true;
    pad.buttons[2].pressed = true;
    controls.suspend(inputs, { menu: true });
    controls.resume(inputs, 1);
    assert.equal(controls.update(inputs, 1), false);
    assert.equal(inputs[0].actions.light, 0);
    pad.buttons[9].pressed = false;
    pad.buttons[2].pressed = false;
    controls.update(inputs, 1);
    pad.buttons[2].pressed = true;
    controls.update(inputs, 1);
    assert.equal(inputs[0].actions.light, 1);
  });
});

test("resuming without any intervening poll still rearms discrete controller actions", () => {
  withController(({ pad, inputs, controls }) => {
    controls.update(inputs, 1);
    controls.suspend(inputs);
    pad.buttons[0].pressed = true;
    pad.buttons[9].pressed = true;
    pad.axes[0] = 1;
    assert.equal(
      controls.update(inputs, 1),
      false,
      "Start held while unfocused is not a menu press",
    );
    assert.equal(inputs[0].actions.jump, 0);
    assert.equal(inputs[0].right, true, "held movement can resume immediately");
    pad.buttons[0].pressed = false;
    pad.buttons[9].pressed = false;
    controls.update(inputs, 1);
    pad.buttons[0].pressed = true;
    controls.update(inputs, 1);
    assert.equal(inputs[0].actions.jump, 1);
  });
});

test("an attack held in pause stays disarmed across disconnect and reconnect", () => {
  withController(({ pad, inputs, controls }) => {
    controls.update(inputs, 1, { gameplay: false });
    pad.buttons[2].pressed = true;
    controls.update(inputs, 1, { gameplay: false });
    pad.connected = false;
    controls.update(inputs, 1, { gameplay: false });
    controls.update(inputs, 1);
    controls.update(inputs, 1);
    pad.connected = true;
    controls.update(inputs, 1);
    assert.equal(
      inputs[0].actions.light,
      0,
      "reconnecting is not a fresh press",
    );
    pad.buttons[2].pressed = false;
    controls.update(inputs, 1);
    pad.buttons[2].pressed = true;
    controls.update(inputs, 1);
    assert.equal(inputs[0].actions.light, 1);
  });
});

test("a fresh Start immediately after keyboard pause remains available", () => {
  withController(({ pad, inputs, controls }) => {
    controls.update(inputs, 1);
    controls.suspend(inputs, { menu: true });
    pad.buttons[9].pressed = true;
    assert.equal(controls.update(inputs, 1, { gameplay: false }), true);
  });
  withController(({ pad, inputs, controls }) => {
    controls.update(inputs, 1);
    controls.suspend(inputs); // blur, before an inactive polling frame
    pad.buttons[9].pressed = true;
    controls.suspend(inputs, { menu: true }); // focus and keyboard pause
    assert.equal(
      controls.update(inputs, 1, { gameplay: false }),
      false,
      "ordinary pause must not erase an unobserved blur boundary",
    );
  });
});

test("Start held under an inactive menu cannot activate after a disconnected resume", () => {
  withController(({ pad, inputs, controls }) => {
    pad.buttons[9].pressed = true;
    controls.update(inputs, 1, { gameplay: false, menu: false });
    pad.connected = false;
    controls.update(inputs, 1, { gameplay: false, menu: false });
    controls.update(inputs, 1);
    pad.connected = true;
    assert.equal(controls.update(inputs, 1), false);
    pad.buttons[9].pressed = false;
    controls.update(inputs, 1);
    pad.buttons[9].pressed = true;
    assert.equal(controls.update(inputs, 1), true);
  });
});
