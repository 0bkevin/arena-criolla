// Capture definitives: a cinematic that holds both fighters and owns the clock.
import { fighterById } from "../roster/roster";
import { activeRunway } from "./finales/field-finales";
import { finaleById } from "./finales/finales";
import {
  effect,
  interceptHit,
  interruptSuperCharge,
  launchTarget,
  rewardHit,
} from "./combat";
import { resolveStocks, resolveTimeout } from "./outcome";
import {
  PLAYERS,
  opponentOf,
  type Input,
  type MatchState,
  type PlayerIndex,
} from "./types";

export function beginFinale(s: MatchState, owner: PlayerIndex) {
  const source = s.players[owner];
  const target = s.players[opponentOf(owner)];
  const definition = finaleById(source.config.fighter);
  if (
    !definition ||
    definition.mode !== "capture" ||
    source.hp <= 0 ||
    target.hp <= 0
  )
    return;
  const direction = target.x >= source.x ? 1 : -1;
  if (interceptHit(s, owner, direction, target.x, target.y - 80, "super"))
    return;
  interruptSuperCharge(s, target);
  // Captured actors resume their held props. No suspended cable survives a
  // cinematic takeover or duplicates a microphone in a canonical capture pose.
  s.projectiles = s.projectiles.filter((shot) => !shot.tether);
  s.finale = {
    owner,
    target: owner === 0 ? 1 : 0,
    fighter: source.config.fighter,
    startedTick: s.tick,
    tick: 0,
    duration: definition.duration,
    x: (source.x + target.x) / 2,
    y: Math.min(source.y, target.y),
    direction,
    initialHp: target.hp,
    damage:
      (28 * fighterById(source.config.fighter).damage + source.comboBonus) *
      fighterById(target.config.fighter).armor,
  };
  if (activeRunway(s, target)) {
    s.fieldFinales = s.fieldFinales?.filter(
      (field) => s.players[field.owner] !== target,
    );
    if (!s.fieldFinales?.length) delete s.fieldFinales;
    target.cooldown = Math.min(target.cooldown, 12);
  }
  target.attack = null;
  target.blocking = false;
  target.dash = 0;
  s.hitstop = 0;
}

export function advanceFinale(s: MatchState, inputs: [Input, Input]) {
  const scene = s.finale!;
  const source = s.players[scene.owner];
  const target = s.players[scene.target];
  // The combat clock also drives moving platforms. Freeze it together with
  // actors, projectiles, recovery and the round timer; the scene owns its clock.
  scene.tick++;
  s.shake *= 0.8;
  s.effects = s.effects.filter((e) => --e.life > 0);
  for (const i of PLAYERS) {
    s.players[i].lastActions = { ...inputs[i].actions };
    delete s.players[i].bufferedAttack;
    delete s.players[i].bufferedSuperTicks;
  }
  const definition = finaleById(scene.fighter)!;
  const beat = definition.damageBeats.indexOf(scene.tick);
  if (beat !== -1) {
    target.hp = Math.max(
      0,
      scene.initialHp -
        scene.damage * ((beat + 1) / definition.damageBeats.length),
    );
    if (beat === 0) rewardHit(s, scene.owner);
    effect(s, target.x, target.y - 80, "hit", definition.accent, {
      owner: scene.owner,
      impact: "super",
      strength: beat === definition.damageBeats.length - 1 ? 1.8 : 1.2,
      direction: scene.direction,
    });
    s.shake = beat === definition.damageBeats.length - 1 ? 14 : 7;
  }
  if (scene.tick >= scene.duration) {
    source.attack = null;
    const force = definition.release?.force ?? 12;
    if (force > 0) launchTarget(target, force, scene.direction);
    else {
      target.vx = 0;
      target.recoilVx = 0;
      target.vy = 0;
      target.stun = 0;
    }
    if (definition.release?.knockoutDelay && target.hp <= 0)
      target.knockoutDelay = definition.release.knockoutDelay;
    target.invincible = 12;
    delete s.finale;
    resolveStocks(s);
    resolveTimeout(s);
  }
}
