import cafeFurniture from "../../assets/manifests/finale-cafe-assets.json";
import { body, drawCafeActor } from "./actors";
import { clamp, smoothstep } from "../../../../shared/math";
import { bubble, chair, damage, ellipse, line, mug } from "./primitives";
import type { Scene } from "./scene";

function drawCafeFurniture(
  scene: Scene,
  part: keyof typeof cafeFurniture.frames,
  x: number,
  feet: number,
  width: number,
  height: number,
) {
  const image = scene.props[cafeFurniture.file];
  const crop = cafeFurniture.frames[part];
  if (!image?.width || !image.height || !crop.width || !crop.height)
    return false;
  const position = scene.layout.point(x, feet);
  scene.ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    position.x - width / 2,
    position.y - height,
    width,
    height,
  );
  return true;
}
export function drawCoffeeScene(scene: Scene) {
  const { ctx, tick, actor, rival, motion } = scene;
  // Whole isolated props prevent chair fragments crossing the actors' bodies.
  // Chair seats meet the real seated poses; only the table passes in front.
  if (!drawCafeFurniture(scene, "leftChair", 326, 518, 152, 230))
    chair(scene, 344, 400, 1);
  if (!drawCafeFurniture(scene, "rightChair", 754, 518, 149, 230))
    chair(scene, 729, 400, -1);
  const sip = Math.sin(clamp((tick - 30) / 118) * Math.PI * 3) > 0.25;
  body(scene, rival, 729, 518, 290, -1, "seat");
  const cafeActor = drawCafeActor(scene, 344, 518, 310);
  if (!cafeActor) body(scene, actor, 344, 518, 302, 1, sip ? "sip" : "talk");
  if (!drawCafeFurniture(scene, "table", 540, 518, 215, 215)) {
    line(ctx, [540, 420, 540, 504], "#573721", 15);
    line(ctx, [502, 508, 540, 498, 578, 508], "#744a2c", 10);
    ellipse(ctx, 540, 405, 133, 27, "#68432c");
    ellipse(ctx, 540, 398, 133, 25, "#b57c46");
  }
  const tableY = scene.props[cafeFurniture.file] ? 335 : 393;
  ellipse(ctx, 486, tableY + 5, 25, 5, "#e8d4a6");
  if (!drawCafeFurniture(scene, "cup", 595, tableY + 9, 38.5, 48))
    mug(ctx, 595, tableY, 0.82);
  const lift = motion
    ? smoothstep(sip ? Math.sin(clamp((tick % 48) / 48) * Math.PI) : 0)
    : 0.8;
  const cupX = 443 - lift * 65,
    cupY = tableY - lift * (tableY - 272);
  if (!cafeActor && lift > 0.08)
    line(
      ctx,
      [377, 330, 405 - lift * 2, 354 - lift * 38, cupX - 7, cupY + 1],
      "#dca97b",
      10,
    );
  if (!cafeActor) mug(ctx, cupX, cupY, 0.9, -lift * 0.2);
  bubble(
    scene,
    tick < 57
      ? scene.profile.caption
      : tick < 108
        ? ["Maduro tiene la leche", "acaparada"]
        : ["y yo se la voy a sacar", "de donde sea."],
    524,
    191,
    276,
  );
  if (tick > 50)
    bubble(scene, tick < 108 ? "…" : "¡Se me va la vida!", 825, 209, 165);
  damage(scene, 190);
}
