import type { FighterDefinition } from "../../../../shared/roster/roster";
import type { MatchState, PlayerState } from "../../../../shared/engine/engine";
import { TECHNIQUES } from "../../../../shared/engine/techniques";
import type { SpriteAsset } from "../../assets/assets";

/** The atlas frame for a fighter's current action and locomotion. */
export function fighterFrame(
  state: MatchState,
  p: PlayerState,
  def: FighterDefinition,
  sprite: SpriteAsset,
) {
  let frame = sprite.battleFrame;
  if (p.stun > 0) frame = 7;
  else if (p.blocking) frame = 1;
  else if (p.attack === "heavy")
    frame = p.attackTick < 6 ? sprite.battleFrame : 6;
  else if (
    p.attack === "light" ||
    p.attack === "super" ||
    p.attack === "special"
  )
    frame = p.attackTick < 4 ? 1 : 5;
  else if (!p.grounded) frame = 4;
  else if (Math.abs(p.vx) > 0.7)
    frame = Math.floor(state.tick / 7) % 2 === 0 ? 2 : 3;
  if (p.attack === "special" && !p.stun)
    frame = specialFrame(state, p, def, sprite) ?? frame;
  return frame;
}

/** Technique-specific timing for a special; undefined keeps the action frame. */
function specialFrame(
  state: MatchState,
  p: PlayerState,
  def: FighterDefinition,
  sprite: SpriteAsset,
) {
  if (def.ability === "signal") {
    // Show the extension when the pulse actually launches, then recover
    // into the current locomotion pose instead of holding a frozen punch.
    const release = p.attackTick - TECHNIQUES.signal.startup;
    return release < 0
      ? p.grounded
        ? 1
        : 4
      : release < 8
        ? 5
        : !p.grounded
          ? 4
          : Math.abs(p.vx) > 0.7
            ? 2 + (Math.floor(state.tick / 7) % 2)
            : sprite.battleFrame;
  }
  if (def.ability === "curtain" && p.attackTick <= 26) return 1;
  if (def.ability === "strum" || def.ability === "tremolo")
    return p.attackTick % 12 < 6 ? 0 : 5;
  if (def.ability === "cuatro") return sprite.battleFrame;
  if (def.ability === "echo") {
    const technique = TECHNIQUES.echo;
    const speaking = technique.pulses!.some(
      (offset) =>
        p.attackTick >= technique.startup + offset &&
        p.attackTick < technique.startup + offset + 9,
    );
    return p.attackTick < technique.startup
      ? 1
      : speaking
        ? 5
        : sprite.battleFrame;
  }
  if (def.ability === "syncopate")
    return p.attackTick > 34 ? 6 : 2 + (Math.floor(p.attackTick / 7) % 2);
  if (def.ability === "zapateo") return p.attackTick % 10 < 4 ? 6 : 0;
  if (def.ability === "pivot") return p.attackTick < 22 ? 4 : 6;
  if (def.ability === "whirl")
    return p.attackTick < TECHNIQUES.whirl.startup
      ? 1
      : p.attackTick < TECHNIQUES.whirl.startup + 9
        ? 5
        : sprite.battleFrame;
  if (["runway", "sprint", "rally", "liberator"].includes(def.ability))
    return p.dash > 0
      ? 2 + (Math.floor(p.attackTick / 4) % 2)
      : sprite.battleFrame;
  if (def.ability === "spin")
    return p.attackTick < 4
      ? 1
      : p.attackTick < TECHNIQUES.spin.startup
        ? 4
        : p.attackTick < TECHNIQUES.spin.startup + 14
          ? 6
          : sprite.battleFrame;
  if (def.ability === "command")
    return p.attackTick < 13
      ? sprite.battleFrame
      : p.attackTick < 22
        ? 6
        : sprite.battleFrame;
  return undefined;
}
