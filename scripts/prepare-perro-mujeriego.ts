import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { BUILT_IN_FIGHTERS } from "../shared/content";
import { normalizeGeneratedAtlas } from "../server/creator/normalize-atlas";
import {
  ACTOR_BASELINE,
  ACTOR_CELL,
  alignActorAtlas,
  validateActorAtlas,
} from "./prepare-finale-actors";

const VERSION = 3;
const IDS = BUILT_IN_FIGHTERS.map((fighter) => fighter.id);
const sha = (bytes: Buffer | string) =>
  createHash("sha256").update(bytes).digest("hex");
export interface PerroFrame {
  x: number;
  y: number;
  width: number;
  height: number;
  bodyHeight: number;
  anchorX: number;
}
interface PackedDancer {
  id: string;
  file: string;
  raw: string;
  source: string;
  runtime: string;
  inputSha256: string;
  sourceSha256: string;
  runtimeSha256: string;
  alphaSha256: string;
  rgbaSha256: string;
  fingerprint: string;
  choreographySha256?: string;
  frames: PerroFrame[];
}
interface PackingAudit {
  version: number;
  cell: number;
  baseline: number;
  assets: PackedDancer[];
}

async function optionalRead(file: string) {
  try {
    return await readFile(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}
async function writeChanged(file: string, bytes: Buffer | string) {
  const content = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if ((await optionalRead(file))?.equals(content)) return;
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
}

/** Only normalizes authored poses. Frame timing belongs to the observed clip plan. */
export async function preparePerroMujeriego(
  root = process.cwd(),
  options: { only?: readonly string[] } = {},
) {
  if (options.only?.length === 0)
    throw new Error("La selección de bailarines no puede estar vacía");
  for (const id of options.only ?? [])
    if (!(IDS as readonly string[]).includes(id))
      throw new Error(`Bailarín desconocido: ${id}`);
  const requested = new Set(options.only ?? IDS);
  const ids = IDS.filter((id) => requested.has(id));
  // Resolve every selected source before publishing anything. A full run waits
  // for all 46; --only publishes independent completed identities as they arrive.
  const raws = await Promise.all(
    ids.map((id) =>
      readFile(
        path.join(
          root,
          `assets/source/finales/perro-mujeriego-v3/${id}-generated.png`,
        ),
      ),
    ),
  );
  const choreographyFile = "docs/finales/perro-mujeriego-v3/choreography.json";
  const choreographyBytes = await optionalRead(
    path.join(root, choreographyFile),
  );
  const choreography = choreographyBytes
    ? { file: choreographyFile, sha256: sha(choreographyBytes) }
    : undefined;
  const fingerprint = sha(
    Buffer.concat([
      await readFile(fileURLToPath(import.meta.url)),
      await readFile(new URL("./prepare-finale-actors.ts", import.meta.url)),
      await readFile(
        new URL("../server/creator/normalize-atlas.ts", import.meta.url),
      ),
      Buffer.from(JSON.stringify(sharp.versions)),
    ]),
  );
  const auditPath = path.join(root, "docs/finales/perro-mujeriego-v3.json");
  const priorBytes = await optionalRead(auditPath);
  const prior = priorBytes
    ? (JSON.parse(priorBytes.toString()) as PackingAudit)
    : undefined;
  const updated: PackedDancer[] = [];
  const pending: {
    source: string;
    runtime: string;
    png: Buffer;
    webp: Buffer;
  }[] = [];
  for (const [index, id] of ids.entries()) {
    const file = `perro-mujeriego-v3-${id}`;
    const raw = `assets/source/finales/perro-mujeriego-v3/${id}-generated.png`;
    const source = `assets/source/finales/perro-mujeriego-v3/${id}.png`;
    const runtime = `public/assets/${file}.webp`;
    const inputSha256 = sha(raws[index]);
    const cached =
      prior?.version === VERSION
        ? prior.assets.find(
            (asset) =>
              asset.id === id &&
              asset.inputSha256 === inputSha256 &&
              asset.fingerprint === fingerprint &&
              asset.choreographySha256 === choreography?.sha256,
          )
        : undefined;
    if (cached) {
      const [png, webp] = await Promise.all([
        optionalRead(path.join(root, source)),
        optionalRead(path.join(root, runtime)),
      ]);
      if (
        png &&
        webp &&
        sha(png) === cached.sourceSha256 &&
        sha(webp) === cached.runtimeSha256
      ) {
        const valid = await validateActorAtlas(png, webp, 4, 2, true, "dance");
        const frames = valid.frames.map(({ frame, bodyHeight, anchorX }) => ({
          ...frame,
          bodyHeight,
          anchorX,
        }));
        if (
          JSON.stringify(frames) === JSON.stringify(cached.frames) &&
          valid.alphaSha256 === cached.alphaSha256 &&
          valid.rgbaSha256 === cached.rgbaSha256
        ) {
          updated.push(cached);
          continue;
        }
      }
    }
    try {
      const normalized = await normalizeGeneratedAtlas(raws[index]);
      const png = await alignActorAtlas(normalized.png, 4, 2);
      const webp = await sharp(png)
        .webp({ lossless: true, exact: true, effort: 6 })
        .toBuffer();
      const valid = await validateActorAtlas(png, webp, 4, 2, true, "dance");
      updated.push({
        id,
        file,
        raw,
        source,
        runtime,
        inputSha256,
        sourceSha256: sha(png),
        runtimeSha256: sha(webp),
        fingerprint,
        choreographySha256: choreography?.sha256,
        alphaSha256: valid.alphaSha256,
        rgbaSha256: valid.rgbaSha256,
        frames: valid.frames.map(({ frame, bodyHeight, anchorX }) => ({
          ...frame,
          bodyHeight,
          anchorX,
        })),
      });
      pending.push({ source, runtime, png, webp });
    } catch (error) {
      throw new Error(
        `${id}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
  }
  // Retain previous identities with their original fingerprints and geometry.
  const assets = IDS.flatMap((id) => {
    const asset =
      updated.find((entry) => entry.id === id) ??
      prior?.assets.find((entry) => entry.id === id);
    return asset ? [asset] : [];
  });
  const manifest = {
    dancers: Object.fromEntries(
      assets.map(({ id, file, frames }) => [id, { file, frames }]),
    ),
  };
  for (const { source, runtime, png, webp } of pending) {
    await writeChanged(path.join(root, source), png);
    await writeChanged(path.join(root, runtime), webp);
  }
  await writeChanged(
    path.join(root, "shared/perro-mujeriego-assets.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  await writeChanged(
    auditPath,
    JSON.stringify(
      {
        version: VERSION,
        tool: "image_gen.imagegen",
        cell: ACTOR_CELL,
        baseline: ACTOR_BASELINE,
        choreography,
        preservation:
          "Generated PNG sources remain untouched. Strict eight-silhouette normalization and whole-pose alignment only; no pose reconstruction or repainting. One scale and bodyHeight per dancer; lossless exact RGBA WebP. Pose order is authored by the observed choreography, never inferred by this packer.",
        assets,
      },
      null,
      2,
    ) + "\n",
  );
  return {
    converted: pending.length,
    cached: ids.length - pending.length,
    manifest,
    assets,
  };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const args = process.argv.slice(2),
    only: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const value =
      arg === "--only"
        ? args[++i]
        : arg.startsWith("--only=")
          ? arg.slice(7)
          : undefined;
    if (!value)
      throw new Error(
        "Uso: prepare-perro-mujeriego.ts [--only id[,id]] [--only id]",
      );
    only.push(...value.split(",").filter(Boolean));
  }
  preparePerroMujeriego(process.cwd(), {
    only: args.length ? [...new Set(only)] : undefined,
  })
    .then(({ converted, cached }) =>
      console.log(
        `Perro Mujeriego v3: ${converted} bailarines procesados, ${cached} en caché.`,
      ),
    )
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
