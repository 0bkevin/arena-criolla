import type { PlayerState } from "./types";

/** The dash-only tail starts after all overlapping non-dash protection expires. */
export function grantDashInvincibility(player: PlayerState, ticks: number) {
  const nonDash = player.invincible - player.dashOnlyInvincible;
  player.dashOnlyInvincible = Math.max(
    player.dashOnlyInvincible,
    ticks - nonDash,
  );
  player.invincible = Math.max(player.invincible, ticks);
}

export function grantNonDashInvincibility(player: PlayerState, ticks: number) {
  const nonDash = Math.max(
    player.invincible - player.dashOnlyInvincible,
    ticks,
  );
  player.invincible = Math.max(player.invincible, ticks);
  player.dashOnlyInvincible = player.invincible - nonDash;
}

export function setInvincibility(
  player: PlayerState,
  ticks: number,
  dash = false,
) {
  player.invincible = ticks;
  player.dashOnlyInvincible = dash ? ticks : 0;
}

export function tickInvincibility(player: PlayerState) {
  if (player.invincible <= player.dashOnlyInvincible)
    player.dashOnlyInvincible = Math.max(0, player.dashOnlyInvincible - 1);
  player.invincible = Math.max(0, player.invincible - 1);
}
