import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createMatch } from "../shared/engine";
import { SuperMeter } from "../src/components/SuperMeter";
import { SUPER_CHARGE_TICKS } from "../shared/content";

test("the meter exposes charge progress separately from stored energy", () => {
  const state = createMatch("caracas", [
    { name: "Uno", fighter: "capriles", wins: 0 },
    { name: "Dos", fighter: "javier", wins: 0 },
  ]);
  const player = state.players[0];
  player.energy = 95;
  player.superChargeTicks = SUPER_CHARGE_TICKS / 2;
  const html = renderToStaticMarkup(
    createElement(SuperMeter, { player, tick: 100 }),
  );
  assert.match(html, /aria-label="Carga de la definitiva"/);
  assert.match(html, /aria-valuenow="50"/);
  assert.match(html, /Cargando 50%/);
  assert.match(html, /width:95%/);
});

test("interruption feedback expires, while a spent definitive always keeps its used explanation", () => {
  const state = createMatch("caracas", [
    { name: "Uno", fighter: "capriles", wins: 0 },
    { name: "Dos", fighter: "javier", wins: 0 },
  ]);
  const player = state.players[0];
  player.superChargeInterruptedTick = 10;
  const render = (tick: number) =>
    renderToStaticMarkup(createElement(SuperMeter, { player, tick }));
  assert.match(render(20), /Carga interrumpida/);
  assert.match(render(20), /Corte: −15/);
  assert.doesNotMatch(render(100), /Carga interrumpida|Corte:/);
  assert.match(render(100), /0,8 segundos/);
  player.superUsed = true;
  assert.match(render(20), /Ya usaste la definitiva/);
  assert.doesNotMatch(render(20), /conservas el uso/);
});
