import test from "node:test";
import assert from "node:assert/strict";
import { createElement, createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createMatch } from "../shared/engine";
import { TouchControls } from "../src/components/TouchControls";
import { VictoryScreen } from "../src/components/VictoryScreen";
import { preloadAssets } from "../src/game/assets";

test("touch definitive unlocks at two wins and still requires 90 energy", () => {
  for (const wins of [0, 1, 2, 3]) {
    for (const energy of [0, 75, 89, 90, 100]) {
      const html = renderToStaticMarkup(
        createElement(TouchControls, {
          wins,
          energy,
          reset: 0,
          onPress() {},
          onRelease() {},
        }),
      );
      const button = html.match(
        /<button\b[^>]*data-control="super"[^>]*>.*?<\/button>/,
      )?.[0];
      assert.ok(button);
      assert.equal(button.includes('disabled=""'), wins < 2 || energy < 90);
      assert.equal(button.includes("lucide-lock-keyhole"), wins < 2);
      if (wins < 2) {
        assert.ok(button.includes("Gana 2 peleas con este personaje"));
      } else if (energy < 90) {
        assert.ok(button.includes("Necesitas 90 de energía."));
      } else {
        assert.doesNotMatch(button, /aria-description=/);
      }
    }
  }
});

test("the second victory announces the definitive for either local player and the online winner", async () => {
  const assets = await preloadAssets([], []);
  for (const mode of ["local", "online"] as const) {
    for (const winner of [0, 1] as const) {
      for (const wins of [0, 1, 2, 3]) {
        const state = createMatch("caracas", [
          { name: "Uno", fighter: "zavarce", wins },
          { name: "Dos", fighter: "javier", wins },
        ]);
        state.phase = "finished";
        state.winner = winner;
        // Match configs contain the wins recorded before this victory.
        const html = renderToStaticMarkup(
          createElement(VictoryScreen, {
            state,
            mode,
            localIndex: 0,
            active: true,
            overlayRef: createRef<HTMLDivElement>(),
            sourceCanvas: createRef<HTMLCanvasElement>(),
            sourceTitle: createRef<HTMLHeadingElement>(),
            assets,
            skipTransition: true,
            onReady() {},
            onRematch() {},
            onExit() {},
          }),
        );
        const localVictory = mode === "local" || winner === 0;
        assert.equal(
          html.includes("Definitiva desbloqueada"),
          localVictory && wins === 1,
        );
        assert.equal(
          html.includes("Nuevo combo desbloqueado"),
          localVictory && wins === 0,
        );
        assert.equal(
          html.includes('class="victory-screen-unlock"'),
          localVictory && wins < 2,
        );
      }
    }
  }
});
