import type { FighterId } from "../../../../shared/roster/roster";
import actorAssets from "../../assets/manifests/finale-actor-assets.json";
import perroAssets from "../../assets/manifests/perro-mujeriego-assets.json";

interface ActorBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface FinaleActorFrame {
  frame: ActorBounds;
  bodyHeight: number;
  anchorX: number;
}
interface CafeActorFrame extends ActorBounds {
  bodyHeight: number;
  anchorX: number;
}
type FinaleActorFile = { file: string; frames: CafeActorFrame[] };
export const actorManifest: {
  seated: Record<
    string,
    FinaleActorFrame & { file: string; frames?: CafeActorFrame[] }
  >;
  caprilesCafe: FinaleActorFile;
  performers?: Partial<Record<FighterId, FinaleActorFile>>;
} = actorAssets;
export const perroManifest: {
  dancers: Partial<Record<FighterId, FinaleActorFile>>;
} = perroAssets;
/** The atlas gutter does not affect actor size or the contact point at the feet. */
export function finaleActorLayout(frame: FinaleActorFrame, height: number) {
  const scale = height / frame.bodyHeight;
  return {
    x: -frame.anchorX * scale,
    y: -frame.frame.height * scale,
    width: frame.frame.width * scale,
    height: frame.frame.height * scale,
  };
}
