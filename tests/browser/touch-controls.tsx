// Run with the dev server at /tests/browser/touch-controls.html, then await
// touchAudit.run() in the browser console. Uses real DOM hit-testing and React
// handlers. Synthetic events do not prove OS gesture handling or native capture.
import { StrictMode, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import { TouchControls } from "../../src/components/TouchControls";
import { createMatch, emptyInput, stepMatch } from "../../shared/engine";
import { SUPER_CHARGE_TICKS } from "../../shared/content";
import {
  ControlSources,
  makeInputs,
  type Control,
} from "../../src/game/controls";
import "../../src/styles.css";
import "../../src/lobby.css";
import "../../src/arcade-theme.css";
import "../../src/mobile-game.css";
import "../../src/ui-accessibility.css";

const controls: Control[] = [
  "left",
  "right",
  "jump",
  "down",
  "dash",
  "block",
  "light",
  "heavy",
  "special",
  "super",
];
let root: Root | null = null;
let input = makeInputs()[0];
let sources = new ControlSources(input);
let events: string[] = [];
let props: ComponentProps<typeof TouchControls>;
let mobile = true;
let restoreDevice: (() => void) | undefined;

function render() {
  flushSync(() =>
    root!.render(
      <StrictMode>
        <div className="app-shell arcade-app">
          <main className={`game-page page-width${mobile ? " is-touch" : ""}`}>
            <TouchControls {...props} />
          </main>
        </div>
      </StrictMode>,
    ),
  );
}

export function unmount() {
  if (root) flushSync(() => root!.unmount());
  root = null;
  restoreDevice?.();
  restoreDevice = undefined;
}

export function mount(
  options: { energy?: number; wins?: number; mobile?: boolean } = {},
) {
  unmount();
  input = makeInputs()[0];
  sources = new ControlSources(input);
  events = [];
  mobile = options.mobile ?? true;
  props = {
    energy: options.energy ?? 100,
    superUsed: false,
    wins: options.wins ?? 3,
    reset: 0,
    onPress: (pointer, control) => {
      events.push(`+${pointer}:${control}`);
      sources.press(`touch:${pointer}`, control);
    },
    onRelease: (pointer) => {
      events.push(`-${pointer}`);
      sources.release(`touch:${pointer}`);
    },
  };
  root = createRoot(document.getElementById("fixture")!);
  render();
}

export function update(changes: Partial<ComponentProps<typeof TouchControls>>) {
  props = { ...props, ...changes };
  render();
}

/** Exercise the real game's arena, toolbar, pad and keyboard hints together. */
export async function mountHybridGame(options: { energy?: number } = {}) {
  unmount();
  if (matchMedia("(pointer: coarse)").matches)
    throw new Error("Hybrid regression requires a fine primary pointer");
  const [{ Game }, { createMatch }] = await Promise.all([
    import("../../src/components/Game"),
    import("../../shared/engine"),
  ]);
  const overrides = [
    [navigator, "maxTouchPoints", 5],
    [screen, "width", 1280],
    [screen, "height", 800],
  ] as const;
  const saved = overrides.map(([target, key]) =>
    Object.getOwnPropertyDescriptor(target, key),
  );
  restoreDevice = () =>
    overrides.forEach(([target, key], index) => {
      if (saved[index]) Object.defineProperty(target, key, saved[index]!);
      else Reflect.deleteProperty(target, key);
    });
  for (const [target, key, value] of overrides)
    Object.defineProperty(target, key, { configurable: true, value });
  const initial = createMatch("caracas", [
    { name: "P1", fighter: "zavarce", wins: 3 },
    { name: "P2", fighter: "javier", wins: 3 },
  ]);
  initial.phase = "playing";
  if (options.energy !== undefined) initial.players[0].energy = options.energy;
  initial.remaining = 360000;
  const noop = () => {};
  root = createRoot(document.getElementById("fixture")!);
  flushSync(() =>
    root!.render(
      <StrictMode>
        <div className="app-shell arcade-app">
          <Game
            initial={initial}
            mode="local"
            difficulty="easy"
            onExit={noop}
            onResult={noop}
            onRematch={noop}
            onHelp={noop}
            onToggleSound={noop}
            soundEnabled={false}
          />
        </div>
      </StrictMode>,
    ),
  );
  // Allow resize observers and any font-dependent toolbar wrapping to settle.
  await document.fonts.ready;
  await new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve)),
  );
  return gameLayout();
}

export function gameLayout() {
  const page = document.querySelector<HTMLElement>(".game-page")!;
  const bounds = page.getBoundingClientRect();
  const arena = page.querySelector(".arena-wrap")!.getBoundingClientRect();
  const padLayout = layout();
  return {
    ...padLayout,
    mobile: page.classList.contains("is-touch"),
    pageBottom: bounds.bottom,
    arena: { width: arena.width, height: arena.height },
    pass:
      padLayout.pass &&
      bounds.top >= 0 &&
      bounds.bottom <= innerHeight + 0.5 &&
      arena.height > 0 &&
      Math.abs(arena.width / arena.height - 1.8) < 0.01,
  };
}

/** Reproduce a stalled frame against the production Game, not a prepared charge. */
export async function chargeStallRegression() {
  const waitUntil = async (ready: () => boolean, timeout: number) => {
    const deadline = Date.now() + timeout;
    while (!ready() && Date.now() < deadline)
      await new Promise(resolve => setTimeout(resolve, 30));
    if (!ready()) throw new Error("Production charge did not reach its expected state");
  };
  try {
    await mountHybridGame({ energy: 100 });
    await waitUntil(() => !document.querySelector(".loading-overlay"), 10000);
    button("super").click();
    window.setTimeout(() => {
      const until = performance.now() + 400;
      while (performance.now() < until) { /* Simulate a stalled browser frame. */ }
    }, 150);
    await waitUntil(() => document.querySelector(".super-charge-status")?.textContent === "Usada", 3000);
    return { pass: true, status: "Usada" };
  } finally {
    mount();
  }
}

const button = (control: Control) =>
  document.querySelector<HTMLButtonElement>(`[data-control="${control}"]`)!;
const pad = () => document.querySelector<HTMLElement>(".touch-controls")!;
function center(control: Control) {
  const rect = button(control).getBoundingClientRect();
  return {
    clientX: rect.x + rect.width / 2,
    clientY: rect.y + rect.height / 2,
  };
}

function pointer(
  type: string,
  id: number,
  control: Control | null,
  extra: PointerEventInit = {},
  target?: EventTarget,
) {
  const point = control
    ? center(control)
    : { clientX: innerWidth / 2, clientY: 80 };
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: id,
    pointerType: "touch",
    buttons: type === "pointerup" || type === "pointercancel" ? 0 : 1,
    ...point,
    ...extra,
  });
  flushSync(() =>
    (
      target ??
      (type === "pointerdown" && control
        ? button(control).querySelector("svg")!
        : pad())
    ).dispatchEvent(event),
  );
}

function equal(actual: unknown, expected: unknown, label = "state") {
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
}

export function state() {
  return {
    input: structuredClone(input),
    events: [...events],
    pressed: [
      ...document.querySelectorAll<HTMLElement>(".touch-button.is-pressed"),
    ]
      .map((el) => el.dataset.control!)
      .sort(),
  };
}

export function layout() {
  const buttons = controls.map((control) => {
    const el = button(control),
      rect = el.getBoundingClientRect();
    const hit = document.elementFromPoint(
      rect.x + rect.width / 2,
      rect.y + rect.height / 2,
    );
    return {
      control,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      visible:
        rect.x >= 0 &&
        rect.y >= 0 &&
        rect.right <= innerWidth &&
        rect.bottom <= innerHeight,
      hit: hit?.closest("button") === el,
      touchAction: getComputedStyle(el).touchAction,
    };
  });
  return {
    width: innerWidth,
    height: innerHeight,
    buttons,
    pass: buttons.every(
      (b) =>
        b.visible &&
        b.hit &&
        b.width >= 48 &&
        b.height >= 48 &&
        b.touchAction === "none",
    ),
  };
}

export async function run() {
  const results: { name: string; pass: boolean; error?: string }[] = [];
  const test = async (name: string, check: () => void | Promise<void>) => {
    mount();
    try {
      await check();
      results.push({ name, pass: true });
    } catch (error) {
      results.push({ name, pass: false, error: String(error) });
    }
  };
  await test("100 button pairs enforce sliding and fresh-press abilities through real hit-testing", () => {
    for (const from of controls)
      for (const to of controls) {
        pointer("pointerdown", 11, from);
        pointer("pointermove", 11, to);
        const protectedEntry =
          from !== to && (to === "special" || to === "super");
        equal(state().pressed, protectedEntry ? [] : [to], `${from} → ${to}`);
        pointer("pointerup", 11, to);
        equal(state().pressed, []);
      }
  });
  await test("special and super cannot fire by sliding, re-entry, or energy recovery", () => {
    pointer("pointerdown", 1, "left");
    for (const ability of ["special", "super"] as const) {
      pointer("pointerdown", 2, "heavy");
      pointer("pointermove", 2, ability);
      equal(input.actions[ability], 0);
      pointer("pointerup", 2, ability);
      pointer("pointerdown", 2, ability);
      equal(input.actions[ability], 1);
      pointer("pointermove", 2, "block");
      pointer("pointermove", 2, ability);
      equal(input.actions[ability], 1);
      pointer("pointerup", 2, ability);
      pointer("pointerdown", 2, ability);
      update({ energy: 0 });
      update({ energy: 100 });
      pointer("pointermove", 2, ability);
      equal(input.actions[ability], 2);
      equal(state().pressed, ["left"]);
      pointer("pointerup", 2, ability);
      pointer("pointerdown", 2, ability);
      equal(input.actions[ability], 3);
      pointer("pointerup", 2, ability);
    }
  });
  await test("small gap jitter retains one attack; deliberate exits and transfers stay immediate", () => {
    pointer("pointerdown", 1, "heavy");
    pointer("pointerdown", 2, "block");
    // The space above heavy stays neutral even in the compact two-pixel layout.
    const r = button("heavy").getBoundingClientRect();
    const near = { clientX: r.left + r.width / 2, clientY: r.top - 2 };
    const far = { ...near, clientY: r.top - 7 };
    equal(
      document
        .elementFromPoint(near.clientX, near.clientY)
        ?.closest("button") ?? null,
      null,
      "fixture gap",
    );
    for (let i = 0; i < 20; i++) {
      pointer("pointermove", 1, null, near);
      equal(state().pressed, ["block", "heavy"]);
      pointer("pointermove", 1, "heavy");
    }
    equal(input.actions.heavy, 1, "jitter must not repeat an attack");
    pointer("pointermove", 1, null, far);
    equal(state().pressed, ["block"]);
    pointer("pointermove", 1, "heavy");
    equal(input.actions.heavy, 2, "a deliberate exit allows a new entry");
    pointer("pointermove", 1, "light");
    equal(input.actions.light, 1, "another button takes effect on this event");
    equal(state().pressed, ["block", "light"]);
    pointer("pointermove", 1, "special");
    equal(state().pressed, ["block"]);
    equal(input.actions.special, 0);
  });
  await test("edge tolerance never retains input outside the group, under overlays, or on disabled buttons", () => {
    const light = button("light").getBoundingClientRect();
    pointer("pointerdown", 1, "light");
    pointer("pointermove", 1, null, {
      clientX: light.left - 1,
      clientY: light.top + light.height / 2,
    });
    equal(state().pressed, []);
    pointer("pointermove", 1, "heavy");
    update({ energy: 0 });
    pointer("pointermove", 1, "special");
    equal(state().pressed, []);
    pointer("pointermove", 1, "light");
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;z-index:9999";
    document.body.append(overlay);
    try {
      pointer("pointermove", 1, "light");
      equal(state().pressed, []);
    } finally {
      overlay.remove();
    }
  });
  await test("independent thumbs, shared controls and keyboard sources", () => {
    sources.press("key:KeyA", "left");
    pointer("pointerdown", 1, "left");
    pointer("pointerdown", 2, "left");
    pointer("pointermove", 2, "block");
    equal(input.left && input.block, true);
    pointer("pointerup", 1, "left");
    equal(input.left, true);
    sources.release("key:KeyA");
    equal(input.left, false);
    pointer("pointermove", 2, "light");
    equal(input.block, false);
    equal(input.actions.light, 1);
    for (let i = 0; i < 30; i++) pointer("pointermove", 2, "light");
    equal(input.actions.light, 1);
    pointer("pointermove", 2, null);
    equal(state().pressed, []);
    pointer("pointermove", 2, "light");
    equal(input.actions.light, 2);
    pointer("pointerup", 2, null);
    equal(state().pressed, []);
  });
  await test("disabled attacks are neutral, including keyboard and accessible clicks", () => {
    update({ energy: 0, wins: 0 });
    pointer("pointerdown", 1, "super");
    equal(input.actions.super, 0);
    pointer("pointermove", 1, "block");
    equal(input.block, true);
    pointer("pointermove", 1, "special");
    equal(input.block, false);
    equal(input.actions.special, 0);
    button("super").click();
    button("special").dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        bubbles: true,
      }),
    );
    equal(input.actions.super + input.actions.special, 0);
    pointer("pointermove", 1, "heavy");
    equal(input.actions.heavy, 1);
  });
  await test("energy changes mid-gesture preserve the finger", () => {
    pointer("pointerdown", 1, "super");
    equal(input.actions.super, 1);
    update({ energy: 0 });
    equal(state().pressed, []);
    pointer("pointermove", 1, "super");
    equal(input.actions.super, 1);
    pointer("pointermove", 1, "block");
    equal(input.block, true);
    pointer("pointerup", 1, "block");
    equal(input.block, false);
  });
  await test("super is available from zero wins and energy recovery requires a fresh press", () => {
    update({ wins: 0, energy: 89 });
    pointer("pointerdown", 1, "super");
    equal(input.actions.super, 0);
    update({ energy: 90 });
    equal(button("super").getAttribute("aria-disabled"), null);
    pointer("pointermove", 1, "super");
    equal(input.actions.super, 0, "energy recovery must not activate a held contact");
    pointer("pointerup", 1, "super");
    pointer("pointerdown", 1, "super");
    equal(input.actions.super, 1, "zero wins allow a fresh press with enough energy");
    update({ energy: 89 });
    equal(state().pressed, []);
    update({ energy: 90 });
    pointer("pointermove", 1, "super");
    equal(input.actions.super, 1, "energy recovery must not reactivate it");
    pointer("pointerup", 1, "super");
    pointer("pointerdown", 1, "super");
    equal(input.actions.super, 2);
  });
  await test("a used super stays unavailable after energy recovery and blocks every input path", () => {
    pointer("pointerdown", 1, "super");
    equal(input.actions.super, 1);
    update({ superUsed: true, energy: 100 });
    equal(state().pressed, []);
    equal(button("super").getAttribute("aria-disabled"), "true");
    equal(button("super").textContent?.includes("Usada"), true);
    update({ energy: 0 });
    update({ energy: 100 });
    pointer("pointerup", 1, "super");
    pointer("pointerdown", 2, "super");
    pointer("pointerup", 2, "super");
    button("super").click();
    button("super").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    button("super").dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", bubbles: true }));
    equal(input.actions.super, 1, "spent super must reject fresh pointer, click and keyboard input");
    update({ superUsed: false, reset: 1 });
    equal(button("super").getAttribute("aria-disabled"), null);
    pointer("pointerdown", 3, "super");
    equal(input.actions.super, 2, "a new fight restores the super");
  });
  await test("holding the real touch button charges, early release cancels, and a full hold activates once", () => {
    const match = createMatch("caracas", [
      { name: "Uno", fighter: "capriles", wins: 0 },
      { name: "Dos", fighter: "javier", wins: 0 },
    ]);
    match.phase = "playing";
    match.players[0].energy = 100;
    const other = emptyInput();
    pointer("pointerdown", 1, "super");
    equal(input.superHeld, true);
    for (let frame = 0; frame < SUPER_CHARGE_TICKS - 1; frame++) stepMatch(match, [input, other]);
    equal(match.players[0].superUsed, false);
    update({ superChargeTicks: match.players[0].superChargeTicks });
    equal(button("super").textContent?.includes(`${Math.floor((SUPER_CHARGE_TICKS - 1) / SUPER_CHARGE_TICKS * 100)}%`), true);
    pointer("pointerup", 1, "super");
    stepMatch(match, [input, other]);
    equal(match.players[0].superChargeTicks, 0);
    equal(match.players[0].energy, 100);
    pointer("pointerdown", 2, "super");
    for (let frame = 0; frame < SUPER_CHARGE_TICKS; frame++) stepMatch(match, [input, other]);
    equal(match.players[0].attack, "super");
    update({ superUsed: true, superChargeTicks: 0, energy: match.players[0].energy });
    equal(input.superHeld, false);
    equal(button("super").getAttribute("aria-disabled"), "true");
  });
  await test("accessible clicks keep the super held long enough and reset cancels that hold", async () => {
    button("super").click();
    equal(input.superHeld, true);
    await new Promise(resolve => setTimeout(resolve, 150));
    equal(input.superHeld, true, "a super must outlive the old 100ms tap timer");
    update({ reset: 1 });
    equal(input.superHeld, false);
    await new Promise(resolve => setTimeout(resolve, 100));
    equal(input.superHeld, false);
  });
  await test("accessible super holds follow charge completion and can be cancelled with another click", async () => {
    button("super").click();
    update({ superChargeTicks: 1 });
    await new Promise(resolve => setTimeout(resolve, 1200));
    equal(input.superHeld, true, "an active charge cannot expire in wall time");
    update({ superChargeTicks: 0, superUsed: true, energy: 10 });
    equal(input.superHeld, false);
    update({ superUsed: false, energy: 100 });
    button("super").click();
    update({ superChargeTicks: 1 });
    button("super").click();
    equal(input.superHeld, false, "another accessible click cancels for free");
    update({ superChargeTicks: 0 });
    button("super").click();
    update({ superChargeTicks: 1 });
    update({ superChargeTicks: 0 });
    equal(input.superHeld, false, "ending the active charge releases its virtual input");
  });
  await test("gestures can start in pad gaps; unrelated pointers cannot activate buttons", () => {
    pointer("pointermove", 50, "light");
    equal(input.actions.light, 0);
    const group = document.querySelector<HTMLElement>(".touch-directions")!;
    const r = group.getBoundingClientRect();
    let point: { clientX: number; clientY: number } | undefined;
    for (let y = r.top + 1; y < r.bottom && !point; y += 4)
      for (let x = r.left + 1; x < r.right && !point; x += 4)
        if (document.elementFromPoint(x, y) === group)
          point = { clientX: x, clientY: y };
    if (!point) throw new Error("No pad gap found");
    pointer("pointerdown", 1, null, point, group);
    equal(state().pressed, []);
    pointer("pointermove", 1, "jump");
    equal(input.actions.jump, 1);
  });
  await test("cancellation and root capture loss release only their owning finger", () => {
    pointer("pointerdown", 1, "left");
    pointer("pointerdown", 2, "block");
    pointer("lostpointercapture", 1, "left", {}, button("left"));
    equal(
      input.left,
      true,
      "implicit capture transfer from a button is harmless",
    );
    pointer("lostpointercapture", 1, null);
    equal(input.left, false);
    equal(input.block, true);
    pointer("pointermove", 1, "right");
    equal(input.right, false);
    pointer("pointercancel", 2, null);
    equal(input.block, false);
    pointer("pointerdown", 3, "light");
    equal(input.actions.light, 1);
  });
  for (const event of ["blur", "pagehide", "orientationchange"]) {
    await test(`${event} clears controls and allows the next gesture`, () => {
      pointer("pointerdown", 1, "right");
      pointer("pointerdown", 2, "block");
      flushSync(() => window.dispatchEvent(new Event(event)));
      equal(state().pressed, []);
      equal(input.right || input.block, false);
      pointer("pointermove", 1, "light");
      equal(input.actions.light, 0);
      pointer("pointerdown", 3, "jump");
      equal(input.actions.jump, 1);
    });
  }
  await test("hidden document clears held inputs", () => {
    const original = Object.getOwnPropertyDescriptor(
      document,
      "visibilityState",
    );
    pointer("pointerdown", 1, "block");
    try {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "hidden",
      });
      flushSync(() => document.dispatchEvent(new Event("visibilitychange")));
      equal(input.block, false);
    } finally {
      if (original)
        Object.defineProperty(document, "visibilityState", original);
      else Reflect.deleteProperty(document, "visibilityState");
    }
  });
  await test("reset and unmount release both fingers and keyboard holds", () => {
    pointer("pointerdown", 1, "right");
    update({ reset: 1 });
    equal(input.right, false);
    pointer("pointermove", 1, "left");
    equal(input.left, false);
    pointer("pointerdown", 2, "block");
    unmount();
    equal(input.block, false);
  });
  await test("mouse and pen primary buttons slide and recover a missed release", () => {
    for (const pointerType of ["mouse", "pen"]) {
      pointer("pointerdown", 1, "left", { pointerType, button: 2, buttons: 2 });
      equal(input.left, false);
      pointer("pointerdown", 1, "left", { pointerType, button: 0 });
      pointer("pointermove", 1, "block", { pointerType });
      equal(input.block, true);
      pointer("pointermove", 1, "block", { pointerType, buttons: 0 });
      equal(input.block, false);
    }
  });
  await test("releasing the primary mouse or pen button ends a chorded gesture", () => {
    pointer("pointerdown", 2, "right");
    for (const pointerType of ["mouse", "pen"]) {
      pointer("pointerdown", 1, "block", {
        pointerType,
        button: 0,
        buttons: 1,
      });
      pointer("pointermove", 1, "block", {
        pointerType,
        button: 2,
        buttons: 3,
      });
      equal(input.block, true, "adding a secondary button preserves the hold");
      // Pointer Events reports intermediate button releases as pointermove.
      pointer("pointermove", 1, "block", {
        pointerType,
        button: 0,
        buttons: 2,
      });
      equal(input.block, false, "primary release must end the hold");
      pointer("pointermove", 1, "light", {
        pointerType,
        button: -1,
        buttons: 2,
      });
      equal(input.actions.light, 0, "secondary-only movement cannot attack");
      pointer("pointerup", 1, "light", {
        pointerType,
        button: 2,
        buttons: 0,
      });
      equal(input.right, true, "the other finger remains held");
    }
  });
  await test("keyboard holds, repeat suppression, accessible clicks and compatibility clicks", async () => {
    const key = (type: string, repeat = false) =>
      flushSync(() =>
        button("block").dispatchEvent(
          new KeyboardEvent(type, {
            key: " ",
            code: "Space",
            repeat,
            bubbles: true,
            cancelable: true,
          }),
        ),
      );
    key("keydown");
    key("keydown", true);
    equal(input.block, true);
    key("keyup");
    equal(input.block, false);
    flushSync(() => button("light").click());
    equal(input.actions.light, 1);
    await new Promise((resolve) => setTimeout(resolve, 130));
    equal(state().pressed, []);
    pointer("pointerdown", 2, "light");
    pointer("pointerup", 2, "light");
    button("light").dispatchEvent(
      new MouseEvent("click", { detail: 1, bubbles: true }),
    );
    button("light").dispatchEvent(
      new PointerEvent("click", {
        detail: 0,
        pointerType: "touch",
        bubbles: true,
      }),
    );
    equal(input.actions.light, 2);
  });
  mount();
  return {
    userAgent: navigator.userAgent,
    passed: results.filter((r) => r.pass).length,
    total: results.length,
    results,
    layout: layout(),
  };
}
