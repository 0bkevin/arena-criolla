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
  FIGHTERS,
  fighterById,
  type FighterCategory,
  type FighterId,
  type StageDefinition,
  type StageId,
} from "../../../shared/roster/roster";
import type { useArenaNetwork } from "../../app/useArenaNetwork";
import type { GameMode } from "../match/Game";
import { assetUrl } from "../../game/assets/asset-url";
import { DuelPreview } from "./DuelPreview";
import { FighterGrid, RosterEmpty } from "./FighterGrid";
import { LobbyMarquee } from "./LobbyMarquee";
import { LobbyModeRow } from "./LobbyModeRow";
import { NetworkNotice } from "./NetworkNotice";
import { ReadyPanel } from "./ReadyPanel";
import { RosterPagination } from "./RosterPagination";
import { RosterToolbar } from "./RosterToolbar";
import { StageStrip } from "./StageStrip";
import { useFighterWarmup } from "./useFighterWarmup";

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
  /** Hover, focus or press on the start button: warm the match art. */
  onStartIntent?: () => void;
  onReady: (ready: boolean) => void;
  onInvite: () => void;
}

export const MIN_PAGE_SIZE = 10;
const fighterNameOrder = new Intl.Collator("es", { sensitivity: "base" });
export const rosterOrder = (
  a: { name: string },
  b: { name: string },
  descending = false,
) => fighterNameOrder.compare(a.name, b.name) * (descending ? -1 : 1);

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
        .sort((a, b) => rosterOrder(a, b, descending)),
    [props.fighters, category, descending],
  );
  const rosterIds = roster.map((item) => item.id).join("|");
  const pageCount = Math.max(1, Math.ceil(roster.length / pageSize));
  const currentPage = Math.min(Math.floor(pageStart / pageSize), pageCount - 1);
  const visibleFighters = roster.slice(
    currentPage * pageSize,
    currentPage * pageSize + pageSize,
  );
  const warmup = useFighterWarmup();
  const rivalPlayer = network.room?.players.find(
    (player) => player.id !== network.id,
  );
  const opponent =
    mode === "online"
      ? rivalPlayer
        ? fighterById(rivalPlayer.fighter)
        : null
      : fighterById(rival);
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
      <LobbyMarquee />

      <LobbyModeRow
        mode={mode}
        onMode={props.onMode}
        onModeKeys={props.onModeKeys}
        onProgress={() => props.onModal("progress")}
      />

      {((network.error && mode === "online") || network.opponentLeft) && (
        <NetworkNotice network={network} />
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
            style={{
              backgroundImage: `url(${assetUrl(`/assets/${stage.id}.webp`)})`,
            }}
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
            <DuelPreview
              mode={mode}
              fighter={fighter}
              opponent={opponent}
              pickingRival={pickingRival}
              ownLabel={ownLabel}
              rivalLabel={rivalLabel}
              onTarget={setTarget}
              onDetail={props.onDetail}
            />
            <div className="arcade-roster">
              <RosterToolbar
                mode={mode}
                pickingRival={pickingRival}
                ownLabel={ownLabel}
                rivalLabel={rivalLabel}
                canSurprise={roster.some((item) => item.id !== activeFighter)}
                query={props.query}
                searchInput={props.searchInput}
                category={category}
                descending={descending}
                onTarget={setTarget}
                onSurprise={surpriseFighter}
                onQuery={props.onQuery}
                onClearQuery={props.onClearQuery}
                onCategory={setCategory}
                onToggleSort={() => setDescending((current) => !current)}
              />
              <FighterGrid
                ref={rosterGrid}
                fighters={visibleFighters}
                selection={{
                  activeFighter,
                  fighter,
                  opponentId: opponent?.id,
                  pickingRival,
                  ownLabel,
                  rivalLabel,
                }}
                warmup={warmup}
                onPick={(id) =>
                  pickingRival ? props.onRival(id) : props.onFighter(id)
                }
                onRosterKeys={props.onRosterKeys}
              />
              {!roster.length && (
                <RosterEmpty
                  onShowAll={() => {
                    props.onClearQuery();
                    setCategory("all");
                    setPageStart(0);
                  }}
                />
              )}
              {roster.length > 0 && (
                <RosterPagination
                  currentPage={currentPage}
                  pageCount={pageCount}
                  onPage={(page) => setPageStart(page * pageSize)}
                />
              )}
              <span className="sr-only" role="status">
                Luchador seleccionado para{" "}
                {pickingRival ? rivalLabel : ownLabel}:{" "}
                {fighterById(activeFighter).name}.
              </span>
            </div>
          </div>
        </section>

        <StageStrip
          stage={stage}
          stageLocked={stageLocked}
          onStage={props.onStage}
          onMap={() => props.onModal("stages")}
        />

        <ReadyPanel
          ref={props.setupPanel}
          mode={mode}
          difficulty={props.difficulty}
          network={network}
          onDifficulty={props.onDifficulty}
          onStart={props.onStart}
          onStartIntent={props.onStartIntent}
          onReady={props.onReady}
          onInvite={props.onInvite}
        />
      </div>
    </main>
  );
}
