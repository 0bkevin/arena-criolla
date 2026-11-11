import type { StageId } from "../shared/roster/roster";
import { assetUrl } from "./asset-url";

export function stageThumbnail(id: StageId, variant: "strip" | "gallery") {
  return assetUrl(`/assets/stage-thumb-${variant}-${id}.webp`);
}
