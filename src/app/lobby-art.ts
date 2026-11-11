// The opening matchup and the art the lobby and the next match will need.
import {
  FIGHTERS,
  isFighter,
  type FighterId,
} from "../../shared/roster/roster";
import { loadSprite } from "../game/assets/assets";
import { warmPortraitBusts } from "../game/assets/portrait-bust";
import { MIN_PAGE_SIZE, rosterOrder } from "../components/lobby/ArcadeLobby";

/** Data saver and 2G connections skip speculative match downloads. */
export function constrainedConnection() {
  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  return Boolean(
    connection?.saveData ||
    /^(slow-)?2g$/.test(connection?.effectiveType ?? ""),
  );
}

let openingMatchup: readonly [FighterId, FighterId] | undefined;
/** Two distinct fighters for the first lobby, picked once per page load. */
export function lobbyMatchup() {
  if (!openingMatchup || !openingMatchup.every(isFighter)) {
    // Pick without shuffling or copying the roster.
    const first = Math.floor(Math.random() * FIGHTERS.length);
    const second =
      (first + 1 + Math.floor(Math.random() * (FIGHTERS.length - 1))) %
      FIGHTERS.length;
    openingMatchup = [FIGHTERS[first].id, FIGHTERS[second].id];
  }
  return openingMatchup;
}

/**
 * Fetch the art the lobby shows first while the entrance is still playing:
 * the two contenders and the busts on the roster's first page.
 */
export function warmLobbyArt() {
  for (const id of lobbyMatchup())
    void loadSprite(id, { entrance: true }).catch(() => {});
  // A page holds at least MIN_PAGE_SIZE cards, rounded up to full rows.
  const firstPage = [...FIGHTERS]
    .sort((a, b) => rosterOrder(a, b))
    .slice(0, MIN_PAGE_SIZE + 2);
  warmPortraitBusts(firstPage.map((fighter) => fighter.id));
}
