import { BUILT_IN_FIGHTERS, fighterById, type FighterId } from "../../../shared/content";
import type { MatchState } from "../../../shared/engine";
import { simulateMoveDemo, demoRivalFor as rivalFor, type GuideMove as Move } from "./simulation";
import { finaleById } from "../../../shared/finales";
import { TECHNIQUES } from "../../../shared/techniques";
import { preloadAssets } from "../../../src/game/assets";
import { renderMatch, type Assets } from "../../../src/game/renderer";
import descriptions from "./descriptions.json";

const moves: Move[] = ["light", "heavy", "combo1", "combo2", "special", "final"];
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const select = $<HTMLSelectElement>("fighter"), search = $<HTMLInputElement>("search");
const range = $<HTMLInputElement>("timeline"), playButton = $<HTMLButtonElement>("play");
const canvas = $<HTMLCanvasElement>("arena"), context = canvas.getContext("2d")!;
const source = document.createElement("canvas"); source.width = 1080; source.height = 640;
const sourceContext = source.getContext("2d")!;
let selected: FighterId = "capriles", mode: Move = "final", assets: Assets | undefined;
let states: MatchState[] = [], at = 0, playing = false, generation = 0, last = 0, accumulated = 0;
let filtered = [...BUILT_IN_FIGHTERS];
const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const titleFor = (id: FighterId, move: Move) => {
  const f = fighterById(id);
  return move === "light" ? "Golpe ligero" : move === "heavy" ? "Golpe fuerte" : move === "combo1" ? f.combos[0] : move === "combo2" ? f.combos[1] : move === "special" ? f.special : finaleById(id)!.title;
};
for (const f of BUILT_IN_FIGHTERS) {
  if (!(f.ability in descriptions.specials) || !(f.id in descriptions.finals)) throw Error(`Falta la descripción de ${f.id}`);
}

function describe() {
  const f = fighterById(selected), final = finaleById(selected)!;
  $("character-name").textContent = f.name;
  $("character-style").textContent = f.title;
  $("move-title").textContent = titleFor(selected, mode);
  $("rival").textContent = fighterById(rivalFor(selected)).name;
  let effect = "", visual = "", requirement = "", keys = "";
  if (mode === "light") {
    keys = "J"; requirement = "Disponible desde el inicio · sin coste de energía";
    effect = "Ataque corto y rápido. Hace menos daño que el fuerte y permite preparar una cadena de golpes.";
    visual = "El personaje pasa brevemente por guardia y extiende el puño. Un arco claro marca el golpe.";
  } else if (mode === "heavy") {
    keys = "K"; requirement = "Disponible desde el inicio · sin coste de energía";
    effect = "Ataque más lento, con mayor alcance, daño y empuje que el ligero.";
    visual = "El personaje prepara y extiende una patada. Un arco dorado más ancho acompaña el impacto.";
  } else if (mode === "combo1" || mode === "combo2") {
    const second = mode === "combo2";
    keys = second ? "J → J → K" : "J → K";
    requirement = second ? "Se desbloquea con 1 victoria · sin coste de energía" : "Disponible desde el inicio · sin coste de energía";
    effect = second ? "Encadena dos ligeros y un fuerte. La secuencia añade 7 de daño al remate antes de aplicar la armadura rival." : "Encadena un ligero y un fuerte. La secuencia añade 3 de daño al remate antes de aplicar la armadura rival.";
    visual = second ? "Dos extensiones del puño seguidas de una patada; aparece el rótulo del combo al iniciar el remate." : "Una extensión del puño seguida de una patada; el rótulo del combo aparece al iniciar el remate.";
    effect += " Deja acabar cada golpe y completa la secuencia en 2,5 segundos.";
  } else if (mode === "special") {
    keys = "L";
    requirement = `${f.specialUnlockWins ? `${f.specialUnlockWins} victorias · ` : ""}25 de energía${TECHNIQUES[f.ability].requiresGround ? " · requiere estar en el suelo" : ""}`;
    [effect, visual] = descriptions.specials[f.ability as keyof typeof descriptions.specials];
  } else {
    keys = "I"; requirement = `3 victorias · 75 de energía · ${final.duration / 60} segundos`;
    effect = final.mode === "transformation"
      ? `Se transforma sin necesitar un rival cercano. Durante ${final.duration / 60} segundos de combate sus ataques hacen un ${Math.round((final.empowerment!.damageMultiplier - 1) * 100)} % más de daño. El combate continúa: la demostración conecta ataques reales y termina al volver a su atuendo habitual.`
      : final.mode === "projectile"
        ? "Lanza una onda sonora que viaja por la arena y hace daño una sola vez al tocar al rival. Se puede bloquear de frente, saltar o dejar pasar fuera de alcance. El reloj y el combate continúan; fallar también consume energía."
        : `Captura a un rival cercano y le quita vida en ${final.damageBeats.length} ${final.damageBeats.length === 1 ? "impacto" : "impactos"}. Antes del contacto se puede evitar alejándose o bloqueando. Durante la definitiva se pausan el reloj y el resto del combate.`;
    visual = descriptions.finals[selected as keyof typeof descriptions.finals];
  }
  $("keys").textContent = keys;
  $("requirement").textContent = requirement;
  $("effect").textContent = effect;
  $("visual").textContent = visual;
  $("alias").textContent = mode === "final" ? `Combo asociado a la definitiva: «${f.combos[2]}».` : "";
  $("alias").hidden = mode !== "final";
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-move]")) button.setAttribute("aria-pressed", String(button.dataset.move === mode));
  $("prev").setAttribute("aria-label", "Ver personaje anterior");
  $("next").setAttribute("aria-label", "Ver personaje siguiente");
}

function pause() { playing = false; playButton.textContent = "Reproducir"; playButton.setAttribute("aria-pressed", "false"); }
function paint() {
  if (!assets || !states.length) return;
  const state = states[at];
  renderMatch(sourceContext, state, assets, at / 60 * 1000, false);
  context.clearRect(0, 0, canvas.width, canvas.height);
  // Ranged waves and the caravan need the full travel lane and tall artwork.
  // Keep the production camera; widen only the guide's post-render crop.
  if (mode === "final" && (finaleById(selected)?.mode === "projectile" || selected === "mcm" || selected === "lorenzo" || selected === "bolivar" || selected === "dudamel"))
    context.drawImage(source, 0, 72, 1080, 568, 0, 0, canvas.width, canvas.height);
  else if (mode === "final" && selected === "ali")
    context.drawImage(source, 100, 177, 880, 880 * 410 / 780, 0, 0, canvas.width, canvas.height);
  else context.drawImage(source, 150, 210, 780, 410, 0, 0, canvas.width, canvas.height);
  range.value = String(at);
  $("time").textContent = `${(at / 60).toFixed(1)} / ${((states.length - 1) / 60).toFixed(1)} s`;
  const hp = Math.max(0, state.players[1].hp);
  $<HTMLMeterElement>("rival-hp").value = hp;
  $("hp-value").textContent = `${Math.round(hp)} / 100`;
  const stocks = state.players[1].stocks;
  $("stocks-value").textContent = `${stocks} ${stocks === 1 ? "vida" : "vidas"}`;
  const status = state.players[0].transformation ? `${finaleById(selected)!.title} · ${(state.players[0].transformation.ticks / 60).toFixed(1)} s · +${Math.round((state.players[0].transformation.damageMultiplier - 1) * 100)} % de daño` : state.players[1].rootTicks > 0 ? "Rival inmovilizado" : state.players[1].slowTicks > 0 ? "Rival ralentizado" : state.players[0].countered ? "Contraataque conectado" : "";
  $("combat-status").textContent = status;
  $("poster").hidden = true;
}
async function loadDemo(options: { autoplay?: boolean; poster?: boolean } = {}) {
  pause(); const current = ++generation;
  describe(); $("load-status").textContent = "Preparando la vista de combate…";
  $("retry").hidden = true;
  playButton.disabled = true; range.disabled = true;
  $<HTMLButtonElement>("restart").disabled = true;
  try {
    const loaded = await preloadAssets([selected, rivalFor(selected)], ["caracas"]);
    await Promise.all([document.fonts.load('800 22px "Barlow Condensed"'), document.fonts.load('700 13px "DM Sans"')]);
    if (current !== generation) return;
    const missing = Object.entries(loaded.finaleProps).filter(([, image]) => !image.width);
    if (missing.length) throw Error("No se ha podido cargar la utilería del ataque.");
    assets = loaded; states = simulateMoveDemo(selected, mode);
    const comboImpact = mode === "combo1" || mode === "combo2" ? states.findIndex(state => state.effects.some(effect => effect.kind === "hit" && effect.owner === 0 && effect.impact === "heavy")) : -1;
    at = options.poster ? mode === "final" ? Math.min(72, states.length - 1) : mode === "special" ? Math.min(TECHNIQUES[fighterById(selected).ability].startup + 8, states.length - 1) : mode === "heavy" ? 14 : comboImpact >= 0 ? comboImpact : 10 : 0;
    range.max = String(states.length - 1); playButton.disabled = false; range.disabled = false;
    $<HTMLButtonElement>("restart").disabled = false;
    $("load-status").textContent = "Vista real del juego · reproducción sin audio";
    paint();
    if (options.autoplay) play();
  } catch (error) {
    if (current !== generation) return;
    $("load-status").textContent = `No se pudo preparar la vista. ${error instanceof Error ? error.message : String(error)}`;
    $("retry").hidden = false;
    throw error;
  }
}
function play() {
  if (!states.length) return;
  if (at >= states.length - 1) at = 0;
  playing = true; last = performance.now(); accumulated = 0;
  playButton.textContent = "Pausar"; playButton.setAttribute("aria-pressed", "true");
}
function animate(now: number) {
  if (playing && !document.hidden) {
    accumulated += Math.min(100, now - last) * 60 / 1000;
    const ticks = Math.floor(accumulated);
    if (ticks) { accumulated -= ticks; at = Math.min(states.length - 1, at + ticks); paint(); if (at === states.length - 1) { pause(); playButton.textContent = "Repetir"; } }
  }
  last = now; requestAnimationFrame(animate);
}
function fillSelect() {
  const query = normalize(search.value.trim());
  filtered = BUILT_IN_FIGHTERS.filter(f => normalize([f.name, f.shortName, f.special, ...f.combos, finaleById(f.id)!.title].join(" ")).includes(query));
  select.replaceChildren(...filtered.map(f => new Option(f.name, f.id)));
  $("count").textContent = `${filtered.length} de ${BUILT_IN_FIGHTERS.length} personajes`;
  $("empty").hidden = !!filtered.length; $("details").hidden = !filtered.length;
  if (!filtered.length) { pause(); return; }
  const next = filtered.some(f => f.id === selected) ? selected : filtered[0].id;
  select.value = next;
  if (next !== selected) { selected = next; void loadDemo({ poster: true }).catch(() => {}); }
}
select.onchange = () => { selected = select.value as FighterId; void loadDemo({ poster: true }).catch(() => {}); };
search.oninput = fillSelect;
$("clear-search").onclick = () => { search.value = ""; fillSelect(); search.focus(); };
$("prev").onclick = () => navigate(-1);
$("next").onclick = () => navigate(1);
function navigate(direction: number) {
  const index = filtered.findIndex(f => f.id === selected);
  selected = filtered[(index + direction + filtered.length) % filtered.length].id;
  select.value = selected; void loadDemo({ poster: true }).catch(() => {});
}
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-move]")) button.onclick = () => {
  mode = button.dataset.move as Move; void loadDemo({ poster: true }).catch(() => {});
};
playButton.onclick = () => playing ? pause() : play();
$("restart").onclick = () => { at = 0; paint(); play(); };
$("retry").onclick = () => { $("retry").hidden = true; void loadDemo({ poster: true }).catch(() => {}); };
range.oninput = () => { pause(); at = Number(range.value); paint(); };
document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });
const tbody = $<HTMLTableSectionElement>("roster-body");
for (const f of BUILT_IN_FIGHTERS) {
  const row = tbody.insertRow(), name = row.insertCell(), button = document.createElement("button");
  button.textContent = f.name; button.className = "text-button";
  button.onclick = () => { search.value = ""; selected = f.id; fillSelect(); void loadDemo({ poster: true }).catch(() => {}); $("character-name").scrollIntoView({ behavior: "auto", block: "start" }); };
  name.append(button);
  for (const text of [f.combos[0], f.combos[1], f.special, finaleById(f.id)!.title]) row.insertCell().textContent = text;
}
Object.assign(globalThis, { arenaMoveGuide: {
  fighters: BUILT_IN_FIGHTERS.map(f => f.id), moves,
  async selectFighter(id: FighterId) { if (!BUILT_IN_FIGHTERS.some(f => f.id === id)) throw Error("Personaje desconocido"); search.value = ""; selected = id; fillSelect(); await loadDemo({ poster: true }); },
  async selectMove(value: Move) { if (!moves.includes(value)) throw Error("Movimiento desconocido"); mode = value; await loadDemo({ poster: true }); },
  seek(tick: number) { pause(); at = Math.max(0, Math.min(states.length - 1, Math.floor(tick))); paint(); },
  play, pause,
  get ready() { return !!assets && states.length > 0; },
  get selected() { return selected; }, get mode() { return mode; },
  get state() { return states[at]; }, get snapshots() { return states; },
  get summary() { return { selected, mode, frames: states.length, hp: states.at(-1)?.players[1].hp, minHp: Math.min(...states.map(state => state.players[1].hp)), stocks: states.at(-1)?.players[1].stocks, props: Object.keys(assets?.finaleProps ?? {}), sprite: fighterById(selected).sprite }; },
} });
fillSelect();
void loadDemo({ poster: true }).catch(() => {});
requestAnimationFrame(animate);
