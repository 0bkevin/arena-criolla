import type { CSSProperties } from "react";
import { ArrowRight, Check, LockKeyhole, Zap } from "lucide-react";
import {
  SUPER_ENERGY_COST,
  fighterById,
  type FighterId,
} from "../../shared/content";
import { finaleById } from "../../shared/finales";
import { Modal } from "./Modal";
import { Portrait } from "./Portrait";

export function FighterDetail({
  fighter,
  wins,
  onClose,
  onSelect,
}: {
  fighter: FighterId;
  wins: number;
  onClose: () => void;
  onSelect: () => void;
}) {
  const f = fighterById(fighter);
  const finale = finaleById(fighter);
  return (
    <Modal title={f.name} wide onClose={onClose}>
      <div
        className="fighter-detail"
        style={{ "--fighter-color": f.color } as CSSProperties}
      >
        <div className="detail-art">
          <span className="detail-backdrop" />
          <Portrait fighter={f.id} />
        </div>
        <div className="detail-info">
          <div className="special-description">
            {wins < (f.specialUnlockWins ?? 0) ? (
              <LockKeyhole size={18} />
            ) : (
              <Zap size={18} />
            )}
            <div>
              <strong>{f.special}</strong>
              <span>
                <kbd>L</kbd> Especial · 25 de energía
              </span>
              {f.specialUnlockWins !== undefined && (
                <span>
                  {wins < f.specialUnlockWins
                    ? `Gana ${f.specialUnlockWins} peleas con ${f.shortName} (${wins}/${f.specialUnlockWins})`
                    : "Especial desbloqueado"}
                </span>
              )}
            </div>
          </div>
          <h3>Tu libro de combos</h3>
          <div className="combo-list">
            {f.combos.map((combo, i) => (
              <div className="unlocked" key={combo}>
                <span>
                  <Check size={16} />
                </span>
                <div>
                  <strong>{i === 2 && finale ? finale.title : combo}</strong>
                  <small>
                    {i === 2
                      ? `Disponible · ${SUPER_ENERGY_COST} de energía`
                      : "Listo para pelear"}
                  </small>
                  {i === 2 && finale && <small>{finale.description}</small>}
                </div>
                <kbd>{["J → K", "J → J → K", "I"][i]}</kbd>
              </div>
            ))}
          </div>
          <button className="primary-button" onClick={onSelect}>
            Elegir a {f.shortName} <ArrowRight size={17} />
          </button>
        </div>
      </div>
    </Modal>
  );
}
