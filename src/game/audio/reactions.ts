/** Short, generic effort sounds. These actors do not portray the roster's real people. */
export type ReactionKind = "jump" | "attack" | "hurt";
export type ReactionBank = "male" | "female";

export const REACTION_CLIPS: Record<
  ReactionBank,
  Record<ReactionKind, readonly string[]>
> = {
  male: {
    jump: [
      "/audio/arcade/male-jump-1.mp3",
      "/audio/arcade/male-jump-2.mp3",
      "/audio/arcade/male-jump-3.mp3",
    ],
    attack: [
      "/audio/arcade/male-attack-1.mp3",
      "/audio/arcade/male-attack-2.mp3",
      "/audio/arcade/male-attack-3.mp3",
    ],
    hurt: [
      "/audio/arcade/male-hurt-1.mp3",
      "/audio/arcade/male-hurt-2.mp3",
      "/audio/arcade/male-hurt-3.mp3",
    ],
  },
  female: {
    jump: [
      "/audio/arcade/female-jump-1.mp3",
      "/audio/arcade/female-jump-2.mp3",
      "/audio/arcade/female-jump-3.mp3",
    ],
    attack: [
      "/audio/arcade/female-attack-1.mp3",
      "/audio/arcade/female-attack-2.mp3",
      "/audio/arcade/female-attack-3.mp3",
    ],
    hurt: [
      "/audio/arcade/female-hurt-1.mp3",
      "/audio/arcade/female-hurt-2.mp3",
      "/audio/arcade/female-hurt-3.mp3",
    ],
  },
};
