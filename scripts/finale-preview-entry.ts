import {
  BUILT_IN_FIGHTERS,
  fighterById,
  type FighterId,
} from "../shared/content";
import { createMatch, type MatchState } from "../shared/engine";
import { finaleById } from "../shared/finales";
import { preloadAssets } from "../src/game/assets";
import { renderMatch, type Assets } from "../src/game/renderer";
import {
  initAudio,
  setSound,
  syncFinaleMusic,
  stopFinaleMusic,
} from "../src/audio";

const canvas = document.querySelector<HTMLCanvasElement>("#arena")!;
const ctx = canvas.getContext("2d")!;
const fighter = document.querySelector<HTMLSelectElement>("#fighter")!;
const rival = document.querySelector<HTMLSelectElement>("#rival")!;
const side = document.querySelector<HTMLSelectElement>("#side")!;
const status = document.querySelector<HTMLElement>("#status")!;
const paused = document.querySelector<HTMLButtonElement>("#pause")!;
const sound = document.querySelector<HTMLInputElement>("#sound")!;
const reduce = document.querySelector<HTMLInputElement>("#reduce")!;
const roster = document.querySelector<HTMLElement>("#roster")!;
let assets: Assets | undefined;
let state: MatchState;
let elapsed = 0;
let previous = performance.now();
let request = 0;
let generation = 0;
let selectedAt = 0;

function setPaused(value: boolean) {
  paused.setAttribute("aria-pressed", String(value));
  paused.textContent = value ? "Continuar" : "Pausar";
  previous = performance.now();
  if (value) stopFinaleMusic();
}

function updateDamage() {
  const scene = state.finale;
  if (!scene) return;
  const profile = finaleById(scene.fighter)!;
  const drains = profile.damageBeats.filter(
    (beat) => scene.tick >= beat,
  ).length;
  state.players[scene.target].hp =
    100 - (scene.damage * drains) / profile.damageBeats.length;
}

for (const definition of BUILT_IN_FIGHTERS) {
  for (const select of [fighter, rival])
    select.add(new Option(definition.name, definition.id));
  const button = document.createElement("button");
  const name = document.createElement("strong");
  name.textContent = definition.name;
  button.append(
    name,
    document.createTextNode(finaleById(definition.id)!.title),
  );
  button.dataset.fighter = definition.id;
  button.onclick = () => {
    fighter.value = definition.id;
    void selectScene();
  };
  roster.append(button);
}
fighter.value = "capriles";
rival.value = "nacho";

async function selectScene() {
  const current = ++generation;
  const id = fighter.value as FighterId;
  const other = rival.value as FighterId;
  const owner = Number(side.value) as 0 | 1;
  assets = undefined;
  stopFinaleMusic();
  status.textContent = "Cargando personajes y utilería…";
  const profile = finaleById(id)!;
  document.querySelector("#scene-title")!.textContent = profile.title;
  document.querySelector("#description")!.textContent = profile.description;
  for (const button of roster.querySelectorAll("button"))
    button.setAttribute("aria-pressed", String(button.dataset.fighter === id));
  try {
    const loaded = await preloadAssets([id, other], ["caracas"]);
    if (current !== generation) return;
    assets = loaded;
    state = createMatch("caracas", [
      {
        name:
          owner === 0
            ? fighterById(id).shortName
            : fighterById(other).shortName,
        fighter: owner === 0 ? id : other,
        wins: 3,
      },
      {
        name:
          owner === 1
            ? fighterById(id).shortName
            : fighterById(other).shortName,
        fighter: owner === 1 ? id : other,
        wins: 3,
      },
    ]);
    state.phase = "playing";
    state.tick = ++selectedAt;
    state.finale = {
      owner,
      target: owner === 0 ? 1 : 0,
      fighter: id,
      startedTick: selectedAt,
      tick: 0,
      duration: profile.duration,
      x: 540,
      y: 555,
      direction: owner === 0 ? 1 : -1,
      initialHp: 100,
      damage: (28 * fighterById(id).damage + 12) * fighterById(other).armor,
    };
    elapsed = 0;
    status.textContent = `${fighterById(id).name} contra ${fighterById(other).name} · 3 victorias · 75 de energía`;
    (window as unknown as { finaleGallery: unknown }).finaleGallery = {
      state,
      assets,
      renderAt(tick: number) {
        const at = Number.isFinite(tick)
          ? Math.max(0, Math.min(state.finale!.duration - 1, Math.floor(tick)))
          : 0;
        setPaused(true);
        elapsed = (at * 1000) / 60;
        state.finale!.tick = at;
        updateDamage();
        renderMatch(ctx, state, loaded, elapsed, reduce.checked);
      },
      selectScene,
    };
  } catch (error) {
    if (current === generation)
      status.textContent = `No se pudo cargar la escena. ${error instanceof Error ? error.message : ""}`;
    console.error(error);
  }
}

function animate(now: number) {
  const delta = Math.min(80, now - previous);
  previous = now;
  if (assets && state.finale) {
    if (paused.getAttribute("aria-pressed") !== "true" && !document.hidden)
      elapsed += delta;
    const timeline = Math.floor((elapsed * 60) / 1000 + 1e-6);
    const duration = state.finale.duration;
    state.finale.tick = Math.min(duration - 1, timeline % (duration + 45));
    updateDamage();
    renderMatch(ctx, state, assets, now, reduce.checked);
    syncFinaleMusic(
      state.finale,
      !sound.checked ||
        paused.getAttribute("aria-pressed") === "true" ||
        document.hidden ||
        timeline % (duration + 45) >= duration,
    );
  }
  request = requestAnimationFrame(animate);
}
for (const select of [fighter, rival, side])
  select.onchange = () => void selectScene();
document.querySelector<HTMLButtonElement>("#replay")!.onclick = () => {
  elapsed = 0;
  if (state.finale) state.finale.startedTick = ++selectedAt;
  stopFinaleMusic();
};
paused.onclick = () => {
  const active = paused.getAttribute("aria-pressed") !== "true";
  setPaused(active);
};
sound.onchange = () => {
  setSound(sound.checked);
  if (sound.checked) initAudio();
  else stopFinaleMusic();
};
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopFinaleMusic();
});
window.addEventListener("pagehide", () => {
  cancelAnimationFrame(request);
  stopFinaleMusic();
});
setSound(false);
void selectScene();
request = requestAnimationFrame(animate);
