import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import { VenezuelaStars } from "./CriolloArt";
import entranceAssets from "../entrance-assets.json";
import "../arena-entrance.css";

export function ArenaEntrance({
  ready,
  onComplete,
}: {
  ready: boolean;
  onComplete: (restoreFocus: boolean) => void;
}) {
  const entrance = useRef<HTMLDivElement>(null);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [introPlayed, setIntroPlayed] = useState(false);
  const [artReady, setArtReady] = useState(false);
  const settledArt = useRef(new Set<string>());
  const leaving = ready && introPlayed;
  const settleArt = (fighter: string) => {
    settledArt.current.add(fighter);
    if (settledArt.current.size === 2) setArtReady(true);
  };

  useEffect(() => {
    if (artReady) return;
    // A slow or missing illustration must never hold the loading screen open.
    const timer = window.setTimeout(() => setArtReady(true), 900);
    return () => window.clearTimeout(timer);
  }, [artReady]);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    preference.addEventListener("change", update);
    update();
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!artReady && !reducedMotion) return;
    const timer = window.setTimeout(
      () => setIntroPlayed(true),
      reducedMotion ? 0 : 2200,
    );
    return () => window.clearTimeout(timer);
  }, [artReady, reducedMotion]);

  useEffect(() => {
    if (!leaving) return;
    // Completion cannot depend on CSS events: reduced motion disables animations.
    const timer = window.setTimeout(
      () => {
        onComplete(Boolean(entrance.current?.contains(document.activeElement)));
      },
      reducedMotion ? 0 : 360,
    );
    return () => window.clearTimeout(timer);
  }, [leaving, onComplete, reducedMotion]);

  return (
    <div
      ref={entrance}
      className={`arena-entrance ${artReady ? "is-playing" : "is-preparing"}${leaving ? " is-leaving" : ""}`}
      onKeyDown={(event) => {
        if (event.key === "Escape" && ready) setIntroPlayed(true);
      }}
    >
      <div className="arena-entrance-stage">
        <div className="arena-entrance-scenery" aria-hidden="true" />
        <div
          className="arena-entrance-panel arena-entrance-panel-left"
          aria-hidden="true"
        />
        <div
          className="arena-entrance-panel arena-entrance-panel-right"
          aria-hidden="true"
        />
        <svg
          className="arena-entrance-speed"
          viewBox="0 0 1200 800"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M0 90 440 320M0 260 390 365M0 510 410 420M0 720 450 465M1200 90 760 320M1200 260 810 365M1200 510 790 420M1200 720 750 465" />
        </svg>
        <div className="arena-entrance-duel" aria-hidden="true">
          <picture className="arena-entrance-fighter arena-entrance-fighter-left">
            <source type="image/avif" srcSet={entranceAssets.renny.avif} />
            <img
              src={entranceAssets.renny.webp}
              alt=""
              width={entranceAssets.renny.width}
              height={entranceAssets.renny.height}
              draggable={false}
              decoding="async"
              fetchPriority="high"
              onLoad={() => settleArt("renny")}
              onError={(event) => {
                event.currentTarget.hidden = true;
                settleArt("renny");
              }}
            />
          </picture>
          <picture className="arena-entrance-fighter arena-entrance-fighter-right">
            <source type="image/avif" srcSet={entranceAssets.capriles.avif} />
            <img
              src={entranceAssets.capriles.webp}
              alt=""
              width={entranceAssets.capriles.width}
              height={entranceAssets.capriles.height}
              draggable={false}
              decoding="async"
              fetchPriority="high"
              onLoad={() => settleArt("capriles")}
              onError={(event) => {
                event.currentTarget.hidden = true;
                settleArt("capriles");
              }}
            />
          </picture>
          <svg className="arena-entrance-impact" viewBox="0 0 200 200">
            <path d="m100 0 12 62 43-43-22 60 67-12-56 35 48 37-66-9 12 62-38-49-34 57 7-66-65 19 49-42L0 84l65-3-37-55 54 38z" />
          </svg>
          <div className="arena-entrance-sparks">
            {[-165, -140, -110, -70, -35, -15, 15, 40, 75, 110, 145, 170].map(
              (angle, index) => (
                <i
                  key={angle}
                  style={
                    {
                      "--spark-angle": `${angle}deg`,
                      "--spark-distance": `${130 + (index % 3) * 45}px`,
                    } as CSSProperties
                  }
                />
              ),
            )}
          </div>
          <span className="arena-entrance-versus">VS</span>
        </div>
        <div className="arena-entrance-brand">
          <h1 className="arena-entrance-title" aria-label="Arena Criolla">
            <span aria-hidden="true">ARENA</span>
            <span aria-hidden="true">CRIOLLA</span>
          </h1>
          <VenezuelaStars className="arena-entrance-stars" />
        </div>
      </div>
      <p className="arena-entrance-status" role="status">
        {ready ? "Entrando a la arena…" : "Abriendo la arena…"}
      </p>
      <div className="arena-entrance-exit-slash" aria-hidden="true" />
      <button
        type="button"
        className="arena-entrance-skip"
        disabled={!ready}
        aria-disabled={leaving || undefined}
        onClick={() => {
          if (!leaving) setIntroPlayed(true);
        }}
      >
        Saltar intro <ArrowRight size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
