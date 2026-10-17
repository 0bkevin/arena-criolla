import type { FighterDefinition, FighterId } from "./content";
import type { Presentation } from "./presentation";
import type { Choreography } from "./choreography";

export type FightingStyle = "agile" | "technical" | "power";
export type CreationStatus =
  | "queued"
  | "designing"
  | "drawing"
  | "packing"
  | "testing"
  | "ready"
  | "failed"
  | "published"
  | "archived";
export interface CreatorUser {
  id: string;
  name: string;
  email: string;
}
export interface CharacterInput {
  name: string;
  description: string;
  style: FightingStyle;
  color: string;
}
export interface SpriteGeometry {
  width: number;
  height: number;
  cellWidth: number;
  cellHeight: number;
  baseline: number;
  bodyHeight: number;
  frames: {
    x: number;
    y: number;
    width: number;
    height: number;
    slotX: number;
    slotY: number;
  }[];
}
export interface CommunityCharacter {
  id: FighterId;
  creatorName: string;
  createdAt: number;
  fighter: FighterDefinition;
  presentation: Presentation;
  choreography: Choreography;
  geometry: SpriteGeometry;
}
export interface CreatorCharacter {
  id: string;
  input: CharacterInput;
  status: CreationStatus;
  progress: number;
  message: string;
  createdAt: number;
  updatedAt: number;
  character: CommunityCharacter | null;
  photoUrls: string[];
}
export interface CreatorCapabilities {
  generationAvailable: boolean;
  maxPhotos: number;
  maxPhotoBytes: number;
}
export const CREATION_STEPS = [
  "Tu esencia",
  "Diseñando el luchador",
  "Dibujando las poses",
  "Afinando el movimiento",
  "Probando en la arena",
  "Listo para pelear",
] as const;
