// One fixed simulation tick, in the order both players must observe it.
import { INTRO_COUNTDOWN_START, INTRO_TOTAL_TICKS } from "./presentation";
import { platformsAtTick } from "../roster/roster";
import {
  advanceDorangelBite,
  releaseBrokenDorangelGrips,
} from "./finales/dorangel";
import {
  arenaFinaleContacts,
  registerArenaContact,
} from "./finales/arena-finales";
import {
  advanceFieldFinales,
  runwayContacts,
  supportRunway,
} from "./finales/field-finales";
import { hurt } from "./combat";
import { advanceFinale } from "./capture-finale";
import { reflectProjectiles, updateAttack } from "./attacks";
import { updateFighterControls } from "./controls";
import { limitRetreat, moveFighter, separateFighters } from "./movement";
import { advanceProjectiles } from "./projectiles";
import { resolveStocks, resolveTimeout } from "./outcome";
import type { Input, MatchState } from "./types";

/** Advance a match by one simulation tick. */
export function stepMatch(s: MatchState, inputs: [Input, Input]): void {
  for (let i = 0; i < 2; i++) {
    const p = s.players[i];
    if (!inputs[i].superHeld || s.phase !== "playing" || p.hp <= 0)
      p.superChargeTicks = 0;
  }
  if (s.phase === "finished") return;
  if (s.finale) {
    advanceFinale(s, inputs);
    return;
  }
  if (s.hitstop > 0) {
    s.hitstop--;
    s.remaining--;
    s.shake *= 0.88;
    resolveTimeout(s);
    return;
  }
  s.tick++;
  s.shake *= 0.8;
  s.effects = s.effects.filter((e) => --e.life > 0);
  if (s.phase === "intro") {
    advanceIntro(s, inputs);
    return;
  }
  s.remaining--;
  releaseBrokenDorangelGrips(s);
  // Tick before attacks so activation receives the full authored duration and
  // both players see the same expiry boundary regardless of update order.
  for (const player of s.players) {
    if (player.transformation && --player.transformation.ticks <= 0)
      delete player.transformation;
  }
  const movementOrigins = s.players.map((p) => p.x);
  const platformCarry = [0, 0];
  const stagePlatforms = platformsAtTick(s.stage, s.tick);
  const priorPlatforms = platformsAtTick(s.stage, s.tick - 1);
  const carriedPlatforms: (number | null)[] = [null, null];
  for (let i = 0; i < 2; i++)
    carriedPlatforms[i] = updateFighterControls(
      s,
      i,
      inputs[i],
      stagePlatforms,
      priorPlatforms,
      platformCarry,
    );
  // Prepare both guards and inputs before contact, then move both fighters after it.
  // Otherwise a P1 hit applies knockback one frame earlier than the mirrored P2 hit.
  for (const player of s.players) if (player.attack) player.attackTick++;
  advanceDorangelBite(s);
  for (let i = 0; i < 2; i++) {
    updateAttack(s, i);
    if (s.finale) return;
  }
  advanceFieldFinales(s);
  releaseBrokenDorangelGrips(s);
  // Both players must finish spawning shots before either reflector sees this tick's pack.
  for (let i = 0; i < 2; i++) reflectProjectiles(s, i);
  // Predict spacing from the movement that roots actually allow this frame.
  for (const p of s.players) {
    if (p.rootTicks > 0 && p.grounded) {
      p.vx = 0;
      p.recoilVx = 0;
    }
  }
  limitRetreat(s, movementOrigins, platformCarry);
  for (let i = 0; i < 2; i++)
    moveFighter(
      s,
      i,
      inputs[i],
      carriedPlatforms[i],
      stagePlatforms,
      priorPlatforms,
    );
  supportRunway(s);
  applyFinaleContacts(s);
  separateFighters(s, stagePlatforms);
  advanceProjectiles(s);
  // Resolve the whole tick, including projectiles, before deciding the result.
  // Both players can lose a stock together; iteration order must not pick a winner.
  resolveStocks(s);
  resolveTimeout(s);
}

/** The pre-fight intro: a dash skips to the countdown, then the fight starts. */
function advanceIntro(s: MatchState, inputs: [Input, Input]) {
  if (
    s.tick < INTRO_COUNTDOWN_START &&
    inputs.some(
      (input, i) => input.actions.dash !== s.players[i].lastActions.dash,
    )
  )
    s.tick = INTRO_COUNTDOWN_START;
  for (let i = 0; i < 2; i++)
    s.players[i].lastActions = { ...inputs[i].actions };
  if (s.tick >= INTRO_TOTAL_TICKS) {
    s.phase = "playing";
    s.players.forEach((p, i) => {
      p.invincible = 0;
      p.facing = s.players[1 - i].x >= p.x ? 1 : -1;
    });
  }
}

/** Hits from active field and arena definitives. */
function applyFinaleContacts(s: MatchState) {
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
  for (const contact of arenaFinaleContacts(s)) {
    const target = s.players[1 - contact.owner],
      hp = target.hp;
    if (
      hurt(
        s,
        contact.owner,
        contact.damage,
        contact.force,
        contact.direction,
        contact.x,
        contact.y,
        "super",
        5,
        contact.rootKind === "pot" ? "heat" : undefined,
      )
    )
      registerArenaContact(s, contact, target.hp < hp);
  }
}
