import {
  drawLloronaSpecial,
  drawLloronaProjectile,
  drawLloronaImpact,
} from "./finales/llorona";
import {
  drawDudamelSpecial,
  drawDudamelProjectile,
  drawDudamelImpact,
} from "./finales/dudamel";
import { drawBolivarSpecial } from "./finales/bolivar";
import { drawLorenzoSpecial, drawLorenzoProjectile } from "./finales/lorenzo";
import { drawDeynaSpecial, drawDeynaBallProjectile } from "./finales/deyna";
import { drawDayanaSpecial, drawDayanaProjectile } from "./finales/dayana";
import { fighterById, stageById } from "../../shared/content";
import type { MatchState } from "../../shared/engine";
import { finaleById } from "../../shared/finales";
import { TECHNIQUES } from "../../shared/techniques";
import { drawSprite, type preloadAssets } from "./assets";
import { drawStage } from "./stage-renderer";
import { drawImpact } from "./effects-renderer";
import {
  drawMelanioSpecial,
  drawMelanioSignal,
  drawMelanioSignalCharge,
} from "./finales/melanio";
import { drawAliSpecial } from "./finales/ali";
import { simonSpecialPose } from "./finales/simon";
import {
  drawMaiteFinaleBody,
  drawMaiteGreeting,
  drawSonicProjectile,
} from "./finales/maite";
import {
  advanceArenaCamera,
  cameraBounds,
  type ArenaCamera,
} from "./arena-camera";
import {
  entranceProgress,
  introActor,
  INTRO_COUNTDOWN_START,
} from "../../shared/presentation";
import { drawPresentation } from "./presentation-renderer";
import { drawIntroCinematic } from "./intro-renderer";
import { drawVictory } from "./victory-renderer";
import { drawCultureProjectile, drawCultureSpecial } from "./culture-renderer";
import { drawFounderProjectile, drawFounderSpecial } from "./founder-renderer";
import { drawIconProjectile, drawIconSpecial } from "./icon-renderer";
import { drawCourierMotorcycle } from "./courier-renderer";
import { drawFinale } from "./finale-renderer";
import { combatLabel } from "./combat-label";
import { drawAttackArt } from "./attack-art";
import {
  drawChataingSpecial,
  drawWiredMicrophone,
  drawMicrophoneCable,
} from "./finales/chataing";
import {
  drawTransformationBody,
  drawTransformationGauge,
} from "./transformation-art";
import {
  drawFolkloreProjectile,
  drawFolkloreSpecial,
  drawFolkloreStatus,
} from "./folklore-renderer";

export type Assets = Awaited<ReturnType<typeof preloadAssets>>;
export function renderMatch(
  ctx: CanvasRenderingContext2D,
  state: MatchState,
  assets: Assets,
  time: number,
  reducedMotion = false,
  camera?: ArenaCamera,
  victoryElapsed = 0,
) {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  if (state.phase === "intro" && state.tick < INTRO_COUNTDOWN_START) {
    drawIntroCinematic(ctx, state, assets.sprites, reducedMotion, {
      width,
      height,
    });
    return;
  }
  ctx.save();
  const framing =
    camera ??
    advanceArenaCamera(undefined, state, width, height, 0, reducedMotion);
  const bounds = cameraBounds(framing, width, height);
  ctx.scale(framing.zoom, framing.zoom);
  ctx.translate(-bounds.x, -bounds.y);
  if (!reducedMotion && state.shake > 0.3)
    ctx.translate(
      Math.sin(time * 0.07) * state.shake,
      Math.cos(time * 0.08) * state.shake * 0.4,
    );
  const bg = assets.stages[state.stage];
  const stage = stageById(state.stage);
  drawStage(ctx, stage, bg, state.tick, bounds);
  if (state.phase === "finished") {
    ctx.restore();
    drawVictory(ctx, state, assets, victoryElapsed, reducedMotion);
    return;
  }
  for (const projectile of state.projectiles) {
    if (
      projectile.tether &&
      state.players[projectile.owner].config.fighter === "chataing"
    )
      continue;
    const color = fighterById(
      state.players[projectile.owner].config.fighter,
    ).color;
    ctx.save();
    ctx.translate(projectile.x, projectile.y);
    ctx.scale(
      Math.sign(projectile.vx) ||
        projectile.direction ||
        state.players[projectile.owner].facing,
      1,
    );
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = color;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    if (projectile.kind === "sonic") {
      drawSonicProjectile(ctx, projectile, reducedMotion);
    } else if (projectile.kind === "courier") {
      if (assets.courier)
        drawCourierMotorcycle(ctx, projectile, assets.courier, reducedMotion);
    } else if (
      drawLloronaProjectile(ctx, assets.finaleProps, projectile) ||
      drawDudamelProjectile(ctx, projectile) ||
      drawLorenzoProjectile(ctx, assets.finaleProps, projectile) ||
      drawDeynaBallProjectile(ctx, assets.finaleProps, projectile) ||
      drawDayanaProjectile(ctx, assets.finaleProps, projectile) ||
      drawMelanioSignal(ctx, assets.finaleProps, projectile) ||
      drawIconProjectile(ctx, projectile) ||
      drawFounderProjectile(ctx, projectile) ||
      drawCultureProjectile(ctx, projectile) ||
      drawFolkloreProjectile(ctx, projectile)
    ) {
      // The folklore effects share the same glow and transform as other shots.
    } else if (projectile.kind === "installments") {
      ctx.shadowBlur = 0;
      ctx.rotate(Math.sin((projectile.age ?? 0) / 9) * 0.08);
      // Keep the printed C readable when the projectile travels left.
      const painted = drawAttackArt(
        ctx,
        assets.finaleProps,
        "vallenilla",
        "box",
        0,
        23,
        46,
        Math.sign(projectile.vx) ||
          projectile.direction ||
          state.players[projectile.owner].facing,
      );
      if (!painted) {
        // Failed optional artwork must not leave a damaging projectile invisible.
        ctx.fillStyle = "#fff52c";
        ctx.strokeStyle = "#30312d";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-21, -21, 42, 42, 7);
        ctx.fill();
        ctx.stroke();
        ctx.save();
        ctx.scale(Math.sign(projectile.vx) || projectile.direction || 1, 1);
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.arc(0, 0, 11, Math.PI * 0.2, Math.PI * 1.8);
        ctx.stroke();
        ctx.restore();
      }
    } else if (projectile.kind === "cuatro") {
      ctx.rotate(Math.sin(time / 100) * 0.12);
      ctx.beginPath();
      ctx.ellipse(-5, 9, 9, 6, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(2, -18, 3, 28);
      ctx.fillRect(3, -18, 13, 4);
    } else if (projectile.kind === "static") {
      // Community users of the technique retain a visible physical microphone.
      drawWiredMicrophone(
        ctx,
        assets.finaleProps,
        { x: 0, y: 0 },
        1,
        0,
        40,
        false,
      );
    } else if (projectile.kind === "broadcast") {
      for (let ring = 0; ring < 3; ring++) {
        ctx.globalAlpha = 1 - ring * 0.22;
        ctx.beginPath();
        ctx.arc(0, 0, 10 + ring * 8, -1.25, 1.25);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      for (let j = 0; j < 3; j++) {
        ctx.globalAlpha = 1 - j * 0.25;
        ctx.beginPath();
        ctx.arc(-j * 12, 0, 19 + j * 3, -1.1, 1.1);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  if (
    state.phase === "playing" &&
    state.finale &&
    finaleById(state.finale.fighter)?.mode === "capture"
  ) {
    drawFinale(ctx, state, assets.sprites, assets.finaleProps, reducedMotion);
    ctx.restore();
    return;
  }
  state.players.forEach((p, i) => {
    if (p.stocks <= 0) return;
    const def = fighterById(p.config.fighter);
    const bodyHeight = def.displayHeight ?? 177;
    const sprite = assets.sprites[p.config.fighter];
    ctx.save();
    ctx.fillStyle = "#090c1670";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 4, 42, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    if (state.phase === "intro") {
      const active = introActor(state.tick) === i;
      drawPresentation(
        ctx,
        sprite,
        def.id,
        active ? entranceProgress(def.id, state.tick, i) : 1,
        p.x,
        p.y,
        bodyHeight,
        p.facing,
        "intro",
        reducedMotion,
      );
      ctx.restore();
      return;
    }
    if (p.invincible > 15 && Math.floor(time / 75) % 2 === 0)
      ctx.globalAlpha = 0.45;
    let frame = sprite.battleFrame;
    if (p.stun > 0) frame = 7;
    else if (p.blocking) frame = 1;
    else if (p.attack === "heavy")
      frame = p.attackTick < 6 ? sprite.battleFrame : 6;
    else if (
      p.attack === "light" ||
      p.attack === "super" ||
      p.attack === "special"
    )
      frame = p.attackTick < 4 ? 1 : 5;
    else if (!p.grounded) frame = 4;
    else if (Math.abs(p.vx) > 0.7)
      frame = Math.floor(state.tick / 7) % 2 === 0 ? 2 : 3;
    if (p.attack === "special" && !p.stun) {
      if (def.ability === "signal") {
        // Show the extension when the pulse actually launches, then recover
        // into the current locomotion pose instead of holding a frozen punch.
        const release = p.attackTick - TECHNIQUES.signal.startup;
        frame =
          release < 0
            ? p.grounded
              ? 1
              : 4
            : release < 8
              ? 5
              : !p.grounded
                ? 4
                : Math.abs(p.vx) > 0.7
                  ? 2 + (Math.floor(state.tick / 7) % 2)
                  : sprite.battleFrame;
      } else if (def.ability === "curtain" && p.attackTick <= 26) frame = 1;
      else if (def.ability === "strum" || def.ability === "tremolo")
        frame = p.attackTick % 12 < 6 ? 0 : 5;
      else if (def.ability === "cuatro") frame = sprite.battleFrame;
      else if (def.ability === "echo") {
        const technique = TECHNIQUES.echo;
        const speaking = technique.pulses!.some(
          (offset) =>
            p.attackTick >= technique.startup + offset &&
            p.attackTick < technique.startup + offset + 9,
        );
        frame =
          p.attackTick < technique.startup
            ? 1
            : speaking
              ? 5
              : sprite.battleFrame;
      } else if (def.ability === "syncopate")
        frame = p.attackTick > 34 ? 6 : 2 + (Math.floor(p.attackTick / 7) % 2);
      else if (def.ability === "zapateo") frame = p.attackTick % 10 < 4 ? 6 : 0;
      else if (def.ability === "pivot") frame = p.attackTick < 22 ? 4 : 6;
      else if (def.ability === "whirl")
        frame =
          p.attackTick < TECHNIQUES.whirl.startup
            ? 1
            : p.attackTick < TECHNIQUES.whirl.startup + 9
              ? 5
              : sprite.battleFrame;
      else if (["runway", "sprint", "rally", "liberator"].includes(def.ability))
        frame =
          p.dash > 0
            ? 2 + (Math.floor(p.attackTick / 4) % 2)
            : sprite.battleFrame;
      else if (def.ability === "spin")
        frame =
          p.attackTick < 4
            ? 1
            : p.attackTick < TECHNIQUES.spin.startup
              ? 4
              : p.attackTick < TECHNIQUES.spin.startup + 14
                ? 6
                : sprite.battleFrame;
      else if (def.ability === "command")
        frame =
          p.attackTick < 13
            ? sprite.battleFrame
            : p.attackTick < 22
              ? 6
              : sprite.battleFrame;
    }
    const idleBob =
      !reducedMotion && !p.attack && p.grounded && !p.stun && !p.blocking
        ? Math.sin(time / 240 + i) * 1.5
        : 0;
    const drawBody = (x: number, feet: number) => {
      if (
        !drawTransformationBody(ctx, assets.finaleProps, p, x, feet, bodyHeight)
      )
        drawSprite(ctx, sprite, frame, x, feet, bodyHeight, p.facing);
    };
    if (p.dash > 0 && !reducedMotion) {
      const opacity = ctx.globalAlpha;
      ctx.globalAlpha = opacity * 0.16;
      drawBody(p.x - p.facing * 44, p.y);
      ctx.globalAlpha = opacity * 0.28;
      drawBody(p.x - p.facing * 22, p.y);
      ctx.globalAlpha = opacity;
    }
    const playingCuatro =
      def.id === "simon" && p.attack === "special" && !p.stun;
    const paintedCuatro =
      drawAliSpecial(ctx, assets.finaleProps, p, bodyHeight) ||
      (playingCuatro &&
        drawAttackArt(
          ctx,
          assets.finaleProps,
          "simon",
          simonSpecialPose(p.attackTick),
          p.x,
          p.y,
          bodyHeight,
          p.facing,
        ));
    const paintedGreeting =
      !paintedCuatro &&
      drawMaiteFinaleBody(ctx, assets.finaleProps, p, bodyHeight);
    const paintedMicrophone =
      !paintedCuatro &&
      !paintedGreeting &&
      drawChataingSpecial(ctx, state, assets.finaleProps, p, i, bodyHeight);
    const paintedSignal =
      !paintedCuatro &&
      !paintedGreeting &&
      !paintedMicrophone &&
      drawMelanioSpecial(ctx, assets.finaleProps, p, bodyHeight);
    const paintedFootball =
      !paintedSignal &&
      drawDeynaSpecial(ctx, assets.finaleProps, p, bodyHeight);
    const paintedPageant = drawDayanaSpecial(
      ctx,
      assets.finaleProps,
      p,
      bodyHeight,
    );
    const paintedLlorona = drawLloronaSpecial(
      ctx,
      assets.finaleProps,
      p,
      bodyHeight,
    );
    const paintedConductor = drawDudamelSpecial(
      ctx,
      assets.finaleProps,
      p,
      bodyHeight,
    );
    const paintedSabre = drawBolivarSpecial(
      ctx,
      assets.finaleProps,
      p,
      bodyHeight,
    );
    const paintedPan = drawLorenzoSpecial(
      ctx,
      assets.finaleProps,
      p,
      bodyHeight,
    );
    if (
      !paintedLlorona &&
      !paintedConductor &&
      !paintedSabre &&
      !paintedPan &&
      !paintedCuatro &&
      !paintedGreeting &&
      !paintedMicrophone &&
      !paintedSignal &&
      !paintedFootball &&
      !paintedPageant
    ) {
      drawBody(p.x, p.y + idleBob);
      const tether =
        def.id === "chataing" &&
        state.projectiles.find((shot) => shot.owner === i && shot.tether);
      if (tether) {
        // A failed optional sheet keeps the canonical held mic unique. A neutral
        // contact marker still exposes the exact physical projectile position.
        drawMicrophoneCable(ctx, { x: p.x, y: p.y - 115 }, tether, 14, 2);
        ctx.save();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "#dce8ee";
        ctx.fillStyle = "#353e49";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(tether.x, tether.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }
    drawTransformationGauge(ctx, p);
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
    if (p.attack === "special") {
      const technique = TECHNIQUES[def.ability];
      const progress = p.attackTick - technique.startup;
      ctx.save();
      ctx.strokeStyle = def.color;
      ctx.fillStyle = `${def.color}30`;
      ctx.lineWidth = 3;
      ctx.globalAlpha = Math.max(0, 1 - Math.abs(progress) / 18);
      drawFolkloreSpecial(ctx, def.ability, p, state.players[1 - i], progress);
      drawFounderSpecial(ctx, def.ability, p, state.players[1 - i], progress);
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
        state.players[1 - i],
        sprite,
        progress,
      );
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
        const other = state.players[1 - i];
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
                  (distance +
                    echoPulse * (def.ability === "punchline" ? 90 : 35)),
              p.y - 80,
              18 + index * 10,
              0,
              Math.PI * 2,
            );
            ctx.stroke();
          });
      }
      ctx.restore();
    }
    if (p.blocking) {
      ctx.strokeStyle = `${def.color}aa`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(p.x + p.facing * 25, p.y - 85, 48, 70, 0, -1.5, 1.5);
      ctx.stroke();
    }
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
    ctx.restore();
  });
  if (
    state.hitstop > 0 &&
    state.effects.some(
      (e) =>
        e.kind === "hit" &&
        (e.impact === "heavy" || e.impact === "super") &&
        e.life === e.duration,
    )
  ) {
    ctx.fillStyle = "#fff2d90c";
    ctx.fillRect(bounds.x, bounds.y, width, height);
  }
  state.effects.forEach((e) => {
    drawImpact(ctx, e);
    drawLloronaImpact(ctx, state, assets.finaleProps, e);
    drawDudamelImpact(ctx, state, e);
  });
  ctx.restore();
}
