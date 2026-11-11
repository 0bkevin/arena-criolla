import type { RefObject } from "react";
import { ArrowDownAZ, ArrowDownZA, Search, X } from "lucide-react";
import type { FighterCategory } from "../../../shared/roster/roster";
import type { GameMode } from "../match/Game";
import { PixelIcon } from "../ui/PixelIcon";
import { RosterFilter } from "./RosterFilter";

/** Player target picker, random pick, search, collection filter and sort. */
export function RosterToolbar({
  mode,
  pickingRival,
  ownLabel,
  rivalLabel,
  canSurprise,
  query,
  searchInput,
  category,
  descending,
  onTarget,
  onSurprise,
  onQuery,
  onClearQuery,
  onCategory,
  onToggleSort,
}: {
  mode: GameMode;
  pickingRival: boolean;
  ownLabel: string;
  rivalLabel: string;
  canSurprise: boolean;
  query: string;
  searchInput: RefObject<HTMLInputElement | null>;
  category: "all" | FighterCategory;
  descending: boolean;
  onTarget: (target: "p1" | "p2") => void;
  onSurprise: () => void;
  onQuery: (query: string) => void;
  onClearQuery: () => void;
  onCategory: (category: "all" | FighterCategory) => void;
  onToggleSort: () => void;
}) {
  return (
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
          onClick={() => onTarget("p1")}
        >
          {ownLabel}
        </button>
        {mode !== "online" && (
          <button
            className={pickingRival ? "active p2" : "p2"}
            aria-pressed={pickingRival}
            aria-label={`Elegir luchador para ${rivalLabel}`}
            onClick={() => onTarget("p2")}
          >
            {rivalLabel}
          </button>
        )}
      </div>
      <button
        className="roster-random"
        onClick={onSurprise}
        disabled={!canSurprise}
        aria-label={`Elegir luchador al azar para ${pickingRival ? rivalLabel : ownLabel}`}
        title="Sorpréndeme"
      >
        <PixelIcon kind="dice" size={19} />
        <span>Sorpréndeme</span>
      </button>
      <div className="fighter-search arcade-search">
        <Search size={14} aria-hidden="true" />
        <input
          ref={searchInput}
          aria-label="Buscar luchador"
          placeholder="Buscar luchador"
          autoComplete="off"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              onClearQuery();
            }
          }}
        />
        {query && (
          <button
            className="roster-search-clear"
            aria-label="Limpiar búsqueda"
            onClick={onClearQuery}
          >
            <X size={14} />
          </button>
        )}
      </div>
      <RosterFilter value={category} onChange={onCategory} />
      <button
        className="roster-sort"
        aria-label={descending ? "Ordenar de A a Z" : "Ordenar de Z a A"}
        title={
          descending ? "Orden Z–A. Cambiar a A–Z" : "Orden A–Z. Cambiar a Z–A"
        }
        onClick={onToggleSort}
      >
        {descending ? <ArrowDownZA size={18} /> : <ArrowDownAZ size={18} />}
      </button>
    </div>
  );
}
