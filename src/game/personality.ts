import type { FighterId } from "../../shared/content";
import { COMMUNITY_CHARACTERS } from "../../shared/community";
import manifest from "../../docs/character-manifest.json";

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
export const personalityById = (id: FighterId): CharacterPersonality => {
  const community = COMMUNITY_CHARACTERS.get(id);
  return (
    PERSONALITIES[id] ?? {
      realName: community?.fighter.name ?? "Luchador de la comunidad",
      portrayal:
        community?.fighter.description ?? "Personaje creado en la arena.",
      sources: [],
    }
  );
};
