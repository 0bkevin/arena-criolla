import { assetUrl } from "../asset-url";
import {
  useEffect,
  useLayoutEffect,
  type CSSProperties,
  type RefObject,
} from "react";
import { ArrowRight, RotateCcw, Trophy, Zap } from "lucide-react";
import { fighterById, stageById } from "../../shared/content";
import type { MatchState } from "../../shared/engine";
import type { GameMode } from "./Game";
import { VenezuelaStars } from "./CriolloArt";
import { Portrait } from "./Portrait";
import { playVictoryTransition } from "../game/victory-transition";
import { startVictoryMusic } from "../audio";

interface Props {
  state: MatchState;
  mode: GameMode;
  localIndex: number;
  active: boolean;
  overlayRef: RefObject<HTMLDivElement | null>;
  onReady: () => void;
  rematchWaiting?: boolean;
  onRematch: () => void;
  onExit: () => void;
}

/** The result appears directly after the last impact and brief knockout hold. */
export function VictoryScreen({
  state,
  mode,
  localIndex,
  active,
  overlayRef,
  onReady,
  rematchWaiting,
  onRematch,
  onExit,
}: Props) {
  useLayoutEffect(() => {
    if (!overlayRef.current) {
      onReady();
      return;
    }
    return playVictoryTransition(overlayRef.current, onReady);
  }, [state.id, overlayRef, onReady]);
  const winner =
    typeof state.winner === "number" ? state.players[state.winner] : null;
  const musicFighter = winner?.config.fighter ?? "draw";
  useEffect(() => startVictoryMusic(musicFighter), [state.id, musicFighter]);
  const fighter = winner ? fighterById(winner.config.fighter) : null;
  const localWinner = state.winner === localIndex;
  const stats = mode === "local" && winner ? winner : state.players[localIndex];
  const unlocked =
    winner &&
    (mode === "local" || localWinner) &&
    winner.config.wins + 1 === fighter?.specialUnlockWins;

  return (
    <div
      ref={overlayRef}
      className={`victory-screen${winner ? "" : " is-draw"}`}
      data-winner={state.winner ?? "draw"}
      style={
        {
          "--victory-stage": `url("${assetUrl(`/assets/${state.stage}.webp`)}")`,
        } as CSSProperties
      }
      role="dialog"
      aria-modal={active}
      aria-hidden={!active}
      aria-labelledby="result-title"
      aria-describedby="result-description"
      inert={!active}
    >
      <div className="victory-screen-scenery" aria-hidden="true" />
      <div className="victory-screen-slash" aria-hidden="true" />
      <div className="victory-screen-layout">
        <div className="victory-screen-brand" aria-hidden="true">
          <img
            src={assetUrl("/assets/arena-mark.svg")}
            alt=""
            width={30}
            height={30}
          />
          <span>
            ARENA <b>CRIOLLA</b>
          </span>
        </div>
        <div className="victory-screen-copy">
          <h2 id="result-title" className="victory-screen-title">
            {fighter ? (
              <>
                <span>{fighter.shortName}</span> <strong>ganó.</strong>
              </>
            ) : (
              <strong>tablas</strong>
            )}
          </h2>
          <p id="result-description" className="victory-screen-description">
            {winner
              ? mode === "local"
                ? `${winner.config.name} se lleva la victoria.`
                : localWinner
                  ? "La victoria es tuya. ¡Tremendo combate!"
                  : "Esta se la llevó tu rival. La próxima puede ser tuya."
              : "Nadie se lleva la corona. Esto pide revancha."}
          </p>
          <dl
            className="victory-screen-stats"
            aria-label={
              mode === "local" && winner
                ? "Estadísticas del ganador"
                : "Tus estadísticas"
            }
          >
            <div>
              <dt>Golpes conectados</dt>
              <dd>{stats.hits}</dd>
            </div>
            <div>
              <dt>Mejor racha</dt>
              <dd>{stats.peakCombo}</dd>
            </div>
          </dl>
          {unlocked && (
            <p className="victory-screen-unlock">
              <Zap size={16} aria-hidden="true" />
              <span>Especial desbloqueado para {fighter?.shortName}</span>
            </p>
          )}
          <div className="victory-screen-actions">
            <button
              className="victory-screen-rematch"
              disabled={rematchWaiting}
              onClick={onRematch}
            >
              <RotateCcw size={19} aria-hidden="true" />
              {rematchWaiting ? "Esperando a tu pana…" : "¡Revancha!"}
            </button>
            <button className="victory-screen-exit" onClick={onExit}>
              Volver a la selección <ArrowRight size={17} aria-hidden="true" />
            </button>
            <span className="sr-only" role="status">
              {rematchWaiting
                ? "Esperando a que tu pana acepte la revancha."
                : ""}
            </span>
          </div>
        </div>
        <div className="victory-screen-art" aria-hidden="true">
          <VenezuelaStars className="victory-screen-stars" />
          {fighter ? (
            <div className="victory-screen-figure">
              <Portrait
                key={fighter.id}
                fighter={fighter.id}
                facing={state.winner === 0 ? 1 : -1}
                animated
                holdPose
                repeat
              />
            </div>
          ) : (
            <div className="victory-screen-duel">
              {state.players.map((player, index) => (
                <Portrait
                  key={index}
                  fighter={player.config.fighter}
                  facing={index === 0 ? 1 : -1}
                  animated
                  holdPose
                />
              ))}
              <span>VS</span>
            </div>
          )}
          {fighter && (
            <span className="victory-screen-name">
              <Trophy size={17} />
              {fighter.name}
            </span>
          )}
        </div>
        <div className="victory-screen-footer">
          <span>{stageById(state.stage).location}</span>
          <span>
            {mode === "online"
              ? "En línea"
              : mode === "local"
                ? "Versus local"
                : "Contra CPU"}
          </span>
        </div>
      </div>
    </div>
  );
}
