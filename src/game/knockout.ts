import { WORLD } from "../../shared/arena";
import { platformsAtTick } from "../../shared/content";
import type { MatchState } from "../../shared/engine";
import { activeRunway } from "../../shared/field-finales";

export const KNOCKOUT_HOLD_MS = 2000;
export const KNOCKOUT_RECOIL_MS = 650;

/** Finish the last impact visually without advancing the decided match. */
export function sampleKnockout(
  state: MatchState,
  elapsedMs: number,
  reducedMotion = false,
): MatchState {
  const elapsed = Math.max(0, Math.min(KNOCKOUT_HOLD_MS, elapsedMs));
  const ticks = Math.max(0, elapsed / (1000 / 60) - state.hitstop);
  const flight = reducedMotion ? 0 : ticks * 0.65;
  const platforms = [
    ...platformsAtTick(state.stage, state.tick).map((platform, index) => ({
      ...platform,
      index,
    })),
    {
      x: WORLD.left,
      y: WORLD.floor,
      width: WORLD.right - WORLD.left,
      index: -1,
    },
  ]
    // Keep the same five-pixel support margin as the combat engine.
    .map((platform) => ({
      ...platform,
      x: platform.x - 5,
      width: platform.width + 10,
    }))
    .sort((a, b) => a.y - b.y);
  return {
    ...state,
    shake: reducedMotion ? 0 : state.shake * Math.exp(-ticks / 4),
    hitstop: Math.max(0, state.hitstop - elapsed / (1000 / 60)),
    effects: state.effects
      .map((effect) => ({ ...effect, life: effect.life - ticks }))
      .filter((effect) => effect.life > 0),
    players: state.players.map((player) => {
      if (flight === 0 || (player.stocks > 0 && activeRunway(state, player)))
        return player;
      const xAt = (time: number) =>
        player.x + player.vx * 8 * (1 - Math.exp(-time / 8));
      let y = player.y;
      let vy = player.vy;
      let support = player.grounded
        ? platforms.find(
            (platform) =>
              Math.abs(y - platform.y) < 2 &&
              player.x >= platform.x &&
              player.x <= platform.x + platform.width,
          )
        : undefined;
      let time = 0;
      // Resolve exact landings and ledge exits, independent of sampling cadence.
      // After landing, each subsequent contact can only be on a lower surface.
      for (let contacts = 0; contacts <= platforms.length; contacts++) {
        const departed = support;
        if (support) {
          y = support.y;
          vy = 0;
          const edge = player.vx > 0 ? support.x + support.width : support.x;
          const fraction = (edge - player.x) / (player.vx * 8);
          const leaveTime =
            player.vx !== 0 && fraction >= 0 && fraction < 1
              ? -8 * Math.log1p(-fraction)
              : Infinity;
          time = Math.min(flight, Math.max(time, leaveTime));
          if (time >= flight) break;
        }
        support = undefined;
        let delta = flight - time;
        for (const platform of platforms) {
          if (platform === departed) continue;
          const discriminant = vy ** 2 + 1.04 * (platform.y - y);
          if (discriminant < 0) continue;
          const landingTime = (-vy + Math.sqrt(discriminant)) / 0.52;
          if (landingTime < 0 || landingTime > delta) continue;
          const landingX = xAt(time + landingTime);
          if (landingX < platform.x || landingX > platform.x + platform.width)
            continue;
          delta = landingTime;
          support = platform;
        }
        y += vy * delta + 0.26 * delta ** 2;
        vy += 0.52 * delta;
        time += delta;
        if (!support) break;
      }
      return {
        ...player,
        x: xAt(flight),
        y,
        vx: player.vx * Math.exp(-flight / 8),
        vy,
        grounded: Boolean(support),
        supportPlatform: support?.index ?? null,
      };
    }) as MatchState["players"],
  };
}
