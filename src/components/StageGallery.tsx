import { Check } from "lucide-react";
import { STAGES, type StageId } from "../../shared/content";

export function StageGallery({
  selectedStage,
  disabled,
  onSelect,
}: {
  selectedStage: StageId;
  disabled: boolean;
  onSelect: (id: StageId) => void;
}) {
  return (
    <div className="stage-gallery">
      {STAGES.map((stage, index) => (
        <button
          key={stage.id}
          className={`stage-card ${stage.artStyle === "pixel" ? "pixel-stage" : ""}`}
          aria-label={`Seleccionar escenario ${stage.location}`}
          aria-pressed={selectedStage === stage.id}
          disabled={disabled}
          onClick={() => onSelect(stage.id)}
        >
          <div className="stage-card-image">
            <img src={`/assets/${stage.id}.webp`} alt="" loading="lazy" />
            <span>{(index + 1).toString().padStart(2, "0")}</span>
            {selectedStage === stage.id && (
              <strong>
                <Check size={14} /> Elegido
              </strong>
            )}
          </div>
          <div className="stage-card-body">
            <span>{stage.location}</span>
            <div className="stage-tags">
              <span>
                {stage.platforms.length
                  ? `${stage.platforms.length} ${stage.platforms.length === 1 ? "plataforma" : "plataformas"}`
                  : "A ras del suelo"}
              </span>
              {stage.platforms.some((platform) => platform.motion) && (
                <span>Plataforma móvil</span>
              )}
              {stage.artStyle === "pixel" && <span>Pixel art</span>}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
