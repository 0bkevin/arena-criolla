// Exercises production Game and Help handlers; gamepads and lifecycle events
// are synthesized. Native keyboard activation is checked separately in-browser.
import { StrictMode, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import { Game, type GameMode } from "../../src/components/Game";
import { Help } from "../../src/components/Help";
import { createMatch, emptyInput, type Input } from "../../shared/engine";
import "../../src/styles.css";
import "../../src/lobby.css";
import "../../src/arcade-theme.css";
import "../../src/mobile-game.css";
import "../../src/ui-accessibility.css";

let root: Root | undefined;
let pads: ReturnType<typeof controller>[] = [];
let sent: Input[] = [];
let restoreGamepads: (() => void) | undefined;
const settle = () => new Promise((resolve) => setTimeout(resolve, 160));

function controller() {
  return {
    index: 0,
    connected: true,
    mapping: "standard" as const,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
}

export function unmount() {
  if (root) flushSync(() => root!.unmount());
  root = undefined;
  restoreGamepads?.();
  restoreGamepads = undefined;
}

export async function mount(mode: GameMode = "local") {
  unmount();
  pads = [];
  sent = [];
  const original = Object.getOwnPropertyDescriptor(navigator, "getGamepads");
  Object.defineProperty(navigator, "getGamepads", {
    configurable: true,
    value: () => pads,
  });
  restoreGamepads = () => {
    if (original) Object.defineProperty(navigator, "getGamepads", original);
    else Reflect.deleteProperty(navigator, "getGamepads");
  };
  const initial = createMatch("poliedro", [
    { fighter: "zavarce", name: "P1", wins: 3 },
    { fighter: "vallenilla", name: "P2", wins: 3 },
  ]);
  initial.phase = "playing";
  initial.remaining = 999_999;
  initial.players.forEach((p) => {
    p.energy = 100;
    p.invincible = 0;
  });
  const remote = { current: structuredClone(initial) };
  function Fixture() {
    const [help, setHelp] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(true);
    return (
      <div className="app-shell arcade-app in-match">
        <Game
          initial={initial}
          mode={mode}
          difficulty="normal"
          remote={remote}
          onInput={(input) => sent.push(structuredClone(input))}
          onExit={() => {}}
          onResult={() => {}}
          onRematch={() => {}}
          onHelp={() => setHelp(true)}
          soundEnabled={soundEnabled}
          onToggleSound={() => setSoundEnabled((value) => !value)}
        />
        {help && <Help onClose={() => setHelp(false)} />}
      </div>
    );
  }
  root = createRoot(document.getElementById("fixture")!);
  flushSync(() =>
    root!.render(
      <StrictMode>
        <Fixture />
      </StrictMode>,
    ),
  );
  const deadline = performance.now() + 10_000;
  while (document.querySelector(".loading-overlay")) {
    if (performance.now() > deadline)
      throw new Error("Game assets did not load");
    await settle();
  }
  window.dispatchEvent(new Event("focus"));
  document.querySelector<HTMLCanvasElement>("canvas")!.focus();
  await settle();
}

export function state() {
  return {
    input: structuredClone(sent.at(-1) ?? emptyInput()),
    paused: !!document.querySelector(".game-page.is-paused"),
    help: !!document.querySelector("dialog[open]"),
    focused: document.activeElement?.tagName,
  };
}

function key(code: string, type = "keydown", extra: KeyboardEventInit = {}) {
  const event = new KeyboardEvent(type, {
    code,
    key: code.startsWith("Key") ? code.slice(3).toLowerCase() : code,
    bubbles: true,
    cancelable: true,
    ...extra,
  });
  document.activeElement!.dispatchEvent(event);
  return event;
}

function click(selector: string) {
  const button = document.querySelector<HTMLButtonElement>(selector)!;
  button.focus();
  button.click();
}

function expect(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

export async function run() {
  const results: { name: string; pass: boolean; error?: string }[] = [];
  async function scenario(
    name: string,
    mode: GameMode,
    run: () => Promise<void>,
  ) {
    try {
      await mount(mode);
      await run();
      results.push({ name, pass: true });
    } catch (error) {
      results.push({ name, pass: false, error: String(error) });
    }
  }
  await scenario(
    "Closing help restores gameplay focus for P2 Enter",
    "local",
    async () => {
      click(".game-tools [aria-label='Ver controles']");
      await settle();
      expect(state().help, "Help did not open");
      click("dialog [aria-label='Cerrar']");
      await settle();
      expect(
        state().focused === "CANVAS",
        "P2 Enter would activate the help button",
      );
    },
  );
  await scenario(
    "Clicking sound returns focus to gameplay; keyboard activation keeps button focus",
    "local",
    async () => {
      const button = document.querySelector<HTMLButtonElement>(
        ".game-tools [aria-label='Silenciar sonido']",
      )!;
      button.focus();
      button.dispatchEvent(
        new MouseEvent("click", { bubbles: true, detail: 1 }),
      );
      await settle();
      expect(
        button.getAttribute("aria-pressed") === "false",
        "Sound did not toggle",
      );
      expect(
        state().focused === "CANVAS",
        "P2 Enter would toggle sound instead of dodging",
      );
      button.focus();
      button.click(); // Keyboard/assistive activation has detail 0.
      await settle();
      expect(
        document.activeElement === button,
        "Keyboard activation lost button focus",
      );
      expect(
        button.getAttribute("aria-pressed") === "true",
        "Keyboard activation did not toggle sound",
      );
    },
  );
  await scenario(
    "A fresh attack in the first frame after resume is accepted",
    "online",
    async () => {
      const pad = controller();
      pads = [pad];
      await settle();
      key("Escape");
      key("Escape", "keyup");
      await settle();
      key("Escape");
      key("Escape", "keyup");
      pad.buttons[2].pressed = true;
      await settle();
      expect(!state().paused, "Game did not resume");
      expect(
        state().input.actions.light === 1,
        "Fresh attack after resume was discarded",
      );
      await settle();
      expect(
        state().input.actions.light === 1,
        "Holding the new attack repeated it",
      );
    },
  );
  await scenario(
    "Ctrl, Meta, Alt and IME input do not attack or cancel browser shortcuts",
    "online",
    async () => {
      for (const extra of [
        { ctrlKey: true },
        { metaKey: true },
        { altKey: true },
        { isComposing: true },
        { keyCode: 229, key: "Process", isComposing: false },
      ]) {
        const event = key("KeyJ", "keydown", extra);
        expect(!event.defaultPrevented, "Browser shortcut was cancelled");
        key("KeyJ", "keyup", extra);
      }
      await settle();
      expect(state().input.actions.light === 0, "A shortcut generated a punch");
    },
  );
  await scenario(
    "Keyup still releases a gameplay key with modifiers or editable focus",
    "online",
    async () => {
      key("KeyD");
      await settle();
      expect(state().input.right, "Movement did not start");
      const input = document.createElement("input");
      document.body.append(input);
      input.focus();
      key("KeyD", "keyup", { ctrlKey: true });
      input.remove();
      await settle();
      expect(!state().input.right, "Direction stayed held");
    },
  );
  await scenario(
    "Visible online blur keeps the controller neutral until focus returns",
    "online",
    async () => {
      const pad = controller();
      pads = [pad];
      pad.axes[0] = 1;
      await settle();
      expect(state().input.right, "Stick did not start movement");
      window.dispatchEvent(new Event("blur"));
      key("KeyJ");
      await settle();
      expect(
        !state().input.right && state().input.actions.light === 0,
        "Unfocused game sent controls",
      );
      window.dispatchEvent(new Event("focus"));
      await settle();
      expect(state().input.right, "Focus did not restore movement");
    },
  );
  await scenario(
    "Start pauses and resumes once per fresh press",
    "local",
    async () => {
      const pad = controller();
      pads = [pad];
      pad.buttons[9].pressed = true;
      await settle();
      expect(state().paused, "Start did not pause");
      await settle();
      expect(state().paused, "Holding Start toggled pause repeatedly");
      pad.buttons[9].pressed = false;
      await settle();
      pad.buttons[9].pressed = true;
      await settle();
      expect(!state().paused, "Start did not resume");
      expect(
        state().focused === "CANVAS",
        "Resume did not restore gameplay focus",
      );
    },
  );
  await scenario(
    "Attacks held in pause require release before firing after resume",
    "online",
    async () => {
      const pad = controller();
      pads = [pad];
      key("Escape");
      key("Escape", "keyup");
      await settle();
      pad.buttons[2].pressed = true;
      await settle();
      key("Escape");
      key("Escape", "keyup");
      await settle();
      expect(
        state().input.actions.light === 0,
        "A paused press became a punch",
      );
      pad.buttons[2].pressed = false;
      await settle();
      pad.buttons[2].pressed = true;
      await settle();
      expect(
        state().input.actions.light === 1,
        "Fresh press did not work after resume",
      );
    },
  );
  await scenario(
    "Fresh Start immediately after keyboard pause is accepted",
    "local",
    async () => {
      const pad = controller();
      pads = [pad];
      await settle();
      key("Escape");
      key("Escape", "keyup");
      pad.buttons[9].pressed = true;
      await settle();
      expect(
        !state().paused,
        "A fresh Start between animation frames was swallowed",
      );
      await mount("online");
      const resumedPad = controller();
      pads = [resumedPad];
      await settle();
      window.dispatchEvent(new Event("blur"));
      resumedPad.buttons[9].pressed = true;
      window.dispatchEvent(new Event("focus"));
      key("Escape");
      key("Escape", "keyup");
      await settle();
      expect(
        state().paused,
        "Keyboard pause rearmed Start first held while unfocused",
      );
    },
  );
  await scenario(
    "Paused attacks stay disarmed across disconnect and reconnect",
    "online",
    async () => {
      const pad = controller();
      pads = [pad];
      await settle();
      key("Escape");
      key("Escape", "keyup");
      pad.buttons[2].pressed = true;
      await settle();
      pads = [];
      await settle();
      key("Escape");
      key("Escape", "keyup");
      await settle();
      pads = [pad];
      await settle();
      expect(
        state().input.actions.light === 0,
        "Reconnection replayed a paused attack",
      );
      pad.buttons[2].pressed = false;
      await settle();
      pad.buttons[2].pressed = true;
      await settle();
      expect(
        state().input.actions.light === 1,
        "A fresh post-reconnect attack was lost",
      );
    },
  );
  await scenario(
    "Start under help cannot toggle pause or activate on closing help",
    "online",
    async () => {
      const pad = controller();
      pads = [pad];
      click(".game-tools [aria-label='Ver controles']");
      await settle();
      pad.buttons[9].pressed = true;
      await settle();
      expect(
        state().help && !state().paused,
        "Start affected the underlying game",
      );
      click("dialog [aria-label='Cerrar']");
      await settle();
      expect(!state().paused, "A held Start toggled pause after help closed");
    },
  );
  await mount();
  return results;
}
