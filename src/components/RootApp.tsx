import { useCallback, useEffect, useRef, useState } from "react";
import { ArenaEntrance } from "./ArenaEntrance";
import type { CommunityCharacter } from "../../shared/creator";
import type { loadInterfaceFonts } from "../fonts";

// Keep combat, audio and the catalog out of the entrance's critical bundle.
let gameLoading:
  | Promise<[typeof import("../App"), typeof import("../../shared/community")]>
  | undefined;
function loadGame() {
  return (gameLoading ??= Promise.all([
    import("../App"),
    import("../../shared/community"),
  ]).catch((error) => {
    gameLoading = undefined;
    throw error;
  }));
}

export function RootApp({
  fontLoading,
}: {
  fontLoading: ReturnType<typeof loadInterfaceFonts>;
}) {
  const [revision, setRevision] = useState(0);
  const [catalogReady, setCatalogReady] = useState(false);
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
  const refresh = async (signal: AbortSignal) => {
    const request = new AbortController();
    const abort = () => request.abort();
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(abort, 5000);
    try {
      const response = await fetch("/api/community/characters", {
        signal: request.signal,
      });
      if (!response.ok) throw new Error("No pudimos cargar los luchadores.");
      const { characters }: { characters: CommunityCharacter[] } =
        await response.json();
      const [, { syncCommunityCatalog }] = await loadGame();
      if (request.signal.aborted) return;
      syncCommunityCatalog(characters);
      setRevision((n) => n + 1);
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
    }
  };
  useEffect(() => {
    let active = true;
    let firstFrame = 0;
    let secondFrame = 0;
    let warmupScheduled = false;
    let paintObserver: PerformanceObserver | undefined;
    const controller = new AbortController();
    const restoreGameRoute = () => {
      if (/^\/create(?:\/|$)/i.test(location.pathname))
        history.replaceState(null, "", "/");
    };
    restoreGameRoute();
    window.addEventListener("popstate", restoreGameRoute);
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
            .then(([module]) => {
              if (active) setGameApp(() => module.App);
            })
            .catch(() => {
              if (active) setLoadFailed(true);
            });
          void refresh(controller.signal)
            .catch(() => {})
            .finally(() => {
              if (active) setCatalogReady(true);
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
    const timer = setInterval(() => {
      if (!document.hidden) void refresh(controller.signal).catch(() => {});
    }, 15_000);
    return () => {
      active = false;
      controller.abort();
      paintObserver?.disconnect();
      clearTimeout(paintDeadline);
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      window.removeEventListener("popstate", restoreGameRoute);
      clearInterval(timer);
    };
  }, []);
  // Restore saved community selections only after their definitions are available.
  if (!entranceComplete || !GameApp)
    return (
      <ArenaEntrance
        ready={catalogReady && interfaceReady && GameApp !== null}
        fontsReady={fontsReady}
        displayFontReady={displayFontReady}
        onComplete={finishEntrance}
        onRetry={loadFailed ? () => location.reload() : undefined}
      />
    );
  return (
    <div className="arena-arrival">
      <GameApp communityRevision={revision} />
    </div>
  );
}
