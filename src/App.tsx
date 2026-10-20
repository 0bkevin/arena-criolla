import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  ArrowRight,
  Check,
  CircleHelp,
  Globe2,
  LockKeyhole,
  Plus,
  Radio,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import {
  FIGHTERS,
  STAGES,
  fighterById,
  isFighter,
  stageById,
  type FighterId,
  type StageId,
} from "../shared/content";
import { createMatch, type MatchState } from "../shared/engine";
import { finaleById } from "../shared/finales";
import {
  isRoomCode,
  normalizeRoomCode,
  ROOM_CODE_LENGTH,
} from "../shared/room-code";
import { useArenaNetwork } from "./network";
import {
  getPreference,
  readProgress,
  saveProgress,
  setPreference,
  type Progress,
} from "./storage";
import {
  initAudio,
  preloadReactions,
  setSound,
  sound,
  stopReactions,
} from "./audio";
import { personalityById } from "./game/personality";
import { preloadAssets } from "./game/assets";
import { Portrait } from "./components/Portrait";
import { ArcadeLobby } from "./components/ArcadeLobby";
import { PixelIcon } from "./components/PixelIcon";
import { Game, type GameMode } from "./components/Game";
import { Modal } from "./components/Modal";
import { Help } from "./components/Help";
import { beginMobilePlay, leaveLandscape } from "./game/mobile";

type ModalName =
  "help" | "fighters" | "stages" | "progress" | "rooms" | "ranking" | null;
const colorStyle = (color: string): React.CSSProperties =>
  ({ "--fighter-color": color }) as React.CSSProperties;

export function App({
  communityRevision: _communityRevision,
}: { communityRevision?: number } = {}) {
  const selectableFighters = FIGHTERS.filter((item) => item.id !== "dayana");
  const [mode, setMode] = useState<GameMode>("practice");
  const [initialMatchup] = useState(() => {
    // Pick two distinct fighters once, without shuffling or copying the roster.
    const first = Math.floor(Math.random() * selectableFighters.length);
    const second =
      (first + 1 + Math.floor(Math.random() * (selectableFighters.length - 1))) %
      selectableFighters.length;
    return [selectableFighters[first].id, selectableFighters[second].id] as const;
  });
  const [fighter, setFighter] = useState<FighterId>(initialMatchup[0]);
  const [rival, setRival] = useState<FighterId>(initialMatchup[1]);
  const [fighterQuery, setFighterQuery] = useState("");
  const [stage, setStage] = useState<StageId>("caracas");
  const [name, setName] = useState(() => getPreference("name", ""));
  const [secondName, setSecondName] = useState("Pana 2");
  const [difficulty, setDifficulty] = useState<"easy" | "normal" | "hard">(
    "normal",
  );
  const [progress, setProgress] = useState<Progress>(readProgress);
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const [audio, setAudio] = useState(() => getPreference("sound", true));
  const [modal, setModal] = useState<ModalName>(null);
  const [detail, setDetail] = useState<FighterId | null>(null);
  const [localMatch, setLocalMatch] = useState<MatchState | null>(null);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [rematchWaiting, setRematchWaiting] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [privateRoom, setPrivateRoom] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const secondNameInput = useRef<HTMLInputElement>(null);
  const fighterSearchInput = useRef<HTMLInputElement>(null);
  const setupPanel = useRef<HTMLElement>(null);
  const footer = useRef<HTMLElement>(null);
  const [setupVisible, setSetupVisible] = useState(true);
  const [footerVisible, setFooterVisible] = useState(false);
  const network = useArenaNetwork();
  useEffect(() => {
    if (!isFighter(fighter)) {
      setFighter("zavarce");
      if (network.room)
        network.send({ type: "select", fighter: "zavarce", wins: 0 });
    }
    if (!isFighter(rival)) setRival("javier");
  }, [_communityRevision, network.communityVersion, fighter, rival]);

  const active = localMatch || network.match?.initial;
  const chosen = fighterById(fighter);
  const chosenStage = stageById(network.room?.stage || stage);
  const wins = Number(progress.wins[fighter]) || 0;
  const secondNameError =
    mode === "local" && Boolean(formError) && Boolean(name.trim());
  const host = network.room?.host === network.id;
  const searchTerm = fighterQuery
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  const visibleFighters = selectableFighters.filter((f) =>
    `${f.name} ${f.shortName} ${f.title} ${f.role}`
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .includes(searchTerm),
  );

  useEffect(() => {
    if (active || !setupPanel.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === setupPanel.current)
            setSetupVisible(entry.isIntersecting);
          else if (entry.target === footer.current)
            setFooterVisible(entry.isIntersecting);
        }
      },
      { threshold: 0.08 },
    );
    observer.observe(setupPanel.current);
    if (footer.current) observer.observe(footer.current);
    return () => observer.disconnect();
  }, [active]);

  useEffect(() => {
    setSound(audio);
    setPreference("sound", audio);
  }, [audio]);
  useEffect(() => {
    setPreference("name", name);
  }, [name]);
  useEffect(() => {
    if (network.room) {
      setMode("online");
      setModal((current) => (current === "rooms" ? null : current));
    }
  }, [network.room]);
  useEffect(() => {
    // Warm the same cached assets while players choose in a room, so the
    // server's shared entrance timeline is visible immediately on both peers.
    if (network.room?.code)
      void preloadAssets(
        network.room.players.map((player) => player.fighter),
        [network.room.stage],
      ).catch(() => {});
  }, [
    network.room?.code,
    network.room?.stage,
    network.room?.players.map((player) => player.fighter).join(","),
  ]);
  useEffect(() => {
    if (network.match) {
      setModal(null);
      setRematchWaiting(false);
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [network.match]);
  useEffect(() => {
    const queryCode = new URLSearchParams(location.search).get("sala");
    if (queryCode) {
      setJoinCode(normalizeRoomCode(queryCode).slice(0, ROOM_CODE_LENGTH));
      setMode("online");
      setModal("rooms");
    }
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  const clickSound = () => {
    initAudio();
    preloadReactions();
    sound("select");
  };
  const toggleAudio = () => {
    setAudio(!audio);
    setSound(!audio);
    if (!audio) {
      initAudio();
      preloadReactions();
    }
  };
  const clearFighterSearch = () => {
    setFighterQuery("");
    fighterSearchInput.current?.focus();
  };
  const selectFighter = (id: FighterId) => {
    setFighter(id);
    clickSound();
    if (network.room?.status === "waiting")
      network.send({
        type: "select",
        fighter: id,
        wins: Number(progress.wins[id]) || 0,
      });
  };
  const selectStage = (id: StageId) => {
    setStage(id);
    clickSound();
    if (network.room?.status === "waiting" && host)
      network.send({ type: "select", stage: id });
  };
  const changeMode = (next: GameMode) => {
    leaveLandscape();
    if (network.room) network.send({ type: "leave" });
    setMode(next);
    setFormError("");
    network.setError("");
    clickSound();
  };
  const handleModeKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    const directions = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!directions.includes(event.key)) return;
    const modes = ["practice", "local", "online"] as const;
    const current = modes.indexOf(mode);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? 2
          : (current + (event.key === "ArrowRight" ? 1 : -1) + 3) % 3;
    event.preventDefault();
    changeMode(modes[next]);
    event.currentTarget
      .querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [next]?.focus();
  };
  const handleRosterKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      ![
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
      ].includes(event.key)
    )
      return;
    const buttons = [
      ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
        ".fighter-card",
      ),
    ];
    const current = buttons.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    if (current < 0) return;
    const columns = getComputedStyle(
      event.currentTarget,
    ).gridTemplateColumns.split(" ").length;
    const offset =
      event.key === "ArrowRight"
        ? 1
        : event.key === "ArrowLeft"
          ? -1
          : event.key === "ArrowDown"
            ? columns
            : -columns;
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : Math.max(0, Math.min(buttons.length - 1, current + offset));
    event.preventDefault();
    buttons[next]?.focus({ preventScroll: true });
    buttons[next]?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  };
  const goToSetup = () => {
    setupPanel.current?.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
    if (!name.trim()) nameInput.current?.focus({ preventScroll: true });
  };
  const validateName = () => {
    if (!name.trim()) {
      setFormError("Pon tu apodo y entramos a la arena.");
      if (modal === "rooms") document.getElementById("lobby-name")?.focus();
      else nameInput.current?.focus();
      return false;
    }
    setFormError("");
    return true;
  };
  const startLocal = () => {
    if (!validateName()) return;
    if (mode === "local" && !secondName.trim()) {
      setFormError("Tu pana también necesita un apodo.");
      secondNameInput.current?.focus();
      return;
    }
    initAudio();
    stopReactions();
    preloadReactions();
    setModal(null);
    beginMobilePlay();
    const saved = progressRef.current;
    setLocalMatch(
      createMatch(
        stage,
        [
          {
            name: name.trim(),
            fighter,
            wins: Number(saved.wins[fighter]) || 0,
          },
          {
            name: mode === "practice" ? "CPU" : secondName.trim(),
            fighter: rival,
            wins: Number(saved.wins[rival]) || 0,
          },
        ],
        crypto.randomUUID(),
      ),
    );
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const recordResult = (state: MatchState, index: number) => {
    const saved = structuredClone(progressRef.current);
    const local = state.players[index];
    const won = state.winner === index;
    saved.played++;
    saved.bestCombo = Math.max(saved.bestCombo, local.peakCombo);
    if (won)
      saved.wins[local.config.fighter] =
        (Number(saved.wins[local.config.fighter]) || 0) + 1;
    if (mode === "local" && state.winner === 1) {
      const second = state.players[1];
      saved.wins[second.config.fighter] =
        (Number(saved.wins[second.config.fighter]) || 0) + 1;
    }
    saved.recent.unshift({
      fighter: local.config.fighter,
      rival: state.players[1 - index].config.fighter,
      won,
      date: new Date().toISOString(),
    });
    saved.recent = saved.recent.slice(0, 8);
    progressRef.current = saved;
    setProgress(saved);
    saveProgress(saved);
  };
  const exit = () => {
    setLocalMatch(null);
    if (network.room) network.send({ type: "leave" });
    setRematchWaiting(false);
  };
  const openRooms = () => {
    setMode("online");
    setModal("rooms");
    network.setError("");
    network.send({ type: "list" });
    clickSound();
  };
  const invite = () => {
    if (!network.room) return;
    const url = new URL(location.href);
    url.searchParams.set("sala", network.room.code);
    if (navigator.clipboard?.writeText)
      void navigator.clipboard
        .writeText(url.toString())
        .then(() => setNotice("Enlace copiado. Mándaselo a tu pana."))
        .catch(() => setNotice(`Código de sala: ${network.room!.code}`));
    else setNotice(`Código de sala: ${network.room.code}`);
  };
  const totalWins = Object.values(progress.wins).reduce<number>(
    (a, b) => a + (Number(b) || 0),
    0,
  );

  return (
    <div className={`app-shell arcade-app ${active ? "in-match" : "in-lobby"}`}>
      <header className="site-header page-width">
        <button
          className="brand"
          aria-label="Arena Criolla, inicio"
          onClick={() => {
            if (!active) {
              setModal(null);
              window.scrollTo({
                top: 0,
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                  .matches
                  ? "auto"
                  : "smooth",
              });
            }
          }}
        >
          <span className="brand-icon" aria-hidden="true">
            <img src="/assets/arena-icon.svg" width="29" height="29" alt="" />
          </span>
          <span className="brand-name">
            ARENA
            <span>
              CRIOLLA
              <span className="flag-mark">
                <i />
                <i />
                <i />
              </span>
            </span>
          </span>
        </button>
        <nav className="main-nav" aria-label="Navegación principal">
          <button
            className={!modal ? "active" : ""}
            onClick={() => {
              if (!active) setModal(null);
            }}
          >
            Jugar
          </button>
          <button
            className={modal === "fighters" ? "active" : ""}
            onClick={() => setModal("fighters")}
          >
            Luchadores
          </button>
          <button onClick={() => setModal("help")} aria-label="Cómo jugar">
            <CircleHelp size={15} />
            <span>Cómo jugar</span>
          </button>
        </nav>
        <div className="header-right">
          <button
            className="icon-button header-help"
            onClick={() => setModal("help")}
            aria-label="Ayuda y controles"
            title="Ayuda y controles"
          >
            <CircleHelp size={19} />
          </button>
          {!active && (
            <button
              className="icon-button header-progress"
              onClick={() => setModal("progress")}
              aria-label="Mi progreso"
              title="Mi progreso"
            >
              <PixelIcon kind="star" size={18} />
            </button>
          )}
          <span
            className={`server-status ${network.connected ? "connected" : ""}`}
            title={
              network.connected
                ? "Servidor de salas conectado"
                : "Conectando al servidor"
            }
          >
            <i />
            {network.connected ? "En línea" : "Conectando"}
          </span>
          <button
            className="icon-button"
            onClick={toggleAudio}
            aria-label={audio ? "Silenciar sonido" : "Activar sonido"}
            aria-pressed={audio}
          >
            {audio ? <Volume2 size={19} /> : <VolumeX size={19} />}
          </button>
        </div>
      </header>

      {active ? (
        <Game
          key={active.id}
          initial={active}
          mode={localMatch ? mode : "online"}
          difficulty={difficulty}
          remote={network.state}
          localIndex={network.match?.index || 0}
          onInput={(input) =>
            network.send({ type: "input", matchId: active.id, input })
          }
          onExit={exit}
          onResult={recordResult}
          onRematch={() => {
            if (localMatch) startLocal();
            else {
              network.send({ type: "rematch" });
              setRematchWaiting(true);
            }
          }}
          rematchWaiting={rematchWaiting}
          onHelp={() => setModal("help")}
          soundEnabled={audio}
          onToggleSound={toggleAudio}
        />
      ) : (
        <ArcadeLobby
          mode={mode}
          fighter={fighter}
          rival={rival}
          stage={chosenStage}
          name={name}
          secondName={secondName}
          difficulty={difficulty}
          query={fighterQuery}
          fighters={visibleFighters}
          network={network}
          formError={formError}
          secondNameError={secondNameError}
          nameInput={nameInput}
          secondNameInput={secondNameInput}
          searchInput={fighterSearchInput}
          setupPanel={setupPanel}
          onName={(value) => {
            setName(value);
            setFormError("");
          }}
          onSecondName={(value) => {
            setSecondName(value);
            setFormError("");
          }}
          onQuery={setFighterQuery}
          onClearQuery={clearFighterSearch}
          onFighter={selectFighter}
          onStage={selectStage}
          onRival={(id) => {
            setRival(id);
            clickSound();
          }}
          onMode={changeMode}
          onDifficulty={setDifficulty}
          onModeKeys={handleModeKeys}
          onRosterKeys={handleRosterKeys}
          onDetail={setDetail}
          onModal={setModal}
          onStart={mode === "online" ? openRooms : startLocal}
          onReady={(ready) => {
            clickSound();
            if (ready) beginMobilePlay();
            else leaveLandscape();
            network.send({ type: "ready", ready });
          }}
          onInvite={invite}
        />
      )}

      <footer className="site-footer page-width" ref={footer}>
        <span className="footer-note">
          Parodia arcade · Habilidades ficticias
        </span>
        <button onClick={() => setModal("ranking")}>
          <Trophy size={13} />
          Ranking <span>PRONTO</span>
        </button>
        <span className="footer-credit">
          Desarrollado por{" "}
          <a
            href="https://kevinbravo.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            Kevin Bravo (kevinbravo.com)
          </a>
        </span>
      </footer>
      {!active && !modal && !detail && !setupVisible && !footerVisible && (
        <div className="mobile-setup-dock">
          <span>
            <strong>{chosen.name}</strong>
          </span>
          <button onClick={goToSetup}>
            Preparar <PixelIcon kind="arrow" size={16} />
          </button>
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          {notice}
        </div>
      )}
      {modal === "help" && <Help onClose={() => setModal(null)} />}
      {modal === "fighters" && (
        <Modal title="Luchadores" wide onClose={() => setModal(null)}>
          <div className="roster-grid">
            {selectableFighters.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setDetail(f.id);
                  setModal(null);
                }}
                style={colorStyle(f.color)}
              >
                <Portrait fighter={f.id} />
                <div>
                  <span>{f.role}</span>
                  <h3>{f.name}</h3>
                  <strong>
                    Ver movimientos <ArrowRight size={13} />
                  </strong>
                </div>
              </button>
            ))}
          </div>
        </Modal>
      )}
      {modal === "stages" && (
        <Modal title="Escenarios" wide onClose={() => setModal(null)}>
          <div className="stage-gallery">
            {STAGES.map((s, index) => (
              <button
                key={s.id}
                className={`stage-card ${s.artStyle === "pixel" ? "pixel-stage" : ""}`}
                aria-label={`Seleccionar escenario ${s.name}`}
                aria-pressed={chosenStage.id === s.id}
                disabled={Boolean(network.room && !host)}
                onClick={() => {
                  selectStage(s.id);
                  setModal(null);
                }}
              >
                <div className="stage-card-image">
                  <img src={`/assets/${s.id}.webp`} alt="" loading="lazy" />
                  <span>{(index + 1).toString().padStart(2, "0")}</span>
                  {chosenStage.id === s.id && (
                    <strong>
                      <Check size={14} /> Elegido
                    </strong>
                  )}
                </div>
                <div className="stage-card-body">
                  <span>{s.location}</span>
                  <h3>{s.name}</h3>
                  <p>{s.description}</p>
                  <div className="stage-tags">
                    <span>
                      {s.platforms.length
                        ? `${s.platforms.length} ${s.platforms.length === 1 ? "plataforma" : "plataformas"}`
                        : "A ras del suelo"}
                    </span>
                    {s.platforms.some((p) => p.motion) && (
                      <span>Plataforma móvil</span>
                    )}
                    {s.artStyle === "pixel" && <span>Pixel art</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Modal>
      )}
      {detail && (
        <FighterDetail
          fighter={detail}
          wins={Number(progress.wins[detail]) || 0}
          onClose={() => setDetail(null)}
          onSelect={() => {
            selectFighter(detail);
            setDetail(null);
          }}
        />
      )}
      {modal === "progress" && (
        <Modal title="Mi progreso" onClose={() => setModal(null)}>
          <p className="modal-intro">
            Guardado en este navegador. Desbloqueos por luchador.
          </p>
          <div className="progress-metrics">
            <div>
              <strong>{progress.played}</strong>
              <span>Peleas</span>
            </div>
            <div>
              <strong>{totalWins}</strong>
              <span>Victorias</span>
            </div>
            <div>
              <strong>{progress.bestCombo}</strong>
              <span>Mejor racha</span>
            </div>
          </div>
          <div className="progress-roster">
            {FIGHTERS.map((f) => {
              const count = Number(progress.wins[f.id]) || 0;
              return (
                <div key={f.id}>
                  <span
                    className="progress-dot"
                    style={{ background: f.color }}
                  />
                  <strong>{f.name}</strong>
                  <span>
                    {count} {count === 1 ? "victoria" : "victorias"}
                  </span>
                  <small>
                    {count >= 3
                      ? "3/3 combos"
                      : count >= 1
                        ? "2/3 combos"
                        : "1/3 combos"}
                  </small>
                </div>
              );
            })}
          </div>
          {progress.recent.length > 0 ? (
            <>
              <h3 className="help-section">Últimas peleas</h3>
              <div className="recent-matches">
                {progress.recent.slice(0, 5).map((m, i) => (
                  <div key={i}>
                    <span className={m.won ? "won" : "lost"}>
                      {m.won ? "VICTORIA" : "PARTIDA"}
                    </span>
                    <span>
                      {fighterById(m.fighter).shortName} <small>vs.</small>{" "}
                      {fighterById(m.rival).shortName}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-progress">
              <Trophy size={29} />
              <p>
                Tu primera victoria está esperando.
                <br />
                Elige tu luchador y empieza a jugar.
              </p>
            </div>
          )}
        </Modal>
      )}
      {modal === "ranking" && (
        <Modal title="La próxima ronda" onClose={() => setModal(null)}>
          <div className="coming-soon">
            <Trophy size={44} />
            <span className="eyebrow">RANKING GLOBAL</span>
            <h3>Los mejores tendrán su lugar.</h3>
            <p>
              La clasificación por victorias llegará más adelante. Mientras
              tanto, puedes pelear sin cuentas y desbloquear los combos de tus
              luchadores favoritos.
            </p>
            <button
              className="primary-button"
              onClick={() => {
                setModal("progress");
              }}
            >
              Ver mi progreso <ArrowRight size={16} />
            </button>
          </div>
        </Modal>
      )}
      {modal === "rooms" && (
        <Modal
          title="Salas en línea"
          className="rooms-modal"
          wide
          onClose={() => setModal(null)}
        >
          <div className="lobby-meta">
            <span>
              <i className={network.connected ? "connected-dot" : ""} />
              {network.connected
                ? `${network.online} ${network.online === 1 ? "pana conectado" : "panas conectados"}`
                : "Conectando…"}
            </span>
            <button
              className="text-button"
              onClick={() => network.send({ type: "list" })}
            >
              <Radio size={13} /> Actualizar
            </button>
          </div>
          <div className="lobby-name">
            <label className="field-label" htmlFor="lobby-name">
              Tu apodo
            </label>
            <input
              id="lobby-name"
              className="plain-input"
              value={name}
              maxLength={20}
              onChange={(e) => {
                setName(e.target.value);
                setFormError("");
              }}
            />
          </div>
          {(formError || network.error) && (
            <p className="form-error" role="alert">
              {formError || network.error}
            </p>
          )}
          <div className="lobby-grid">
            <div className="create-room-panel">
              <div className="room-panel-heading">
                <Plus size={20} aria-hidden="true" />
                <h3>Crear sala</h3>
              </div>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={privateRoom}
                  onChange={(e) => setPrivateRoom(e.target.checked)}
                />
                <LockKeyhole size={13} />
                Solo entrar con código
              </label>
              <button
                className="primary-button"
                disabled={!network.connected}
                onClick={() => {
                  if (!validateName()) return;
                  network.send({
                    type: "create",
                    name: name.trim(),
                    fighter,
                    stage,
                    wins,
                    private: privateRoom,
                  });
                }}
              >
                <Plus size={16} /> Crear sala
              </button>
            </div>
            <div className="join-room-panel">
              <h3>Entrar con código</h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!validateName()) return;
                  if (!isRoomCode(joinCode)) {
                    network.setError(
                      "El código de sala debe tener 32 caracteres hexadecimales.",
                    );
                    return;
                  }
                  network.send({
                    type: "join",
                    code: joinCode,
                    name: name.trim(),
                    fighter,
                    wins,
                  });
                }}
              >
                <input
                  aria-label="Código de sala"
                  className="plain-input code-input"
                  value={joinCode}
                  onChange={(e) => {
                    setJoinCode(
                      e.target.value
                        .toUpperCase()
                        .replace(/[^A-F0-9]/g, "")
                        .slice(0, ROOM_CODE_LENGTH),
                    );
                    network.setError("");
                  }}
                  maxLength={ROOM_CODE_LENGTH}
                  placeholder="Código de sala"
                />
                <button
                  className="secondary-button"
                  disabled={!network.connected}
                  type="submit"
                >
                  Entrar <ArrowRight size={15} />
                </button>
              </form>
            </div>
          </div>
          <div className="section-label rooms-list-heading">
            <h2>SALAS ABIERTAS</h2>
            <span>{network.rooms.length} disponibles</span>
          </div>
          {network.rooms.length === 0 ? (
            <div className="empty-rooms">
              <Globe2 size={27} />
              <div>
                <p>No hay salas abiertas. Crea una e invita a tu pana.</p>
              </div>
            </div>
          ) : (
            <div className="rooms-list">
              {network.rooms.map((room) => (
                <div key={room.code}>
                  <img src={`/assets/${room.stage}.webp`} alt="" />
                  <div>
                    <strong>{room.name}</strong>
                    <span>
                      {stageById(room.stage).location} · {room.players.length}/2
                      jugadores
                    </span>
                  </div>
                  <button
                    className="secondary-button"
                    onClick={() => {
                      if (validateName())
                        network.send({
                          type: "join",
                          code: room.code,
                          name: name.trim(),
                          fighter,
                          wins,
                        });
                    }}
                  >
                    Unirme <ArrowRight size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function FighterDetail({
  fighter,
  wins,
  onClose,
  onSelect,
}: {
  fighter: FighterId;
  wins: number;
  onClose: () => void;
  onSelect: () => void;
}) {
  const f = fighterById(fighter);
  const personality = personalityById(fighter);
  const finale = finaleById(fighter);
  return (
    <Modal title={f.name} wide onClose={onClose}>
      <div className="fighter-detail" style={colorStyle(f.color)}>
        <div className="detail-art">
          <span className="detail-backdrop" />
          <Portrait fighter={f.id} />
          <span>{f.role}</span>
        </div>
        <div className="detail-info">
          <span className="eyebrow">{f.title}</span>
          <p>{f.description}</p>
          <div className="character-identity">
            <strong>{personality.realName}</strong>
            <span>{personality.portrayal}</span>
          </div>
          {personality.quote && (
            <blockquote className="character-quote">
              “{personality.quote.text}”
              <a
                href={personality.quote.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                Ver referencia <ArrowRight size={12} />
              </a>
            </blockquote>
          )}
          {personality.sources.length > 0 && (
            <details className="character-references">
              <summary>Fotos, videos y referencias</summary>
              <div>
                {personality.sources.map((source) => (
                  <a
                    key={source.url}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {source.title} <ArrowRight size={12} />
                  </a>
                ))}
              </div>
            </details>
          )}
          <div className="special-description">
            {wins < (f.specialUnlockWins ?? 0) ? (
              <LockKeyhole size={18} />
            ) : (
              <Zap size={18} />
            )}
            <div>
              <strong>{f.special}</strong>
              <span>
                <kbd>L</kbd> Especial · 25 de energía
              </span>
              {f.specialUnlockWins !== undefined && (
                <span>
                  {wins < f.specialUnlockWins
                    ? `Gana ${f.specialUnlockWins} peleas con ${f.shortName} (${wins}/${f.specialUnlockWins})`
                    : "Especial desbloqueado"}
                </span>
              )}
            </div>
          </div>
          <h3>Tu libro de combos</h3>
          <div className="combo-list">
            {f.combos.map((combo, i) => {
              const threshold = [0, 1, 3][i];
              const unlocked = wins >= threshold;
              return (
                <div className={unlocked ? "unlocked" : ""} key={combo}>
                  <span>
                    {unlocked ? <Check size={16} /> : <LockKeyhole size={15} />}
                  </span>
                  <div>
                    <strong>{i === 2 && finale ? finale.title : combo}</strong>
                    <small>
                      {unlocked
                        ? i === 2
                          ? "Desbloqueado · 75 de energía"
                          : "Listo para pelear"
                        : `Gana ${threshold} ${threshold === 1 ? "pelea" : "peleas"} con ${f.shortName} (${wins}/${threshold})`}
                    </small>
                    {i === 2 && finale && <small>{finale.description}</small>}
                  </div>
                  <kbd>{["J → K", "J → J → K", "I"][i]}</kbd>
                </div>
              );
            })}
          </div>
          {finale && (
            <p className="finale-detail-note">
              {finale.mode === "projectile"
                ? "La definitiva lanza una onda a distancia. Puede bloquearse o esquivarse y consume 75 de energía, incluso si falla."
                : finale.mode === "transformation"
                  ? "La definitiva transforma al personaje durante seis segundos de combate. Sus ataques hacen un 20 % más de daño y consume 75 de energía."
                  : "La definitiva atrapa al rival a corta distancia. Puede bloquearse antes de que empiece la escena y consume 75 de energía."}
            </p>
          )}
          <button className="primary-button" onClick={onSelect}>
            Elegir a {f.shortName} <ArrowRight size={17} />
          </button>
        </div>
      </div>
    </Modal>
  );
}
