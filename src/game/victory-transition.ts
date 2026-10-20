import type { MatchState } from "../../shared/engine";
import type { Assets } from "./renderer";
import { selectionBodyHeight } from "./entrance-framing";
import { VICTORY_DURATION_MS } from "./victory";
import { victoryActorLayout } from "./victory-framing";
import { drawVictoryPose } from "./victory-pose";
import { VICTORY_TRANSITION_MS } from "./victory-types";

const MOVE_DELAY = 160;
const POSE_DELAY = 420;
const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

/**
 * Carry the last arena pose into the portrait's new framing, then blend into
 * its greeting. Everything uses one timeline; the buttons become active last.
 */
export function playVictoryTransition(
  screen: HTMLElement,
  arena: HTMLCanvasElement,
  announcement: HTMLElement | null,
  state: MatchState,
  assets: Assets,
  onComplete: () => void,
) {
  const animations: Animation[] = [];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let disposed = false;
  let completed = false;
  const animate = (
    element: Element | null,
    frames: Keyframe[],
    duration: number,
    delay = 0,
  ) => {
    if (!element) return;
    const animation = element.animate(frames, {
      duration,
      delay,
      easing: EASE,
      fill: "both",
    });
    animations.push(animation);
    return animation;
  };
  const complete = () => {
    if (disposed || completed) return;
    completed = true;
    animations.forEach((animation) => animation.cancel());
    onComplete();
  };

  if (reduced.matches) {
    const fade = animate(screen, [{ opacity: 0 }, { opacity: 1 }], 160);
    void fade?.finished.then(complete, () => {});
  } else {
    // Keep the outgoing arena intact until its scenery is covered.
    animate(
      screen.querySelector(".victory-screen-scenery"),
      [{ opacity: 0 }, { opacity: 1 }],
      180,
    );
    animate(
      screen.querySelector(".victory-screen-slash"),
      [
        { opacity: 0 },
        {
          opacity: getComputedStyle(
            screen.querySelector(".victory-screen-slash")!,
          ).opacity,
        },
      ],
      400,
      120,
    );

    const title = screen.querySelector(".victory-screen-title");
    for (const part of ["span", "strong"]) {
      const from = announcement?.querySelector(part)?.getBoundingClientRect();
      const to = title?.querySelector<HTMLElement>(part);
      if (!from || !to || !from.width || !from.height) continue;
      const rect = to.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      animate(
        to,
        [
          {
            transformOrigin: "0 0",
            transform: `translate(${from.left - rect.left}px, ${from.top - rect.top}px) scale(${from.width / rect.width}, ${from.height / rect.height})`,
          },
          { transformOrigin: "0 0", transform: "none" },
        ],
        VICTORY_TRANSITION_MS - MOVE_DELAY,
        MOVE_DELAY,
      );
    }

    const winner = typeof state.winner === "number" ? state.winner : null;
    const figure = screen.querySelector<HTMLElement>(".victory-screen-figure");
    const carry = screen.querySelector<HTMLCanvasElement>(
      ".victory-screen-carry",
    );
    const portrait = figure?.querySelector(".portrait");
    if (winner !== null && figure && carry && portrait) {
      const id = state.players[winner].config.fighter;
      const sprite = assets.sprites[id];
      const actor = victoryActorLayout(
        state,
        sprite,
        winner,
        arena.width,
        arena.height,
      );
      const bodyHeight = sprite.entrance ? selectionBodyHeight(sprite) : 450;
      const ctx = carry.getContext("2d")!;
      ctx.resetTransform();
      ctx.clearRect(0, 0, carry.width, carry.height);
      ctx.save();
      ctx.translate(200, 491);
      drawVictoryPose(
        ctx,
        assets,
        id,
        VICTORY_DURATION_MS,
        bodyHeight,
        actor.facing,
      );
      ctx.restore();

      const source = arena.getBoundingClientRect();
      // Canvas can be letterboxed by object-fit: contain on short viewports.
      const pixelScale = Math.min(
        source.width / arena.width,
        source.height / arena.height,
      );
      const left = source.left + (source.width - arena.width * pixelScale) / 2;
      const top = source.top + (source.height - arena.height * pixelScale) / 2;
      const target = figure.getBoundingClientRect();
      const scale =
        (actor.bodyHeight * pixelScale) / ((bodyHeight * target.width) / 400);
      const dx = left + actor.x * pixelScale - (target.left + target.width / 2);
      const dy =
        top +
        actor.feet * pixelScale -
        (target.top + (target.height * 491) / 500);
      animate(
        figure,
        [
          {
            transformOrigin: "50% 98.2%",
            transform: `translate(${dx}px, ${dy}px) scale(${scale})`,
          },
          { transformOrigin: "50% 98.2%", transform: "none" },
        ],
        VICTORY_TRANSITION_MS - MOVE_DELAY,
        MOVE_DELAY,
      );
      animate(carry, [{ opacity: 1 }, { opacity: 0 }], 180, POSE_DELAY);
      animate(portrait, [{ opacity: 0 }, { opacity: 1 }], 180, POSE_DELAY);
    }

    for (const element of screen.querySelectorAll(
      ".victory-screen-brand, .victory-screen-description, .victory-screen-stats, .victory-screen-unlock, .victory-screen-actions, .victory-screen-stars, .victory-screen-name, .victory-screen-footer, .victory-screen-duel",
    )) {
      animate(
        element,
        [{ opacity: 0 }, { opacity: 1 }],
        280,
        VICTORY_TRANSITION_MS - 280,
      );
    }
    void Promise.all(animations.map((animation) => animation.finished)).then(
      complete,
      () => {},
    );
  }

  // Rotation, resizing or a changed motion preference should settle the result,
  // never keep a transform calculated for an obsolete viewport.
  const settle = () => {
    if (completed) return;
    animations.forEach((animation) => animation.finish());
    complete();
  };
  window.addEventListener("resize", settle);
  reduced.addEventListener("change", settle);
  return () => {
    disposed = true;
    animations.forEach((animation) => animation.cancel());
    window.removeEventListener("resize", settle);
    reduced.removeEventListener("change", settle);
  };
}
