import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Game } from "../src/components/Game";
import { createMatch } from "../shared/engine";
import { finaleById } from "../shared/finales";
import type { BuiltInFighterId } from "../shared/content";

function renderScreen(
  touch: boolean,
  width: number,
  height: number,
  touchPoints = touch ? 1 : 0,
  finale?: BuiltInFighterId,
  remaining?: number,
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
    if (remaining !== undefined) initial.remaining = remaining;
    if (finale) {
      const profile = finaleById(finale)!;
      initial.finale = {
        owner: 0,
        target: 1,
        fighter: finale,
        startedTick: 12,
        tick: 60,
        duration: profile.duration,
        x: 450,
        y: 554,
        direction: 1,
        damage: 30,
        initialHp: 100,
      };
    }
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

test("the match clock shows minutes until 99 seconds remain", () => {
  for (const [remaining, label] of [
    [120 * 60, "2 min"],
    [100 * 60, "2 min"],
    [99 * 60 + 1, "2 min"],
    [99 * 60, "99"],
    [98 * 60 + 1, "99"],
    [9 * 60, "09"],
    [61, "02"],
    [60, "01"],
    [1, "01"],
    [0, "00"],
  ] as const) {
    for (const [touch, width, height] of [
      [false, 1280, 800],
      [false, 320, 568],
      [true, 844, 390],
    ] as const) {
      const html = renderScreen(
        touch,
        width,
        height,
        touch ? 1 : 0,
        undefined,
        remaining,
      );
      const minutesClass =
        label === "2 min" ? ' class="match-clock-minutes"' : "";
      assert.ok(
        html.includes(
          `<div class="match-clock"><strong${minutesClass}>${label}</strong></div>`,
        ),
        `clock at ${remaining} ticks and ${width}px should display only ${label}`,
      );
      assert.equal((html.match(/class="stock-hearts"/g) ?? []).length, 2);
    }
  }
});

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

test("finales retain the normal HUD, keyboard help and touch pad layout", () => {
  for (const fighter of ["capriles", "nacho", "giuseppe"] as const) {
    for (const touch of [false, true]) {
      const screen = renderScreen(touch, 844, 390, touch ? 1 : 0, fighter);
      assert.match(screen, /class="match-hud"/);
      assert.equal((screen.match(/class="health-track"/g) || []).length, 2);
      assert.match(screen, /class="game-controls-bar"/);
      assert.match(screen, /class="arena-wrap"/);
      if (touch) assert.match(screen, /class="touch-controls"/);
    }
  }
});

test("Nacho's finale has no embedded video or YouTube player on any game layout", () => {
  for (const [width, height] of [
    [1280, 800],
    [844, 390],
    [390, 844],
  ]) {
    for (const touch of [false, true]) {
      const screen = renderScreen(touch, width, height, touch ? 1 : 0, "nacho");
      assert.doesNotMatch(
        screen,
        /<iframe\b|<video\b|nacho-finale-clip|youtube(?:-nocookie)?\.com/i,
      );
      assert.match(screen, /class="match-hud"/);
      assert.match(screen, /class="arena-wrap"/);
    }
  }
});
