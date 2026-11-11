import type { KeyboardEvent, RefObject } from "react";
import { ArrowRight } from "lucide-react";
import type {
  FighterDefinition,
  FighterId,
} from "../../../shared/roster/roster";
import { PixelIcon } from "../ui/PixelIcon";
import { Portrait } from "../ui/Portrait";
import { colorStyle } from "../ui/fighter-color";
import type { useFighterWarmup } from "./useFighterWarmup";

interface Selection {
  /** The fighter the current target (P1 or the rival) has picked. */
  activeFighter: FighterId;
  fighter: FighterId;
  opponentId: FighterId | undefined;
  pickingRival: boolean;
  ownLabel: string;
  rivalLabel: string;
}

function FighterCard({
  item,
  selection: {
    activeFighter,
    fighter,
    opponentId,
    pickingRival,
    ownLabel,
    rivalLabel,
  },
  warmup,
  onPick,
}: {
  item: FighterDefinition;
  selection: Selection;
  warmup: ReturnType<typeof useFighterWarmup>;
  onPick: (id: FighterId) => void;
}) {
  const p1 = fighter === item.id;
  const p2 = opponentId === item.id;
  return (
    <button
      className={`fighter-card ${activeFighter === item.id ? "chosen" : ""} ${p1 ? "picked-p1" : ""} ${p2 ? "picked-p2" : ""} ${pickingRival ? "picking-p2" : ""}`}
      style={colorStyle(item.color)}
      aria-label={`Elegir a ${item.name}`}
      aria-pressed={activeFighter === item.id}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") warmup.hoverCard(item.id);
      }}
      onPointerLeave={warmup.cancelHover}
      onPointerDown={() => warmup.warmSelection(item.id)}
      onFocus={() => warmup.warmSelection(item.id)}
      onClick={() => onPick(item.id)}
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
}

/** The current roster page as selectable fighter cards. */
export function FighterGrid({
  ref,
  fighters,
  selection,
  warmup,
  onPick,
  onRosterKeys,
}: {
  ref: RefObject<HTMLDivElement | null>;
  fighters: readonly FighterDefinition[];
  selection: Selection;
  warmup: ReturnType<typeof useFighterWarmup>;
  onPick: (id: FighterId) => void;
  onRosterKeys: (event: KeyboardEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      className="fighter-grid"
      ref={ref}
      role="group"
      aria-label="Seleccionar luchador"
      onKeyDown={onRosterKeys}
    >
      {fighters.map((item) => (
        <FighterCard
          key={item.id}
          item={item}
          selection={selection}
          warmup={warmup}
          onPick={onPick}
        />
      ))}
    </div>
  );
}

/** Shown when the search and collection filter leave no fighters. */
export function RosterEmpty({ onShowAll }: { onShowAll: () => void }) {
  return (
    <div className="fighter-empty" role="status">
      <PixelIcon kind="gamepad" size={24} />
      <strong>Ese pana no está en la arena.</strong>
      <button onClick={onShowAll}>
        Ver todos <ArrowRight size={14} />
      </button>
    </div>
  );
}
