import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Game } from "../src/components/Game";
import { createMatch } from "../shared/engine";

function renderScreen(
  touch: boolean,
  width: number,
  height: number,
  touchPoints = touch ? 1 : 0,
) {
  const values = {
    innerWidth: width,
    innerHeight: height,
    matchMedia: () => ({ matches: touch }),
    screen: { width: 1920, height: 1080 },
  };
  const saved = new Map(
    Object.keys(values).map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  const points = Object.getOwnPropertyDescriptor(navigator, "maxTouchPoints");
  try {
    for (const [key, value] of Object.entries(values))
      Object.defineProperty(globalThis, key, { configurable: true, value });
    Object.defineProperty(navigator, "maxTouchPoints", {
      configurable: true,
      value: touchPoints,
    });
    const initial = createMatch(
      "caracas",
      [
        { name: "Pana", fighter: "zavarce", wins: 0 },
        { name: "CPU", fighter: "javier", wins: 0 },
      ],
      "match-screen-test",
    );
    initial.phase = "playing";
    return renderToStaticMarkup(
      createElement(Game, {
        initial,
        mode: "practice",
        difficulty: "normal",
        onExit() {},
        onResult() {},
        onRematch() {},
        onHelp() {},
      }),
    );
  } finally {
    if (points) Object.defineProperty(navigator, "maxTouchPoints", points);
    else Reflect.deleteProperty(navigator, "maxTouchPoints");
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}

test("small keyboard windows keep keyboard help without rendering a touch pad", () => {
  for (const [width, height] of [
    [320, 568],
    [568, 320],
    [1280, 320],
  ]) {
    const screen = renderScreen(false, width, height);
    assert.match(screen, /class="game-controls-bar"/);
    assert.doesNotMatch(screen, /class="touch-controls"/);
  }
});

test("touchscreen laptops retain touch controls without entering the mobile layout", () => {
  const screen = renderScreen(false, 568, 320, 10);
  assert.match(screen, /class="touch-controls"/);
  assert.doesNotMatch(screen, /game-page[^\"]*is-touch/);
});

test("landscape touch screens retain their complete control pad", () => {
  for (const [width, height] of [
    [320, 240],
    [568, 320],
    [1024, 768],
  ]) {
    const screen = renderScreen(true, width, height);
    assert.match(screen, /class="touch-controls"/);
    assert.equal((screen.match(/data-control=/g) || []).length, 10);
  }
});
