import {
  SUPER_CHARGE_TICKS,
  SUPER_CHARGE_SECONDS_LABEL,
  SUPER_INTERRUPT_ENERGY_COST,
} from "../../shared/content";
import type { PlayerState } from "../../shared/engine";

export function SuperMeter({
  player,
  tick,
}: {
  player: PlayerState;
  tick: number;
}) {
  const charging = player.superChargeTicks > 0;
  const progress = Math.min(
    100,
    Math.floor((player.superChargeTicks / SUPER_CHARGE_TICKS) * 100),
  );
  const interrupted =
    player.superChargeInterruptedTick !== undefined &&
    tick - player.superChargeInterruptedTick < 90;
  const status = player.superUsed
    ? "Usada"
    : charging
      ? `Cargando ${progress}%`
      : interrupted
        ? `Corte: −${SUPER_INTERRUPT_ENERGY_COST}`
        : `Carga: ${SUPER_CHARGE_SECONDS_LABEL} s`;
  const description = player.superUsed
    ? "Ya usaste la definitiva en esta pelea."
    : charging
      ? "Cargando definitiva. No puedes atacar, bloquear, saltar ni esquivar."
      : interrupted
        ? `Carga interrumpida. Pierdes ${SUPER_INTERRUPT_ENERGY_COST} de energía y conservas el uso.`
        : `Mantén la definitiva durante ${SUPER_CHARGE_SECONDS_LABEL} segundos. Un uso por pelea.`;
  return (
    <div
      className={`energy-meter${charging ? " is-charging" : ""}${interrupted && !charging && !player.superUsed ? " is-interrupted" : ""}`}
    >
      <div
        className="energy-track"
        role="progressbar"
        aria-label={charging ? "Carga de la definitiva" : "Energía"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={charging ? progress : Math.floor(player.energy)}
        aria-valuetext={
          charging
            ? `${progress}%. ${description}`
            : `${Math.floor(player.energy)}%. ${description}`
        }
      >
        <div className="energy-fill" style={{ width: `${player.energy}%` }} />
        {charging && (
          <div
            className="super-charge-fill"
            style={{ width: `${progress}%` }}
          />
        )}
      </div>
      <span className="super-charge-status" title={description}>
        {status}
      </span>
    </div>
  );
}
