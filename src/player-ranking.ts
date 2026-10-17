import { useCallback, useEffect, useState } from "react";
import type { ArenaAccount, RankingEntry } from "../shared/ranking";
import { loadPlayerRanking } from "./ranking-api";

export function useRankingRefresh() {
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    const visible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh]);
  return [revision, refresh] as const;
}

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
  const [refresh, refreshRanking] = useRankingRefresh();
  useEffect(() => {
    if (!account) {
      setState(null);
      return;
    }
    let alive = true;
    const controller = new AbortController();
    setState({ userId: account.id, entry: null, loading: true, error: "" });
    void loadPlayerRanking(account, controller.signal)
      .then(({ entry }) => {
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
    refresh: refreshRanking,
  };
}
