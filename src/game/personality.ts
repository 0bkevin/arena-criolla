import type { FighterId } from "../../shared/content";
import manifest from "../../shared/character-personalities.json";

export interface CharacterPersonality {
  realName: string;
  portrayal: string;
  quote?: { text: string; sourceUrl: string };
  sources: { title: string; url: string }[];
}
export const PERSONALITIES = manifest.characters as unknown as Record<
  FighterId,
  CharacterPersonality
>;
export const personalityById = (id: FighterId): CharacterPersonality =>
  PERSONALITIES[id];
