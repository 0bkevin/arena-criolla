import { ArrowRight } from "lucide-react";
import { fighterById } from "../../../shared/roster/roster";
import { INTRO_COUNTDOWN_START } from "../../../shared/engine/presentation";
import type { MatchState, PlayerIndex } from "../../../shared/engine/engine";

interface Props {
  view: MatchState;
  /** The fighter whose entrance is playing, or null during the countdown. */
  presenting: PlayerIndex | null;
  touch: boolean;
  onSkip: () => void;
}

/** Entrance name cards with a skip button, then the 3-2-1 countdown. */
export function IntroOverlay({ view, presenting, touch, onSkip }: Props) {
  const cinematic = presenting !== null;
  return cinematic ? (
    <div className="cinematic-overlay">
      {view.players.map((player, side) => {
        const def = fighterById(player.config.fighter);
        return (
          <div
            key={side}
            className={`cinematic-name cinematic-name-${side}${presenting === side ? " is-presenting" : ""}`}
          >
            <strong>{def.name}</strong>
          </div>
        );
      })}
      <button
        className="skip-entrances"
        aria-label="Saltar presentaciones"
        aria-keyshortcuts="Space"
        onClick={onSkip}
      >
        Saltar intro {!touch && <kbd>Espacio</kbd>}{" "}
        <ArrowRight size={14} aria-hidden="true" />
      </button>
    </div>
  ) : (
    <div className="countdown-overlay">
      <strong>
        {view.tick - INTRO_COUNTDOWN_START < 120
          ? Math.max(
              1,
              3 - Math.floor((view.tick - INTRO_COUNTDOWN_START) / 40),
            )
          : "¡DALE!"}
      </strong>
    </div>
  );
}
