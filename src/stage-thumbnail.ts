import type { StageId } from "../shared/content";

export function stageThumbnail(id: StageId, variant: "strip" | "gallery") {
  return `/assets/stage-thumb-${variant}-${id}.webp`;
}
