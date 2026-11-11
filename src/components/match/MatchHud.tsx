import { Heart, Zap } from "lucide-react";
import { fighterById } from "../../../shared/roster/roster";
import type { MatchState } from "../../../shared/engine/engine";
import { SuperMeter } from "./SuperMeter";

interface Props {
  view: MatchState;
  location: string;
}

/** Both fighters' health, stocks and energy, the clock and the venue. */
export function MatchHud({ view, location }: Props) {
  return (
    <>
      <div className="match-hud">
        {view.players.map((p, i) => {
          const def = fighterById(p.config.fighter);
          return (
            <div
              key={i}
              className={`player-hud player-${i}`}
              style={{ "--fighter-color": def.color }}
            >
              <div className="hud-label">
                <span className="player-number">P{i + 1}</span>
                <strong>{p.config.name}</strong>
                <span className="hud-character">{def.shortName}</span>
              </div>
              <div
                className={`health-track${p.hp > 0 && p.hp <= 25 ? " is-low" : ""}`}
                style={{ "--hp": `${p.hp}%` }}
              >
                <div style={{ width: `${p.hp}%` }} />
                <span>{Math.ceil(p.hp)}</span>
              </div>
              <div className="hud-bottom">
                <div className="stock-hearts">
                  {[0, 1].map((stock) => (
                    <Heart
                      size={13}
                      key={stock}
                      className={stock < p.stocks ? "alive" : ""}
                      fill={stock < p.stocks ? "currentColor" : "none"}
                    />
                  ))}
                </div>
                <SuperMeter player={p} tick={view.tick} />
                <Zap size={12} />
                <span>{Math.floor(p.energy)}%</span>
              </div>
            </div>
          );
        })}
        <div
          className={`match-clock${view.remaining <= 10 * 60 ? " is-urgent" : ""}`}
        >
          <strong
            className={
              view.remaining > 99 * 60 ? "match-clock-minutes" : undefined
            }
          >
            {view.remaining > 99 * 60
              ? "2 min"
              : Math.ceil(view.remaining / 60)
                  .toString()
                  .padStart(2, "0")}
          </strong>
        </div>
      </div>
      <span className="arena-location">{location}</span>
    </>
  );
}
