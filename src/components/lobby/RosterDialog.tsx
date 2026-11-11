import type { CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import { FIGHTERS, type FighterId } from "../../../shared/roster/roster";
import { Modal } from "../ui/Modal";
import { Portrait } from "../ui/Portrait";

const colorStyle = (color: string): CSSProperties =>
  ({ "--fighter-color": color }) as CSSProperties;

interface Props {
  onDetail: (id: FighterId) => void;
  onClose: () => void;
}

/** Every fighter, each opening its move list. */
export function RosterDialog({ onDetail, onClose }: Props) {
  return (
    <Modal title="Luchadores" wide onClose={onClose}>
      <div className="roster-grid">
        {FIGHTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => onDetail(f.id)}
            style={colorStyle(f.color)}
          >
            <Portrait fighter={f.id} />
            <div>
              <h3>{f.name}</h3>
              <strong>
                Ver movimientos <ArrowRight size={13} />
              </strong>
            </div>
          </button>
        ))}
      </div>
    </Modal>
  );
}
