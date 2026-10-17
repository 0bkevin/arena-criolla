import type { Ability } from "../../shared/content";
import type { PlayerState, Projectile } from "../../shared/engine";

// These small effects are drawn around the illustrated sprites, without loading
// extra textures. Their movement comes from the shared simulation state.
export function drawFolkloreProjectile(
  ctx: CanvasRenderingContext2D,
  p: Projectile,
): boolean {
  const age = p.age ?? 0;
  switch (p.kind) {
    case "whistle":
      for (let ring = 0; ring < 3; ring++) {
        ctx.globalAlpha = 1 - ring * 0.22;
        ctx.beginPath();
        ctx.arc(-ring * 12, 0, 12 + ring * 7, -1.4, 1.4);
        ctx.stroke();
      }
      ctx.fillRect(-2, -2, 4, 4);
      break;
    case "undertow":
      ctx.beginPath();
      ctx.moveTo(-38, 22);
      ctx.bezierCurveTo(-25, -15, 15, -43, 33, -14);
      ctx.bezierCurveTo(12, -21, 5, -2, 25, 7);
      ctx.lineTo(38, 23);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#e4fbff";
      for (let drop = 0; drop < 4; drop++) {
        ctx.beginPath();
        ctx.arc(
          -27 + drop * 12,
          -15 - Math.sin(age / 5 + drop) * 9,
          3,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      break;
    case "wildspirit":
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.ellipse(-8, -1, 34, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(23, -8, 17, 13, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(29, -6);
      ctx.quadraticCurveTo(52, -7, 48, 10);
      ctx.lineTo(40, 9);
      ctx.lineTo(36, 0);
      ctx.fill();
      ctx.fillRect(19, -29, 7, 13);
      for (let leg = 0; leg < 4; leg++) {
        const x = -29 + leg * 15;
        ctx.fillRect(x + Math.sin(age / 4 + leg * 2) * 4, 9, 7, 20);
      }
      ctx.fillStyle = "#153b31";
      ctx.fillRect(30, -12, 3, 3);
      break;
    case "verse":
      ctx.rotate(Math.sin(age / 7) * 0.2);
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.ellipse(-8 + i * 20, 12 - i * 3, 8, 5, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(-2 + i * 20, -17 - i * 3, 3, 30);
      }
      ctx.fillRect(0, -20, 20, 4);
      break;
    case "hellfire":
      ctx.beginPath();
      ctx.moveTo(-38, -18);
      ctx.quadraticCurveTo(-14, -8, -21, -30);
      ctx.quadraticCurveTo(33, -35, 29, 2);
      ctx.quadraticCurveTo(21, 29, -39, 18);
      ctx.quadraticCurveTo(-15, 5, -38, -18);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fff0b5";
      ctx.beginPath();
      ctx.ellipse(8, 0, 13, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "elixir":
      ctx.rotate(age / 8);
      ctx.fillStyle = "#d8fff7";
      ctx.beginPath();
      ctx.roundRect(-11, -10, 22, 27, 7);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#80e893";
      ctx.fillRect(-8, 1, 16, 12);
      ctx.fillStyle = "#b68b5f";
      ctx.fillRect(-5, -16, 10, 7);
      break;
    case "trickster":
      ctx.rotate(age / 9);
      ctx.fillStyle = "#ffad50";
      ctx.beginPath();
      ctx.moveTo(-23, 0);
      ctx.lineTo(14, -11);
      ctx.quadraticCurveTo(28, 0, 14, 11);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "#74d99b";
      ctx.lineWidth = 4;
      for (let leaf = -1; leaf <= 1; leaf++) {
        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(33, leaf * 10);
        ctx.stroke();
      }
      break;
    default:
      return false;
  }
  return true;
}

export function drawFolkloreSpecial(
  ctx: CanvasRenderingContext2D,
  ability: Ability,
  p: PlayerState,
  rival: PlayerState,
  progress: number,
) {
  if (ability === "roots") {
    const x = p.x + p.facing * Math.min(215, Math.abs(rival.x - p.x));
    for (let vine = -2; vine <= 2; vine++) {
      ctx.beginPath();
      ctx.moveTo(x + vine * 17, p.y);
      ctx.bezierCurveTo(
        x + vine * 17 - 17,
        p.y - 35,
        x + vine * 17 + 20,
        p.y - 32,
        x + vine * 15,
        p.y - 68,
      );
      ctx.stroke();
    }
  } else if (ability === "haunt") {
    for (let ghost = 1; ghost <= 3; ghost++) {
      ctx.globalAlpha = Math.max(
        0,
        0.45 - ghost * 0.1 - Math.abs(progress) / 70,
      );
      ctx.beginPath();
      ctx.ellipse(
        p.x - p.facing * ghost * 36,
        p.y - 83,
        22,
        70,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.stroke();
    }
  } else if (ability === "pounce") {
    for (let claw = 0; claw < 3; claw++) {
      ctx.beginPath();
      ctx.moveTo(p.x + p.facing * (28 + claw * 12), p.y - 139);
      ctx.quadraticCurveTo(
        p.x + p.facing * (115 + claw * 12),
        p.y - 95,
        p.x + p.facing * (65 + claw * 12),
        p.y - 44,
      );
      ctx.stroke();
    }
  } else if (ability === "trickster") {
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 42 + Math.max(progress, 0), 9, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

export function drawFolkloreStatus(
  ctx: CanvasRenderingContext2D,
  p: PlayerState,
) {
  if (!p.slowTicks && !p.rootTicks) return;
  ctx.save();
  ctx.strokeStyle = p.rootTicks ? "#9fe1a9" : "#c0ff91";
  ctx.lineWidth = 3;
  ctx.shadowColor = ctx.strokeStyle;
  ctx.shadowBlur = 8;
  if (p.rootTicks) {
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(p.x + i * 20, p.y + 4);
      ctx.quadraticCurveTo(p.x + i * 20 - 15, p.y - 17, p.x + i * 14, p.y - 36);
      ctx.stroke();
    }
  } else {
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - 4, 36, 10, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.font = '700 11px "DM Sans", sans-serif';
  ctx.textAlign = "center";
  ctx.fillStyle = "#eaffdd";
  ctx.strokeStyle = "#163929";
  ctx.lineWidth = 3;
  const label = p.rootTicks ? "RAÍCES · SALTA" : "LENTITUD";
  ctx.strokeText(label, p.x, p.y - 220);
  ctx.fillText(label, p.x, p.y - 220);
  ctx.restore();
}
