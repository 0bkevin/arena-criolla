import { fighterById, SUPER_CHARGE_TICKS, type FighterId } from "../../shared/content";
import { createMatch, emptyInput, stepMatch } from "../../shared/engine";
import { finaleById } from "../../shared/finales";
import { TECHNIQUES } from "../../shared/techniques";

export type GuideMove =
  "light" | "heavy" | "combo1" | "combo2" | "special" | "final";
export const demoRivalFor = (id: FighterId): FighterId =>
  TECHNIQUES[fighterById(id).ability].reflect
    ? "vallenilla"
    : id === "capriles"
      ? "nacho"
      : id === "nacho"
        ? "javier"
        : "capriles";

export function simulateMoveDemo(id: FighterId, move: GuideMove) {
  const f = fighterById(id),
    rival = demoRivalFor(id),
    technique = TECHNIQUES[f.ability];
  const state = createMatch("caracas", [
    { name: f.shortName, fighter: id, wins: 3 },
    { name: fighterById(rival).shortName, fighter: rival, wins: 3 },
  ]);
  state.phase = "playing";
  state.tick = 1;
  const transform =
    move === "final" && finaleById(id)?.mode === "transformation";
  let followup = 0;
  const combo =
    move === "combo1"
      ? (["light", "heavy"] as const)
      : move === "combo2"
        ? (["light", "light", "heavy"] as const)
        : undefined;
  let nextComboAction = 1;
  const reflect = move === "special" && !!technique.reflect;
  const counter = move === "special" && !!technique.counter;
  // Projectiles get travel room; melee demonstrations start inside their range.
  const rangedFinal = move === "final" && finaleById(id)?.mode === "projectile";
  const distance =
    move === "final"
      ? rangedFinal
        ? 430
        : 190
      : move === "special"
        ? reflect
          ? 210
          : counter
            ? 120
            : technique.projectile
              ? 210
              : Math.min(140, technique.range - 20)
        : 88;
  state.players.forEach((p, index) => {
    const origin = transform || rangedFinal ? 280 : 435;
    p.x = index ? origin + distance : origin;
    p.y = 555;
    p.vx = 0;
    p.vy = 0;
    p.facing = index ? -1 : 1;
    p.invincible = 0;
    p.energy = 100;
    p.grounded = true;
  });
  const input: [ReturnType<typeof emptyInput>, ReturnType<typeof emptyInput>] =
    [emptyInput(), emptyInput()];
  let duration =
    move === "light"
      ? 78
      : move === "heavy"
        ? 90
        : move === "combo1"
          ? 132
          : move === "combo2"
            ? 165
            : 180;
  if (move === "final") {
    const final = finaleById(id)!;
    // Include startup and release so grabs, knockback and temporary forms can be reviewed.
    duration = SUPER_CHARGE_TICKS + final.duration + 100;
    input[0].superHeld = true;
  }
  const snapshots = [structuredClone(state)];
  for (let tick = 1; tick < duration; tick++) {
    if (tick === 1)
      input[0].actions[
        move === "final"
          ? "super"
          : move === "special"
            ? "special"
            : move === "heavy"
              ? "heavy"
              : "light"
      ]++;
    if (transform && tick > SUPER_CHARGE_TICKS + 44 && followup < 2) {
      const player = state.players[0],
        target = state.players[1];
      const gap = target.x - player.x;
      input[0].right = gap > 80;
      input[0].left = gap < -80;
      if (
        !player.cooldown &&
        !player.stun &&
        target.grounded &&
        Math.abs(gap) <= 90
      ) {
        input[0].right = input[0].left = false;
        input[0].actions[(["light", "heavy"] as const)[followup++]]++;
      }
    } else if (transform) input[0].right = input[0].left = false;
    if (move !== "final") {
      if (combo) {
        input[0].left = input[0].right = false;
        const player = state.players[0],
          target = state.players[1],
          gap = target.x - player.x;
        // Use ordinary movement after recovery. The old fixed frame 32 light often
        // swung below an airborne rival and still granted the combo name.
        if (
          nextComboAction < combo.length &&
          !state.hitstop &&
          !player.attack &&
          !player.cooldown &&
          !player.stun
        ) {
          input[0].right = gap > 65;
          input[0].left = gap < -65;
          // Brake before the next input so residual running cannot carry a
          // slower startup through the rival. Nothing edits combat state here.
          if (
            player.grounded &&
            target.grounded &&
            !target.invincible &&
            Math.abs(gap) <= 70 &&
            Math.abs(player.vx) < 0.8
          ) {
            input[0].left = input[0].right = false;
            input[0].actions[combo[nextComboAction++]]++;
          }
        }
      }
      if (counter && tick === 4) input[1].actions.heavy++;
      if (reflect && tick === 1) input[1].actions.special++;
      if (move === "special" && f.ability === "fountain" && tick === 24)
        input[1].actions.jump++;
    }
    stepMatch(state, input);
    snapshots.push(structuredClone(state));
  }
  return snapshots;
}
