import type { PlayerState } from "./types";

/** The dash-only tail starts after all overlapping non-dash protection expires. */
export function grantDashInvincibility(player: PlayerState, ticks: number) {
  const nonDash = player.invincible - player.dashOnlyInvincible;
  player.dashOnlyInvincible = Math.max(
    player.dashOnlyInvincible,
    ticks - nonDash,
  );
  player.invincible = Math.max(player.invincible, ticks);
  if (player.fallProtectionTicks !== undefined)
    player.fallProtectionDashBase = Math.max(
      player.fallProtectionDashBase ?? 0,
      ticks,
    );
}

export function grantNonDashInvincibility(player: PlayerState, ticks: number) {
  const nonDash = Math.max(
    player.invincible - player.dashOnlyInvincible,
    ticks,
  );
  player.invincible = Math.max(player.invincible, ticks);
  player.dashOnlyInvincible = player.invincible - nonDash;
  if (player.fallProtectionTicks !== undefined)
    player.fallProtectionBase = Math.max(player.fallProtectionBase ?? 0, ticks);
}

/** Remove only the nonlethal-fall layer, retaining unrelated immunity. */
export function clearFallProtection(player: PlayerState) {
  if (player.fallProtectionTicks === undefined) return;
  const base = player.fallProtectionBase ?? 0;
  const dashBase = player.fallProtectionDashBase ?? player.dashOnlyInvincible;
  player.invincible = Math.max(base, dashBase);
  player.dashOnlyInvincible = Math.max(0, dashBase - base);
  delete player.fallProtectionTicks;
  delete player.fallProtectionBase;
  delete player.fallProtectionDashBase;
}

export function setInvincibility(
  player: PlayerState,
  ticks: number,
  dash = false,
) {
  delete player.fallProtectionTicks;
  delete player.fallProtectionBase;
  delete player.fallProtectionDashBase;
  player.invincible = ticks;
  player.dashOnlyInvincible = dash ? ticks : 0;
}

export function tickInvincibility(player: PlayerState) {
  if (player.fallProtectionTicks !== undefined) {
    player.fallProtectionTicks = Math.max(0, player.fallProtectionTicks - 1);
    player.fallProtectionBase = Math.max(
      0,
      (player.fallProtectionBase ?? 0) - 1,
    );
    player.fallProtectionDashBase = Math.max(
      0,
      (player.fallProtectionDashBase ?? 0) - 1,
    );
    if (player.fallProtectionTicks === 0) {
      const base = player.fallProtectionBase;
      const dashBase = player.fallProtectionDashBase ?? 0;
      delete player.fallProtectionTicks;
      delete player.fallProtectionBase;
      delete player.fallProtectionDashBase;
      if (base !== undefined) {
        player.invincible = Math.max(player.invincible, base, dashBase);
        player.dashOnlyInvincible = Math.max(0, dashBase - base);
      }
    }
  }
  if (player.invincible <= player.dashOnlyInvincible)
    player.dashOnlyInvincible = Math.max(0, player.dashOnlyInvincible - 1);
  player.invincible = Math.max(0, player.invincible - 1);
}
