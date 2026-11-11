// Lost stocks and the end of a match, by knockout or by time.
import { WORLD } from "./arena";
import { fighterById } from "../roster/roster";
import { runwayContacts, supportRunway } from "./finales/field-finales";
import { effect, hurt } from "./combat";
import type { MatchState } from "./types";

function loseStock(s: MatchState, i: number) {
  const p = s.players[i];
  delete p.bufferedAttack;
  s.projectiles = s.projectiles.filter(
    (shot) => !shot.tether || shot.owner !== i,
  );
  p.stocks--;
  p.superChargeTicks = 0;
  delete p.knockoutDelay;
  delete p.transformation;
  s.fieldFinales = s.fieldFinales?.filter((field) => field.owner !== i);
  if (!s.fieldFinales?.length) delete s.fieldFinales;
  p.slowTicks = 0;
  p.rootTicks = 0;
  delete p.rootKind;
  effect(
    s,
    Math.max(WORLD.x + 30, Math.min(WORLD.x + WORLD.width - 30, p.x)),
    Math.min(590, p.y - 60),
    "ringout",
    fighterById(p.config.fighter).color,
    {
      owner: i,
      strength: 1.8,
      direction: p.x < WORLD.x + WORLD.width / 2 ? -1 : 1,
    },
  );
  if (p.stocks <= 0) {
    p.hp = 0;
    return;
  }
  p.x = i === 0 ? 330 : 750;
  p.y = 260;
  p.vx = 0;
  p.recoilVx = 0;
  p.vy = 0;
  p.hp = 100;
  p.grounded = false;
  p.supportPlatform = null;
  p.dropThrough = 0;
  p.jumps = 0;
  p.stun = 0;
  p.attack = null;
  p.cooldown = 30;
  p.invincible = 110;
  p.energy = Math.max(0, p.energy - 20);
  p.streak = 0;
}

export function resolveStocks(s: MatchState) {
  s.players.forEach((p, i) => {
    if (p.stocks <= 0) return;
    if (
      (p.hp <= 0 && !p.knockoutDelay) ||
      p.x < WORLD.x - 120 ||
      p.x > WORLD.x + WORLD.width + 120 ||
      p.y > WORLD.y + WORLD.height + 140
    )
      loseStock(s, i);
  });
  const [first, second] = s.players;
  if (s.players.some((p) => p.hp <= 0 && (p.knockoutDelay ?? 0) > 0)) return;
  if (first.stocks <= 0 || second.stocks <= 0) {
    s.phase = "finished";
    s.winner = first.stocks <= 0 ? (second.stocks <= 0 ? "draw" : 1) : 0;
  }
}

export function resolveTimeout(s: MatchState) {
  // A lethal finishing throw has already decided this stock; finish its short
  // physical flight (or bounded fallback) before comparing timeout scores.
  if (s.players.some((p) => p.hp <= 0 && (p.knockoutDelay ?? 0) > 0)) return;
  if (s.remaining <= 0 && s.phase === "playing") {
    supportRunway(s);
    for (const hit of runwayContacts(s))
      hurt(
        s,
        hit.owner,
        hit.damage,
        hit.force,
        hit.direction,
        hit.x,
        hit.y,
        "super",
        8,
      );
    const [a, b] = s.players;
    const scoreA = a.stocks * 100 + a.hp;
    const scoreB = b.stocks * 100 + b.hp;
    s.winner =
      Math.abs(scoreA - scoreB) < 0.01 ? "draw" : scoreA > scoreB ? 0 : 1;
    s.phase = "finished";
  }
}
