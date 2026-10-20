import { useCallback, useEffect, useRef, useState } from "react";
import { App } from "../App";
import { ArenaEntrance } from "./ArenaEntrance";
import { syncCommunityCatalog } from "../../shared/community";
import type { CommunityCharacter } from "../../shared/creator";

export function RootApp({ fontLoading }: { fontLoading: Promise<void> }) {
  const [revision, setRevision] = useState(0);
  const [catalogReady, setCatalogReady] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);
  const [entranceComplete, setEntranceComplete] = useState(false);
  const restoreFocus = useRef(false);
  const finishEntrance = useCallback((focus: boolean) => {
    restoreFocus.current = focus;
    setEntranceComplete(true);
  }, []);

  useEffect(() => {
    let active = true;
    void fontLoading.then(() => {
      if (active) setFontsReady(true);
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
  const refresh = async () => {
    const response = await fetch("/api/community/characters", {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error("No pudimos cargar los luchadores.");
    const { characters }: { characters: CommunityCharacter[] } =
      await response.json();
    syncCommunityCatalog(characters);
    setRevision((n) => n + 1);
  };
  useEffect(() => {
    const restoreGameRoute = () => {
      if (/^\/create(?:\/|$)/i.test(location.pathname))
        history.replaceState(null, "", "/");
    };
    restoreGameRoute();
    window.addEventListener("popstate", restoreGameRoute);
    void refresh()
      .catch(() => {})
      .finally(() => setCatalogReady(true));
    const timer = setInterval(() => {
      if (!document.hidden) void refresh().catch(() => {});
    }, 15_000);
    return () => {
      window.removeEventListener("popstate", restoreGameRoute);
      clearInterval(timer);
    };
  }, []);
  // Restore saved community selections only after their definitions are available.
  if (!entranceComplete)
    return (
      <ArenaEntrance
        ready={catalogReady}
        fontsReady={fontsReady}
        onComplete={finishEntrance}
      />
    );
  return (
    <div className="arena-arrival">
      <App communityRevision={revision} />
    </div>
  );
}
