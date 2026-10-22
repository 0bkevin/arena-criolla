import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import { ArenaEntrance } from "../../src/components/ArenaEntrance";
import "../../src/styles.css";

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

type Readiness = { ready: boolean; fontsReady: boolean };
type Timer = { at: number; callback: () => void };
let running = false;

/** Production component and handlers; time, image events, and motion are controlled. */
export async function run() {
  check(!running, "The loading screen audit is already running");
  running = true;
  const fixture = document.getElementById("fixture");
  check(fixture, "The loading screen fixture is missing");
  const originalTimeout = window.setTimeout;
  const originalClear = window.clearTimeout;
  const originalMatchMedia = window.matchMedia;
  const originalAdd = EventTarget.prototype.addEventListener;
  const originalRemove = EventTarget.prototype.removeEventListener;
  const timers = new Map<number, Timer>();
  const keyboardListeners = new Map<
    EventTarget,
    Set<EventListenerOrEventListenerObject>
  >();
  let nextTimer = 0;
  let now = 0;
  let root: Root | undefined;
  let reduced = false;
  let controlledImageEvent = false;
  let calls: boolean[] = [];
  let readiness: Readiness = { ready: true, fontsReady: true };
  let reducedStyle: HTMLStyleElement | undefined;
  const scenarios: string[] = [];
  const complete = (restoreFocus: boolean) => calls.push(restoreFocus);
  const completionCount = () => calls.length;
  const screen = () => fixture.querySelector(".arena-entrance");
  const playing = () => screen()?.classList.contains("is-playing");
  const leaving = () => screen()?.classList.contains("is-leaving");
  const listenerCount = () =>
    [...keyboardListeners.values()].reduce((sum, set) => sum + set.size, 0);
  const blockUncontrolledImages = (event: Event) => {
    if (
      !controlledImageEvent &&
      event.target instanceof HTMLImageElement &&
      fixture.contains(event.target)
    )
      event.stopImmediatePropagation();
  };

  try {
    // Native image events must not race the deliberately missing/delayed cases.
    document.addEventListener("load", blockUncontrolledImages, true);
    document.addEventListener("error", blockUncontrolledImages, true);
    window.setTimeout = ((
      handler: TimerHandler,
      delay = 0,
      ...args: unknown[]
    ) => {
      check(typeof handler === "function", "String timers are unsupported");
      const id = ++nextTimer;
      timers.set(id, {
        at: now + Math.max(0, Number(delay) || 0),
        callback: () => handler(...args),
      });
      return id;
    }) as typeof window.setTimeout;
    window.clearTimeout = (id) => {
      if (typeof id === "number") timers.delete(id);
      else originalClear(id);
    };
    window.matchMedia = (query) => {
      const media = originalMatchMedia.call(window, query);
      if (query === "(prefers-reduced-motion: reduce)")
        Object.defineProperty(media, "matches", { get: () => reduced });
      return media;
    };
    EventTarget.prototype.addEventListener = function (
      type,
      callback,
      options,
    ) {
      if (
        type === "keydown" &&
        callback &&
        (this === window || this === document)
      ) {
        const listeners = keyboardListeners.get(this) ?? new Set();
        listeners.add(callback);
        keyboardListeners.set(this, listeners);
      }
      originalAdd.call(this, type, callback, options);
    };
    EventTarget.prototype.removeEventListener = function (
      type,
      callback,
      options,
    ) {
      if (type === "keydown" && callback)
        keyboardListeners.get(this)?.delete(callback);
      originalRemove.call(this, type, callback, options);
    };

    const advance = (duration: number) => {
      const target = now + duration;
      let executed = 0;
      while (true) {
        const due = [...timers.entries()]
          .filter(([, timer]) => timer.at <= target)
          .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!due) break;
        check(++executed < 1000, "The component scheduled a timer loop");
        timers.delete(due[0]);
        now = due[1].at;
        flushSync(due[1].callback);
      }
      now = target;
    };
    const unmount = () => {
      if (root) flushSync(() => root!.unmount());
      root = undefined;
      check(timers.size === 0, "Unmount leaked loading screen timers");
      check(listenerCount() === 0, "Unmount leaked a global keyboard listener");
    };
    const render = (update: Partial<Readiness> = {}) => {
      readiness = { ...readiness, ...update };
      flushSync(() =>
        root!.render(
          <StrictMode>
            <ArenaEntrance {...readiness} onComplete={complete} />
          </StrictMode>,
        ),
      );
    };
    const mount = (initial: Partial<Readiness> = {}) => {
      unmount();
      calls = [];
      now = 0;
      readiness = { ready: true, fontsReady: true, ...initial };
      root = createRoot(fixture);
      render();
    };
    const imageEvents = (type: "load" | "error") => {
      controlledImageEvent = true;
      try {
        flushSync(() => {
          for (const image of fixture.querySelectorAll(
            ".arena-entrance-fighter img",
          ))
            image.dispatchEvent(new Event(type));
        });
      } finally {
        controlledImageEvent = false;
      }
    };
    const escape = () => {
      if (document.activeElement instanceof HTMLElement)
        document.activeElement.blur();
      check(document.activeElement === document.body, "BODY must own focus");
      flushSync(() =>
        document.body.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        ),
      );
    };

    mount({ fontsReady: false });
    imageEvents("load");
    check(!playing(), "The animation started before entrance fonts settled");
    advance(3000);
    check(!playing(), "The animation ran while entrance fonts were pending");
    check(
      completionCount() === 0,
      "Pending fonts allowed premature completion",
    );
    render({ fontsReady: true });
    check(playing(), "Ready art and fonts must start the animation together");
    advance(2199);
    check(!leaving(), "Delayed fonts shortened the visible intro");
    advance(1);
    check(leaving(), "The playback clock must start when the animation starts");
    advance(360);
    check(completionCount() === 1, "The delayed-font intro must complete once");
    scenarios.push("delayed-font playback clock");

    mount();
    imageEvents("load");
    escape();
    check(leaving(), "Escape from initial BODY focus must skip a ready intro");
    advance(360);
    check(
      completionCount() === 1 && !calls[0],
      "BODY Escape must complete once",
    );
    scenarios.push("BODY Escape after readiness");

    mount({ ready: false, fontsReady: false });
    imageEvents("load");
    escape();
    advance(100);
    check(
      !leaving() && completionCount() === 0,
      "Escape bypassed font readiness",
    );
    render({ fontsReady: true });
    escape();
    const disabledSkip = fixture.querySelector<HTMLButtonElement>(
      ".arena-entrance-skip",
    )!;
    flushSync(() => disabledSkip.click());
    advance(100);
    check(
      disabledSkip.disabled && !leaving() && completionCount() === 0,
      "Escape or disabled skip bypassed application readiness",
    );
    render({ ready: true });
    escape();
    advance(360);
    check(completionCount() === 1, "Escape must work after readiness changes");
    scenarios.push("Escape and button readiness gates");

    mount();
    imageEvents("error");
    check(
      [
        ...fixture.querySelectorAll<HTMLImageElement>(
          ".arena-entrance-fighter img",
        ),
      ].every(
        (image) => image.hidden && getComputedStyle(image).display === "none",
      ),
      "Failed illustrations must not leave broken-image glyphs",
    );
    check(playing(), "Illustration errors must settle art readiness");
    advance(10000);
    check(completionCount() === 1, "Missing illustrations blocked completion");
    scenarios.push("missing-art error recovery");

    mount();
    advance(899);
    check(!playing(), "The delayed-art fixture must still be preparing");
    advance(1);
    check(playing(), "Delayed illustrations exceeded the art deadline");
    advance(10000);
    check(
      completionCount() === 1,
      "The art deadline failed to release the intro",
    );
    scenarios.push("delayed-art deadline");

    mount({ ready: false });
    imageEvents("load");
    advance(10000);
    check(completionCount() === 0, "The intro exited before the app was ready");
    render({ ready: true });
    advance(360);
    check(
      completionCount() === 1,
      "A ready app did not release the finished intro",
    );
    scenarios.push("application readiness after animation");

    mount();
    imageEvents("load");
    const skip = fixture.querySelector<HTMLButtonElement>(
      ".arena-entrance-skip",
    )!;
    skip.focus();
    flushSync(() => skip.click());
    flushSync(() => skip.click());
    flushSync(() =>
      skip.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      ),
    );
    advance(10000);
    render();
    advance(10000);
    check(
      calls.length === 1,
      "Repeated skip or rerender duplicated completion",
    );
    check(calls[0], "Keyboard-focused skip must request focus restoration");
    scenarios.push("exactly-once skip completion");

    for (const phase of ["preparing", "playing", "leaving"] as const) {
      mount();
      if (phase !== "preparing") imageEvents("load");
      advance(phase === "leaving" ? 2200 : 400);
      unmount();
      advance(10000);
      check(
        completionCount() === 0,
        `${phase}: unmount allowed a late callback`,
      );
    }
    scenarios.push("timer and keyboard cleanup across unmount phases");

    // The preview API cannot emulate this OS preference. Apply the production
    // media-rule declarations and matchMedia branch together, explicitly.
    reduced = true;
    reducedStyle = document.createElement("style");
    reducedStyle.textContent = [...document.styleSheets]
      .flatMap((sheet) => [...sheet.cssRules])
      .filter(
        (rule): rule is CSSMediaRule =>
          rule instanceof CSSMediaRule &&
          rule.conditionText.includes("prefers-reduced-motion: reduce"),
      )
      .flatMap((rule) => [...rule.cssRules].map((entry) => entry.cssText))
      .join("\n");
    check(reducedStyle.textContent.length > 0, "Reduced-motion CSS is missing");
    document.head.append(reducedStyle);
    mount();
    advance(0);
    check(
      calls.length === 1,
      "Reduced motion must not wait for an illustration",
    );
    check(
      fixture.getAnimations({ subtree: true }).length === 0 &&
        getComputedStyle(fixture.querySelector(".arena-entrance-brand")!)
          .opacity === "1" &&
        getComputedStyle(fixture.querySelector(".arena-entrance-impact")!)
          .opacity === "0",
      "Reduced motion must preserve a readable static composition",
    );
    scenarios.push("controlled reduced-motion policy simulation");
    unmount();
    return { pass: true, scenarios };
  } finally {
    if (root) flushSync(() => root!.unmount());
    reducedStyle?.remove();
    document.removeEventListener("load", blockUncontrolledImages, true);
    document.removeEventListener("error", blockUncontrolledImages, true);
    window.setTimeout = originalTimeout;
    window.clearTimeout = originalClear;
    window.matchMedia = originalMatchMedia;
    EventTarget.prototype.addEventListener = originalAdd;
    EventTarget.prototype.removeEventListener = originalRemove;
    running = false;
  }
}
