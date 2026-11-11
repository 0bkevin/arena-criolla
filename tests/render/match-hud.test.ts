import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MatchHud } from "../../src/components/match/MatchHud";
import { createMatch } from "../../shared/engine/engine";

test("the HUD keeps health below the fall cutoff visibly below 10 in either seat", () => {
  for (const [hp, expected] of [
    [0, "0"],
    [0.01, "0.1"],
    [1.234, "1.2"],
    [7.199999999999999, "7.2"],
    [7.776, "7.8"],
    [9.99, "9.9"],
    [10, "10"],
    [10.001, "11"],
    [100, "100"],
  ] as const) {
    const view = createMatch("caracas", [
      { name: "A", fighter: "zavarce", wins: 0 },
      { name: "B", fighter: "javier", wins: 0 },
    ]);
    view.players.forEach((player) => (player.hp = hp));
    const html = renderToStaticMarkup(
      createElement(MatchHud, { view, location: "Caracas" }),
    );
    assert.equal(
      html.split(`<span>${expected}</span>`).length - 1,
      2,
      `${hp} HP: both health labels show ${expected}`,
    );
  }
});
