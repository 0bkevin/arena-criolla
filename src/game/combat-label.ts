import { fighterById } from "../../shared/content";
import type { PlayerState } from "../../shared/engine";

/** The category stays readable in combat; requested character lines keep their voice. */
export function combatLabel(player: PlayerState, tick: number): string {
  if (player.attack === "super") return "Definitiva";
  if (player.attack === "special") return "Ataque especial";
  if (!player.combo || tick - player.comboTick >= 75) return "";
  if (player.combo === fighterById(player.config.fighter).combos[2])
    return "Definitiva";
  if (
    player.config.fighter === "capriles" ||
    player.config.fighter === "vallenilla"
  )
    return player.combo;
  return "Combo";
}
