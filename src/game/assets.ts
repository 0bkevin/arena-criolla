import { COMMUNITY_CHARACTERS } from "../../shared/community";
import {
  FIGHTERS,
  STAGES,
  fighterById,
  type FighterId,
} from "../../shared/content";
import entranceManifest from "../../shared/entrance-assets.json";
import { presentationById } from "../../shared/presentation";
import atlasManifest from "../../shared/sprite-geometry.json";
import { preparationWorker } from "./preparation-worker";
import { isolateFramePixels } from "./sprite-isolation";

import courierManifest from "../../shared/courier-assets.json";
import finaleActors from "../../shared/finale-actor-assets.json";
import cafeFurniture from "../../shared/finale-cafe-assets.json";
import finaleDesk from "../../shared/finale-desk-assets.json";
import { finaleAsset, finaleById } from "../../shared/finales";
import perroMujeriego from "../../shared/perro-mujeriego-assets.json";
import { ATTACK_ART } from "./attack-art";

const isolatePixels = preparationWorker(
  () =>
    new Worker(new URL("./sprite.worker.ts", import.meta.url), {
      type: "module",
    }),
  ({
    pixels,
    width,
    height,
  }: {
    pixels: Uint8ClampedArray;
    width: number;
    height: number;
  }) => isolateFramePixels(pixels, width, height),
);

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
  /** Full-body gestures keep the gown and football inside the versus panel. */
  fullBody?: boolean;
  ball?: { x: number; y: number; width: number; height: number };
  frames: (SpriteFrame & {
    anchorX?: number;
    anchorY?: number;
    bodyHeight?: number;
  })[];
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
const cinematicSprites = new Map<FighterId, Promise<SpriteAsset>>();
// These two published files contain the exact same eight painted dance poses.
const nachoDanceImage = "perro-mujeriego-v3-nacho";
const legacyNachoDanceImage = "finales-nacho-dance";
const seatedFinaleActors = new Set<FighterId>([
  "capriles",
  "juan",
  "carlos",
  "florentino",
]);

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

function imageSource(id: string): string {
  return id.startsWith("custom_")
    ? `/api/community/assets/${id}/sprite.webp`
    : `/assets/${id}.webp`;
}

export function loadImage(
  id: string,
  priority?: "high" | "low",
): Promise<HTMLImageElement> {
  const imageId = id === legacyNachoDanceImage ? nachoDanceImage : id;
  if (!images.has(imageId)) {
    images.set(
      imageId,
      new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        if (priority) image.fetchPriority = priority;
        let alternate =
          imageId === nachoDanceImage ? legacyNachoDanceImage : undefined;
        image.onload = () => resolve(image);
        image.onerror = () => {
          // Keep the older URL as a recovery source, without downloading the
          // same bitmap twice during a successful load.
          if (alternate) {
            const next = alternate;
            alternate = undefined;
            image.src = imageSource(next);
          } else reject(new Error(`No se pudo cargar el asset ${id}.`));
        };
        image.src = imageSource(imageId);
      }),
    );
    // Failed requests must not poison later attempts from a new fight.
    void images.get(imageId)!.catch(() => images.delete(imageId));
  }
  return images.get(imageId)!;
}
function loadSpriteGeometry(id: FighterId): Promise<SpriteAsset> {
  if (!sprites.has(id)) {
    sprites.set(
      id,
      loadImage(fighterById(id).sprite).then(async (image) => {
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
          const frameTextures = await isolateOverlappingFrames(image, frames);
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
          frameTextures: await isolateOverlappingFrames(image, frames),
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
        };
      }),
    );
    void sprites.get(id)!.catch(() => sprites.delete(id));
  }
  return sprites.get(id)!;
}

export function loadSprite(
  id: FighterId,
  options: { entrance?: boolean } = {},
): Promise<SpriteAsset> {
  const geometry = loadSpriteGeometry(id);
  const manifest = (
    entranceManifest as Partial<
      Record<FighterId, Omit<EntranceAsset, "image"> & { file: string }>
    >
  )[id];
  if (options.entrance === false || !manifest) return geometry;
  if (!cinematicSprites.has(id)) {
    cinematicSprites.set(
      id,
      Promise.all([geometry, loadImage(manifest.file)]).then(
        ([sprite, image]) => ({
          ...sprite,
          entrance: { ...manifest, image },
        }),
      ),
    );
    void cinematicSprites.get(id)!.catch(() => cinematicSprites.delete(id));
  }
  return cinematicSprites.get(id)!;
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
async function isolateOverlappingFrames(
  image: HTMLImageElement,
  frames: SpriteFrame[],
) {
  return Promise.all(
    frames.map(async (frame, index) => {
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
      pixels.data.set(
        await isolatePixels({
          pixels: pixels.data,
          width: frame.width,
          height: frame.height,
        }),
      );
      ctx.putImageData(pixels, 0, 0);
      return canvas;
    }),
  );
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
/**
 * Attack sheets, finale props and the courier sheet a match may draw. Attack
 * art can appear from the first exchange; finale art only during a capture
 * super cinematic, which only finale-renderer.ts draws.
 */
function decorationFiles(
  fighters: readonly FighterId[],
  attacks: ReadonlySet<FighterId>,
  finales: ReadonlySet<FighterId>,
) {
  const hasCourier = fighters.some(
    (id) =>
      (attacks.has(id) || finales.has(id)) &&
      fighterById(id).ability === "courier",
  );
  const hasNacho = finales.has("nacho");
  // Coffee, the two vehicle rides and the musical duel seat both fighters.
  const hasSeatedFinale = fighters.some(
    (id) => finales.has(id) && seatedFinaleActors.has(id),
  );
  const attackFiles = [
    ...new Set(
      fighters.flatMap((id) =>
        attacks.has(id) && ATTACK_ART[id] ? [ATTACK_ART[id].file] : [],
      ),
    ),
  ];
  const finaleFiles = [
    ...new Set(
      fighters.flatMap((id) => {
        const capture = finales.has(id) && finaleById(id)?.mode === "capture";
        const asset = capture ? finaleAsset(id) : undefined;
        const seated = (
          finaleActors.seated as Record<string, { file: string }>
        )[id];
        const performer = (
          finaleActors.performers as Record<string, { file: string }>
        )[id];
        const choreographyDancer = hasNacho
          ? (perroMujeriego.dancers as Record<string, { file: string }>)[id]
          : undefined;
        return [
          ...(asset ? [asset.file] : []),
          ...(hasSeatedFinale && seated ? [seated.file] : []),
          ...(capture && performer ? [performer.file] : []),
          ...(choreographyDancer ? [choreographyDancer.file] : []),
          ...(finales.has(id) && id === "giuseppe" ? [finaleDesk.file] : []),
          ...(finales.has(id) && id === "capriles"
            ? [finaleActors.caprilesCafe.file, cafeFurniture.file]
            : []),
        ];
      }),
    ),
  ].filter((file) => !attackFiles.includes(file));
  return { hasCourier, attackFiles, finaleFiles };
}

export async function preloadAssets(
  fighterIds: readonly FighterId[] = FIGHTERS.map((fighter) => fighter.id),
  stageIds: readonly string[] = STAGES.map((stage) => stage.id),
  options: {
    entrance?: boolean;
    attacks?: readonly FighterId[];
    finales?: readonly FighterId[];
    /**
     * Resolve without waiting for finale art. It is added to `finaleProps`
     * as it arrives; until then each cinematic draws its sprite fallback.
     */
    deferFinales?: boolean;
  } = {},
) {
  // Snapshot the requested roster before loading: publishing can change it mid-flight.
  const fighters = [...new Set(fighterIds)];
  const stages = [...new Set(stageIds)];
  const attacks = new Set(options.attacks ?? fighters);
  const finales = new Set(options.finales ?? fighters);
  const { hasCourier, attackFiles, finaleFiles } = decorationFiles(
    fighters,
    attacks,
    finales,
  );
  const decorations = options.deferFinales
    ? attackFiles
    : [...attackFiles, ...finaleFiles];
  const [results, courier, decorationImages] = await Promise.all([
    Promise.all([
      ...fighters.map((id) => loadSprite(id, { entrance: options.entrance })),
      ...stages.map((id) => loadImage(id)),
    ]),
    hasCourier ? loadImage(courierManifest.file) : undefined,
    // Decorations can retry next fight without blocking the mandatory fighter
    // and stage assets; each cinematic also has a geometry-based fallback.
    Promise.allSettled(decorations.map((file) => loadImage(file))),
  ]);
  const finaleProps = Object.fromEntries([
    ...(courier ? [[courierManifest.file, courier]] : []),
    ...decorations.flatMap((file, i) => {
      const result = decorationImages[i];
      return result.status === "fulfilled" ? [[file, result.value]] : [];
    }),
  ]) as Record<string, HTMLImageElement>;
  // Renderers read this record every frame, so late images appear in place
  // without re-rendering the game.
  if (options.deferFinales)
    for (const file of finaleFiles)
      void loadImage(file).then(
        (image) => (finaleProps[file] = image),
        () => {},
      );
  return {
    sprites: Object.fromEntries(
      fighters.map((id, i) => [id, results[i]]),
    ) as Record<FighterId, SpriteAsset>,
    stages: Object.fromEntries(
      stages.map((id, i) => [id, results[i + fighters.length]]),
    ) as Record<string, HTMLImageElement>,
    courier,
    finaleProps,
  };
}

const prefetched = new Set<string>();
/**
 * Warm the HTTP cache for a match that has not started, without decoding or
 * retaining any bitmap. Idle, low-priority image requests use the same Accept
 * header as the real loads, so the browser reuses them for the later fight.
 */
export function prefetchMatchAssets(
  fighterIds: readonly FighterId[],
  stageIds: readonly string[],
) {
  const fighters = [...new Set(fighterIds)];
  const everyone = new Set(fighters);
  // Finale art is left out: Game fetches it after the match has started.
  const { hasCourier, attackFiles } = decorationFiles(
    fighters,
    everyone,
    everyone,
  );
  const files = [
    ...fighters.map((id) => fighterById(id).sprite),
    ...fighters.flatMap((id) => {
      const entrance = (
        entranceManifest as Partial<Record<FighterId, { file: string }>>
      )[id];
      return entrance ? [entrance.file] : [];
    }),
    ...stageIds,
    ...(hasCourier ? [courierManifest.file] : []),
    ...attackFiles,
  ];
  for (const id of new Set(files)) {
    const url = imageSource(id);
    if (images.has(id) || prefetched.has(url)) continue;
    prefetched.add(url);
    const image = new Image();
    image.decoding = "async";
    image.fetchPriority = "low";
    const release = () => {
      image.onload = image.onerror = null;
    };
    image.onload = release;
    image.onerror = () => {
      release();
      prefetched.delete(url);
    };
    image.src = url;
  }
}
