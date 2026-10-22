import { fighterById, type FighterId } from "../../shared/content";
import { TECHNIQUES } from "../../shared/techniques";
import { preloadAssets } from "./assets";
import { demoRivalFor, type GuideMove } from "./move-demo";

// These painted sheets only appear in a finale, never in a normal special.
// Full-sequence renderer coverage guards this list against missing artwork.
const finaleOnlyArt = new Set<FighterId>([
  "javier",
  "renny",
  "gomez",
  "conde",
  "emilio",
  "maite",
  "oscar",
  "puma",
  "george",
  "mcm",
  "carolina",
]);

/** The rival only attacks during reflection demos; its finale never runs. */
export function preloadMovePreviewAssets(fighter: FighterId, move: GuideMove) {
  const rival = demoRivalFor(fighter);
  const attacks: FighterId[] =
    move === "final" || (move === "special" && !finaleOnlyArt.has(fighter))
      ? [fighter]
      : [];
  if (move === "special" && TECHNIQUES[fighterById(fighter).ability].reflect)
    attacks.push(rival);
  return preloadAssets([fighter, rival], ["caracas"], {
    entrance: false,
    attacks,
    finales: move === "final" ? [fighter] : [],
  });
}
