import type { Effect } from "../../shared/engine";

export function drawImpact(ctx: CanvasRenderingContext2D, effect: Effect) {
  const age = effect.duration - effect.life;
  const strength = effect.strength ?? 1;
  const direction = effect.direction ?? 1;
  const progress = age / effect.duration;
  ctx.save();
  ctx.translate(effect.x, effect.y);
  ctx.globalAlpha = Math.min(1, effect.life / 9);
  if (effect.kind === "hit") {
    // A dark outlined, bright burst stays legible against every arena.
    const radius = Math.max(6, (28 - age * 0.8) * strength);
    ctx.rotate(direction * 0.2);
    ctx.beginPath();
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      const r = radius * (i % 2 ? 0.42 : 1 + (i % 3) * 0.2);
      if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
      else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    ctx.closePath();
    ctx.fillStyle = age < 5 ? "#fffce7" : effect.color;
    ctx.strokeStyle = "#152130";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fill();
    ctx.strokeStyle = effect.color;
    ctx.lineWidth = 3 * (1 - progress) + 1;
    ctx.beginPath();
    ctx.arc(0, 0, 14 + age * 3.8 * strength, 0, Math.PI * 2);
    ctx.stroke();
    const count = Math.round(12 * strength);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + effect.id * 0.71;
      const distance = (12 + age * (2.1 + (i % 4) * 0.8)) * strength;
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance + age * age * 0.03;
      const length = (9 + (i % 5) * 3) * (1 - progress);
      ctx.strokeStyle = i % 3 ? effect.color : "#fff9d2";
      ctx.lineWidth = i % 4 ? 2 : 4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
      ctx.stroke();
      ctx.fillStyle = "#ffdd93";
      ctx.fillRect(Math.round(x), Math.round(y), 3, 3);
    }
    if ((effect.impact === "heavy" || effect.impact === "super") && age < 17) {
      ctx.rotate(-direction * 0.2);
      ctx.font = `italic 900 ${effect.impact === "super" ? 31 : 24}px "Barlow Condensed", sans-serif`;
      ctx.textAlign = "center";
      ctx.lineWidth = 5;
      ctx.strokeStyle = "#171729";
      ctx.fillStyle = "#fff4c9";
      const text = effect.impact === "super" ? "¡BOOM!" : "¡PAM!";
      ctx.strokeText(text, direction * 28, -36 - age * 1.5);
      ctx.fillText(text, direction * 28, -36 - age * 1.5);
    }
  } else if (effect.kind === "block") {
    ctx.strokeStyle = "#ecfaff";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(0, 0, 17 + age * 1.7, 32 + age, 0, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    for (let i = 0; i < 7; i++) {
      const a = (i / 6 - 0.5) * 2;
      ctx.fillStyle = i % 2 ? "#fff1b5" : "#9cdaff";
      ctx.fillRect(
        Math.cos(a) * (15 + age * 3) * direction,
        Math.sin(a) * (20 + age * 3),
        4,
        3,
      );
    }
  } else if (effect.kind === "ringout") {
    ctx.strokeStyle = effect.color;
    ctx.lineWidth = 7 * (1 - progress) + 1;
    for (let ring = 0; ring < 3; ring++) {
      ctx.beginPath();
      ctx.arc(0, 0, 16 + age * (4 + ring * 1.6), 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      ctx.fillStyle = i % 2 ? effect.color : "#fff6d5";
      ctx.fillRect(Math.cos(a) * age * 6, Math.sin(a) * age * 6, 5, 5);
    }
  } else {
    ctx.strokeStyle = effect.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 16 + age * 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
