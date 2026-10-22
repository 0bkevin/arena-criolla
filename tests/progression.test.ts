import test from "node:test";
import assert from "node:assert/strict";
import { createElement, createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createMatch } from "../shared/engine";
import { TouchControls } from "../src/components/TouchControls";
import { VictoryScreen } from "../src/components/VictoryScreen";

test("touch definitive is available from zero wins and still requires 90 energy", () => {
  for (const wins of [0, 1, 2, 3]) {
    for (const energy of [0, 75, 89, 90, 100]) {
      const html = renderToStaticMarkup(
        createElement(TouchControls, {
          wins,
          energy,
          superUsed: false,
          reset: 0,
          onPress() {},
          onRelease() {},
        }),
      );
      const button = html.match(
        /<button\b[^>]*data-control="super"[^>]*>.*?<\/button>/,
      )?.[0];
      assert.ok(button);
      assert.equal(
        button.includes('aria-disabled="true"'),
        energy < 90,
      );
      assert.doesNotMatch(button, /\sdisabled=/);
      assert.ok(!button.includes("lucide-lock-keyhole"));
      assert.ok(!button.includes("Gana"));
      if (energy < 90) {
        assert.ok(button.includes("Necesitas 90 de energía."));
      } else {
        assert.ok(
          button.includes(
            "Mantén pulsado 0,8 segundos para cargar.",
          ),
        );
      }
    }
  }
});

test("victories never announce combo unlocks for either local player or the online winner", () => {
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
            onReady() {},
            onRematch() {},
            onExit() {},
          }),
        );
        assert.equal(
          html.includes("Definitiva desbloqueada"),
          false,
        );
        assert.equal(
          html.includes("Nuevo combo desbloqueado"),
          false,
        );
        assert.equal(
          html.includes('class="victory-screen-unlock"'),
          false,
        );
      }
    }
  }
});
