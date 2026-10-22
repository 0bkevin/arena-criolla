import { useEffect, useMemo, useRef, useState } from "react";
import { fighterById, type FighterId } from "../../shared/content";
import { WORLD } from "../../shared/engine";
import { preloadAssets } from "../game/assets";
import {
  demoRivalFor,
  simulateMoveDemo,
  type GuideMove,
} from "../game/move-demo";
import { renderMatch, type Assets } from "../game/renderer";
import { Portrait } from "./Portrait";

export function FighterMovePreview({
  fighter,
  move,
  label,
  playbackKey,
}: {
  fighter: FighterId;
  move: GuideMove | null;
  label: string;
  playbackKey: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const position = useRef(0);
  const [assets, setAssets] = useState<Assets | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [frame, setFrame] = useState(0);
  const [canvasHeight, setCanvasHeight] = useState(600);
  const [playing, setPlaying] = useState(false);
  const [visible, setVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const frames = useMemo(
    () => (move ? simulateMoveDemo(fighter, move) : null),
    [fighter, move],
  );
  const lastFrame = (frames?.length ?? 1) - 1;

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0)
        setCanvasHeight(Math.max(1, Math.round((960 * height) / width)));
    });
    if (stage.current) observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    setError(false);
    setAssets(null);
    void preloadAssets([fighter, demoRivalFor(fighter)], ["caracas"])
      .then((value) => {
        if (active) setAssets(value);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [fighter, attempt]);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(preference.matches);
    let onScreen = true;
    const updateVisibility = () => setVisible(onScreen && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      updateVisibility();
    });
    if (panel.current) observer.observe(panel.current);
    updateMotion();
    updateVisibility();
    preference.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      observer.disconnect();
      preference.removeEventListener("change", updateMotion);
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  useEffect(() => {
    position.current = 0;
    setFrame(0);
    setPlaying(Boolean(frames));
    if (frames) {
      const bounds = panel.current?.getBoundingClientRect();
      if (bounds && (bounds.top < 80 || bounds.bottom > window.innerHeight))
        panel.current?.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }, [frames, playbackKey]);

  useEffect(() => {
    if (!frames || !assets || !playing || !visible) return;
    let raf = 0;
    let previous = 0;
    const tick = (now: number) => {
      if (previous) position.current += Math.min(now - previous, 100) * 0.06;
      previous = now;
      position.current = Math.min(lastFrame, position.current);
      setFrame(Math.floor(position.current));
      if (position.current >= lastFrame) setPlaying(false);
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [frames, assets, playing, visible, lastFrame]);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx || !frames || !assets) return;
    const state = frames[Math.min(frame, lastFrame)];
    // Melee gets a close view; definitives retain the full arena for their actors.
    // Reduced motion fixes the shot and suppresses combat shake and trails.
    const players = (reducedMotion ? frames[0] : state).players;
    const left = Math.min(...players.map((p) => p.x));
    const right = Math.max(...players.map((p) => p.x));
    const head = Math.min(
      ...players.map(
        (p) => p.y - (fighterById(p.config.fighter).displayHeight ?? 177),
      ),
    );
    const camera =
      move === "final"
        ? undefined
        : {
            x: (left + right) / 2,
            zoom: Math.min(
              2.2,
              ctx.canvas.width / (right - left + 300),
              (ctx.canvas.height * 0.8) / (WORLD.floor - head + 60),
            ),
          };
    renderMatch(ctx, state, assets, (frame * 1000) / 60, reducedMotion, camera);
  }, [assets, frames, frame, lastFrame, move, reducedMotion, canvasHeight]);

  return (
    <div className="move-preview" ref={panel}>
      <div
        ref={stage}
        className="move-preview-stage"
        aria-busy={Boolean(move && !assets && !error)}
      >
        {move ? (
          <canvas
            ref={canvas}
            width={960}
            height={canvasHeight}
            role="img"
            aria-label={`${label} de ${fighterById(fighter).name}`}
            data-fighter={fighter}
            data-move={move}
            data-frame={frame}
          />
        ) : (
          <div className="detail-art">
            <span className="detail-backdrop" />
            <Portrait fighter={fighter} />
          </div>
        )}
        {move && !assets && (
          <div className="move-preview-loading" role="status">
            {error ? (
              <>
                <span>No pudimos cargar la animación.</span>
                <button
                  className="secondary-button"
                  onClick={() => setAttempt((n) => n + 1)}
                >
                  Reintentar
                </button>
              </>
            ) : (
              "Cargando animación…"
            )}
          </div>
        )}
      </div>
    </div>
  );
}
