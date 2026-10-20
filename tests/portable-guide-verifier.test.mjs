import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
const sandbox = vm.createContext({});
vm.runInContext(await fs.readFile("docs/finales/moveset-guide/verify-portable-browser.js", "utf8"), sandbox);
const analyze = args => JSON.parse(JSON.stringify(sandbox.arenaPortableGuideVerification.analyzeSnapshots(args)));

function state(fighter, tick = 1) {
  const player = id => ({ config: { fighter: id }, x: id === fighter ? 435 : 625, y: 555, hp: 100, stocks: 2, energy: 100, attack: null, attackTick: 0, history: [], combo: "", countered: false, rootTicks: 0, slowTicks: 0 });
  return { tick, remaining: 5400 - tick, phase: "playing", players: [player(fighter), player("capriles")], effects: [], projectiles: [] };
}
function basic(fighter, move) {
  const actions = move === "combo1" ? ["light", "heavy"] : move === "combo2" ? ["light", "light", "heavy"] : [move];
  const snapshots = [state(fighter)], history = [];
  let hp = 100, id = 0;
  for (const action of actions) {
    history.push({ action, tick: snapshots.length + 1 });
    const start = state(fighter, snapshots.length + 1); start.players[0].attack = action; start.players[0].history = structuredClone(history); start.players[1].hp = hp;
    if (move === "special") start.players[0].energy = 75;
    start.players[0].combo = move; snapshots.push(start);
    const hit = structuredClone(start); hit.tick++; hit.remaining--; hit.players[0].attackTick = 1;
    hp -= action === "light" ? 7 : move === "combo1" ? 16 : move === "combo2" ? 20 : action === "heavy" ? 13 : 15;
    hit.players[1].hp = hp; hit.effects.push({ id: ++id, kind: "hit", owner: 0, impact: action }); snapshots.push(hit);
    const rest = structuredClone(hit); rest.tick++; rest.remaining--; rest.players[0].attack = null; snapshots.push(rest);
  }
  return { fighter, move, snapshots, text: { title: move } };
}
test("distinct real contacts verify light, heavy, special and both complete combos", () => {
  for (const move of ["light", "heavy", "special", "combo1", "combo2"]) {
    const row = analyze(basic("fixture", move));
    assert.equal(row.passed, true, `${move}: ${row.failures}`);
  }
  const wrongCost = basic("fixture", "special"); wrongCost.snapshots[1].players[0].energy = 80;
  assert.match(analyze(wrongCost).failures.join(" "), /activation energy/);
});
test("a missing second combo light remains a failure even with extra unrelated damage", () => {
  const input = basic("fixture", "combo2");
  const secondLight = input.snapshots[5];
  secondLight.effects = []; // HP still falls, but no real owner0 light contact occurred.
  const row = analyze(input);
  assert.equal(row.active, true); assert.equal(row.passed, false);
  assert.equal(row.connected, false); assert.equal(row.damagedOrRingout, true);
  assert.match(row.failures.join(" "), /distinct light/);
  // An extra HP delta during the first light cannot stand in for a second attack.
  const duplicate = structuredClone(input.snapshots[2]); duplicate.tick++; duplicate.remaining--; duplicate.players[1].hp--;
  input.snapshots.splice(3, 0, duplicate);
  assert.equal(analyze(input).passed, false);
});
function captured({ damage = true } = {}) {
  const fighter = "puma", snapshots = Array.from({ length: 6 }, (_, at) => state(fighter, Math.min(at + 1, 3)));
  for (let at = 1; at < snapshots.length; at++) {
    const player = snapshots[at].players[0]; player.energy = 25; player.history = [{ action: "super", tick: 2 }]; player.attack = at < 4 ? "super" : null;
  }
  for (const at of [2, 3]) snapshots[at].finale = { owner: 0, target: 1, fighter, duration: 2 };
  for (const at of [2, 3, 4]) snapshots[at].remaining = 5397;
  snapshots[3].players[1].hp = damage ? 60 : 100;
  snapshots[3].effects = [{ id: 1, kind: "hit", owner: 0, impact: "super" }];
  for (const at of [4, 5]) snapshots[at].players[1].stocks = 1;
  snapshots[5].tick = 4; snapshots[5].remaining = 5396;
  return { fighter, move: "final", snapshots, text: { effect: "Captura y golpea en 1 impacto." } };
}
test("intentional ringout passes with restored 100 HP and separately retained HP/stock minima", () => {
  const row = analyze(captured());
  assert.equal(row.passed, true, row.failures.join("; "));
  assert.equal(row.minHp, 60); assert.equal(row.finalHp, 100); assert.equal(row.minStocks, 1); assert.equal(row.stockEvents.length, 1);
  const launchOnly = analyze(captured({ damage: false }));
  assert.equal(launchOnly.passed, true, launchOnly.failures.join("; "));
  assert.equal(launchOnly.minHp, 100); assert.equal(launchOnly.connected, true);
});
test("captured finales require release and a paused clock through the release transition", () => {
  const clock = captured(); clock.snapshots[4].remaining--;
  assert.match(analyze(clock).failures.join(" "), /clock/);
  const held = captured(); held.snapshots.at(-1).finale = { ...held.snapshots[3].finale };
  assert.match(analyze(held).failures.join(" "), /release/);
  const rooted = captured(); rooted.snapshots.at(-1).players[1].rootTicks = 10;
  assert.match(analyze(rooted).failures.join(" "), /rooted/);
  const pending = captured(); pending.snapshots.at(-1).players[1].knockoutDelay = 10;
  assert.match(analyze(pending).failures.join(" "), /pending knockout/);
  assert.equal(analyze(pending).terminalReleased, false);
});
function powered({ expiryHit = false } = {}) {
  const fighter = "conde", snapshots = [state(fighter)], history = [{ action: "super", tick: 2 }];
  const start = state(fighter, 2); start.players[0].attack = "super"; start.players[0].energy = 25; start.players[0].history = structuredClone(history); snapshots.push(start);
  let hp = 100;
  for (let tick = 3; tick <= 364; tick++) {
    if (tick === 60 || tick === 363 && expiryHit) history.push({ action: "light", tick });
    if (tick === 89) history.push({ action: "heavy", tick });
    const frame = state(fighter, tick), player = frame.players[0];
    player.energy = 25; player.history = structuredClone(history);
    player.attack = tick < 40 ? "super" : tick >= 60 && tick < 64 ? "light" : tick >= 89 && tick < 94 ? "heavy" : tick >= 363 && expiryHit ? "light" : null;
    player.attackTick = tick >= 89 && tick < 94 ? tick - 89 : tick >= 60 && tick < 64 ? tick - 60 : 0;
    if (tick < 363) player.transformation = { id: "conde-bond", ticks: 363 - tick, damageMultiplier: 1.2 };
    if (tick === 61 || tick === 90 || tick === 363 && expiryHit) {
      const kind = tick === 90 ? "heavy" : "light", damage = tick === 90 ? 16 * 1.2 : tick === 61 ? 7 * 1.2 : 7;
      hp -= damage; frame.effects = [{ id: tick, kind: "hit", owner: 0, impact: kind }];
    }
    frame.players[1].hp = hp; snapshots.push(frame);
    if (tick === 62) { const pause = structuredClone(frame); pause.remaining--; snapshots.push(pause); }
  }
  return { fighter, move: "final", snapshots, baselines: Object.fromEntries(["light", "heavy", "combo1"].map(move => [`${fighter}/${move}`, analyze(basic(fighter, move))])) };
}
test("a true 360 active tick form with hitstop compares powered light and bonused combo1 heavy", () => {
  const row = analyze(powered());
  assert.equal(row.passed, true, row.failures.join("; "));
  assert.equal(row.form.activeTicks, 360); assert.equal(row.form.expired, true);
  assert.deepEqual(row.form.comparisons.map(hit => hit.baselineMove), ["light", "combo1"]);
  const expiry = analyze(powered({ expiryHit: true }));
  assert.equal(expiry.passed, true, expiry.failures.join("; "));
  assert.equal(expiry.damageEvents.at(-1).transformed, false);
});
test("early expiry, countdown during hitstop, altered multiplier and unbonused heavy are rejected", () => {
  const early = powered();
  for (const frame of early.snapshots) if (frame.tick >= 100) delete frame.players[0].transformation;
  assert.equal(analyze(early).passed, false);
  const pause = powered(), repeated = pause.snapshots.findIndex((frame, at) => at && frame.tick === pause.snapshots[at - 1].tick);
  pause.snapshots[repeated].players[0].transformation.ticks--;
  assert.equal(analyze(pause).passed, false);
  const multiplier = powered();
  for (const frame of multiplier.snapshots) if (frame.tick >= 60 && frame.players[0].transformation) frame.players[0].transformation.damageMultiplier = 1;
  assert.equal(analyze(multiplier).passed, false);
  const heavy = powered();
  for (const frame of heavy.snapshots) if (frame.tick >= 89) frame.players[0].history = [{ action: "heavy", tick: 89 }];
  assert.match(analyze(heavy).failures.join(" "), /bonused combo1/);
});
test("counter, reflection, slow and root claims require their actual combat evidence", () => {
  const counter = basic("fixture", "special"); counter.snapshots[1].players[1].attack = "heavy"; counter.text.effect = "Ventana de contraataque";
  assert.equal(analyze(counter).passed, false);
  counter.snapshots[2].players[0].countered = true;
  assert.equal(analyze(counter).passed, true);
  const reflection = basic("fixture", "special"); reflection.snapshots[1].players[1].attack = "special";
  reflection.snapshots[1].projectiles = [{ id: 10, owner: 1, kind: "test" }];
  reflection.snapshots[2].projectiles = [{ id: 10, owner: 0, kind: "test" }];
  assert.equal(analyze(reflection).passed, true);
  reflection.snapshots[2].projectiles[0].owner = 1;
  assert.equal(analyze(reflection).passed, false);
  for (const [text, field] of [["ralentiza", "slowTicks"], ["inmoviliza", "rootTicks"]]) {
    const status = basic("fixture", "special"); status.text.effect = text;
    assert.equal(analyze(status).passed, false); status.snapshots[2].players[1][field] = 12;
    assert.equal(analyze(status).passed, true);
  }
});
test("a ranged definitive must create and connect a real super projectile, then release", () => {
  const fighter = "maite", snapshots = Array.from({ length: 5 }, (_, at) => state(fighter, at + 1));
  for (let at = 1; at < snapshots.length; at++) {
    snapshots[at].players[0].energy = 25; snapshots[at].players[0].history = [{ action: "super", tick: 2 }];
    snapshots[at].players[0].attack = at < 3 ? "super" : null;
  }
  snapshots[2].projectiles = [{ id: 10, owner: 0, kind: "sonic", impact: "super" }];
  for (const at of [3, 4]) snapshots[at].players[1].hp = 60;
  snapshots[3].effects = [{ id: 11, kind: "hit", owner: 0, impact: "super" }];
  const input = { fighter, move: "final", snapshots };
  assert.equal(analyze(input).passed, true);
  snapshots[2].projectiles[0].impact = "special";
  assert.equal(analyze(input).passed, false);
});
