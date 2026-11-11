// Ring-outs, lost stocks and the end of a match, by knockout or by time.
import { WORLD } from "./arena";
import { fighterById } from "../roster/roster";
import { runwayContacts, supportRunway } from "./finales/field-finales";
import { effect, hurt } from "./combat";
import { RING_OUT_DAMAGE } from "./damage-values";
import { clearFallProtection, setInvincibility } from "./invincibility";
import { PLAYERS, type MatchState, type PlayerIndex } from "./types";

/** Clear the fighter's ongoing actions and mark where they left the arena. */
function leaveArena(
  s: MatchState,
  i: PlayerIndex,
  preserveTransformation = false,
) {
  const p = s.players[i];
  delete p.bufferedAttack;
  delete p.bufferedSuperTicks;
  s.projectiles = s.projectiles.filter(
    (shot) => !shot.tether || shot.owner !== i,
  );
  p.superChargeTicks = 0;
  delete p.knockoutDelay;
  if (!preserveTransformation) delete p.transformation;
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
}

/** Return a fighter to their spawn point, briefly protected. */
function respawn(s: MatchState, i: PlayerIndex, survivingFall = false) {
  const p = s.players[i];
  clearFallProtection(p);
  p.x = i === 0 ? 330 : 750;
  p.y = 260;
  p.vx = 0;
  p.recoilVx = 0;
  p.vy = 0;
  p.grounded = false;
  p.supportPlatform = null;
  p.dropThrough = 0;
  p.jumps = 0;
  p.stun = 0;
  p.attack = null;
  p.attackTick = 0;
  p.attackHit = false;
  p.countered = false;
  p.counterLanded = false;
  p.cooldown = 30;
  p.dash = 0;
  p.blocking = false;
  p.history = [];
  p.combo = "";
  p.comboTick = 0;
  p.comboBonus = 0;
  setInvincibility(p, survivingFall ? 60 : 110);
  if (survivingFall) {
    p.fallProtectionTicks = 60;
    p.fallProtectionBase = 0;
    p.fallProtectionDashBase = 0;
  } else {
    delete p.fallProtectionTicks;
    delete p.fallProtectionBase;
    delete p.fallProtectionDashBase;
    p.energy = Math.max(0, p.energy - 20);
  }
  p.streak = 0;
}

function loseStock(s: MatchState, i: PlayerIndex) {
  const p = s.players[i];
  p.stocks--;
  clearFallProtection(p);
  leaveArena(s, i);
  if (p.stocks <= 0) {
    p.hp = 0;
    return;
  }
  p.hp = 100;
  respawn(s, i);
}

/** A ring-out costs a fixed amount of health, or the stock if that is all left. */
function fall(s: MatchState, i: PlayerIndex) {
  const p = s.players[i];
  if (p.hp <= RING_OUT_DAMAGE) {
    loseStock(s, i);
    return;
  }
  p.hp -= RING_OUT_DAMAGE;
  leaveArena(s, i, true);
  respawn(s, i, true);
}

function outOfArena(p: MatchState["players"][number]) {
  return (
    p.x < WORLD.x - 120 ||
    p.x > WORLD.x + WORLD.width + 120 ||
    p.y > WORLD.y + WORLD.height + 140
  );
}

export function resolveStocks(s: MatchState) {
  for (const i of PLAYERS) {
    const p = s.players[i];
    if (p.stocks <= 0) continue;
    if (p.hp <= 0 && !p.knockoutDelay) loseStock(s, i);
    else if (outOfArena(p)) fall(s, i);
  }
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
