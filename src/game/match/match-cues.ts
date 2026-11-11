// Sound cues a match's state changes trigger: entrances and the countdown,
// impacts, and each fighter's dashes, steps, landings, swings and jumps.
import { fighterById } from "../../../shared/roster/roster";
import {
  INTRO_COUNTDOWN_START,
  introActor,
} from "../../../shared/engine/intro";
import {
  PLAYERS,
  opponentOf,
  perPlayer,
  type MatchState,
  type PlayerIndex,
} from "../../../shared/engine/engine";
import type { playReaction, sound } from "../audio/audio";

/** The audio calls the cues make; the game passes the real audio module. */
export interface MatchCueAudio {
  sound: typeof sound;
  playReaction: typeof playReaction;
}

/** Track one match and play the cues each new state calls for, exactly once. */
export function createMatchCues(initial: MatchState, audio: MatchCueAudio) {
  const playedIntroductions = new Set<number>();
  let lastCountdown = -1;
  let lastEffect = -1;
  const specialAttacks = perPlayer(() => -1);
  const swungAttacks = perPlayer(() => -1);
  const groundedStates = perPlayer((i) => initial.players[i].grounded);
  const jumpCounts = perPlayer((i) => initial.players[i].jumps);
  const dashStates = perPlayer((i) => initial.players[i].dash > 0);
  const footsteps = perPlayer((i) => ({
    tick: initial.tick,
    x: initial.players[i].x,
  }));

  /** Entrance calls and countdown beats, only while the intro is visible. */
  const introduce = (state: MatchState) => {
    const actor = introActor(state.tick);
    if (actor !== null && !playedIntroductions.has(actor)) {
      playedIntroductions.add(actor);
      audio.sound("entrance", state.players[actor].config.fighter, {
        x: state.players[actor].x,
      });
    } else if (actor === null) {
      const beat = Math.min(
        3,
        Math.floor((state.tick - INTRO_COUNTDOWN_START) / 40),
      );
      if (beat > lastCountdown) {
        audio.sound("ready", undefined, { strength: beat === 3 ? 1.5 : 1 });
        lastCountdown = beat;
      }
    }
  };

  /** One sound per new effect, plus the victim's voice for hits and ring-outs. */
  const effects = (state: MatchState) => {
    for (const effect of state.effects) {
      if (effect.id <= lastEffect) continue;
      const actor =
        effect.owner !== undefined
          ? state.players[effect.owner]
          : (state.players.find(
              (p) => fighterById(p.config.fighter).color === effect.color,
            ) ??
            state.players.reduce((a, b) =>
              Math.abs(a.x - effect.x) < Math.abs(b.x - effect.x) ? a : b,
            ));
      audio.sound(
        effect.kind === "ringout"
          ? "ringout"
          : effect.kind === "special"
            ? "special"
            : effect.kind === "block"
              ? "block"
              : "hit",
        actor.config.fighter,
        { x: effect.x, impact: effect.impact, strength: effect.strength },
      );
      if (
        effect.owner !== undefined &&
        (effect.kind === "hit" || effect.kind === "ringout")
      ) {
        // Hit effects belong to the attacker; ringout effects belong to the victim.
        const victim =
          effect.kind === "ringout" ? effect.owner : opponentOf(effect.owner);
        const target = state.players[victim];
        audio.playReaction("hurt", target.config.fighter, {
          player: victim,
          x: effect.x,
          impact: effect.kind === "ringout" ? "heavy" : effect.impact,
        });
      }
      lastEffect = effect.id;
    }
  };

  /** Movement and attack cues for one fighter, compared with the last state. */
  const fighter = (state: MatchState, i: PlayerIndex, quiet: boolean) => {
    const p = state.players[i];
    const dash = p.dash > 0;
    if (!quiet && state.phase === "playing") {
      if (dash && !dashStates[i])
        audio.sound("dash", p.config.fighter, { x: p.x });
      const step = footsteps[i];
      if (
        p.grounded &&
        !p.stun &&
        !p.attack &&
        !dash &&
        Math.abs(p.vx) > 1 &&
        state.tick - step.tick >= 16 &&
        Math.abs(p.x - step.x) >= 32
      ) {
        audio.sound("step", p.config.fighter, { x: p.x });
        step.tick = state.tick;
        step.x = p.x;
      }
    }
    dashStates[i] = dash;
    if (p.grounded && !groundedStates[i] && state.phase === "playing")
      audio.sound("land", p.config.fighter, { x: p.x });
    groundedStates[i] = p.grounded;
    if ((p.attack === "light" || p.attack === "heavy") && p.attackTick < 4) {
      const startedAt = state.tick - p.attackTick;
      if (startedAt > swungAttacks[i]) {
        swungAttacks[i] = startedAt;
        audio.sound("swing", p.config.fighter, { x: p.x, impact: p.attack });
        audio.playReaction("attack", p.config.fighter, {
          player: i,
          x: p.x,
          impact: p.attack,
        });
      }
    }
    if (p.jumps > jumpCounts[i] && p.vy < 0) {
      audio.sound("jump", p.config.fighter, { x: p.x });
      audio.playReaction("jump", p.config.fighter, { player: i, x: p.x });
    }
    jumpCounts[i] = p.jumps;
    if ((p.attack === "special" || p.attack === "super") && p.attackTick < 8) {
      const startedAt = state.tick - p.attackTick;
      if (startedAt > specialAttacks[i]) {
        specialAttacks[i] = startedAt;
        audio.playReaction("attack", p.config.fighter, {
          player: i,
          x: p.x,
          impact: p.attack,
        });
      }
    }
  };

  return {
    /**
     * Play the cues for this frame. `introAudible` is false while the game is
     * paused, gated or behind a dialog; `quiet` also covers focus and visibility.
     */
    update(
      state: MatchState,
      { quiet, introAudible }: { quiet: boolean; introAudible: boolean },
    ) {
      if (state.phase === "intro" && introAudible) introduce(state);
      effects(state);
      for (const i of PLAYERS) fighter(state, i, quiet);
    },
  };
}
