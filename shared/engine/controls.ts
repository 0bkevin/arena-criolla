// One fighter's response to its input this tick: guard, movement, jumps,
// dashes, super charge and attack requests (with short input buffers).
import { setInvincibility, tickInvincibility } from "./invincibility";
import {
  SUPER_CHARGE_TICKS,
  fighterById,
  type Platform,
} from "../roster/roster";
import { cancelArenaPerformance, mountedFinale } from "./finales/arena-finales";
import { activeRunway } from "./finales/field-finales";
import { TECHNIQUES } from "./techniques";
import { beginAttack, canBeginAttack, canUseSuper } from "./attacks";
import {
  opponentOf,
  type Action,
  type Input,
  type MatchState,
  type PlayerIndex,
} from "./types";

// Five active simulation ticks (83 ms at 60 Hz), shared by local and online play.
const ATTACK_BUFFER_TICKS = 5;
// A definitive held through a heavy attack (33 ticks) or a dash (30-tick
// cooldown) still charges once free; 40 ticks (0.67 s) leaves a little slack.
const SUPER_BUFFER_TICKS = 40;

/**
 * Apply one fighter's input. Records how far a moving platform carried the
 * fighter in `platformCarry` and returns the platform it rode, if any.
 */
export function updateFighterControls(
  s: MatchState,
  i: PlayerIndex,
  input: Input,
  stagePlatforms: Platform[],
  priorPlatforms: Platform[],
  platformCarry: [number, number],
): number | null {
  const p = s.players[i];
  const def = fighterById(p.config.fighter);
  let carriedPlatform: number | null = null;
  p.dropThrough = Math.max(0, p.dropThrough - 1);
  if (p.grounded && p.supportPlatform !== null && p.supportPlatform >= 0) {
    const index = p.supportPlatform;
    const prior = priorPlatforms[index];
    const current = stagePlatforms[index];
    if (input.down) {
      p.dropThrough = 14;
      p.y += 3;
      p.grounded = false;
      p.supportPlatform = null;
    } else if (
      prior &&
      current &&
      Math.abs(p.y - prior.y) < 2 &&
      p.x >= prior.x - 5 &&
      p.x <= prior.x + prior.width + 5
    ) {
      platformCarry[i] = current.x - prior.x;
      p.x += platformCarry[i];
      p.y += current.y - prior.y;
      carriedPlatform = index;
    }
  }
  p.cooldown = Math.max(0, p.cooldown - 1);
  if (p.knockoutDelay) p.knockoutDelay--;
  p.stun = Math.max(0, p.stun - 1);
  p.slowTicks = Math.max(0, p.slowTicks - 1);
  p.rootTicks = Math.max(0, p.rootTicks - 1);
  if (!p.rootTicks) delete p.rootKind;
  tickInvincibility(p);
  p.dash = Math.max(0, p.dash - 1);
  const brake = TECHNIQUES[def.ability].dash?.brake;
  if (p.attack === "special" && !p.dash && brake) {
    p.vx *= brake;
    p.recoilVx = (p.recoilVx ?? 0) * brake;
  }
  const pressed = (key: Action) => input.actions[key] !== p.lastActions[key];
  if (
    p.bufferedAttack &&
    (--p.bufferedAttack.ticks < 0 || p.stun > 0 || input.block || p.hp <= 0)
  )
    delete p.bufferedAttack;
  if (
    p.bufferedSuperTicks !== undefined &&
    (--p.bufferedSuperTicks < 0 ||
      !input.superHeld ||
      p.stun > 0 ||
      input.block ||
      p.hp <= 0 ||
      (["light", "heavy", "special", "jump", "dash"] as const).some(pressed) ||
      !canUseSuper(s, i))
  )
    delete p.bufferedSuperTicks;
  if (
    p.superChargeTicks > 0 &&
    (pressed("super") || p.stun > 0 || !canUseSuper(s, i))
  )
    p.superChargeTicks = 0;
  p.blocking =
    input.block &&
    p.superChargeTicks === 0 &&
    p.hp > 0 &&
    p.stun === 0 &&
    !p.attack &&
    p.grounded &&
    p.energy > 0;
  if (p.blocking) p.energy = Math.max(0, p.energy - 0.12);
  else p.energy = Math.min(100, p.energy + 0.035);
  if (p.stun === 0 && p.hp > 0) {
    if (p.superChargeTicks > 0) p.superChargeTicks++;
    else if (
      (pressed("super") || p.bufferedSuperTicks !== undefined) &&
      input.superHeld &&
      p.cooldown === 0 &&
      !p.blocking &&
      !p.attack &&
      !p.dash &&
      canUseSuper(s, i)
    ) {
      delete p.bufferedSuperTicks;
      p.superChargeTicks = 1;
      setInvincibility(p, 0);
    } else if (
      pressed("super") &&
      input.superHeld &&
      !input.block &&
      canUseSuper(s, i)
    )
      p.bufferedSuperTicks = SUPER_BUFFER_TICKS;
    const charging = p.superChargeTicks > 0;
    const move = Number(input.right) - Number(input.left);
    if (!p.attack && !p.dash) {
      const acceleration = p.grounded ? 0.35 : 0.08;
      p.vx +=
        (move *
          def.speed *
          (charging ? 0.45 : p.blocking ? 0.3 : 1) *
          (p.slowTicks ? 0.6 : 1) -
          p.vx) *
        acceleration;
      p.recoilVx = (p.recoilVx ?? 0) * (1 - acceleration);
      if (move) p.facing = move;
      else if (
        p.grounded &&
        !(
          p.blocking &&
          s.fieldFinales?.some(
            (field) =>
              field.owner !== i &&
              (mountedFinale(field) ||
                field.fighter === "zavarce" ||
                field.fighter === "simon"),
          )
        )
      )
        p.facing = s.players[opponentOf(i)].x >= p.x ? 1 : -1;
    }
    if (!charging && pressed("jump") && p.jumps < 2 && !p.blocking) {
      cancelArenaPerformance(s, p);
      if (activeRunway(s, p)) {
        s.fieldFinales = s.fieldFinales?.filter(
          (field) => s.players[field.owner] !== p,
        );
        p.attack = null;
        p.cooldown = 12;
      }
      p.rootTicks = 0;
      delete p.rootKind;
      p.vy = p.jumps === 0 ? -12.8 : -11;
      p.jumps++;
      p.grounded = false;
      p.supportPlatform = null;
    }
    if (
      !charging &&
      pressed("dash") &&
      p.cooldown === 0 &&
      !p.blocking &&
      !p.rootTicks
    ) {
      p.vx = p.facing * 14 * (p.slowTicks ? 0.6 : 1);
      p.recoilVx = 0;
      p.dash = 12;
      setInvincibility(p, 8, true);
      p.cooldown = 30;
    }
    if (charging || pressed("super")) {
      delete p.bufferedAttack;
      if (charging && p.superChargeTicks >= SUPER_CHARGE_TICKS)
        beginAttack(s, i, "super");
    } else {
      const requested = (["special", "heavy", "light"] as const).find(pressed);
      if (requested) {
        delete p.bufferedAttack;
        if (p.cooldown === 0 && !p.blocking) beginAttack(s, i, requested);
        else if (
          !input.block &&
          p.cooldown <= ATTACK_BUFFER_TICKS &&
          canBeginAttack(s, i, requested)
        )
          p.bufferedAttack = {
            attack: requested,
            ticks: ATTACK_BUFFER_TICKS,
          };
      } else if (p.cooldown === 0 && !p.blocking && p.bufferedAttack) {
        const { attack } = p.bufferedAttack;
        delete p.bufferedAttack;
        beginAttack(s, i, attack);
      }
    }
  }
  p.lastActions = { ...input.actions };
  return carriedPlatform;
}
