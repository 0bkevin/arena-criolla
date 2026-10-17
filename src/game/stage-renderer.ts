import { platformsAtTick, type StageDefinition } from "../../shared/content";
import { WORLD } from "../../shared/engine";
import { arenaBounds, sceneryCover } from "./viewport";

const pixel = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
) => {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x / 2) * 2, Math.round(y / 2) * 2, w, h);
};
const wrap = (value: number, size: number) => ((value % size) + size) % size;

function bird(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tick: number,
  color: string,
) {
  const wing = Math.sin(tick / 9) > 0 ? -4 : 2;
  pixel(ctx, x - 10, y + wing, 6, 2, color);
  pixel(ctx, x - 4, y, 8, 3, color);
  pixel(ctx, x + 4, y + wing, 6, 2, color);
}

function boat(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tick: number,
  sail = false,
) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y + Math.sin(tick / 32) * 2));
  pixel(ctx, -26, 0, 52, 6, sail ? "#e9d8b4" : "#ddb380");
  pixel(ctx, -20, 6, 40, 4, "#263953");
  pixel(ctx, -5, -18, 14, 18, "#fff0d4");
  pixel(ctx, -12, -20, 28, 4, "#d26665");
  if (sail) {
    pixel(ctx, 0, -58, 2, 58, "#485966");
    for (let row = 0; row < 11; row++)
      pixel(ctx, 3, -54 + row * 4, 4 + row * 2, 4, "#ffffe9");
  }
  pixel(ctx, -36, 12, 74, 2, "#b6e9ed65");
  ctx.restore();
}

function gondola(ctx: CanvasRenderingContext2D, x: number, y: number) {
  pixel(ctx, x + 18, y - 20, 4, 24, "#354c67");
  pixel(ctx, x + 8, y - 24, 24, 4, "#627e91");
  pixel(ctx, x, y, 42, 26, "#e7ad4f");
  pixel(ctx, x + 4, y + 4, 34, 12, "#28445a");
  pixel(ctx, x + 7, y + 5, 12, 5, "#9adee4");
  pixel(ctx, x + 23, y + 5, 12, 5, "#75b9cf");
  pixel(ctx, x + 19, y + 3, 2, 15, "#e7ad4f");
  pixel(ctx, x + 4, y + 23, 34, 5, "#bd713b");
}

function environment(
  ctx: CanvasRenderingContext2D,
  stage: StageDefinition,
  tick: number,
) {
  ctx.save();
  if (stage.id === "canaima") {
    // Fog banks pass behind the fighters and leave the foreground readable.
    for (let i = 0; i < 7; i++) {
      const x = wrap(i * 192 + tick * 0.25, 1340) - 180;
      pixel(ctx, x, 302 + (i % 3) * 38, 150, 8, "#e0f7e71a");
      pixel(ctx, x + 20, 294 + (i % 3) * 38, 100, 8, "#e0f7e714");
    }
    for (let i = 0; i < 4; i++)
      bird(
        ctx,
        wrap(tick * 0.42 + i * 251, 1150) - 35,
        150 + i * 23,
        tick + i * 13,
        "#183d3f",
      );
    for (let i = 0; i < 14; i++)
      pixel(
        ctx,
        wrap(i * 87 + tick * 0.8, 1080),
        470 + ((i * 31) % 70) + Math.sin(tick / 25 + i) * 7,
        4,
        2,
        "#b8dc6560",
      );
  } else if (stage.id === "merida") {
    gondola(ctx, wrap(tick * 0.5, 1180) - 70, 160 + Math.sin(tick / 160) * 25);
    gondola(
      ctx,
      1050 - wrap(tick * 0.38 + 420, 1180),
      118 + Math.sin(tick / 160 + 2) * 20,
    );
    for (let i = 0; i < 34; i++) {
      const x = wrap(i * 97 + tick * 0.25, 1120) - 20;
      const y = wrap(i * 137 + tick * 0.64, 540);
      pixel(ctx, x, y, i % 3 ? 2 : 4, 2, "#eaf7fa9c");
    }
  } else if (stage.id === "maracaibo" || stage.id === "roques") {
    const lake = stage.id === "maracaibo";
    boat(
      ctx,
      wrap(tick * 0.38 + 100, 1200) - 60,
      lake ? 448 : 390,
      tick,
      !lake,
    );
    boat(
      ctx,
      1130 - wrap(tick * 0.22 + 500, 1230),
      lake ? 479 : 443,
      tick + 80,
    );
    for (let i = 0; i < 25; i++) {
      const x = wrap(i * 53 + tick * 0.13, 1080);
      const y = (lake ? 396 : 350) + ((i * 37) % 145);
      if (Math.sin(tick / 18 + i * 2) > 0.4)
        pixel(ctx, x, y, 6 + (i % 4) * 4, 2, lake ? "#f5be6850" : "#defbfa90");
    }
    if (!lake)
      for (let i = 0; i < 3; i++)
        bird(
          ctx,
          wrap(tick * 0.68 + i * 370, 1200) - 40,
          183 + i * 36,
          tick + i * 19,
          "#fff2d9",
        );
  } else if (stage.id === "coro") {
    for (let i = 0; i < 42; i++) {
      const x = wrap(i * 67 + tick * (1.1 + (i % 3) * 0.12), 1160) - 40;
      const y = 327 + ((i * 39) % 200) + Math.sin(tick / 50 + i) * 5;
      pixel(ctx, x, y, i % 4 ? 4 : 18, 2, "#f6d29765");
    }
    const x = wrap(tick * 1.25, 1260) - 80;
    const y = 528 - Math.abs(Math.sin(tick / 24)) * 14;
    ctx.translate(x, y);
    ctx.rotate(tick / 27);
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      pixel(ctx, Math.cos(angle) * 14, Math.sin(angle) * 14, 5, 4, "#725135");
      pixel(ctx, Math.cos(angle) * 6, Math.sin(angle) * 6, 4, 3, "#b88847");
    }
  } else if (stage.id === "poliedro") {
    for (let i = 0; i < 3; i++) {
      const top = 180 + i * 360;
      const aim = top + Math.sin(tick / 95 + i * 2) * 220;
      ctx.fillStyle = ["#a2edff16", "#e9a1ff19", "#ffe29c15"][i];
      ctx.beginPath();
      ctx.moveTo(top, 54);
      ctx.lineTo(aim - 80, 550);
      ctx.lineTo(aim + 80, 550);
      ctx.closePath();
      ctx.fill();
      pixel(ctx, top - 5, 50, 10, 6, "#fff0c2");
    }
    for (let i = 0; i < 65; i++) {
      const x = 40 + ((i * 83) % 1000);
      const y = 280 + ((i * 31) % 144);
      const bob = Math.sin(tick / 10 + i) > 0 ? 2 : 0;
      pixel(
        ctx,
        x,
        y - bob,
        3,
        4,
        ["#ed84c35a", "#8ebedf60", "#ffdd8965"][i % 3],
      );
    }
  }
  ctx.restore();
}

const materials = {
  plaza: ["#686778", "#282b39", "#484457"],
  jungle: ["#91b967", "#334734", "#586e43"],
  bridge: ["#e1be87", "#323c51", "#626c7e"],
  snow: ["#e4f6ff", "#344958", "#7895a7"],
  sand: ["#f6cc84", "#785635", "#ae824b"],
  pier: ["#a4e0d7", "#473c3c", "#aa805a"],
  concert: ["#ce8cea", "#28223e", "#514a69"],
} as const;

export function drawStage(
  ctx: CanvasRenderingContext2D,
  stage: StageDefinition,
  image: HTMLImageElement,
  tick: number,
  bounds = arenaBounds(WORLD.width, WORLD.height),
) {
  const { width, height, floor, left, right } = WORLD;
  ctx.save();
  ctx.imageSmoothingEnabled = stage.artStyle !== "pixel";
  const cover = sceneryCover(width, height, bounds);
  ctx.drawImage(image, cover.x, cover.y, cover.width, cover.height);
  ctx.restore();
  const shade = ctx.createLinearGradient(
    0,
    bounds.y,
    0,
    bounds.y + bounds.height,
  );
  shade.addColorStop(0, "#10121850");
  shade.addColorStop(0.3, "#10121805");
  shade.addColorStop(1, "#10121825");
  ctx.fillStyle = shade;
  ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
  environment(ctx, stage, tick);
  const [top, dark, detail] = materials[stage.theme];
  ctx.fillStyle = "#090e18b0";
  ctx.fillRect(
    bounds.x,
    floor + 3,
    left - bounds.x,
    bounds.y + bounds.height - floor,
  );
  ctx.fillRect(
    right,
    floor + 3,
    bounds.x + bounds.width - right,
    bounds.y + bounds.height - floor,
  );
  if (stage.artStyle === "pixel") {
    pixel(ctx, left, floor, right - left, 6, top);
    pixel(ctx, left, floor + 6, right - left, 26, dark);
    for (let x = left + 4; x < right; x += 32) {
      pixel(ctx, x, floor + 8, 26, 4, detail);
      pixel(ctx, x + 18, floor + 21, 6, 2, detail);
    }
    pixel(ctx, left + 4, floor + 32, right - left - 8, 4, "#080d16");
  } else {
    ctx.strokeStyle = stage.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left, floor + 2);
    ctx.lineTo(right, floor + 2);
    ctx.stroke();
  }
  platformsAtTick(stage.id, tick).forEach((platform) => {
    const { x, y, width: w, motion } = platform;
    pixel(ctx, x, y, w, 4, top);
    pixel(ctx, x + 2, y + 4, w - 4, 12, dark);
    for (let tile = 8; tile < w - 8; tile += 24)
      pixel(ctx, x + tile, y + 7, 14, 3, detail);
    pixel(ctx, x + 8, y + 16, w - 16, 4, "#09131b65");
    if (stage.theme === "jungle") {
      for (let tile = 6; tile < w - 8; tile += 18) {
        pixel(ctx, x + tile, y - 2, 8, 2, "#c2dc89");
        pixel(ctx, x + tile + 5, y + 13, 6, 10 + (tile % 8), "#4d7750");
      }
    } else if (stage.theme === "snow" && motion) {
      // The cabin roof is the collidable top. Windows hang below it.
      pixel(ctx, x + 8, y + 16, w - 16, 46, "#d6a24e");
      pixel(ctx, x + 16, y + 23, w - 32, 25, "#26425a");
      for (let tile = 20; tile < w - 20; tile += 34)
        pixel(ctx, x + tile, y + 26, 22, 9, "#8ad4e0");
      pixel(ctx, x + 10, y + 59, w - 20, 6, "#aa6d3b");
      pixel(ctx, x + w / 2, y + 16, 4, 42, "#d6a24e");
    } else if (stage.theme === "pier" || stage.theme === "sand") {
      for (let tile = 12; tile < w - 8; tile += 22)
        pixel(ctx, x + tile, y + 4, 2, 12, "#c19a67");
      if (motion && stage.id === "roques") {
        pixel(ctx, x + 12, y + 17, 24, 9, "#e58d60");
        pixel(ctx, x + w - 36, y + 17, 24, 9, "#e58d60");
      }
    }
    if (motion) {
      pixel(ctx, x + w / 2 - 8, y + 6, 16, 3, stage.color);
      pixel(ctx, x + w / 2 - 1, y + 3, 3, 9, stage.color);
    }
  });
}
