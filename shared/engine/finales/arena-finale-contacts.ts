// Where arena definitives touch the rival, and what a landed contact does.
import { launchScale } from "../launch";
import { DORANGEL_POT, insideDorangelPot } from "./dorangel";
import type { MatchState, PlayerState } from "../engine";
import { COUTURE_MODEL_COUNT } from "./couture-runway";
import { opponentOf } from "../types";
import {
  ARENA_FINALE_CUES,
  RIDE_STUN_FLOOR,
  isRideHelper,
  arenaActorForce,
  activeArenaPerformance,
  arenaActorReach,
  isArenaFinalist,
  mountedFinale,
  nextMountStrike,
  rideMoving,
  type ArenaContact,
  type ArenaFinaleActor,
} from "./arena-finale-specs";

/** The body rectangle is deliberately smaller than capes, swords and feather tips. */
function overlaps(
  target: PlayerState,
  x: number,
  feet: number,
  halfWidth: number,
  top: number,
  bottom = 8,
  previousX = x,
  previousFeet = feet,
) {
  return (
    target.x + 22 >= Math.min(x, previousX) - halfWidth &&
    target.x - 22 <= Math.max(x, previousX) + halfWidth &&
    target.y >= Math.min(feet, previousFeet) - top &&
    target.y - 145 <= Math.max(feet, previousFeet) - bottom
  );
}

export function arenaFinaleContacts(state: MatchState): ArenaContact[] {
  const contacts: ArenaContact[] = [];
  for (const field of state.fieldFinales ?? []) {
    if (!isArenaFinalist(field.fighter)) continue;
    const target = state.players[opponentOf(field.owner)],
      p = state.players[field.owner],
      active = activeArenaPerformance(state, p) === field;
    const offer = (
      fraction: number,
      force: number,
      x: number,
      y: number,
      direction = field.direction,
      actor?: ArenaFinaleActor,
      rootTicks?: number,
      stunFloor?: number,
    ) =>
      contacts.push({
        field,
        actor,
        owner: field.owner,
        damage: field.damage * fraction,
        force,
        direction,
        x,
        y,
        rootTicks,
        stunFloor,
      });
    if (
      field.fighter === "dorangel" &&
      active &&
      ARENA_FINALE_CUES.dorangel.includes(field.tick) &&
      insideDorangelPot(field, target)
    ) {
      contacts.push({
        field,
        owner: field.owner,
        damage: field.damage / ARENA_FINALE_CUES.dorangel.length,
        force: 0.1,
        direction: field.direction,
        x: target.x,
        y: target.y - 130,
        rootTicks: DORANGEL_POT.snareTicks,
        rootSupport: target.supportPlatform,
        rootKind: "pot",
      });
    }
    const strike =
      active && mountedFinale(field) && rideMoving(field)
        ? nextMountStrike(field)
        : undefined;
    if (strike) {
      const touches = (reach: typeof strike.reach) =>
          overlaps(
            target,
            p.x + field.direction * reach.offset,
            p.y,
            reach.halfWidth,
            reach.top,
          ),
        front = touches(strike.reach);
      if (front || (strike.carried && touches(strike.carried)))
        offer(
          strike.damage,
          strike.preHitSpeedLimit === undefined
            ? strike.force
            : Math.min(
                strike.force,
                strike.preHitSpeedLimit / launchScale(target.hp),
              ),
          target.x,
          target.y - 75,
          // Under the caravan, behind its leading edge, a guard may face either way.
          !front && target.blocking && target.facing === field.direction
            ? -field.direction
            : field.direction,
          undefined,
          undefined,
          RIDE_STUN_FLOOR,
        );
    }
    for (const actor of field.actors ?? []) {
      if (actor.kind === "supporter" || actor.kind === "pot") continue;
      if (actor.kind === "mascot" || actor.kind === "dancer") {
        const beats =
            actor.kind === "mascot"
              ? [36, 49, 62, 75, 88, 101]
              : [48, 70, 92, 104],
          beat = beats.indexOf(field.tick);
        if (beat !== -1 && beat % 2 === actor.index) {
          const x = actor.x + actor.direction * 38;
          if (overlaps(target, x, actor.y, 42, 155))
            offer(
              actor.kind === "mascot" ? 1 / 6 : 1 / 4,
              beat === beats.length - 1 ? 6 : 1.8,
              target.x,
              target.y - 80,
              actor.direction,
              actor,
            );
        }
        continue;
      }
      if (actor.kind === "handchain" && actor.caughtTick !== undefined) {
        if (
          field.tick === actor.caughtTick + 24 &&
          overlaps(target, actor.x, actor.y, 105, 165)
        )
          offer(0.75, 19, target.x, target.y - 70, actor.direction, actor);
        continue;
      }
      if (actor.connected) continue;
      if (actor.kind === "curtain") {
        if (
          field.tick < 75 &&
          overlaps(
            target,
            actor.x,
            actor.y + 12,
            100,
            24,
            0,
            actor.previousX,
            actor.previousY + 12,
          )
        )
          offer(1, 10, target.x, actor.y, field.direction, actor);
        continue;
      }
      const reach = arenaActorReach(actor);
      if (
        overlaps(
          target,
          actor.x + actor.direction * reach.offset,
          actor.y,
          reach.halfWidth,
          reach.top,
          reach.bottom,
          actor.previousX + actor.direction * reach.offset,
          actor.previousY,
        )
      )
        offer(
          actor.kind === "handchain"
            ? 0.25
            : field.fighter === "bolivar" || field.fighter === "zavarce"
              ? 1 / 7
              : actor.kind === "model"
                ? 1 / COUTURE_MODEL_COUNT
                : 1 / 3,
          arenaActorForce(field.fighter, actor.kind),
          target.x,
          target.y - 70,
          actor.direction,
          actor,
          actor.kind === "handchain" ? 25 : undefined,
          isRideHelper(field.fighter, actor.kind) ? RIDE_STUN_FLOOR : undefined,
        );
    }
    if (!active) continue;
    if (
      field.fighter === "melanio" &&
      [20, 48].includes(field.tick) &&
      overlaps(
        target,
        p.x + field.direction * 60,
        p.y,
        field.tick === 20 ? 68 : 38,
        155,
      )
    )
      offer(
        field.tick === 20 ? 0.2 : 0.8,
        field.tick === 20 ? 1 : 8,
        target.x,
        target.y - 90,
        field.direction,
        undefined,
        field.tick === 20 ? 14 : undefined,
      );
    if (field.fighter === "chataing") {
      const x = field.caught?.x ?? field.x + field.direction * 105,
        y = field.caught?.y ?? field.y;
      if (
        ((field.tick >= 14 && field.tick <= 20 && !field.connected) ||
          field.tick === 44) &&
        Math.abs(p.x - x) < 195 &&
        overlaps(target, x, y, 62, 162)
      )
        offer(
          field.tick === 44 ? 0.85 : 0.15,
          field.tick === 44 ? 9 : 1,
          target.x,
          target.y - 80,
          field.direction,
          undefined,
          field.tick < 44 ? 20 : undefined,
        );
    }
    if (
      field.fighter === "llorona" &&
      [18, 38, 58].includes(field.tick) &&
      overlaps(target, p.x + field.direction * 48, p.y, 64, 165)
    )
      offer(
        field.tick === 58 ? 0.5 : 0.25,
        field.tick === 58 ? 8 : 1.4,
        target.x,
        target.y - 75,
        field.direction,
        undefined,
        field.tick === 18 ? 22 : undefined,
      );
  }
  return contacts;
}

/** Called only after ordinary guard, counter and invincibility rules accept contact. */
export function registerArenaContact(
  state: MatchState,
  contact: ArenaContact,
  damaged: boolean,
) {
  const { field, actor } = contact;
  if (damaged && contact.stunFloor !== undefined) {
    const target = state.players[opponentOf(contact.owner)];
    target.stun = Math.max(target.stun, contact.stunFloor);
    target.cooldown = Math.max(target.cooldown, target.stun);
  }
  if (actor && actor.kind !== "mascot" && actor.kind !== "dancer") {
    actor.connected = true;
    if (
      damaged &&
      actor.kind === "handchain" &&
      actor.caughtTick === undefined
    ) {
      actor.caughtTick = field.tick;
      actor.vx = 0;
    }
  } else if (!actor && mountedFinale(field)) {
    // Guarded strikes count too, so a blocked ride cannot strike without end.
    field.mountHits = (field.mountHits ?? 0) + 1;
    field.mountHitTick = field.tick;
  } else if (!actor && field.fighter === "chataing") field.connected = true;
  if (damaged && contact.rootTicks) {
    const target = state.players[opponentOf(contact.owner)];
    target.rootTicks = Math.max(target.rootTicks, contact.rootTicks);
    if (contact.rootSupport !== undefined) {
      if (contact.rootKind) target.rootKind = contact.rootKind;
      else delete target.rootKind;
      target.vx = target.recoilVx = target.vy = 0;
      target.grounded = true;
      target.supportPlatform = contact.rootSupport;
      return;
    }
    target.rootKind =
      field.fighter === "puma"
        ? "chain"
        : field.fighter === "chataing"
          ? "screen"
          : field.fighter === "llorona"
            ? "spectral"
            : "flash";
    if (field.fighter === "chataing")
      field.caught = { x: target.x, y: target.y };
  }
}
