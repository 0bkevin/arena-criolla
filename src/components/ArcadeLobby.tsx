import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import {
  ArrowRight,
  ArrowDownAZ,
  ArrowDownZA,
  ChevronLeft,
  ChevronRight,
  Check,
  Copy,
  Globe2,
  Search,
  X,
} from "lucide-react";
import {
  FIGHTERS,
  STAGES,
  fighterById,
  type FighterCategory,
  type FighterId,
  type StageDefinition,
  type StageId,
} from "../../shared/content";
import type { useArenaNetwork } from "../network";
import type { GameMode } from "./Game";
import { Portrait } from "./Portrait";
import { PixelIcon } from "./PixelIcon";
import { RosterFilter } from "./RosterFilter";

const desktopBanner = new URL(
  "../assets/lobby-cast-banner.webp",
  import.meta.url,
).href;
const tabletBanner = new URL(
  "../assets/lobby-cast-banner-tablet.webp",
  import.meta.url,
).href;
const mobileBanner = new URL(
  "../assets/lobby-cast-banner-mobile.webp",
  import.meta.url,
).href;

interface Props {
  mode: GameMode;
  fighter: FighterId;
  rival: FighterId;
  stage: StageDefinition;
  difficulty: "easy" | "normal" | "hard";
  query: string;
  fighters: typeof FIGHTERS;
  network: ReturnType<typeof useArenaNetwork>;
  searchInput: RefObject<HTMLInputElement | null>;
  setupPanel: RefObject<HTMLElement | null>;
  onQuery: (query: string) => void;
  onClearQuery: () => void;
  onFighter: (id: FighterId) => void;
  onRival: (id: FighterId) => void;
  onStage: (id: StageId) => void;
  onMode: (mode: GameMode) => void;
  onDifficulty: (difficulty: Props["difficulty"]) => void;
  onModeKeys: (event: KeyboardEvent<HTMLDivElement>) => void;
  onRosterKeys: (event: KeyboardEvent<HTMLDivElement>) => void;
  onDetail: (id: FighterId) => void;
  onModal: (modal: "help" | "stages" | "progress") => void;
  onStart: () => void;
  onReady: (ready: boolean) => void;
  onInvite: () => void;
}

const colorStyle = (color: string) =>
  ({ "--fighter-color": color }) as React.CSSProperties;
const MIN_PAGE_SIZE = 10;
const fighterNameOrder = new Intl.Collator("es", { sensitivity: "base" });
const stageLabels: Record<StageId, string> = {
  caracas: "Altamira",
  guaira: "La Guaira",
  valencia: "Valencia",
  canaima: "Salto Ángel",
  maracaibo: "Maracaibo",
  merida: "Mérida",
  coro: "Coro",
  roques: "Los Roques",
  poliedro: "Poliedro",
};

export function ArcadeLobby(props: Props) {
  const { mode, fighter, rival, stage, network } = props;
  const [target, setTarget] = useState<"p1" | "p2">("p1");
  const [category, setCategory] = useState<"all" | FighterCategory>("all");
  const [descending, setDescending] = useState(false);
  const rosterGrid = useRef<HTMLDivElement>(null);
  const [pageSize, setPageSize] = useState(MIN_PAGE_SIZE);
  // Keep the page's fighter anchor when a rotation changes its capacity.
  const [pageStart, setPageStart] = useState(0);
  const roster = useMemo(
    () =>
      props.fighters
        .filter(
          (item) =>
            category === "all" || (item.category ?? "culture") === category,
        )
        .sort(
          (a, b) =>
            fighterNameOrder.compare(a.name, b.name) * (descending ? -1 : 1),
        ),
    [props.fighters, category, descending],
  );
  const rosterIds = roster.map((item) => item.id).join("|");
  const pageCount = Math.max(1, Math.ceil(roster.length / pageSize));
  const currentPage = Math.min(Math.floor(pageStart / pageSize), pageCount - 1);
  const visibleFighters = roster.slice(
    currentPage * pageSize,
    currentPage * pageSize + pageSize,
  );
  const chosen = fighterById(fighter);
  const rivalPlayer = network.room?.players.find(
    (player) => player.id !== network.id,
  );
  const opponent =
    mode === "online"
      ? rivalPlayer
        ? fighterById(rivalPlayer.fighter)
        : null
      : fighterById(rival);
  const ownRoomPlayer = network.room?.players.find(
    (player) => player.id === network.id,
  );
  const host = network.room?.host === network.id;
  const stageLocked = Boolean(network.room && !host);
  const pickingRival = target === "p2" && mode !== "online";
  const activeFighter = pickingRival ? rival : fighter;
  const surpriseFighter = () => {
    const candidates = roster.filter((item) => item.id !== activeFighter);
    if (!candidates.length) return;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    if (pickingRival) props.onRival(pick.id);
    else props.onFighter(pick.id);
    setPageStart(roster.findIndex((item) => item.id === pick.id));
  };
  // Selection targets are relative to this client; labels follow room slots.
  const ownLabel =
    mode === "online" && network.room?.players[1]?.id === network.id
      ? "P2"
      : "P1";
  const rivalLabel =
    mode === "practice" ? "CPU" : ownLabel === "P2" ? "P1" : "P2";
  const handleStageKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(
        "button:not(:disabled)",
      ),
    );
    const index = buttons.indexOf(event.target as HTMLButtonElement);
    if (index < 0 || !buttons.length) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) %
            buttons.length;
    buttons[next].focus();
  };

  useEffect(() => {
    if (mode === "online") setTarget("p1");
  }, [mode]);
  useEffect(() => setPageStart(0), [rosterIds]);
  useLayoutEffect(() => {
    const grid = rosterGrid.current;
    if (!grid) return;
    const update = () => {
      if (!grid.getClientRects().length) return;
      const columns = getComputedStyle(grid)
        .gridTemplateColumns.split(" ")
        .filter(Boolean).length;
      // A full page fills the actual CSS columns, including on small screens.
      if (columns) setPageSize(Math.ceil(MIN_PAGE_SIZE / columns) * columns);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(grid);
    return () => observer.disconnect();
  }, []);

  return (
    <main className="page-width home-page arcade-home">
      <section className="arcade-marquee" aria-labelledby="lobby-banner-title">
        <h1 id="lobby-banner-title" className="sr-only">
          Elige tus luchadores
        </h1>
        <picture className="marquee-art" aria-hidden="true">
          <source
            media="(max-width: 600px)"
            srcSet={mobileBanner}
            width="1280"
            height="427"
          />
          <source
            media="(max-width: 1100px)"
            srcSet={tabletBanner}
            width="1983"
            height="308"
          />
          <img
            src={desktopBanner}
            alt=""
            width="2172"
            height="248"
            loading="eager"
            fetchPriority="high"
            decoding="async"
          />
        </picture>
      </section>

      <div className="arcade-mode-row">
        <div
          className="mode-tabs arcade-modes"
          role="tablist"
          aria-label="Modo de juego"
          onKeyDown={props.onModeKeys}
        >
          {(
            [
              ["practice", "Contra CPU", "gamepad"],
              ["local", "Dos jugadores", "heart"],
              ["online", "En línea", "bolt"],
            ] as const
          ).map(([value, label, icon]) => (
            <button
              key={value}
              role="tab"
              id={`mode-${value}`}
              aria-controls="match-setup"
              tabIndex={mode === value ? 0 : -1}
              aria-selected={mode === value}
              title={
                value === "local"
                  ? "Dos jugadores en el mismo dispositivo"
                  : undefined
              }
              className={mode === value ? "selected" : ""}
              onClick={() => props.onMode(value)}
            >
              <PixelIcon kind={icon} size={20} />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <button
          className="arcade-progress"
          onClick={() => props.onModal("progress")}
        >
          <PixelIcon kind="star" size={16} /> Mis logros{" "}
          <ArrowRight size={14} />
        </button>
      </div>

      {((network.error && mode === "online") || network.opponentLeft) && (
        <div className="notice-banner" role="status">
          <Globe2 size={16} />
          <span>
            {network.opponentLeft
              ? "Tu pana salió. Invítalo de nuevo o busca otra pelea."
              : network.error}
          </span>
          <button
            className="icon-button"
            aria-label="Cerrar aviso"
            onClick={() => {
              network.setError("");
              network.setOpponentLeft(false);
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div
        className="arcade-session"
        id="match-setup"
        role="tabpanel"
        aria-labelledby={`mode-${mode}`}
      >
        <section className="arcade-cabinet" aria-label="Elegir luchadores">
          <div
            className="cabinet-scenery"
            key={stage.id}
            style={{ backgroundImage: `url(/assets/${stage.id}.webp)` }}
            aria-hidden="true"
          />
          <div className="cabinet-heading">
            <div>
              <h2>LUCHADORES</h2>
            </div>
            <span className="duel-vs" aria-hidden="true">
              VS
            </span>
          </div>

          <div className="arcade-selection" id="luchadores">
            <div className="duel-preview" aria-label="Vista previa de la pelea">
              <div
                className={`contender-panel contender-p1 ${!pickingRival ? "is-editing" : ""}`}
                style={colorStyle(chosen.color)}
              >
                <button
                  className={`contender-player ${!pickingRival ? "editing" : ""}`}
                  aria-label={`Elegir luchador para ${ownLabel}`}
                  aria-pressed={!pickingRival}
                  onClick={() => setTarget("p1")}
                >
                  <span>{ownLabel}</span>
                  <span className="pixel-cursor" aria-hidden="true">
                    ◂
                  </span>
                </button>
                <div className="contender-stage">
                  <div className="contender-lives" aria-hidden="true">
                    <PixelIcon kind="heart" size={13} />
                    <PixelIcon kind="heart" size={13} />
                  </div>
                  <Portrait
                    key={fighter}
                    fighter={fighter}
                    className="selected-portrait"
                    animated
                  />
                  <span className="contender-shadow" />
                </div>
                <div className="contender-identity" key={`name-${fighter}`}>
                  <h3>{chosen.name}</h3>
                </div>
                <button
                  className="contender-moves"
                  title="Ver movimientos"
                  onClick={() => props.onDetail(fighter)}
                  aria-label={`Ver movimientos de ${chosen.name}`}
                >
                  <PixelIcon kind="bolt" size={12} />
                  <span>Movimientos</span> <ArrowRight size={12} />
                </button>
              </div>

              <div
                className={`contender-panel contender-p2 ${!opponent ? "waiting" : ""} ${pickingRival ? "is-editing" : ""}`}
                style={opponent ? colorStyle(opponent.color) : undefined}
              >
                <button
                  className={`contender-player ${pickingRival ? "editing" : ""}`}
                  aria-label={`Elegir luchador para ${rivalLabel}`}
                  aria-pressed={pickingRival}
                  disabled={mode === "online"}
                  onClick={() => setTarget("p2")}
                >
                  <span>{rivalLabel}</span>
                  <span className="pixel-cursor" aria-hidden="true">
                    ▸
                  </span>
                </button>
                <div className="contender-stage">
                  <div className="contender-lives" aria-hidden="true">
                    <PixelIcon kind="heart" size={13} />
                    <PixelIcon kind="heart" size={13} />
                  </div>
                  {opponent ? (
                    <Portrait
                      key={opponent.id}
                      fighter={opponent.id}
                      facing={-1}
                      className="selected-portrait"
                      animated
                    />
                  ) : (
                    <div className="waiting-portrait">
                      <PixelIcon kind="gamepad" size={38} />
                      <span>?</span>
                    </div>
                  )}
                  <span className="contender-shadow" />
                </div>
                <div
                  className="contender-identity"
                  key={`rival-${opponent?.id || "waiting"}`}
                >
                  <h3>{opponent?.name || "Esperando rival"}</h3>
                </div>
                {opponent ? (
                  <button
                    className="contender-moves"
                    title="Ver movimientos"
                    onClick={() => props.onDetail(opponent.id)}
                    aria-label={`Ver movimientos de ${opponent.name}`}
                  >
                    <PixelIcon kind="bolt" size={12} />
                    <span>Movimientos</span> <ArrowRight size={12} />
                  </button>
                ) : null}
              </div>
            </div>
            <div className="arcade-roster">
              <div className="roster-toolbar">
                <div
                  className="player-picker"
                  role="group"
                  aria-label="Jugador que estás eligiendo"
                >
                  <button
                    className={!pickingRival ? "active p1" : "p1"}
                    aria-pressed={!pickingRival}
                    aria-label={`Elegir luchador para ${ownLabel}`}
                    onClick={() => setTarget("p1")}
                  >
                    {ownLabel}
                  </button>
                  {mode !== "online" && (
                    <button
                      className={pickingRival ? "active p2" : "p2"}
                      aria-pressed={pickingRival}
                      aria-label={`Elegir luchador para ${rivalLabel}`}
                      onClick={() => setTarget("p2")}
                    >
                      {rivalLabel}
                    </button>
                  )}
                </div>
                <button
                  className="roster-random"
                  onClick={surpriseFighter}
                  disabled={!roster.some((item) => item.id !== activeFighter)}
                  aria-label={`Elegir luchador al azar para ${pickingRival ? rivalLabel : ownLabel}`}
                  title="Sorpréndeme"
                >
                  <PixelIcon kind="dice" size={19} />
                  <span>Sorpréndeme</span>
                </button>
                <div className="fighter-search arcade-search">
                  <Search size={14} aria-hidden="true" />
                  <input
                    ref={props.searchInput}
                    aria-label="Buscar luchador"
                    placeholder="Buscar luchador"
                    autoComplete="off"
                    value={props.query}
                    onChange={(event) => props.onQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        props.onClearQuery();
                      }
                    }}
                  />
                  {props.query && (
                    <button
                      className="roster-search-clear"
                      aria-label="Limpiar búsqueda"
                      onClick={props.onClearQuery}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <RosterFilter value={category} onChange={setCategory} />
                <button
                  className="roster-sort"
                  aria-label={
                    descending ? "Ordenar de A a Z" : "Ordenar de Z a A"
                  }
                  title={
                    descending
                      ? "Orden Z–A. Cambiar a A–Z"
                      : "Orden A–Z. Cambiar a Z–A"
                  }
                  onClick={() => setDescending((current) => !current)}
                >
                  {descending ? (
                    <ArrowDownZA size={18} />
                  ) : (
                    <ArrowDownAZ size={18} />
                  )}
                </button>
              </div>
              <div
                className="fighter-grid"
                ref={rosterGrid}
                role="group"
                aria-label="Seleccionar luchador"
                onKeyDown={props.onRosterKeys}
              >
                {visibleFighters.map((item) => {
                  const p1 = fighter === item.id;
                  const p2 = opponent?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      className={`fighter-card ${activeFighter === item.id ? "chosen" : ""} ${p1 ? "picked-p1" : ""} ${p2 ? "picked-p2" : ""} ${pickingRival ? "picking-p2" : ""}`}
                      style={colorStyle(item.color)}
                      aria-label={`Elegir a ${item.name}`}
                      aria-pressed={activeFighter === item.id}
                      onClick={() =>
                        pickingRival
                          ? props.onRival(item.id)
                          : props.onFighter(item.id)
                      }
                    >
                      <div className="fighter-card-art">
                        <Portrait fighter={item.id} bust />
                        <div className="fighter-player-tags">
                          {p1 && <span className="tag-p1">{ownLabel}</span>}
                          {p2 && <span className="tag-p2">{rivalLabel}</span>}
                        </div>
                      </div>
                      <div className="fighter-card-caption">
                        <strong>{item.name}</strong>
                      </div>
                    </button>
                  );
                })}
              </div>
              {!roster.length && (
                <div className="fighter-empty" role="status">
                  <PixelIcon kind="gamepad" size={24} />
                  <strong>Ese pana no está en la arena.</strong>
                  <button
                    onClick={() => {
                      props.onClearQuery();
                      setCategory("all");
                      setPageStart(0);
                    }}
                  >
                    Ver todos <ArrowRight size={14} />
                  </button>
                </div>
              )}
              {roster.length > 0 && (
                <div
                  className="roster-pagination"
                  aria-label="Páginas de luchadores"
                >
                  <button
                    aria-label="Página anterior de luchadores"
                    disabled={currentPage === 0}
                    onClick={() => setPageStart((currentPage - 1) * pageSize)}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span role="status">
                    Página {currentPage + 1} de {pageCount}
                  </span>
                  <button
                    aria-label="Página siguiente de luchadores"
                    disabled={currentPage >= pageCount - 1}
                    onClick={() => setPageStart((currentPage + 1) * pageSize)}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
              <span className="sr-only" role="status">
                Luchador seleccionado para{" "}
                {pickingRival ? rivalLabel : ownLabel}:{" "}
                {fighterById(activeFighter).name}.
              </span>
            </div>
          </div>
        </section>

        <section className="arcade-stages" aria-label="Seleccionar escenario">
          <div className="arcade-stage-heading">
            <div>
              <h2>ESCENARIO</h2>
            </div>
            <span className="sr-only" aria-live="polite">
              {stage.location}
            </span>
            <button onClick={() => props.onModal("stages")}>
              Ver mapa <ArrowRight size={13} />
            </button>
          </div>
          <div
            className="stage-strip"
            role="group"
            aria-label="Escenarios de Venezuela"
            onKeyDown={handleStageKeys}
          >
            {STAGES.map((item) => (
              <button
                key={item.id}
                className={`arcade-stage ${item.id === stage.id ? "selected" : ""}`}
                aria-label={`Elegir escenario ${item.location}`}
                aria-pressed={item.id === stage.id}
                disabled={stageLocked}
                onClick={() => props.onStage(item.id)}
              >
                <span className="stage-thumbnail">
                  <img src={`/assets/${item.id}.webp`} alt="" />
                  {item.id === stage.id && (
                    <span className="stage-tick">
                      <Check size={12} />
                    </span>
                  )}
                </span>
                <strong>{stageLabels[item.id]}</strong>
              </button>
            ))}
          </div>
          {stageLocked && (
            <p className="stage-lock-note">El anfitrión elige el escenario.</p>
          )}
        </section>

        <section
          className={`arcade-ready ${mode === "local" ? "local-ready" : ""} ${mode === "online" ? "online-ready" : ""} ${network.room ? "in-room" : ""}`}
          ref={props.setupPanel}
          id="prepare-fight"
          aria-label="Preparar pelea"
        >
          <div className="ready-intro">
            <PixelIcon kind="swords" size={28} />
            <div>
              <strong>PREPARAR PELEA</strong>
            </div>
          </div>
          {network.room && (
            <div className="ready-room">
              <span>CÓDIGO DE SALA</span>
              <strong>{network.room.code}</strong>
              <button aria-label="Copiar invitación" onClick={props.onInvite}>
                <Copy size={16} />
              </button>
            </div>
          )}
          {mode === "practice" && (
            <div className="ready-difficulty">
              <span>NIVEL DEL CPU</span>
              <div role="group" aria-label="Dificultad del CPU">
                {(
                  [
                    ["easy", "Suave"],
                    ["normal", "Normal"],
                    ["hard", "Candela"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    className={props.difficulty === value ? "active" : ""}
                    aria-pressed={props.difficulty === value}
                    onClick={() => props.onDifficulty(value)}
                  >
                    {label}
                    {value === "hard" && <PixelIcon kind="bolt" size={11} />}
                  </button>
                ))}
              </div>
            </div>
          )}
          {mode === "online" && (
            <div className="ready-online-status">
              <span
                className={`live-dot ${network.connected ? "connected" : ""}`}
              />
              <span>
                {network.room
                  ? `${network.room.players.length}/2 PANAS EN LA SALA`
                  : "INVITA A UN PANA"}
              </span>
              {network.room && (
                <button onClick={props.onInvite}>
                  Invitar <Copy size={12} />
                </button>
              )}
            </div>
          )}
          <button
            className="arcade-start primary-button fight-button"
            disabled={mode === "online" && !network.connected}
            onClick={
              network.room
                ? () => props.onReady(!ownRoomPlayer?.ready)
                : props.onStart
            }
          >
            <PixelIcon
              kind={mode === "online" ? "bolt" : "gamepad"}
              size={20}
            />
            <span>
              {network.room
                ? ownRoomPlayer?.ready
                  ? "¡LISTO!"
                  : "¡ESTOY LISTO!"
                : mode === "online"
                  ? "BUSCAR SALAS"
                  : "¡A DARLE!"}
            </span>
            <PixelIcon kind="arrow" size={20} />
          </button>
          {network.room && (
            <div className="ready-room-players">
              {network.room.players.map((p) => (
                <span key={p.id} className={p.ready ? "ready" : ""}>
                  <span className="ready-player-dot" />
                  {p.name}
                  {p.id === network.id ? " (tú)" : ""} ·{" "}
                  {p.connected === false
                    ? "RECONECTANDO…"
                    : p.ready
                      ? "LISTO"
                      : "ELIGIENDO"}
                </span>
              ))}
              {network.room.players.length === 1 && (
                <span>Esperando a tu pana…</span>
              )}
              <button onClick={() => network.send({ type: "leave" })}>
                Salir de la sala
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
