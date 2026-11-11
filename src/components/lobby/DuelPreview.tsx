import { ArrowRight } from "lucide-react";
import {
  fighterById,
  type FighterDefinition,
  type FighterId,
} from "../../../shared/roster/roster";
import type { GameMode } from "../match/Game";
import { PixelIcon } from "../ui/PixelIcon";
import { Portrait } from "../ui/Portrait";
import { colorStyle } from "../ui/fighter-color";

function ContenderLives() {
  return (
    <div className="contender-lives" aria-hidden="true">
      <PixelIcon kind="heart" size={13} />
      <PixelIcon kind="heart" size={13} />
    </div>
  );
}

function ContenderMoves({
  fighter,
  onDetail,
}: {
  fighter: FighterDefinition;
  onDetail: (id: FighterId) => void;
}) {
  return (
    <button
      className="contender-moves"
      title="Ver movimientos"
      onClick={() => onDetail(fighter.id)}
      aria-label={`Ver movimientos de ${fighter.name}`}
    >
      <PixelIcon kind="bolt" size={12} />
      <span>Movimientos</span> <ArrowRight size={12} />
    </button>
  );
}

/** The two contender panels: this client's fighter and the rival or CPU. */
export function DuelPreview({
  mode,
  fighter,
  opponent,
  pickingRival,
  ownLabel,
  rivalLabel,
  onTarget,
  onDetail,
}: {
  mode: GameMode;
  fighter: FighterId;
  opponent: FighterDefinition | null;
  pickingRival: boolean;
  ownLabel: string;
  rivalLabel: string;
  onTarget: (target: "p1" | "p2") => void;
  onDetail: (id: FighterId) => void;
}) {
  const chosen = fighterById(fighter);
  return (
    <div className="duel-preview" aria-label="Vista previa de la pelea">
      <div
        className={`contender-panel contender-p1 ${!pickingRival ? "is-editing" : ""}`}
        style={colorStyle(chosen.color)}
      >
        <button
          className={`contender-player ${!pickingRival ? "editing" : ""}`}
          aria-label={`Elegir luchador para ${ownLabel}`}
          aria-pressed={!pickingRival}
          onClick={() => onTarget("p1")}
        >
          <span>{ownLabel}</span>
          <span className="pixel-cursor" aria-hidden="true">
            ◂
          </span>
        </button>
        <div className="contender-stage">
          <ContenderLives />
          <Portrait
            key={fighter}
            fighter={fighter}
            className="selected-portrait"
            animated
            instantPose
          />
          <span className="contender-shadow" />
        </div>
        <div className="contender-identity" key={`name-${fighter}`}>
          <h3>{chosen.name}</h3>
        </div>
        <ContenderMoves fighter={chosen} onDetail={onDetail} />
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
          onClick={() => onTarget("p2")}
        >
          <span>{rivalLabel}</span>
          <span className="pixel-cursor" aria-hidden="true">
            ▸
          </span>
        </button>
        <div className="contender-stage">
          <ContenderLives />
          {opponent ? (
            <Portrait
              key={opponent.id}
              fighter={opponent.id}
              facing={-1}
              className="selected-portrait"
              animated
              instantPose
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
          <ContenderMoves fighter={opponent} onDetail={onDetail} />
        ) : null}
      </div>
    </div>
  );
}
