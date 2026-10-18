import { useEffect, useState } from "react";
import { App } from "../App";
import { syncCommunityCatalog } from "../../shared/community";
import type { CommunityCharacter } from "../../shared/creator";

export function RootApp() {
  const [revision, setRevision] = useState(0);
  const [catalogReady, setCatalogReady] = useState(false);
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
  if (!catalogReady)
    return (
      <div className="arena-boot" role="status">
        Abriendo la arena…
      </div>
    );
  return <App communityRevision={revision} />;
}
