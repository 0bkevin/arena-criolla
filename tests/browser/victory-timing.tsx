import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import { Game } from "../../src/components/Game";
import { setSound } from "../../src/audio";
import { preloadAssets } from "../../src/game/assets";
import { createMatch, emptyInput, stepMatch } from "../../shared/engine";
import "../../src/styles.css";
import "../../src/lobby.css";
import "../../src/arcade-theme.css";
import "../../src/mobile-game.css";
import "../../src/ui-accessibility.css";
import "../../src/victory-screen.css";

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

let running = false;

/** Exercise production Game with controlled frame timing and actual modal DOM. */
export async function run() {
  check(!running, "The victory timing audit is already running");
  running = true;
  let root: Root | undefined;
  let dialog: HTMLDialogElement | undefined;
  const originalRAF = window.requestAnimationFrame;
  const originalCancel = window.cancelAnimationFrame;
  const originalNow = Object.getOwnPropertyDescriptor(performance, "now");
  const originalHidden = Object.getOwnPropertyDescriptor(document, "hidden");
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  let now = 0;
  let hidden = false;
  const results: string[] = [];
  const screen = () => document.querySelector(".victory-screen");
  try {
    setSound(false);
    await preloadAssets(["zavarce", "javier"], ["caracas"]);
    window.requestAnimationFrame = (callback) => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    };
    window.cancelAnimationFrame = (id) => frames.delete(id);
    Object.defineProperty(performance, "now", {
      configurable: true,
      value: () => now,
    });
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => hidden,
    });
    const frame = async (delta: number) => {
      now += delta;
      const callbacks = [...frames.values()];
      frames.clear();
      flushSync(() => callbacks.forEach((callback) => callback(now)));
      await Promise.resolve();
    };
    const advance = async (duration: number, interval: number) => {
      for (let left = duration; left > 0; left -= interval)
        await frame(Math.min(left, interval));
    };
    for (const mode of ["local", "online", "practice"] as const) {
      for (const scenario of ["normal", "slow", "hidden", "dialog"] as const) {
        now = 0;
        let resultCount = 0;
        const initial = createMatch("caracas", [
          { name: "Uno", fighter: "zavarce", wins: 3 },
          { name: "Dos", fighter: "javier", wins: 3 },
        ]);
        initial.phase = "playing";
        initial.players.forEach((player, index) =>
          Object.assign(player, {
            x: 400 + index * 80,
            y: 554,
            grounded: true,
            facing: index === 0 ? 1 : -1,
            invincible: 0,
          }),
        );
        Object.assign(initial.players[1], { hp: 1, stocks: 1 });
        const inputs = [emptyInput(), emptyInput()] as const;
        inputs[0].actions.heavy++;
        for (let tick = 0; tick < 60 && initial.winner === null; tick++)
          stepMatch(initial, [...inputs]);
        check(
          initial.winner === 0,
          "The fixture must end with a real knockout",
        );
        const snapshot = JSON.stringify(initial);
        root = createRoot(document.getElementById("fixture")!);
        flushSync(() =>
          root!.render(
            <StrictMode>
              <div className="app-shell arcade-app">
                <Game
                  initial={initial}
                  mode={mode}
                  difficulty="easy"
                  remote={mode === "online" ? { current: initial } : undefined}
                  localIndex={0}
                  onExit={() => {}}
                  onRematch={() => {}}
                  onHelp={() => {}}
                  onResult={() => {
                    resultCount++;
                  }}
                  soundEnabled={false}
                />
              </div>
            </StrictMode>,
          ),
        );
        for (let attempts = 0; frames.size === 0 && attempts < 20; attempts++)
          await new Promise((resolve) => setTimeout(resolve, 0));
        check(frames.size > 0, "The production game must finish loading");
        await frame(0);
        check(
          !screen(),
          `${mode}/${scenario}: the result appeared immediately`,
        );
        const interval = scenario === "normal" ? 16 : 500;
        if (scenario === "hidden" || scenario === "dialog") {
          await frame(500);
          if (scenario === "hidden") {
            hidden = true;
            document.dispatchEvent(new Event("visibilitychange"));
          } else {
            dialog = document.createElement("dialog");
            document.body.append(dialog);
            dialog.showModal();
          }
          await Promise.resolve();
          now += 10000; // A hidden/blocked tab need not receive any RAF callback.
          if (scenario === "hidden") {
            hidden = false;
            document.dispatchEvent(new Event("visibilitychange"));
          } else {
            dialog!.close();
            dialog!.remove();
            dialog = undefined;
          }
          await Promise.resolve();
          await advance(1499, interval);
        } else await advance(1999, interval);
        check(
          !screen(),
          `${mode}/${scenario}: the hold ended before two active seconds`,
        );
        await frame(1);
        check(
          screen(),
          `${mode}/${scenario}: the result is missing after two active seconds`,
        );
        check(
          resultCount === 1,
          `${mode}/${scenario}: result callback must fire once`,
        );
        check(
          document.querySelectorAll(".victory-screen-stars path").length === 7,
          "The result must have seven stars",
        );
        check(
          JSON.stringify(initial) === snapshot,
          "Presentation must not mutate the decided match",
        );
        flushSync(() => root!.unmount());
        root = undefined;
        check(
          frames.size === 0,
          `${mode}/${scenario}: unmount leaked frame callbacks`,
        );
        results.push(`${mode}/${scenario}`);
      }
    }
    return { pass: true, scenarios: results };
  } finally {
    if (root) flushSync(() => root!.unmount());
    dialog?.close();
    dialog?.remove();
    window.requestAnimationFrame = originalRAF;
    window.cancelAnimationFrame = originalCancel;
    if (originalNow) Object.defineProperty(performance, "now", originalNow);
    else Reflect.deleteProperty(performance, "now");
    if (originalHidden)
      Object.defineProperty(document, "hidden", originalHidden);
    else Reflect.deleteProperty(document, "hidden");
    running = false;
  }
}
