import { StrictMode, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import { createMatch } from "../../shared/engine";
import { Game } from "../../src/components/Game";
import { Help } from "../../src/components/Help";
import { App } from "../../src/App";
import { loadInterfaceFonts } from "../../src/fonts";
import { setSound } from "../../src/audio";
import "../../src/styles.css";
import "../../src/lobby.css";
import "../../src/arcade-theme.css";
import "../../src/mobile-game.css";
import "../../src/ui-accessibility.css";
import "../../src/victory-screen.css";
import "../../src/desktop-controls.css";

let root: Root | undefined;
let restoreDevice: (() => void) | undefined;
let exits = 0;
let rematches = 0;
const settle = () => new Promise((resolve) => setTimeout(resolve, 100));

async function prepareFonts() {
  const loading = loadInterfaceFonts();
  await loading.ready;
  loading.activateInterface();
}

export function unmount() {
  if (root) flushSync(() => root!.unmount());
  root = undefined;
  restoreDevice?.();
  restoreDevice = undefined;
}

/** Production Game and Help; only the initial match/device state is controlled. */
export async function mount(
  view: "playing" | "victory" | "draw",
  touch = false,
) {
  unmount();
  exits = 0;
  rematches = 0;
  setSound(false);
  const originalTouch = Object.getOwnPropertyDescriptor(
    navigator,
    "maxTouchPoints",
  );
  const originalWidth = Object.getOwnPropertyDescriptor(screen, "width");
  const originalHeight = Object.getOwnPropertyDescriptor(screen, "height");
  const originalFocus = Object.getOwnPropertyDescriptor(document, "hasFocus");
  Object.defineProperty(navigator, "maxTouchPoints", {
    configurable: true,
    value: touch ? 5 : 0,
  });
  Object.defineProperty(screen, "width", {
    configurable: true,
    value: touch ? 390 : 1440,
  });
  Object.defineProperty(screen, "height", {
    configurable: true,
    value: touch ? 844 : 900,
  });
  Object.defineProperty(document, "hasFocus", {
    configurable: true,
    value: () => true,
  });
  restoreDevice = () => {
    for (const [target, property, descriptor] of [
      [navigator, "maxTouchPoints", originalTouch],
      [screen, "width", originalWidth],
      [screen, "height", originalHeight],
      [document, "hasFocus", originalFocus],
    ] as const) {
      if (descriptor) Object.defineProperty(target, property, descriptor);
      else Reflect.deleteProperty(target, property);
    }
  };
  await prepareFonts();
  const initial = createMatch("caracas", [
    { fighter: "zavarce", name: "Jugador uno", wins: 0 },
    { fighter: "javier", name: "Jugador dos", wins: 0 },
  ]);
  initial.phase = view === "playing" ? "playing" : "finished";
  initial.winner = view === "playing" ? null : view === "draw" ? "draw" : 0;
  initial.remaining = 7200;
  function Fixture() {
    const [help, setHelp] = useState(false);
    return (
      <div className="app-shell arcade-app in-match">
        <Game
          initial={initial}
          mode="local"
          difficulty="normal"
          soundEnabled={false}
          onToggleSound={() => {}}
          onExit={() => {
            exits += 1;
          }}
          onRematch={() => {
            rematches += 1;
          }}
          onResult={() => {}}
          onHelp={() => setHelp(true)}
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
  const deadline = performance.now() + 10000;
  while (
    document.querySelector(".loading-overlay") ||
    (view !== "playing" &&
      !document.querySelector('.victory-screen[aria-hidden="false"]'))
  ) {
    if (performance.now() > deadline)
      throw new Error("Overlay did not become ready");
    await settle();
  }
  await settle();
  return state();
}

export function state() {
  return {
    exits,
    rematches,
    focused: document.activeElement?.textContent?.trim(),
  };
}

/** Cover the actual App transition, including the original roster trigger. */
export async function runRosterNavigation() {
  unmount();
  await prepareFonts();
  root = createRoot(document.getElementById("fixture")!);
  flushSync(() =>
    root!.render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  );
  await settle();
  const expect = (condition: unknown, message: string) => {
    if (!condition) throw new Error(message);
  };
  const activate = (button: HTMLButtonElement) => {
    expect(button, "Required dialog control is missing");
    button.focus();
    button.click();
  };
  try {
    const opener = [
      ...document.querySelectorAll<HTMLButtonElement>(
        ".site-header nav button",
      ),
    ].find((button) => button.textContent === "Luchadores")!;
    activate(opener);
    await settle();
    const roster = document.querySelector<HTMLDialogElement>(
      'dialog[aria-label="Luchadores"]',
    )!;
    const fighter = roster.querySelectorAll<HTMLButtonElement>(
      ".roster-grid button",
    )[20];
    fighter.scrollIntoView({ block: "center" });
    await settle();
    const scrollTop = roster.scrollTop;
    activate(fighter);
    await settle();
    expect(
      document.querySelectorAll("dialog[open]").length === 2,
      "Opening details discarded the roster",
    );
    const detail = [
      ...document.querySelectorAll<HTMLDialogElement>("dialog[open]"),
    ].at(-1)!;
    activate(detail.querySelector<HTMLButtonElement>('[aria-label="Cerrar"]')!);
    await settle();
    expect(
      document.activeElement === fighter,
      "Closing details did not restore the fighter button",
    );
    expect(
      Math.abs(roster.scrollTop - scrollTop) < 1,
      "Closing details lost the roster scroll position",
    );
    expect(
      document.body.style.position === "fixed",
      "Closing details unlocked the roster background",
    );
    activate(roster.querySelector<HTMLButtonElement>('[aria-label="Cerrar"]')!);
    await settle();
    expect(
      document.activeElement === opener,
      "Closing the roster did not restore its opener",
    );
    expect(
      document.body.style.position !== "fixed",
      "Closing the final dialog left scrolling locked",
    );
    activate(opener);
    await settle();
    activate(document.querySelector<HTMLButtonElement>(".roster-grid button")!);
    await settle();
    const nextDetail = [
      ...document.querySelectorAll<HTMLDialogElement>("dialog[open]"),
    ].at(-1)!;
    activate(nextDetail.querySelector<HTMLButtonElement>(".primary-button")!);
    await settle();
    expect(
      document.querySelectorAll("dialog[open]").length === 0,
      "Choosing a fighter left a dialog open",
    );
    expect(
      document.body.style.position !== "fixed",
      "Choosing a fighter left scrolling locked",
    );
    return {
      pass: true,
      scenarios: [
        "detail returns focus and scroll to roster",
        "final close restores page",
        "selection closes both dialogs",
      ],
    };
  } finally {
    unmount();
  }
}
