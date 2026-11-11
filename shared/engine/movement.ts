// Fighter physics after contact: retreat limit, gravity, landing and body
// separation.
import { MAX_FIGHTER_SEPARATION, WORLD } from "./arena";
import type { Platform } from "../roster/roster";
import { activeArenaPerformance, mountedFinale } from "./finales/arena-finales";
import { activeRunway } from "./finales/field-finales";
import type { Input, MatchState } from "./types";

export function limitRetreat(
  s: MatchState,
  origins: number[],
  carried: number[],
) {
  if (s.players.some((p) => p.stocks <= 0 || p.hp <= 0)) return;
  const direction = Math.sign(origins[1] - origins[0]) || 1;
  const next = s.players.map((p) => p.x + p.vx);
  const excess =
    (next[1] - next[0]) * direction -
    Math.max(MAX_FIGHTER_SEPARATION, Math.abs(origins[1] - origins[0]));
  if (excess <= 0) return;
  const outward = s.players.map((p, i) =>
    p.stun > 0
      ? 0
      : Math.max(
          0,
          (next[i] - origins[i] - carried[i] - (p.recoilVx ?? 0)) *
            (i === 0 ? -direction : direction),
        ),
  );
  const total = outward[0] + outward[1];
  if (total <= 0) return;
  // Share the remaining retreat space fairly; damage and platform carry stay free.
  s.players.forEach((p, i) => {
    const away = i === 0 ? -direction : direction;
    const blocked = (Math.min(excess, total) * outward[i]) / total;
    const scripted = Math.min(
      blocked,
      Math.max(0, (p.x - origins[i] - carried[i]) * away),
    );
    p.x -= scripted * away;
    p.vx -= (blocked - scripted) * away;
  });
}

/** Integrate one fighter's motion and land it on the highest surface it crossed. */
export function moveFighter(
  s: MatchState,
  i: number,
  input: Input,
  carriedPlatform: number | null,
  stagePlatforms: Platform[],
  priorPlatforms: Platform[],
) {
  const p = s.players[i];
  const previousY = p.y;
  p.vy += 0.52;
  p.x += p.vx;
  p.y += p.vy;
  p.grounded = false;
  p.supportPlatform = null;
  const platforms = [
    ...stagePlatforms.map((platform, index) => ({
      ...platform,
      index,
      previousY:
        carriedPlatform === index ? platform.y : priorPlatforms[index].y,
    })),
    {
      x: WORLD.left,
      y: WORLD.floor,
      width: WORLD.right - WORLD.left,
      index: -1,
      previousY: WORLD.floor,
    },
  ].sort((a, b) => a.y - b.y);
  for (const platform of platforms) {
    if ((input.down || p.dropThrough > 0) && platform.index !== -1) continue;
    const relativeFall = p.y - previousY - (platform.y - platform.previousY);
    if (
      relativeFall >= 0 &&
      p.x >= platform.x - 5 &&
      p.x <= platform.x + platform.width + 5 &&
      previousY <= platform.previousY + 2 &&
      p.y >= platform.y
    ) {
      p.y = platform.y;
      p.vy = 0;
      p.grounded = true;
      p.supportPlatform = platform.index;
      p.jumps = 0;
      break;
    }
  }
  if (p.grounded && p.stun > 0) {
    p.vx *= 0.89;
    p.recoilVx = (p.recoilVx ?? 0) * 0.89;
  }
}

/** Push overlapping fighters apart, then drop anyone pushed off their support. */
export function separateFighters(s: MatchState, stagePlatforms: Platform[]) {
  const [a, b] = s.players;
  if (
    Math.abs(a.x - b.x) < 43 &&
    Math.abs(a.y - b.y) < 80 &&
    !a.dash &&
    !b.dash &&
    ![a, b].some((p) => {
      const field = activeArenaPerformance(s, p);
      return field && mountedFinale(field);
    })
  ) {
    const sign = b.x >= a.x ? 1 : -1;
    const push = (43 - Math.abs(a.x - b.x)) / 2;
    a.x -= sign * push;
    b.x += sign * push;
    // Body separation can push a fighter beyond the surface checked above.
    for (const p of s.players) {
      if (!p.grounded || activeRunway(s, p)) continue;
      const support =
        p.supportPlatform === -1
          ? { x: WORLD.left, width: WORLD.right - WORLD.left }
          : p.supportPlatform === null
            ? undefined
            : stagePlatforms[p.supportPlatform];
      if (
        !support ||
        p.x < support.x - 5 ||
        p.x > support.x + support.width + 5
      ) {
        p.grounded = false;
        p.supportPlatform = null;
      }
    }
  }
}
