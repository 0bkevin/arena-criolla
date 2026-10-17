import { FIGHTERS, COMMUNITY_DEFINITIONS, type FighterId } from "./content";
import { PRESENTATIONS } from "./presentation";
import { CHOREOGRAPHIES } from "./choreography";
import type { CommunityCharacter } from "./creator";

export const COMMUNITY_CHARACTERS = new Map<FighterId, CommunityCharacter>();
/** Register the same validated, published definition in the server and every browser. */
export function registerCommunityCharacter(
  character: CommunityCharacter,
  discoverable = true,
) {
  if (
    !/^custom_[a-f0-9]{32}$/.test(character.id) ||
    character.fighter.id !== character.id
  )
    throw new Error("Invalid community character");
  COMMUNITY_DEFINITIONS.set(character.id, character.fighter);
  const current = FIGHTERS.findIndex((f) => f.id === character.id);
  if (current < 0 && discoverable) FIGHTERS.push(character.fighter);
  else if (current >= 0) FIGHTERS[current] = character.fighter;
  PRESENTATIONS[character.id] = character.presentation;
  CHOREOGRAPHIES[character.id] = character.choreography;
  COMMUNITY_CHARACTERS.set(character.id, character);
}
export function unregisterCommunityCharacter(id: FighterId) {
  const index = FIGHTERS.findIndex((f) => f.id === id);
  if (index >= 0) FIGHTERS.splice(index, 1);
  // Retain immutable definitions and sprite geometry for fights already in progress.
}

export function syncCommunityCatalog(characters: CommunityCharacter[]) {
  const ids = new Set(characters.map((character) => character.id));
  for (const fighter of [...FIGHTERS])
    if (fighter.category === "community" && !ids.has(fighter.id))
      unregisterCommunityCharacter(fighter.id);
  characters.forEach((character) => registerCommunityCharacter(character));
}
