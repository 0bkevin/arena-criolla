import { useEffect, useRef } from "react";
import { fighterById, type FighterId } from "../../shared/content";
import { drawSprite, loadSprite } from "../game/assets";
import { presentationById, selectionProgress } from "../../shared/presentation";
import { drawPresentation } from "../game/presentation-renderer";

export function Portrait({
  fighter,
  className = "",
  facing = 1,
  frame,
  bust = false,
  animated = false,
}: {
  fighter: FighterId;
  className?: string;
  facing?: number;
  frame?: number;
  bust?: boolean;
  animated?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let disposed = false;
    let raf = 0;
    let observing: IntersectionObserver | null = null;
    let visible = true;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let redraw = () => {};
    const onVisibility = () => redraw();
    document.addEventListener("visibilitychange", onVisibility);
    reduced.addEventListener("change", onVisibility);
    void loadSprite(fighter, { entrance: animated && !bust })
      .then((asset) => {
        if (disposed || !canvas.current) return;
        const node = canvas.current;
        const ctx = node.getContext("2d")!;
        const def = fighterById(fighter);
        const profile = presentationById(fighter);
        const poseFrame = frame ?? profile.battleFrame;
        const height = bust
          ? 690 * (def.portraitScale ?? 1)
          : animated
            ? asset.entrance
              ? 375
              : 450
            : 480;
        const portraitOffset = bust
          ? (asset.portraitCenters[poseFrame] - asset.cellWidth / 2) *
            (height / asset.bodyHeight) *
            facing *
            asset.frameFacing[poseFrame]
          : 0;
        const started = performance.now();
        let previousPaint = -Infinity;
        const paint = (now: number) => {
          raf = 0;
          if (disposed) return;
          if (
            now - previousPaint >= 1000 / 30 ||
            !animated ||
            reduced.matches ||
            selectionProgress(fighter, now - started) >= 1
          ) {
            ctx.clearRect(0, 0, 400, 500);
            let currentFrame = poseFrame;
            if (animated && !bust) {
              const progress = selectionProgress(fighter, now - started);
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
            node.dataset.frame = String(currentFrame);
            node.dataset.facing = String(facing);
            node.dataset.progress = String(
              selectionProgress(fighter, now - started),
            );
            previousPaint = now;
          }
          if (
            animated &&
            visible &&
            !document.hidden &&
            !reduced.matches &&
            selectionProgress(fighter, now - started) < 1
          )
            raf = requestAnimationFrame(paint);
        };
        redraw = () => {
          cancelAnimationFrame(raf);
          paint(performance.now());
        };
        if (animated) {
          observing = new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            if (visible) redraw();
            else cancelAnimationFrame(raf);
          });
          observing.observe(node);
        }
        redraw();
      })
      .catch(() => {});
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observing?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      reduced.removeEventListener("change", onVisibility);
    };
  }, [fighter, facing, frame, bust, animated]);
  return (
    <canvas
      ref={canvas}
      width={400}
      height={500}
      className={`portrait ${className}`}
      aria-hidden="true"
      data-fighter={fighter}
      data-motion={animated ? "selection" : "static"}
    />
  );
}
