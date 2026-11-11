import { useEffect, useRef } from "react";
import type { FighterId } from "../../../shared/roster/roster";
import { loadSprite } from "../../game/assets/assets";

/**
 * Cards draw small busts, but selecting one animates the fighter's atlas and
 * entrance art: start loading it when the player approaches a card.
 */
export function useFighterWarmup() {
  const cardIntent = useRef(0);
  const warmSelection = (id: FighterId) => {
    window.clearTimeout(cardIntent.current);
    void loadSprite(id, { entrance: true, priority: "high" }).catch(() => {});
  };
  // Sweeping the pointer across the grid should not load every card it crosses.
  const hoverCard = (id: FighterId) => {
    window.clearTimeout(cardIntent.current);
    cardIntent.current = window.setTimeout(() => warmSelection(id), 120);
  };
  const cancelHover = () => window.clearTimeout(cardIntent.current);
  useEffect(() => () => window.clearTimeout(cardIntent.current), []);
  return { warmSelection, hoverCard, cancelHover };
}
