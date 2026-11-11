import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Check } from "lucide-react";
import {
  FIGHTERS,
  fighterById,
  isFighter,
  stageById,
  type FighterId,
  type StageId,
} from "../../shared/roster/roster";
import {
  createMatch,
  type MatchState,
  type PlayerIndex,
} from "../../shared/engine/engine";
import {
  normalizeRoomCode,
  ROOM_CODE_LENGTH,
} from "../../shared/lobby/room-code";
import { useArenaNetwork } from "./useArenaNetwork";
import {
  getPreference,
  readProgress,
  saveProgress,
  setPreference,
  type Progress,
} from "./storage";
import {
  initAudio,
  listenForAudioActivation,
  preloadReactions,
  setSound,
  sound,
  stopReactions,
} from "../game/audio/audio";
import { preloadAssets, prefetchMatchAssets } from "../game/assets/assets";
import { FighterDetail } from "../components/lobby/FighterDetail";
import { StageGallery } from "../components/lobby/StageGallery";
import { ArcadeLobby } from "../components/lobby/ArcadeLobby";
import { PixelIcon } from "../components/ui/PixelIcon";
import { Game, type GameMode } from "../components/match/Game";
import { Modal } from "../components/ui/Modal";
import { Help } from "../components/help/Help";
import { beginMobilePlay, leaveLandscape } from "../game/viewport/mobile";
import { ProgressDialog } from "../components/lobby/ProgressDialog";
import { RoomsDialog } from "../components/lobby/RoomsDialog";
import { RosterDialog } from "../components/lobby/RosterDialog";
import { constrainedConnection, lobbyMatchup } from "./lobby-art";
import { recordMatch } from "./progress";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import "../styles/dialog.css";
import "../styles/app.css";
import "../styles/lobby.css";
import "../styles/arcade-theme.css";
import "../styles/mobile-game.css";
import "../styles/ui-accessibility.css";
import "../styles/victory-screen.css";
import "../styles/desktop-controls.css";
import "../styles/progress.css";
import "../styles/fighter-moves.css";

export { warmLobbyArt } from "./lobby-art";

export type LobbyModal =
  "help" | "fighters" | "stages" | "progress" | "rooms" | null;

export function App() {
  const [mode, setMode] = useState<GameMode>("practice");
  const [initialMatchup] = useState(lobbyMatchup);
  const [fighter, setFighter] = useState<FighterId>(initialMatchup[0]);
  const [rival, setRival] = useState<FighterId>(initialMatchup[1]);
  const [fighterQuery, setFighterQuery] = useState("");
  const [debouncedFighterQuery, setDebouncedFighterQuery] = useState("");
  const [stage, setStage] = useState<StageId>("caracas");
  const [difficulty, setDifficulty] = useState<"easy" | "normal" | "hard">(
    "normal",
  );
  const [progress, setProgress] = useState<Progress>(readProgress);
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const [audio, setAudio] = useState(() => getPreference("sound", true));
  const [modal, setModal] = useState<LobbyModal>(null);
  const [detail, setDetail] = useState<FighterId | null>(null);
  const [localMatch, setLocalMatch] = useState<MatchState | null>(null);
  const [notice, setNotice] = useState("");
  const [rematchWaiting, setRematchWaiting] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [privateRoom, setPrivateRoom] = useState(false);
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
  }, [fighter, rival]);

  const active = localMatch || network.match?.initial;
  const chosen = fighterById(fighter);
  const chosenStage = stageById(network.room?.stage || stage);
  const wins = Number(progress.wins[fighter]) || 0;
  const host = network.room?.host === network.id;
  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedFighterQuery(fighterQuery),
      250,
    );
    return () => window.clearTimeout(timeout);
  }, [fighterQuery]);
  const searchTerm = debouncedFighterQuery
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  const visibleFighters = useMemo(
    () =>
      FIGHTERS.filter((f) =>
        `${f.name} ${f.shortName} ${f.role}`
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .includes(searchTerm),
      ),
    [searchTerm],
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
  useEffect(listenForAudioActivation, []);
  useEffect(() => {
    if (network.room) {
      setMode("online");
      setModal((current) => (current === "rooms" ? null : current));
    }
  }, [network.room]);
  useEffect(() => {
    // Entering or resuming a room, show the fighter the server holds for this
    // seat; after a reload the local pick would otherwise be a random one.
    const seat = network.room?.players.find((p) => p.id === network.id);
    if (seat) setFighter(seat.fighter);
  }, [network.room?.code, network.id]);
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
  const [engaged, setEngaged] = useState(false);
  useEffect(() => {
    // Visitors who never touch the page should not download match art.
    if (engaged) return;
    const engage = () => setEngaged(true);
    const events = ["pointerdown", "keydown", "touchstart"] as const;
    for (const type of events)
      window.addEventListener(type, engage, { once: true, passive: true });
    return () => {
      for (const type of events) window.removeEventListener(type, engage);
    };
  }, [engaged]);
  const warmMatch = () => {
    if (network.room || active || constrainedConnection()) return;
    prefetchMatchAssets([fighter, rival], [stage]);
  };
  useEffect(() => {
    // Offline matches start right after the player taps Jugar: fetch the attack
    // and finale art in idle time so the start does not wait on the network.
    // Each pairing is a few MB, so wait until the choice has settled instead
    // of warming every fighter the player merely browses past.
    if (!engaged || network.room || active || constrainedConnection()) return;
    let idle = 0;
    const timer = window.setTimeout(() => {
      const warm = () => prefetchMatchAssets([fighter, rival], [stage]);
      if ("requestIdleCallback" in window)
        idle = window.requestIdleCallback(warm, { timeout: 4000 });
      else warm();
    }, 2000);
    return () => {
      clearTimeout(timer);
      if (idle) window.cancelIdleCallback(idle);
    };
  }, [engaged, fighter, rival, stage, network.room, active]);
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
  // Fighter voice clips load when a match starts (Game and startLocal), not on
  // every lobby click.
  const clickSound = () => {
    initAudio();
    sound("select");
  };
  const toggleAudio = () => {
    setAudio(!audio);
    setSound(!audio);
    if (!audio) {
      initAudio();
      if (active) preloadReactions();
    }
  };
  const clearFighterSearch = () => {
    setFighterQuery("");
    setDebouncedFighterQuery("");
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
    setupPanel.current
      ?.querySelector<HTMLButtonElement>(".arcade-start")
      ?.focus({ preventScroll: true });
  };
  const startLocal = () => {
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
            name: "Jugador 1",
            fighter,
            wins: Number(saved.wins[fighter]) || 0,
          },
          {
            name: mode === "practice" ? "CPU" : "Jugador 2",
            fighter: rival,
            wins: Number(saved.wins[rival]) || 0,
          },
        ],
        crypto.randomUUID(),
      ),
    );
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const recordResult = (state: MatchState, index: PlayerIndex) => {
    const saved = recordMatch(progressRef.current, state, index, mode);
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

  return (
    <div className={`app-shell arcade-app ${active ? "in-match" : "in-lobby"}`}>
      <SiteHeader
        active={Boolean(active)}
        modal={modal}
        connected={network.connected}
        audio={audio}
        onHome={() => {
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
        onPlay={() => {
          if (!active) setModal(null);
        }}
        onModal={setModal}
        onToggleAudio={toggleAudio}
      />

      {active ? (
        <Game
          key={active.id}
          initial={active}
          mode={localMatch ? mode : "online"}
          difficulty={difficulty}
          remote={network.state}
          localIndex={network.match?.index ?? 0}
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
          difficulty={difficulty}
          query={fighterQuery}
          fighters={visibleFighters}
          network={network}
          searchInput={fighterSearchInput}
          setupPanel={setupPanel}
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
          onStartIntent={warmMatch}
          onReady={(ready) => {
            clickSound();
            if (ready) beginMobilePlay();
            else leaveLandscape();
            network.send({ type: "ready", ready });
          }}
          onInvite={invite}
        />
      )}

      <SiteFooter ref={footer} />
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
        <RosterDialog onDetail={setDetail} onClose={() => setModal(null)} />
      )}
      {modal === "stages" && (
        <Modal title="Escenarios" wide onClose={() => setModal(null)}>
          <StageGallery
            selectedStage={chosenStage.id}
            disabled={Boolean(network.room && !host)}
            onSelect={(id) => {
              selectStage(id);
              setModal(null);
            }}
          />
        </Modal>
      )}
      {detail && (
        <FighterDetail
          key={detail}
          fighter={detail}
          onClose={() => setDetail(null)}
          onSelect={() => {
            selectFighter(detail);
            setDetail(null);
            setModal(null);
          }}
        />
      )}
      {modal === "progress" && (
        <ProgressDialog progress={progress} onClose={() => setModal(null)} />
      )}
      {modal === "rooms" && (
        <RoomsDialog
          network={network}
          fighter={fighter}
          stage={stage}
          wins={wins}
          privateRoom={privateRoom}
          joinCode={joinCode}
          onPrivateRoom={setPrivateRoom}
          onJoinCode={setJoinCode}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
