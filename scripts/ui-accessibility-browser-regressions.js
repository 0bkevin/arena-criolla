// Start the isolated scripts/journey-qa-server.ts, open its lobby in a separate
// collaborative browser tab, then evaluate:
// await import('/scripts/ui-accessibility-browser-regressions.js');
// await window.runUiAdversarialReview(). Uses the real React
// components and event handlers; server simulation snapshots are controlled
// at Game's existing remote/initial prop boundary. No paid provider is used.
import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { Game } from "../src/components/Game";
import { Help } from "../src/components/Help";
import { createMatch } from "../shared/engine";
import { INTRO_TOTAL_TICKS } from "../shared/presentation";
import "../src/styles.css";
import "../src/lobby.css";
import "../src/arcade-theme.css";
import "../src/creator.css";
import "../src/mobile-game.css";
import "../src/ui-accessibility.css";

// Leave the running app mounted in its own hidden root, with no active match.
// Never create a second React root on the app's existing DOM container.
const appRoot = document.getElementById("root");
appRoot.id = "arena-app-before-regressions";
appRoot.hidden = true;
const fixtureRoot = document.createElement("div");
fixtureRoot.id = "root";
document.body.append(fixtureRoot);
const root = createRoot(fixtureRoot);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const until = async (predicate, timeout = 6000) => {
  const end = performance.now() + timeout;
  while (!predicate()) {
    if (performance.now() > end) throw new Error("UI regression timed out");
    await wait(20);
  }
};
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const query = (selector) => {
  const element = document.querySelector(selector);
  assert(element, `Missing ${selector}`);
  return element;
};
const pointerClick = (selector) => {
  const element = query(selector);
  element.focus();
  element.click();
};
const key = (code, options = {}) => {
  const event = new KeyboardEvent("keydown", {
    code,
    key: code === "Space" ? " " : code,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  (document.activeElement || window).dispatchEvent(event);
  return event;
};
const release = (code) =>
  (document.activeElement || window).dispatchEvent(
    new KeyboardEvent("keyup", { code, bubbles: true, cancelable: true }),
  );
const unmount = async () => {
  flushSync(() => root.render(null));
  await wait(30);
};

async function mountGame({
  mode = "local",
  phase = "playing",
  touch = false,
} = {}) {
  await unmount();
  const originalMatchMedia = window.matchMedia;
  if (touch)
    window.matchMedia = (query) => {
      const media = originalMatchMedia.call(window, query);
      return query === "(pointer: coarse)"
        ? new Proxy(media, {
            get(target, property) {
              if (property === "matches") return true;
              const value = Reflect.get(target, property, target);
              return typeof value === "function" ? value.bind(target) : value;
            },
          })
        : media;
    };
  const initial = createMatch("caracas", [
    { fighter: "zavarce", name: "Adversarial P1", wins: 3 },
    { fighter: "javier", name: "Adversarial P2", wins: 3 },
  ]);
  initial.phase = phase;
  initial.tick = phase === "intro" ? 0 : INTRO_TOTAL_TICKS;
  if (phase === "finished") initial.winner = 0;
  const remote = { current: structuredClone(initial) };
  let help = false;
  let soundEnabled = true;
  const events = [];
  const render = () =>
    flushSync(() =>
      root.render(
        React.createElement(
          React.StrictMode,
          null,
          React.createElement(
            "div",
            { className: "app-shell arcade-app in-match" },
            React.createElement(Game, {
              key: initial.id,
              initial,
              mode,
              difficulty: "easy",
              remote,
              onInput: () => {},
              onExit: () => events.push("exit"),
              onResult: () => events.push("result"),
              onRematch: () => events.push("rematch"),
              onHelp: () => {
                help = true;
                render();
              },
              soundEnabled,
              onToggleSound: () => {
                soundEnabled = !soundEnabled;
                events.push("sound");
                render();
              },
            }),
            help &&
              React.createElement(Help, {
                onClose: () => {
                  help = false;
                  render();
                },
              }),
          ),
        ),
      ),
    );
  render();
  await until(() => document.querySelector(".game-page"));
  await until(() => !document.querySelector(".loading-overlay"));
  return {
    remote,
    events,
    cleanup: async () => {
      await unmount();
      window.matchMedia = originalMatchMedia;
    },
  };
}

window.runUiAdversarialReview = async () => {
  const results = [];
  const run = async (name, options, test) => {
    let fixture;
    try {
      fixture = await mountGame(options);
      await test(fixture);
      results.push({ name, pass: true });
    } catch (error) {
      results.push({ name, pass: false, error: error.message });
    } finally {
      if (fixture) await fixture.cleanup();
      else await unmount();
    }
  };
  await run("resume returns keyboard control to the arena", {}, async () => {
    pointerClick('.game-tools [aria-label="Pausar"]');
    await until(() => document.querySelector(".pause-card"));
    pointerClick(".pause-card .primary-button");
    await until(() => !document.querySelector(".pause-card"));
    assert(
      document.activeElement === query(".arena-canvas"),
      `Resume retained focus on ${document.activeElement.getAttribute("aria-label")}`,
    );
    const enter = key("Enter");
    assert(
      enter.defaultPrevented,
      "P2 Enter was not handled as a gameplay key",
    );
    release("Enter");
  });
  await run("held Enter cannot activate the new pause action", {}, async () => {
    key("Escape");
    release("Escape");
    await until(() => document.querySelector(".pause-card"));
    assert(
      document.activeElement === query(".pause-card .primary-button"),
      "Pause missing initial focus",
    );
    const repeated = key("Enter", { repeat: true });
    assert(
      repeated.defaultPrevented,
      "Repeated Enter is allowed to activate Continue natively",
    );
    release("Enter");
  });
  await run(
    "held Enter cannot activate the new rematch action",
    { phase: "finished" },
    async ({ events }) => {
      await until(() => document.querySelector(".result-card"), 9000);
      await until(
        () =>
          document.activeElement ===
          document.querySelector(".result-info .primary-button"),
      );
      const repeated = key("Enter", { repeat: true });
      assert(
        repeated.defaultPrevented,
        "Repeated Enter is allowed to activate Rematch natively",
      );
      release("Enter");
      assert(
        !events.includes("rematch"),
        "Rematch was activated without a fresh press",
      );
    },
  );
  await run(
    "remote phase changes preserve focus within an unchanged pause",
    { mode: "online", phase: "intro" },
    async ({ remote }) => {
      key("Escape");
      release("Escape");
      await until(() => document.querySelector(".pause-card"));
      const exit = query(".pause-card > .secondary-button");
      exit.focus();
      remote.current = {
        ...remote.current,
        phase: "playing",
        tick: INTRO_TOTAL_TICKS,
      };
      await until(() => query(".game-page").dataset.phase === "playing");
      await wait(60);
      assert(
        document.activeElement === exit,
        "Remote phase change stole focus from Exit",
      );
    },
  );
  await run(
    "touch pause includes reachable sound, Help and Fullscreen actions",
    { touch: true },
    async ({ events }) => {
      key("Escape");
      release("Escape");
      await until(() => document.querySelector(".pause-card"));
      const help = document.querySelector(
        '.pause-card [aria-label="Ver controles"]',
      );
      const fullscreen = document.querySelector(
        '.pause-card [aria-label="Pantalla completa"]',
      );
      assert(
        help && fullscreen,
        "Help and Fullscreen are outside the modal keyboard region",
      );
      pointerClick('.pause-card [aria-label="Silenciar sonido"]');
      await until(() =>
        document.querySelector('.pause-card [aria-label="Activar sonido"]'),
      );
      assert(
        events.includes("sound") &&
          query('.pause-card [aria-label="Activar sonido"]').getAttribute(
            "aria-pressed",
          ) === "false",
        "The pause sound control did not toggle the current audio state",
      );
      pointerClick('.pause-card [aria-label="Ver controles"]');
      await until(() => document.querySelector("dialog[open]"));
      pointerClick('dialog [aria-label="Cerrar"]');
      await until(() => !document.querySelector("dialog"));
      assert(
        document.activeElement === help,
        "Nested Help did not restore focus to its pause action",
      );
      const container = document.getElementById("root");
      const originalFullscreen = container.requestFullscreen;
      let requested = false;
      container.requestFullscreen = async () => {
        requested = true;
      };
      try {
        pointerClick('.pause-card [aria-label="Pantalla completa"]');
        await until(() => requested);
      } finally {
        container.requestFullscreen = originalFullscreen;
      }
    },
  );
  return { pass: results.every((result) => result.pass), results };
};

window.uiAdversarialFixture = { mountGame, key, release, until };

// Begin in landscape, resize the collaborative tab to portrait, then call the
// finish function. This exercises a foreground change under a native dialog.
window.beginUiNestedOrientationRegression = async () => {
  const fixture = await mountGame({ mode: "online", touch: true });
  key("Escape");
  release("Escape");
  await until(() => document.querySelector(".pause-card"));
  pointerClick('.pause-card [aria-label="Ver controles"]');
  await until(() => document.querySelector("dialog[open]"));
  window.nestedOrientationFixture = fixture;
  return { helpOpen: true };
};
window.finishUiNestedOrientationRegression = async () => {
  const fixture = window.nestedOrientationFixture;
  try {
    await until(() => document.querySelector(".orientation-gate"));
    pointerClick('dialog [aria-label="Cerrar"]');
    await until(() => !document.querySelector("dialog"));
    const focus = document.activeElement;
    return {
      pass: Boolean(focus.closest(".orientation-gate")),
      focusedLabel: focus.getAttribute("aria-label") || focus.innerText,
      inOrientation: Boolean(focus.closest(".orientation-gate")),
    };
  } finally {
    await fixture.cleanup();
    delete window.nestedOrientationFixture;
  }
};

// Run after resizing the browser to a portrait viewport.
window.runUiOrientationRegression = async () => {
  assert(innerHeight > innerWidth, "This check needs a portrait viewport");
  const fixture = await mountGame({
    mode: "online",
    phase: "intro",
    touch: true,
  });
  try {
    await until(() => document.querySelector(".orientation-gate"));
    const exit = query(".orientation-card > .text-button");
    exit.focus();
    fixture.remote.current = {
      ...fixture.remote.current,
      phase: "playing",
      tick: INTRO_TOTAL_TICKS,
    };
    await until(() => query(".game-page").dataset.phase === "playing");
    await wait(60);
    assert(
      document.activeElement === exit,
      "Remote phase change stole orientation focus",
    );
    const repeated = key("Enter", { repeat: true });
    assert(
      repeated.defaultPrevented,
      "Held Enter can activate orientation action",
    );
    release("Enter");
    return { pass: true, preservedFocus: true, repeatPrevented: true };
  } finally {
    await fixture.cleanup();
  }
};
