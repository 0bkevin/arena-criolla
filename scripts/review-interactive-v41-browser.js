// Browser-only adversarial driver: ordinary DOM and keyboard events, read-only
// inspection of the live Game ref. It never changes simulation state.
import { fighterById, stageById } from "/shared/content.ts";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, label, timeout = 20_000) {
  const end = performance.now() + timeout;
  while (performance.now() < end) {
    const result = check();
    if (result) return result;
    await delay(30);
  }
  throw new Error(`Timed out: ${label}`);
}
function click(selector) {
  const element = document.querySelector(selector);
  if (!element || element.disabled) throw new Error(`Unavailable: ${selector}`);
  element.click();
}
function type(selector, value) {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Missing field: ${selector}`);
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}
export function liveState() {
  const node = document.querySelector(".game-page");
  let fiber = node?.[Object.keys(node).find((key) => key.startsWith("__reactFiber"))];
  while (fiber) {
    if (fiber.type?.name === "Game") {
      let hook = fiber.memoizedState;
      while (hook) {
        const current = hook.memoizedState?.current;
        if (current?.players && current?.phase) return current;
        hook = hook.next;
      }
    }
    fiber = fiber.return;
  }
  throw new Error("Live Game ref is unavailable");
}
function key(code, down) {
  window.dispatchEvent(new KeyboardEvent(down ? "keydown" : "keyup", { code, key: code, bubbles: true }));
}
function tap(code) { key(code, true); key(code, false); }
export async function exitMatch() {
  if (!document.querySelector(".game-page")) return;
  document.querySelector('button[aria-label="Continuar pelea"]')?.click();
  const back = [...document.querySelectorAll("button")].find((button) => button.getAttribute("aria-label") === "Volver a la selección");
  if (!back) throw new Error("No exit control");
  back.click();
  await until(() => document.querySelector("#player-name"), "return to selection");
}
async function choose(id, side, mode) {
  click(`button[aria-label="Elegir luchador para ${side === 0 ? "P1" : mode === "local" ? "P2" : "CPU"}"]`);
  if (!document.querySelector('input[aria-label="Buscar luchador"]')) click('button[aria-label="Buscar luchador"]');
  await until(() => document.querySelector('input[aria-label="Buscar luchador"]'), "fighter search mounted");
  type('input[aria-label="Buscar luchador"]', fighterById(id).name);
  await delay(50);
  click(`button[aria-label="Elegir a ${fighterById(id).name}"]`);
  await delay(40);
}
export async function setupMatch({ fighter, rival, side = 0, stage, mode = "practice", difficulty = "normal" }) {
  await exitMatch();
  const label = mode === "local" ? "Con un pana" : "Pelea rápida";
  const tab = [...document.querySelectorAll('[role="tab"]')].find((b) => b.textContent.includes(label));
  tab.click();
  await delay(50);
  await choose(side === 0 ? fighter : rival, 0, mode);
  await choose(side === 1 ? fighter : rival, 1, mode);
  click(`button[aria-label="Elegir escenario ${stageById(stage).name}"]`);
  type("#player-name", "QA adversarial P1");
  if (mode === "local") type("#second-name", "QA adversarial P2");
  else {
    const names = { easy: "Suave", normal: "Normal", hard: "Candela" };
    const button = [...document.querySelectorAll('[aria-label="Dificultad del CPU"] button')].find((b) => b.textContent.includes(names[difficulty]));
    button.click();
  }
  await delay(70);
  click("button.arcade-start");
  await until(() => document.querySelector('.game-page[data-phase="intro"]'), "intro");
  const first = liveState();
  if (first.stage !== stage || first.players[side].config.fighter !== fighter) throw new Error("Wrong selected matchup");
  await until(() => document.querySelector('.game-page[data-phase="playing"]'), "playing after complete intro");
  return { matchId: liveState().id, stage, fighter, rival, side, mode, difficulty };
}
export async function exercise(config) {
  const side = config.side ?? 0;
  const map = side === 0
    ? { left: "KeyA", right: "KeyD", jump: "KeyW", block: "KeyU", dash: "ShiftLeft", light: "KeyJ", heavy: "KeyK", special: "KeyL" }
    : { left: "ArrowLeft", right: "ArrowRight", jump: "ArrowUp", block: "Numpad0", dash: "NumpadDecimal", light: "Numpad1", heavy: "Numpad2", special: "Numpad3" };
  const initial = structuredClone(liveState()), samples = [], started = new Set(), observed = new Set();
  let minX = initial.players[side].x, maxX = minX, minY = initial.players[side].y;
  const sample = () => {
    const s = liveState(), p = s.players[side];
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y);
    if (p.attack) started.add(p.attack);
    for (const h of p.history) observed.add(h.action);
    if (!s.players.every((v) => [v.x, v.y, v.vx, v.vy, v.hp, v.energy, v.stocks].every(Number.isFinite))) throw new Error("Non-finite live state");
    samples.push({ tick: s.tick, x: p.x, y: p.y, hp: p.hp, energy: p.energy, attack: p.attack, hits: p.hits, facing: p.facing });
  };
  let failure;
  const timer = setInterval(() => { try { sample(); } catch (e) { failure = String(e); } }, 65);
  const hold = async (control, ms) => { key(map[control], true); await delay(ms); key(map[control], false); };
  const act = async (control, ms = 600) => { tap(map[control]); await delay(ms); };
  try {
    // First special is attempted while separated, before an aggressive CPU can
    // prevent every startup. Later attempts deliberately occur in close combat.
    await act("special", 1700);
    await hold(liveState().players[1-side].x > liveState().players[side].x ? "right" : "left", 420);
    await act("jump", 140); await act("jump", 140); await act("jump", 700);
    await hold("block", 350);
    await act("light", 400); await act("heavy", 650);
    await act("dash", 400);
    for (let i = 0; i < 3; i++) {
      const s = liveState(), p = s.players[side], other = s.players[1-side];
      if (s.phase !== "playing") break;
      if (Math.abs(p.x-other.x) > 95) await hold(other.x > p.x ? "right" : "left", 300);
      await act(i === 1 ? "special" : i === 0 ? "light" : "heavy", 650);
    }
    // Blur must release all held sources; resuming must not teleport the fighter.
    key(map.right, true); await delay(100); window.dispatchEvent(new Event("blur"));
    await delay(120);
    const paused = Boolean(document.querySelector('button[aria-label="Continuar pelea"]'));
    document.querySelector('button[aria-label="Continuar pelea"]')?.click();
    key(map.right, false); await delay(650); sample();
    const final = structuredClone(liveState()), p = final.players[side];
    const report = { ...config, matchId: final.id, phase: final.phase, ticks: final.tick-initial.tick,
      observations: { started: [...started], history: [...observed], minX, maxX, minY, blurPaused: paused, hp: p.hp, rivalHp: final.players[1-side].hp, hits: p.hits, stocks: p.stocks, lastActions: p.lastActions, samples },
      assets: performance.getEntriesByType("resource").filter((r) => r.name.includes(`/assets/${config.fighter}-`)).map((r) => new URL(r.name).pathname),
      assertions: { finite: !failure, moved: maxX-minX>30, jumped: minY<initial.players[side].y-20, specialStarted: started.has("special") || observed.has("special"), actionsReceived: p.lastActions.light>0 && p.lastActions.heavy>0 && p.lastActions.jump>=2 } };
    if (failure) report.failure = failure;
    (window.__adversarialV41 ??= []).push(report);
    return report;
  } finally {
    clearInterval(timer);
    for (const code of Object.values(map)) key(code, false);
  }
}

export async function exerciseWithResistance(config) {
  const side = 1 - (config.side ?? 0);
  const map = side === 0
    ? { left: "KeyA", right: "KeyD", light: "KeyJ", heavy: "KeyK", special: "KeyL", jump: "KeyW" }
    : { left: "ArrowLeft", right: "ArrowRight", light: "Numpad1", heavy: "Numpad2", special: "Numpad3", jump: "ArrowUp" };
  let turn = 0;
  const timer = config.mode === "local" ? setInterval(() => {
    let state;
    try { state = liveState(); } catch { return; }
    if (state.phase !== "playing") return;
    const player = state.players[side], rival = state.players[1 - side], dx = rival.x - player.x;
    key(map.left, false); key(map.right, false);
    if (Math.abs(dx) > 95) key(dx > 0 ? map.right : map.left, true);
    turn++;
    if (turn > 3 && !player.stun && !player.attack) {
      if (turn % 9 === 0 && player.energy >= 25) tap(map.special);
      else if (turn % 5 === 0) tap(map.heavy);
      else if (turn % 3 === 0) tap(map.light);
    }
    if (turn % 11 === 0) tap(map.jump);
  }, 180) : null;
  try {
    const report = await exercise(config);
    return { ...report, resistingLocalOpponent: Boolean(timer) };
  } finally {
    clearInterval(timer);
    Object.values(map).forEach((code) => key(code, false));
  }
}

// Start without awaiting in preview_evaluate (its transport has a 15s deadline),
// then read window.__run41. The exercise begins immediately after the intro;
// a fast CPU cannot finish an idle match between two separate tool calls.
export function startInteractiveReview(config) {
  window.__run41 = { config, status: "setup", startedAt: Date.now() };
  void setupMatch(config).then(() => {
    window.__run41.status = "playing";
    return exerciseWithResistance(config);
  }).then((report) => {
    window.__run41 = { ...window.__run41, status: "done", report };
    if (report.phase === "playing") document.querySelector('button[aria-label="Pausar"]')?.click();
  }).catch((error) => {
    window.__run41 = { ...window.__run41, status: "error", error: String(error) };
  });
  return { started: true, config };
}
