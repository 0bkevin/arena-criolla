import { useEffect, useRef } from "react";
import { fighterById, type FighterId } from "../../shared/content";
import { drawSprite, loadImage, loadSprite } from "../game/assets";
import {
  drawPortraitBust,
  drawSelectionPlaceholder,
  portraitBust,
} from "../game/portrait-bust";
import { presentationById, selectionProgress } from "../../shared/presentation";
import { drawPresentation } from "../game/presentation-renderer";
import { selectionBodyHeight } from "../game/entrance-framing";
import { entrancePoseProgress } from "../../shared/entrance-actions";
import { drawEntranceAction } from "../game/entrance-renderer";
import { samplePortraitLoop } from "../game/portrait-motion";

export function Portrait({
  fighter,
  className = "",
  facing = 1,
  frame,
  bust = false,
  animated = false,
  holdPose = false,
  repeat = false,
}: {
  fighter: FighterId;
  className?: string;
  facing?: number;
  frame?: number;
  bust?: boolean;
  animated?: boolean;
  holdPose?: boolean;
  repeat?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let disposed = false;
    let raf = 0;
    let timer = 0;
    let lastTick = 0;
    let observing: IntersectionObserver | null = null;
    let visible = true;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let redraw = () => {};
    const onVisibility = () => {
      lastTick = 0;
      redraw();
    };
    document.addEventListener("visibilitychange", onVisibility);
    reduced.addEventListener("change", onVisibility);
    // Roster cards draw a pre-cut pose instead of downloading the whole atlas.
    const cut =
      bust && !animated && frame === undefined
        ? portraitBust(fighter)
        : undefined;
    if (cut)
      void loadImage(cut.file)
        .then((image) => {
          if (disposed || !canvas.current) return;
          const node = canvas.current;
          drawPortraitBust(node.getContext("2d")!, image, cut, fighter, facing);
          node.dataset.frame = String(cut.frame);
          node.dataset.facing = String(facing);
          node.dataset.progress = "1";
        })
        .catch(() => {
          if (!disposed) fromAtlas();
        });
    else {
      const placeholder =
        animated &&
        !bust &&
        className.split(/\s+/).includes("selected-portrait")
          ? portraitBust(fighter)
          : undefined;
      let ready = false;
      if (placeholder)
        void loadImage(placeholder.file)
          .then((image) => {
            if (disposed || ready || !canvas.current) return;
            const node = canvas.current;
            drawSelectionPlaceholder(
              node.getContext("2d")!,
              image,
              placeholder,
              facing,
            );
            node.dataset.frame = String(placeholder.frame);
            node.dataset.facing = String(facing);
            node.dataset.progress = "0";
            node.dataset.phase = "placeholder";
          })
          .catch(() => {});
      fromAtlas(() => {
        ready = true;
      });
    }
    function fromAtlas(onReady = () => {}) {
      // An animated portrait is what the player just chose: fetch it first.
      void loadSprite(fighter, {
        entrance: animated && !bust,
        priority: animated ? "high" : undefined,
      })
        .then((asset) => {
          if (disposed || !canvas.current) return;
          onReady();
          const node = canvas.current;
          const ctx = node.getContext("2d")!;
          const def = fighterById(fighter);
          const profile = presentationById(fighter);
          const poseFrame = frame ?? profile.battleFrame;
          const height = bust
            ? 690 * (def.portraitScale ?? 1)
            : animated
              ? asset.entrance
                ? selectionBodyHeight(asset)
                : 450
              : 480;
          const portraitOffset = bust
            ? (asset.portraitCenters[poseFrame] - asset.cellWidth / 2) *
              (height / asset.bodyHeight) *
              facing *
              asset.frameFacing[poseFrame]
            : 0;
          const started = performance.now();
          const endProgress =
            holdPose && asset.entrance ? entrancePoseProgress(fighter) : 1;
          const progressAt = (now: number) =>
            Math.min(endProgress, selectionProgress(fighter, now - started));
          const looping = repeat && animated && !bust;
          let elapsed = 0;
          let previousPaint = -Infinity;
          const paint = (now: number) => {
            raf = 0;
            timer = 0;
            if (disposed) return;
            if (lastTick && visible && !document.hidden && !reduced.matches)
              elapsed += now - lastTick;
            lastTick = now;
            const playback = looping
              ? samplePortraitLoop(elapsed, profile.durationMs, endProgress)
              : null;
            const progress =
              reduced.matches && holdPose
                ? endProgress
                : (playback?.progress ?? progressAt(now));
            if (
              now - previousPaint >= 1000 / 30 ||
              !animated ||
              reduced.matches ||
              (playback ? playback.waitMs > 0 : progress >= endProgress)
            ) {
              ctx.clearRect(0, 0, 400, 500);
              let currentFrame = poseFrame;
              if (animated && !bust) {
                if (reduced.matches && holdPose && endProgress < 1) {
                  // Show the crossed-arms pose immediately without spatial motion.
                  ctx.save();
                  ctx.translate(200, 491);
                  if (
                    !drawEntranceAction(
                      ctx,
                      asset,
                      fighter,
                      progress,
                      height,
                      facing,
                    )
                  )
                    drawSprite(ctx, asset, poseFrame, 0, 0, height, facing);
                  ctx.restore();
                } else {
                  const pose = drawPresentation(
                    ctx,
                    asset,
                    fighter,
                    progress,
                    200,
                    491,
                    height,
                    facing,
                    "selection",
                    reduced.matches,
                  );
                  currentFrame = pose.frame;
                }
              } else
                drawSprite(
                  ctx,
                  asset,
                  poseFrame,
                  200 - portraitOffset,
                  bust ? height + 30 - height * (def.portraitLift ?? 0) : 496,
                  height,
                  facing,
                );
              node.dataset.phase = "animation";
              node.dataset.frame = String(currentFrame);
              node.dataset.facing = String(facing);
              node.dataset.progress = String(progress);
              previousPaint = now;
            }
            if (
              animated &&
              visible &&
              !document.hidden &&
              !reduced.matches &&
              (looping || progressAt(now) < endProgress)
            ) {
              if (playback && playback.waitMs > 0)
                timer = window.setTimeout(
                  () => paint(performance.now()),
                  playback.waitMs,
                );
              else raf = requestAnimationFrame(paint);
            }
          };
          redraw = () => {
            cancelAnimationFrame(raf);
            window.clearTimeout(timer);
            paint(performance.now());
          };
          if (animated) {
            observing = new IntersectionObserver(([entry]) => {
              visible = entry.isIntersecting;
              lastTick = 0;
              if (visible) redraw();
              else {
                cancelAnimationFrame(raf);
                window.clearTimeout(timer);
              }
            });
            observing.observe(node);
          }
          paint(started);
        })
        .catch(() => {});
    }
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      observing?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      reduced.removeEventListener("change", onVisibility);
    };
  }, [fighter, facing, frame, bust, animated, holdPose, repeat, className]);
  return (
    <canvas
      ref={canvas}
      width={400}
      height={500}
      className={`portrait ${className}`}
      aria-hidden="true"
      data-fighter={fighter}
      data-motion={animated ? (holdPose ? "victory" : "selection") : "static"}
      data-repeat={repeat || undefined}
    />
  );
}
