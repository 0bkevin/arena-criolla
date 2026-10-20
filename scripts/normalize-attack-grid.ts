import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

export interface AttackGridOptions {
  columns: number;
  rows: number;
  poseCount: number;
  poses?: readonly string[];
}

export interface AttackGridFileOptions extends AttackGridOptions {
  source: string;
  destination: string;
  auditPath: string;
}

export interface AttackGridBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Component {
  label: number;
  pixels: number;
  corePixels: number;
  maxAlpha: number;
  sourceBounds: AttackGridBounds;
  coreBounds: AttackGridBounds;
}

type SoftComponent = Pick<
  Component,
  "label" | "pixels" | "maxAlpha" | "sourceBounds"
>;

export interface AttackGridSoftComponentAudit {
  assignment: "contained" | "adjacent-alpha2";
  contourDistance?: number;
  component: number;
  assignedComponent: number;
  cell: number;
  sourceBounds: AttackGridBounds;
  outputBounds: AttackGridBounds;
  translation: { x: number; y: number };
  pixels: number;
  maxAlpha: number;
  isolatedRgbaSha256: string;
}

export interface AttackGridObjectAudit {
  cell: number;
  column: number;
  row: number;
  pose?: string;
  sourceBounds: AttackGridBounds;
  coreBounds: AttackGridBounds;
  outputBounds: AttackGridBounds;
  outputCoreBounds: AttackGridBounds;
  translation: { x: number; y: number };
  retainedPixels: number;
  corePixels: number;
  maxAlpha: number;
  isolatedRgbaSha256: string;
}

export interface AttackGridNormalizationAudit extends AttackGridOptions {
  version: number;
  sourceWidth: number;
  sourceHeight: number;
  width: number;
  height: number;
  cellWidth: number;
  cellHeight: number;
  padding: number;
  coreAlphaThreshold: number;
  minimumCorePixels: number;
  transparentSourcePixels: number;
  retainedPixels: number;
  discardedNoise: { components: number; pixels: number; maxAlpha: number };
  retainedSoftComponents: AttackGridSoftComponentAudit[];
  objects: AttackGridObjectAudit[];
  sourceSha256: string;
  sourceRgbaSha256: string;
  normalizedSha256: string;
  normalizedRgbaSha256: string;
  retainedSourceRgbaSha256: string;
  reconstructedSourceRgbaSha256: string;
  exactRetainedRgbaRoundtrip: boolean;
  preservation: string;
}

const MAX_INPUT_PIXELS = 16_000_000;
const MAX_OUTPUT_PIXELS = 32_000_000;
const CORE_ALPHA = 40;
const MIN_CORE_PIXELS = 1_000;
const PADDING = 32;
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const bounds = (left: number, top: number, right: number, bottom: number) => ({
  left,
  top,
  width: right - left + 1,
  height: bottom - top + 1,
});

function validateGrid({ columns, rows, poseCount, poses }: AttackGridOptions) {
  if (
    !Number.isInteger(columns) ||
    !Number.isInteger(rows) ||
    columns < 1 ||
    rows < 1 ||
    columns > 8 ||
    rows > 8 ||
    !Number.isInteger(poseCount) ||
    poseCount !== columns * rows ||
    (poses !== undefined &&
      (!Array.isArray(poses) ||
        poses.length !== poseCount ||
        new Set(poses).size !== poseCount ||
        poses.some(
          (pose) => typeof pose !== "string" || !/^[a-z0-9-]+$/.test(pose),
        )))
  )
    throw Error(
      "Grid needs positive integer columns/rows (at most 8) and one unique pose per cell",
    );
}

/** Isolate complete generated silhouettes, translating their exact RGBA pixels. */
export async function normalizeAttackGrid(
  source: Buffer,
  options: AttackGridOptions,
): Promise<{ png: Buffer; audit: AttackGridNormalizationAudit }> {
  validateGrid(options);
  const { columns, rows, poseCount, poses } = options;
  const image = sharp(source, { limitInputPixels: MAX_INPUT_PIXELS });
  const metadata = await image.metadata();
  if (
    metadata.format !== "png" ||
    !metadata.hasAlpha ||
    metadata.depth !== "uchar" ||
    (metadata.pages ?? 1) !== 1
  )
    throw Error("A single transparent 8-bit PNG is required");
  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  if (info.channels !== 4 || data.length !== width * height * 4)
    throw Error("The source must decode to 8-bit RGBA");
  const sourceRgbaSha256 = sha(data);
  let transparent = 0;
  for (let index = 0; index < width * height; index++) {
    if (data[index * 4 + 3]) continue;
    transparent++;
    // Invisible background RGB is not part of a retained silhouette.
    data.fill(0, index * 4, index * 4 + 4);
  }
  if (transparent < width * height * 0.12)
    throw Error(
      "The source has an opaque background; real transparency is required",
    );
  const labels = new Int32Array(width * height);
  const queue = new Int32Array(labels.length);
  const components: Component[] = [];
  const softComponents: SoftComponent[] = [];
  const discardedNoise = { components: 0, pixels: 0, maxAlpha: 0 };
  let nextLabel = 0;
  for (let index = 0; index < labels.length; index++) {
    if (!data[index * 4 + 3]) continue;
    if (labels[index]) continue;
    const label = ++nextLabel;
    labels[index] = label;
    queue[0] = index;
    let head = 0,
      tail = 1,
      maxAlpha = 0,
      corePixels = 0,
      left = width,
      top = height,
      right = -1,
      bottom = -1,
      coreLeft = width,
      coreTop = height,
      coreRight = -1,
      coreBottom = -1;
    while (head < tail) {
      const pixel = queue[head++],
        x = pixel % width,
        y = Math.floor(pixel / width),
        alpha = data[pixel * 4 + 3];
      maxAlpha = Math.max(maxAlpha, alpha);
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
      if (alpha >= CORE_ALPHA) {
        corePixels++;
        coreLeft = Math.min(coreLeft, x);
        coreTop = Math.min(coreTop, y);
        coreRight = Math.max(coreRight, x);
        coreBottom = Math.max(coreBottom, y);
      }
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx,
            ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const next = ny * width + nx;
          if (labels[next] || !data[next * 4 + 3]) continue;
          labels[next] = label;
          queue[tail++] = next;
        }
    }
    if (maxAlpha === 1) {
      discardedNoise.components++;
      discardedNoise.pixels += tail;
      discardedNoise.maxAlpha = 1;
      for (let at = 0; at < tail; at++)
        data.fill(0, queue[at] * 4, queue[at] * 4 + 4);
      continue;
    }
    if (corePixels === 0 && maxAlpha < CORE_ALPHA) {
      softComponents.push({
        label,
        pixels: tail,
        maxAlpha,
        sourceBounds: bounds(left, top, right, bottom),
      });
      continue;
    }
    if (corePixels < MIN_CORE_PIXELS)
      throw Error(
        `Extra or incomplete silhouette component ${label}: ${corePixels} core pixels, ${tail} nonzero-alpha pixels, maxAlpha ${maxAlpha}, bounds ${JSON.stringify(bounds(left, top, right, bottom))}; no visible or soft fragment may be discarded`,
      );
    if (
      left < 2 ||
      top < 2 ||
      right >= width - 2 ||
      bottom >= height - 2 ||
      coreLeft < 5 ||
      coreTop < 5 ||
      coreRight >= width - 5 ||
      coreBottom >= height - 5
    )
      throw Error(
        "A complete silhouette touches an outer edge; regenerate with gutters",
      );
    components.push({
      label,
      pixels: tail,
      corePixels,
      maxAlpha,
      sourceBounds: bounds(left, top, right, bottom),
      coreBounds: bounds(coreLeft, coreTop, coreRight, coreBottom),
    });
  }
  if (components.length !== poseCount)
    throw Error(
      `Expected exactly ${poseCount} complete silhouettes; received ${components.length}`,
    );
  const ordered: (Component | undefined)[] = Array(poseCount).fill(undefined);
  for (const component of components) {
    const core = component.coreBounds;
    // Bounds are half-open pixel rectangles. An exact boundary center belongs
    // to the cell on its right/bottom, matching the source grid's intervals.
    const column = Math.floor(((core.left + core.width / 2) * columns) / width),
      row = Math.floor(((core.top + core.height / 2) * rows) / height),
      cell = row * columns + column;
    if (ordered[cell])
      throw Error(
        `Duplicate core centers in source cell ${cell}; another intended cell is missing`,
      );
    ordered[cell] = component;
  }
  if (ordered.some((component) => !component))
    throw Error("A source grid cell is missing a complete silhouette");
  const frames = ordered as Component[];
  const labelOwners = new Map(
    frames.map((component) => [component.label, component.label]),
  );
  const softAssignments: {
    component: SoftComponent;
    cell: number;
    assignment: "contained" | "adjacent-alpha2";
    contourDistance?: number;
  }[] = [];
  for (const component of softComponents) {
    const soft = component.sourceBounds;
    const containers = frames.flatMap((frame, cell) => {
      const full = frame.sourceBounds;
      return soft.left >= full.left &&
        soft.top >= full.top &&
        soft.left + soft.width <= full.left + full.width &&
        soft.top + soft.height <= full.top + full.height
        ? [cell]
        : [];
    });
    const column = Math.floor(((soft.left + soft.width / 2) * columns) / width),
      row = Math.floor(((soft.top + soft.height / 2) * rows) / height),
      cell = row * columns + column;
    let assignment: "contained" | "adjacent-alpha2" = "contained";
    let contourDistance: number | undefined;
    if (
      !containers.length &&
      component.maxAlpha === 2 &&
      component.pixels <= 8
    ) {
      const distances = new Map<number, number>();
      for (let y = soft.top; y < soft.top + soft.height; y++)
        for (let x = soft.left; x < soft.left + soft.width; x++) {
          if (labels[y * width + x] !== component.label) continue;
          for (let dy = -3; dy <= 3; dy++)
            for (let dx = -3; dx <= 3; dx++) {
              const nx = x + dx,
                ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
              const owner = frames.findIndex(
                (frame) => frame.label === labels[ny * width + nx],
              );
              if (owner < 0) continue;
              distances.set(
                owner,
                Math.min(
                  distances.get(owner) ?? 4,
                  Math.max(Math.abs(dx), Math.abs(dy)),
                ),
              );
            }
        }
      if (distances.size === 1 && distances.has(cell)) {
        containers.push(cell);
        assignment = "adjacent-alpha2";
        contourDistance = distances.get(cell);
      }
    }
    if (containers.length !== 1 || containers[0] !== cell)
      throw Error(
        `Detached soft component ${component.label}: ${component.pixels} pixels, maxAlpha ${component.maxAlpha}, bounds ${JSON.stringify(soft)}; it must be fully contained by exactly one complete silhouette and match its source cell (containers ${JSON.stringify(containers)}, center cell ${cell})`,
      );
    labelOwners.set(component.label, frames[cell].label);
    softAssignments.push({ component, cell, assignment, contourDistance });
  }
  // Expand only after all ownership decisions: one retained island must not
  // make an unrelated fragment look contained or become a new contour owner.
  for (const { component, cell, assignment } of softAssignments) {
    if (assignment !== "adjacent-alpha2") continue;
    const full = frames[cell].sourceBounds,
      soft = component.sourceBounds;
    if (
      soft.left < 2 ||
      soft.top < 2 ||
      soft.left + soft.width > width - 2 ||
      soft.top + soft.height > height - 2
    )
      throw Error(
        "A retained soft island touches an outer edge; regenerate with gutters",
      );
    frames[cell].sourceBounds = bounds(
      Math.min(full.left, soft.left),
      Math.min(full.top, soft.top),
      Math.max(full.left + full.width, soft.left + soft.width) - 1,
      Math.max(full.top + full.height, soft.top + soft.height) - 1,
    );
  }
  const maximumWidth = Math.max(
      ...frames.map((frame) => frame.sourceBounds.width),
    ),
    maximumHeight = Math.max(
      ...frames.map((frame) => frame.sourceBounds.height),
    );
  // At least 32px per side, plus >=20% transparent capacity even for a solid
  // rectangular silhouette. The downstream strict packer's gutters stay intact.
  const cellSize = (extent: number) =>
    Math.ceil(Math.max(extent + PADDING * 2, extent / Math.sqrt(0.8)) / 32) *
    32;
  const cellWidth = cellSize(maximumWidth),
    cellHeight = cellSize(maximumHeight),
    outputWidth = cellWidth * columns,
    outputHeight = cellHeight * rows;
  if (outputWidth * outputHeight > MAX_OUTPUT_PIXELS)
    throw Error(
      "Translation-only normalization exceeds the bounded output grid size",
    );
  const packed = Buffer.alloc(outputWidth * outputHeight * 4);
  const objects: AttackGridObjectAudit[] = [];
  const retainedSoftComponents: AttackGridSoftComponentAudit[] = [];
  let retainedPixels = 0;
  for (const [cell, component] of frames.entries()) {
    const from = component.sourceBounds,
      column = cell % columns,
      row = Math.floor(cell / columns);
    const outputBounds = {
      left: column * cellWidth + Math.floor((cellWidth - from.width) / 2),
      top: row * cellHeight + Math.floor((cellHeight - from.height) / 2),
      width: from.width,
      height: from.height,
    };
    const translation = {
      x: outputBounds.left - from.left,
      y: outputBounds.top - from.top,
    };
    const isolated = Buffer.alloc(from.width * from.height * 4);
    for (let y = 0; y < from.height; y++)
      for (let x = 0; x < from.width; x++) {
        const sourcePixel = (from.top + y) * width + from.left + x;
        if (labelOwners.get(labels[sourcePixel]) !== component.label) continue;
        data.copy(
          isolated,
          (y * from.width + x) * 4,
          sourcePixel * 4,
          sourcePixel * 4 + 4,
        );
        const outputPixel =
          ((outputBounds.top + y) * outputWidth + outputBounds.left + x) * 4;
        data.copy(packed, outputPixel, sourcePixel * 4, sourcePixel * 4 + 4);
      }
    let objectPixels = component.pixels;
    for (const assignment of softAssignments.filter(
      (assignment) => assignment.cell === cell,
    )) {
      const soft = assignment.component;
      const isolatedSoft = Buffer.alloc(
        soft.sourceBounds.width * soft.sourceBounds.height * 4,
      );
      for (let y = 0; y < soft.sourceBounds.height; y++)
        for (let x = 0; x < soft.sourceBounds.width; x++) {
          const sourcePixel =
            (soft.sourceBounds.top + y) * width + soft.sourceBounds.left + x;
          if (labels[sourcePixel] !== soft.label) continue;
          data.copy(
            isolatedSoft,
            (y * soft.sourceBounds.width + x) * 4,
            sourcePixel * 4,
            sourcePixel * 4 + 4,
          );
        }
      retainedSoftComponents.push({
        assignment: assignment.assignment,
        ...(assignment.contourDistance !== undefined
          ? { contourDistance: assignment.contourDistance }
          : {}),
        component: soft.label,
        assignedComponent: component.label,
        cell,
        sourceBounds: soft.sourceBounds,
        outputBounds: {
          ...soft.sourceBounds,
          left: soft.sourceBounds.left + translation.x,
          top: soft.sourceBounds.top + translation.y,
        },
        translation,
        pixels: soft.pixels,
        maxAlpha: soft.maxAlpha,
        isolatedRgbaSha256: sha(isolatedSoft),
      });
      objectPixels += soft.pixels;
    }
    retainedPixels += objectPixels;
    objects.push({
      cell,
      column,
      row,
      ...(poses ? { pose: poses[cell] } : {}),
      sourceBounds: from,
      coreBounds: component.coreBounds,
      outputBounds,
      outputCoreBounds: {
        ...component.coreBounds,
        left: component.coreBounds.left + translation.x,
        top: component.coreBounds.top + translation.y,
      },
      translation,
      retainedPixels: objectPixels,
      corePixels: component.corePixels,
      maxAlpha: component.maxAlpha,
      isolatedRgbaSha256: sha(isolated),
    });
  }
  const png = await sharp(packed, {
    raw: { width: outputWidth, height: outputHeight, channels: 4 },
  })
    .png()
    .toBuffer();
  const decoded = await sharp(png).ensureAlpha().raw().toBuffer();
  if (!decoded.equals(packed))
    throw Error("Normalized PNG changed copied RGBA pixels");
  const reconstructed = Buffer.alloc(data.length);
  for (const object of objects) {
    const from = object.outputBounds,
      to = object.sourceBounds;
    for (let y = 0; y < from.height; y++)
      for (let x = 0; x < from.width; x++) {
        const outputPixel = ((from.top + y) * outputWidth + from.left + x) * 4;
        if (!decoded[outputPixel + 3]) continue;
        const sourcePixel = ((to.top + y) * width + to.left + x) * 4;
        decoded.copy(reconstructed, sourcePixel, outputPixel, outputPixel + 4);
      }
  }
  if (!reconstructed.equals(data))
    throw Error(
      "Reversing the translations did not preserve all retained source RGBA",
    );
  return {
    png,
    audit: {
      version: 1,
      columns,
      rows,
      poseCount,
      ...(poses ? { poses: [...poses] } : {}),
      sourceWidth: width,
      sourceHeight: height,
      width: outputWidth,
      height: outputHeight,
      cellWidth,
      cellHeight,
      padding: PADDING,
      coreAlphaThreshold: CORE_ALPHA,
      minimumCorePixels: MIN_CORE_PIXELS,
      transparentSourcePixels: transparent,
      retainedPixels,
      discardedNoise,
      retainedSoftComponents,
      objects,
      sourceSha256: sha(source),
      sourceRgbaSha256,
      normalizedSha256: sha(png),
      normalizedRgbaSha256: sha(packed),
      retainedSourceRgbaSha256: sha(data),
      reconstructedSourceRgbaSha256: sha(reconstructed),
      exactRetainedRgbaRoundtrip: true,
      preservation:
        "Translation only. Every nonzero-alpha RGBA pixel in each retained 8-neighbor component is copied exactly. Detached max-alpha-2-to-39 components are retained inside exactly one complete silhouette's bounds and matching source cell. Additionally, a max-alpha-2 component of at most 8 pixels outside all silhouette bounds may be retained only when actual nonzero-alpha contour pixels of exactly one substantial silhouette are within Chebyshev distance 3, in the matching source cell; its complete bounds are included and assignment distance audited. Only wholly disconnected max-alpha-1 components are discarded. Invisible alpha-zero background RGB is zeroed. No scaling, rotation, painting or anatomy changes.",
    },
  };
}

async function writeAtomically(path: string, bytes: Buffer | string) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${dirname(path)}/.${basename(path)}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, bytes, { flag: "wx" });
    // Replace an existing output inode instead of truncating it. A hard link
    // at the destination must never alter the retained raw source's pixels.
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function normalizeAttackGridFile(config: AttackGridFileOptions) {
  const paths = await Promise.all(
    [config.source, config.destination, config.auditPath].map(async (path) => {
      // Keep literal symlink/.. semantics until the filesystem resolves them.
      let existing = path.startsWith("/") ? path : `${process.cwd()}/${path}`;
      const missing: string[] = [];
      for (;;) {
        try {
          return join(await realpath(existing), ...missing);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
          const parent = dirname(existing);
          if (parent === existing) throw error;
          missing.unshift(basename(existing));
          existing = parent;
        }
      }
    }),
  );
  if (new Set(paths).size !== paths.length)
    throw Error(
      "Source, normalized PNG and audit paths must be distinct; never overwrite the source",
    );
  const { png, audit } = await normalizeAttackGrid(
    await readFile(config.source),
    config,
  );
  const report = {
    ...audit,
    source: config.source,
    normalized: config.destination,
  };
  await writeAtomically(config.destination, png);
  await writeAtomically(
    config.auditPath,
    JSON.stringify(report, null, 2) + "\n",
  );
  return report;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const configPath = process.argv[2];
  if (!configPath)
    throw Error(
      "Usage: npx tsx scripts/normalize-attack-grid.ts path/to/config.json",
    );
  const report = await normalizeAttackGridFile(
    JSON.parse(await readFile(configPath, "utf8")),
  );
  console.log(
    `${report.poseCount} complete silhouettes translated into ${report.columns}×${report.rows} cells (${report.width}×${report.height}); exact retained RGBA verified`,
  );
}
