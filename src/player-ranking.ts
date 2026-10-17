import { useEffect, useState } from "react";
import type { ArenaAccount, RankingEntry } from "../shared/ranking";
import { creatorRequest } from "./creator-api";

// The server owns the total. Never increment it from a local combat result or
// retain another account's total while a session change is being fetched.
export function usePlayerRanking(
  account: ArenaAccount | null,
  revision: number,
) {
  const [state, setState] = useState<{
    userId: string;
    entry: RankingEntry | null;
    loading: boolean;
    error: string;
  } | null>(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const update = () => setRefresh((value) => value + 1);
    const visible = () => {
      if (document.visibilityState === "visible") update();
    };
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  useEffect(() => {
    if (!account) {
      setState(null);
      return;
    }
    let alive = true;
    const controller = new AbortController();
    setState({ userId: account.id, entry: null, loading: true, error: "" });
    void creatorRequest<{ entry: RankingEntry }>("/api/ranking/me", {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
    })
      .then(({ entry }) => {
        if (entry.userId !== account.id) throw new Error("Session changed");
        if (alive)
          setState({ userId: account.id, entry, loading: false, error: "" });
      })
      .catch(() => {
        if (alive)
          setState({
            userId: account.id,
            entry: null,
            loading: false,
            error: "No pudimos cargar tu puntaje. Inténtalo de nuevo.",
          });
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [account, revision, refresh]);
  const current = account && state?.userId === account.id ? state : null;
  return {
    entry: current?.entry ?? null,
    loading: Boolean(account && (!current || current.loading)),
    error: current?.error ?? "",
    refresh: () => setRefresh((value) => value + 1),
  };
}
