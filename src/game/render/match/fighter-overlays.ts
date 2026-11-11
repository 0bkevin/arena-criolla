import type { FighterDefinition } from "../../../../shared/roster/roster";
import {
  opponentOf,
  type MatchState,
  type PlayerIndex,
  type PlayerState,
} from "../../../../shared/engine/engine";
import { TECHNIQUES } from "../../../../shared/engine/techniques";
import type { SpriteAsset } from "../../assets/assets";
import { combatLabel } from "../combat-label";
import { drawCultureSpecial } from "../culture-renderer";
import { drawMaiteGreeting } from "../finales/maite";
import { drawMelanioSignalCharge } from "../finales/melanio";
import { drawFolkloreSpecial, drawFolkloreStatus } from "../folklore-renderer";
import { drawFounderSpecial } from "../founder-renderer";
import { drawIconSpecial } from "../icon-renderer";
import type { Assets } from "./match-assets";

/** The swing arc of a light or heavy attack during its active frames. */
export function drawAttackArc(ctx: CanvasRenderingContext2D, p: PlayerState) {
  if (
    (p.attack === "light" || p.attack === "heavy") &&
    p.attackTick >= 5 &&
    p.attackTick < 17
  ) {
    ctx.save();
    ctx.translate(p.x, p.y - (p.attack === "heavy" ? 63 : 94));
    ctx.scale(p.facing, 1);
    ctx.globalAlpha = Math.max(0, 0.58 - Math.abs(p.attackTick - 10) * 0.07);
    ctx.strokeStyle = p.attack === "heavy" ? "#ffe4a7" : "#d8f3ff";
    ctx.lineWidth = p.attack === "heavy" ? 8 : 4;
    ctx.beginPath();
    ctx.arc(17, 0, p.attack === "heavy" ? 90 : 68, -0.8, 0.55);
    ctx.stroke();
    ctx.restore();
  }
}

/** Technique effects drawn in the fighter's colour while a special plays. */
export function drawSpecialEffects(
  ctx: CanvasRenderingContext2D,
  state: MatchState,
  assets: Assets,
  p: PlayerState,
  i: PlayerIndex,
  def: FighterDefinition,
  sprite: SpriteAsset,
  bodyHeight: number,
) {
  if (p.attack !== "special") return;
  const technique = TECHNIQUES[def.ability];
  const progress = p.attackTick - technique.startup;
  ctx.save();
  ctx.strokeStyle = def.color;
  ctx.fillStyle = `${def.color}30`;
  ctx.lineWidth = 3;
  ctx.globalAlpha = Math.max(0, 1 - Math.abs(progress) / 18);
  drawFolkloreSpecial(
    ctx,
    def.ability,
    p,
    state.players[opponentOf(i)],
    progress,
  );
  drawFounderSpecial(
    ctx,
    def.ability,
    p,
    state.players[opponentOf(i)],
    progress,
  );
  if (
    def.id !== "lorenzo" &&
    def.id !== "bolivar" &&
    !drawMelanioSignalCharge(ctx, assets.finaleProps, p, bodyHeight)
  )
    drawIconSpecial(ctx, def.ability, p, progress);
  drawCultureSpecial(
    ctx,
    def.ability,
    p,
    state.players[opponentOf(i)],
    sprite,
    progress,
  );
  drawTechniqueShape(ctx, state, p, i, def, progress);
  ctx.restore();
}

/** Simple geometric cues for techniques without dedicated artwork. */
function drawTechniqueShape(
  ctx: CanvasRenderingContext2D,
  state: MatchState,
  p: PlayerState,
  i: PlayerIndex,
  def: FighterDefinition,
  progress: number,
) {
  const technique = TECHNIQUES[def.ability];
  if (def.ability === "courier") {
    ctx.save();
    ctx.translate(p.x + p.facing * 48, p.y - 8);
    ctx.scale(p.facing, 1);
    // Route markers show where the convoy emerges; the bikes carry the attack.
    for (let mark = 0; mark < 3; mark++) {
      ctx.beginPath();
      ctx.moveTo(mark * 22, -9);
      ctx.lineTo(mark * 22 + 10, -4);
      ctx.lineTo(mark * 22, 1);
      ctx.stroke();
    }
    ctx.restore();
  } else if (def.ability === "spotlight") {
    const other = state.players[opponentOf(i)];
    const mark = p.x + p.facing * Math.min(250, Math.abs(other.x - p.x));
    ctx.beginPath();
    ctx.moveTo(mark - 52, p.y);
    ctx.lineTo(mark, p.y - 235);
    ctx.lineTo(mark + 52, p.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (def.ability === "command") {
    ctx.beginPath();
    ctx.ellipse(
      p.x,
      p.y,
      Math.min(210, 35 + Math.max(0, progress) * 14),
      15,
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  } else if (def.ability === "roar") {
    ctx.beginPath();
    ctx.moveTo(p.x + p.facing * 35, p.y - 90);
    ctx.lineTo(p.x + p.facing * 260, p.y - 160);
    ctx.lineTo(p.x + p.facing * 260, p.y - 20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (def.ability === "salsa" || def.ability === "spin") {
    ctx.beginPath();
    const radius = def.ability === "spin" ? technique.range : 90;
    ctx.ellipse(
      p.x,
      p.y - 90,
      radius,
      radius / 2,
      progress / 16,
      0,
      Math.PI * 1.75,
    );
    ctx.stroke();
  } else if (def.ability === "echo" || def.ability === "punchline") {
    const echoPulse =
      def.ability === "echo" || def.ability === "punchline"
        ? technique.pulses!.findIndex(
            (offset) => progress >= offset && progress < offset + 9,
          )
        : 0;
    if (echoPulse >= 0)
      ctx.globalAlpha = 1 - (progress - technique.pulses![echoPulse]) / 9;
    if (echoPulse >= 0)
      [50, 95].forEach((distance, index) => {
        ctx.beginPath();
        ctx.arc(
          p.x +
            p.facing *
              (distance + echoPulse * (def.ability === "punchline" ? 90 : 35)),
          p.y - 80,
          18 + index * 10,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      });
  }
}

export function drawGuard(
  ctx: CanvasRenderingContext2D,
  p: PlayerState,
  def: FighterDefinition,
) {
  if (p.blocking) {
    ctx.strokeStyle = `${def.color}aa`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(p.x + p.facing * 25, p.y - 85, 48, 70, 0, -1.5, 1.5);
    ctx.stroke();
  }
}

/** Status marks, the player marker, the combat label and Maite's greeting. */
export function drawFighterTags(
  ctx: CanvasRenderingContext2D,
  state: MatchState,
  p: PlayerState,
  i: PlayerIndex,
  bodyHeight: number,
) {
  ctx.globalAlpha = 1;
  drawFolkloreStatus(ctx, p);
  ctx.fillStyle = i === 0 ? "#dfff7b" : "#b69cff";
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - bodyHeight - 20);
  ctx.lineTo(p.x - 5, p.y - bodyHeight - 28);
  ctx.lineTo(p.x + 5, p.y - bodyHeight - 28);
  ctx.closePath();
  ctx.fill();
  ctx.font = '700 13px "DM Sans", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText(`P${i + 1}`, p.x, p.y - bodyHeight - 34);
  const label = combatLabel(p, state.tick);
  if (label) {
    ctx.fillStyle = "#ffffff";
    ctx.font = 'italic 700 22px "Barlow Condensed", sans-serif';
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 6;
    ctx.fillText(label.toLocaleUpperCase("es"), p.x, p.y - 240);
  }
  drawMaiteGreeting(ctx, p);
}
