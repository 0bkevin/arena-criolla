import { useCallback, useEffect, useRef, useState } from "react";
import { ArenaEntrance } from "./ArenaEntrance";
import type { loadInterfaceFonts } from "../fonts";

// Keep combat and audio out of the entrance's critical bundle.
let gameLoading: Promise<typeof import("../App")> | undefined;
function loadGame() {
  return (gameLoading ??= import("../App").catch((error) => {
    gameLoading = undefined;
    throw error;
  }));
}

export function RootApp({
  fontLoading,
}: {
  fontLoading: ReturnType<typeof loadInterfaceFonts>;
}) {
  const [fontsReady, setFontsReady] = useState(false);
  const [displayFontReady, setDisplayFontReady] = useState(true);
  const [interfaceReady, setInterfaceReady] = useState(false);
  const [GameApp, setGameApp] = useState<
    (typeof import("../App"))["App"] | null
  >(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [entranceComplete, setEntranceComplete] = useState(false);
  const restoreFocus = useRef(false);
  const finishEntrance = useCallback(
    (focus: boolean) => {
      fontLoading.activateInterface();
      restoreFocus.current = focus;
      setEntranceComplete(true);
    },
    [fontLoading],
  );

  useEffect(() => {
    let active = true;
    void fontLoading.entranceReady.then(({ displayReady }) => {
      if (active) {
        setDisplayFontReady(displayReady);
        setFontsReady(true);
      }
    });
    void fontLoading.ready.then(() => {
      if (active) setInterfaceReady(true);
    });
    return () => {
      active = false;
    };
  }, [fontLoading]);

  useEffect(() => {
    if (entranceComplete && restoreFocus.current) {
      document.querySelector<HTMLButtonElement>(".site-header .brand")?.focus();
      restoreFocus.current = false;
    }
  }, [entranceComplete]);
  useEffect(() => {
    let active = true;
    let firstFrame = 0;
    let secondFrame = 0;
    let warmupScheduled = false;
    let paintObserver: PerformanceObserver | undefined;
    // Wait for visible entrance content before executing the larger game chunk.
    // The deadline also warms the game when fonts or images are still arriving.
    const warmGame = () => {
      if (warmupScheduled) return;
      warmupScheduled = true;
      paintObserver?.disconnect();
      clearTimeout(paintDeadline);
      firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(() => {
          void loadGame()
            .then((module) => {
              if (!active) return;
              setGameApp(() => module.App);
              // The lobby follows the entrance: fetch its first art meanwhile.
              module.warmLobbyArt();
            })
            .catch(() => {
              if (active) setLoadFailed(true);
            });
        });
      });
    };
    const paintDeadline = setTimeout(warmGame, 250);
    if (
      typeof PerformanceObserver !== "undefined" &&
      PerformanceObserver.supportedEntryTypes?.includes("paint") &&
      !performance
        .getEntriesByType("paint")
        .some((entry) => entry.name === "first-contentful-paint")
    ) {
      paintObserver = new PerformanceObserver((entries) => {
        if (
          entries
            .getEntries()
            .some((entry) => entry.name === "first-contentful-paint")
        )
          warmGame();
      });
      paintObserver.observe({ type: "paint", buffered: true });
    } else warmGame();
    return () => {
      active = false;
      paintObserver?.disconnect();
      clearTimeout(paintDeadline);
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, []);
  if (!entranceComplete || !GameApp)
    return (
      <ArenaEntrance
        ready={interfaceReady && GameApp !== null}
        fontsReady={fontsReady}
        displayFontReady={displayFontReady}
        onComplete={finishEntrance}
        onRetry={loadFailed ? () => location.reload() : undefined}
      />
    );
  return (
    <div className="arena-arrival">
      <GameApp />
    </div>
  );
}
