import { useEffect, useState } from "react";
import { App } from "../App";
import { CreatorStudio } from "./CreatorStudio";
import { creatorApi } from "../creator-api";
import { syncCommunityCatalog } from "../../shared/community";

export function RootApp() {
  const [route, setRoute] = useState(location.pathname),
    [revision, setRevision] = useState(0);
  const [catalogReady, setCatalogReady] = useState(false);
  const refresh = async () => {
    const { characters } = await creatorApi.community();
    syncCommunityCatalog(characters);
    setRevision((n) => n + 1);
  };
  useEffect(() => {
    const pop = () => setRoute(location.pathname);
    window.addEventListener("popstate", pop);
    void refresh()
      .catch(() => {})
      .finally(() => setCatalogReady(true));
    const timer = setInterval(() => {
      if (!document.hidden) void refresh().catch(() => {});
    }, 15_000);
    return () => {
      window.removeEventListener("popstate", pop);
      clearInterval(timer);
    };
  }, []);
  const navigate = (path: string) => {
    history.pushState(null, "", path);
    setRoute(path);
    window.scrollTo({ top: 0 });
  };
  if (route === "/create" || route === "/create/")
    return (
      <CreatorStudio onBack={() => navigate("/")} onCatalogChange={refresh} />
    );
  // Restore saved community selections only after their definitions are available.
  if (!catalogReady)
    return (
      <div className="arena-boot" role="status">
        Abriendo la arena…
      </div>
    );
  return (
    <App onCreate={() => navigate("/create")} communityRevision={revision} />
  );
}
