import {
  FIGHTERS,
  STAGES,
  fighterById,
  type FighterId,
} from "../../shared/content";
import atlasManifest from "../../docs/character-sprite-qa.json";
import { presentationById } from "../../shared/presentation";
import entranceManifest from "../../shared/entrance-assets.json";
import { COMMUNITY_CHARACTERS } from "../../shared/community";
import { isolateFramePixels } from "./sprite-isolation";

interface SpriteFrame {
  x: number;
  y: number;
  width: number;
  height: number;
  slotX: number;
  slotY: number;
}
export interface EntranceAsset {
  image: HTMLImageElement;
  cell: number;
  bodyHeight: number;
  baseline: number;
  anchorX: number;
  frames: SpriteFrame[];
}
export interface SpriteAsset {
  image: HTMLImageElement;
  frameTextures?: (HTMLCanvasElement | undefined)[];
  cellWidth: number;
  cellHeight: number;
  baseline: number;
  bodyHeight: number;
  portraitCenters: number[];
  frames: SpriteFrame[];
  frameFacing: number[];
  battleFrame: number;
  entrance?: EntranceAsset;
}
const images = new Map<string, Promise<HTMLImageElement>>();
const sprites = new Map<FighterId, Promise<SpriteAsset>>();

function portraitCenter(image: HTMLImageElement, frame: SpriteFrame): number {
  const band = document.createElement("canvas");
  band.width = frame.width;
  band.height = Math.max(1, Math.ceil(frame.height * 0.24));
  const ctx = band.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(
    image,
    frame.x,
    frame.y,
    band.width,
    band.height,
    0,
    0,
    band.width,
    band.height,
  );
  const pixels = ctx.getImageData(0, 0, band.width, band.height).data;
  let weightedX = 0;
  let weight = 0;
  for (let pixel = 0; pixel < band.width * band.height; pixel++) {
    const alpha = pixels[pixel * 4 + 3];
    if (alpha < 40) continue;
    weightedX += (pixel % band.width) * alpha;
    weight += alpha;
  }
  return frame.x + (weight ? weightedX / weight : frame.width / 2);
}

export function loadImage(id: string): Promise<HTMLImageElement> {
  if (!images.has(id))
    images.set(
      id,
      new Promise((resolve, reject) => {
        const image = new Image();
        image.src = id.startsWith("custom_")
          ? `/api/community/assets/${id}/sprite.webp`
          : `/assets/${id}.webp`;
        image.onload = () => resolve(image);
        image.onerror = () =>
          reject(new Error(`No se pudo cargar el asset ${id}.`));
      }),
    );
  return images.get(id)!;
}
export function loadSprite(id: FighterId): Promise<SpriteAsset> {
  if (!sprites.has(id))
    sprites.set(
      id,
      loadImage(fighterById(id).sprite).then(async (image) => {
        const manifest = entranceManifest[id as keyof typeof entranceManifest];
        const entrance = manifest
          ? { ...manifest, image: await loadImage(manifest.file) }
          : undefined;
        const cellWidth = image.width / 4;
        const cellHeight = image.height / 2;
        const community = COMMUNITY_CHARACTERS.get(id);
        if (community) {
          const geometry = community.geometry;
          return {
            image,
            ...geometry,
            portraitCenters: geometry.frames.map(
              (frame) => portraitCenter(image, frame) - frame.slotX,
            ),
            frameFacing: community.presentation.frameFacing,
            battleFrame: community.presentation.battleFrame,
          };
        }
        const checked = atlasManifest.sprites
          .find((entry) => entry.id === id)
          ?.files.find(
            (file) =>
              file.file === `public/assets/${fighterById(id).sprite}.webp`,
          );
        if (
          checked?.passed &&
          checked.width === image.width &&
          checked.height === image.height &&
          checked.components.length === 8
        ) {
          const frames = checked.components.map((bounds, index) => ({
            x: bounds.minX,
            y: bounds.minY,
            width: bounds.maxX - bounds.minX + 1,
            height: bounds.maxY - bounds.minY + 1,
            slotX: (index % 4) * cellWidth,
            slotY: Math.floor(index / 4) * cellHeight,
          }));
          const frameTextures = isolateOverlappingFrames(image, frames);
          return {
            image,
            frameTextures,
            cellWidth,
            cellHeight,
            baseline: checked.components[0].maxY + 1,
            bodyHeight: checked.components[0].maxY - checked.components[0].minY,
            portraitCenters: frames.map(
              (frame) => portraitCenter(image, frame) - frame.slotX,
            ),
            frames,
            frameFacing: presentationById(id).frameFacing,
            battleFrame: presentationById(id).battleFrame,
            entrance,
          };
        }
        const scratch = document.createElement("canvas");
        scratch.width = image.width;
        scratch.height = image.height;
        const ctx = scratch.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(image, 0, 0);
        const data = ctx.getImageData(0, 0, image.width, image.height).data;
        // Find the eight connected character silhouettes. Generated kicks can cross
        // a nominal column boundary, so equal slicing would clip feet or borrow pixels.
        const seen = new Uint8Array(image.width * image.height);
        const queue = new Int32Array(seen.length);
        const components: {
          minX: number;
          maxX: number;
          minY: number;
          maxY: number;
          count: number;
        }[] = [];
        for (let pixel = 0; pixel < seen.length; pixel++) {
          if (seen[pixel] || data[pixel * 4 + 3] < 40) continue;
          seen[pixel] = 1;
          queue[0] = pixel;
          let head = 0;
          let tail = 1;
          let minX = image.width;
          let maxX = 0;
          let minY = image.height;
          let maxY = 0;
          while (head < tail) {
            const p = queue[head++];
            const x = p % image.width;
            const y = Math.floor(p / image.width);
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
            const neighbors = [
              x > 0 ? p - 1 : -1,
              x < image.width - 1 ? p + 1 : -1,
              y > 0 ? p - image.width : -1,
              y < image.height - 1 ? p + image.width : -1,
            ];
            for (const n of neighbors)
              if (n >= 0 && !seen[n] && data[n * 4 + 3] >= 40) {
                seen[n] = 1;
                queue[tail++] = n;
              }
          }
          if (tail > 4000)
            components.push({ minX, maxX, minY, maxY, count: tail });
        }
        const largest = components
          .sort((a, b) => b.count - a.count)
          .slice(0, 8);
        if (largest.length !== 8)
          throw new Error(
            `El atlas de ${id} no contiene ocho poses completas.`,
          );
        const first = largest
          .filter((c) => c.minY < cellHeight / 2)
          .sort((a, b) => a.minX - b.minX);
        const second = largest
          .filter((c) => c.minY >= cellHeight / 2)
          .sort((a, b) => a.minX - b.minX);
        if (first.length !== 4 || second.length !== 4)
          throw new Error(
            `El atlas de ${id} tiene una distribución inesperada.`,
          );
        const frames = [...first, ...second].map((c, index) => ({
          x: c.minX,
          y: c.minY,
          width: c.maxX - c.minX + 1,
          height: c.maxY - c.minY + 1,
          slotX: (index % 4) * cellWidth,
          slotY: Math.floor(index / 4) * cellHeight,
        }));
        return {
          image,
          frameTextures: isolateOverlappingFrames(image, frames),
          cellWidth,
          cellHeight,
          baseline: first[0].maxY + 1,
          bodyHeight: first[0].maxY - first[0].minY,
          portraitCenters: frames.map(
            (frame) => portraitCenter(image, frame) - frame.slotX,
          ),
          frames,
          frameFacing: presentationById(id).frameFacing,
          battleFrame: presentationById(id).battleFrame,
          entrance,
        };
      }),
    );
  return sprites.get(id)!;
}
export function spriteFrameSource(sprite: SpriteAsset, frame: number) {
  const source = sprite.frames[frame];
  const isolated = sprite.frameTextures?.[frame];
  return {
    image: isolated ?? sprite.image,
    x: isolated ? 0 : source.x,
    y: isolated ? 0 : source.y,
  };
}
function isolateOverlappingFrames(
  image: HTMLImageElement,
  frames: SpriteFrame[],
) {
  return frames.map((frame, index) => {
    const overlaps = frames.some(
      (other, n) =>
        n !== index &&
        frame.x < other.x + other.width &&
        frame.x + frame.width > other.x &&
        frame.y < other.y + other.height &&
        frame.y + frame.height > other.y,
    );
    if (!overlaps) return undefined;
    const canvas = document.createElement("canvas");
    canvas.width = frame.width;
    canvas.height = frame.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(
      image,
      frame.x,
      frame.y,
      frame.width,
      frame.height,
      0,
      0,
      frame.width,
      frame.height,
    );
    const pixels = ctx.getImageData(0, 0, frame.width, frame.height);
    pixels.data.set(isolateFramePixels(pixels.data, frame.width, frame.height));
    ctx.putImageData(pixels, 0, 0);
    return canvas;
  });
}
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: SpriteAsset,
  frame: number,
  x: number,
  feet: number,
  height: number,
  facing = 1,
) {
  const scale = height / sprite.bodyHeight;
  ctx.save();
  ctx.translate(x, feet);
  ctx.scale(facing * sprite.frameFacing[frame], 1);
  const source = sprite.frames[frame];
  const texture = spriteFrameSource(sprite, frame);
  ctx.drawImage(
    texture.image,
    texture.x,
    texture.y,
    source.width,
    source.height,
    (source.x - source.slotX - sprite.cellWidth / 2) * scale,
    // Grounded poses have separate foot baselines in the generated atlas.
    // Anchor their lowest opaque pixel; the jump keeps its tucked-leg height.
    frame === 4 ? -height : -source.height * scale,
    source.width * scale,
    source.height * scale,
  );
  ctx.restore();
}
export async function preloadAssets(
  fighterIds: readonly FighterId[] = FIGHTERS.map((fighter) => fighter.id),
  stageIds: readonly string[] = STAGES.map((stage) => stage.id),
) {
  // Snapshot the requested roster before loading: publishing can change it mid-flight.
  const fighters = [...new Set(fighterIds)];
  const stages = [...new Set(stageIds)];
  const results = await Promise.all([
    ...fighters.map((id) => loadSprite(id)),
    ...stages.map((id) => loadImage(id)),
  ]);
  return {
    sprites: Object.fromEntries(
      fighters.map((id, i) => [id, results[i]]),
    ) as Record<FighterId, SpriteAsset>,
    stages: Object.fromEntries(
      stages.map((id, i) => [id, results[i + fighters.length]]),
    ) as Record<string, HTMLImageElement>,
  };
}
