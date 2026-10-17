import type { ArenaAccount, RankingCommands } from "../shared/ranking";
import { creatorRequest } from "./creator-api";

async function read<T>(url: string, signal: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal.aborted) cancel();
  else signal.addEventListener("abort", cancel, { once: true });
  // Do not require AbortSignal.any/timeout: older mobile browsers still support
  // AbortController and must be able to load and retry account statistics.
  const timer = window.setTimeout(cancel, 10_000);
  try {
    return await creatorRequest<T>(url, { signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted && !signal.aborted)
      throw new Error("La consulta tardó demasiado. Vuelve a intentarlo.");
    throw error;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
  }
}

export const loadRankingBoard = (signal: AbortSignal) =>
  read<RankingCommands["board"]["result"]>("/api/ranking", signal);

export async function loadPlayerRanking(
  account: ArenaAccount,
  signal: AbortSignal,
) {
  const profile = await read<RankingCommands["profile"]["result"]>(
    "/api/ranking/me",
    signal,
  );
  if (profile.entry.userId !== account.id)
    throw new Error(
      "La sesión ha cambiado. Vuelve a la pestaña o recarga para actualizar tu cuenta.",
    );
  return profile;
}
