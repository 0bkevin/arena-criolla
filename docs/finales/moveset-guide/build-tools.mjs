import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { build } from "esbuild";

export const base = path.resolve("docs/finales/moveset-guide");
export const moves = ["light", "heavy", "combo1", "combo2", "special", "final"];
export const sha256 = value => createHash("sha256").update(value).digest("hex");
export const readJson = async file => JSON.parse(await fs.readFile(file, "utf8"));

/** The inventory includes optional fallbacks. The draw audit, not this list, decides pruning. */
export async function guideInventory() {
  const fighters = await readJson("shared/fighters.json");
  const actors = await readJson("shared/finale-actor-assets.json");
  const perro = await readJson("shared/perro-mujeriego-assets.json");
  const attacks = await readJson("shared/attack-assets.json");
  const extras = await Promise.all(["shared/finale-cafe-assets.json", "shared/finale-desk-assets.json", "shared/courier-assets.json"].map(readJson));
  const ids = new Set(["caracas", ...fighters.map(f => f.sprite), ...Array.from({ length: 6 }, (_, i) => `finales-v1-${i + 1}`)]);
  function files(value) {
    if (!value || typeof value !== "object") return;
    if (typeof value.file === "string") ids.add(value.file);
    for (const child of Object.values(value)) files(child);
  }
  [actors, attacks, ...extras, perro].forEach(files);
  // All choreography alternatives are listed deliberately. Current opponents are
  // an implementation detail which a future guide edit must be free to change.
  const protectedIds = new Set(["caracas", ...fighters.map(f => f.sprite)]);
  const attackIds = new Set();
  function protect(value) {
    if (!value || typeof value !== "object") return;
    if (typeof value.file === "string") { protectedIds.add(value.file); attackIds.add(value.file); }
    Object.values(value).forEach(protect);
  }
  protect(attacks);
  const assets = await Promise.all([...ids].sort().map(async id => {
    const source = `public/assets/${id}.webp`;
    return { id, source, sourceSha256: sha256(await fs.readFile(source)), protected: protectedIds.has(id), attack: attackIds.has(id) };
  }));
  return { fighters: fighters.map(f => f.id), moves, assets };
}

/** Used by both the portable build and the full-frame browser audit. */
export async function compileGuide() {
  const result = await build({
    entryPoints: [path.join(base, "guide.ts")], bundle: true, write: false, minify: true,
    format: "iife", platform: "browser", target: "es2022", legalComments: "none", metafile: true,
    plugins: [{ name: "standalone-guide-assets", setup(plugin) {
      plugin.onLoad({ filter: /src\/game\/assets\.ts$/ }, async args => {
        let contents = await fs.readFile(args.path, "utf8");
        const source = 'image.src = id.startsWith("custom_")\n          ? `/api/community/assets/${id}/sprite.webp`\n          : `/assets/${id}.webp`;';
        if (!contents.includes(source)) throw Error("Review image loader adaptation: upstream changed");
        contents = contents.replace(source, 'const uri = (globalThis as unknown as { __arenaGuideImages: Record<string,string> }).__arenaGuideImages[id]; if (!uri) { reject(new Error(`Falta la imagen de ${id}`)); return; } image.src = uri;');
        const preload = "...fighters.map((id) => loadSprite(id)),";
        if (!contents.includes(preload)) throw Error("Review entrance adaptation: upstream changed");
        contents = contents.replace(preload, "...fighters.map((id) => loadSprite(id, { entrance: false })),");
        return { contents, loader: "ts", resolveDir: path.dirname(args.path) };
      });
    } }],
  });
  return result.outputFiles[0].contents;
}

/** Includes the audit implementation, UI, runtime and every full-quality asset. */
export async function guideInputs(runtime = undefined) {
  const inventory = await guideInventory();
  const code = runtime ?? await compileGuide();
  const controls = await Promise.all(["template.html", "audit-browser.js", "build-tools.mjs", "prepare-draw-audit.mjs", "prepare-media.mjs", "build.mjs", "serve-draw-audit.mjs"].map(async file => ({ file, sha256: sha256(await fs.readFile(path.join(base, file))) })));
  const inputs = { schema: 1, runtimeSha256: sha256(code), controls, ...inventory };
  return { ...inputs, fingerprint: sha256(JSON.stringify(inputs)) };
}

/** Rejects stale reports and partial/sampled/duplicate coverage before any pruning. */
export function validateDrawAudit(audit, inputs) {
  if (!audit || audit.schema !== 1 || audit.fingerprint !== inputs.fingerprint) throw Error("Missing or stale guide draw audit; regenerate it against the current sources.");
  if (audit.complete !== true || !Array.isArray(audit.errors) || audit.errors.length || !Array.isArray(audit.pendingImages) || audit.pendingImages.length) throw Error("Guide draw audit is incomplete or has image/render errors.");
  if (JSON.stringify(audit.fighters) !== JSON.stringify(inputs.fighters) || JSON.stringify(audit.moves) !== JSON.stringify(inputs.moves)) throw Error("Guide draw audit roster/moves mismatch.");
  const expected = new Set(inputs.fighters.flatMap(id => inputs.moves.map(move => `${id}/${move}`)));
  const imageIds = new Set(inputs.assets.map(a => a.id)), used = new Set();
  if (!Array.isArray(audit.cases) || audit.cases.length !== expected.size) throw Error("Guide draw audit does not cover every demo.");
  for (const row of audit.cases) {
    const key = `${row.fighter}/${row.move}`;
    if (!expected.delete(key)) throw Error(`Duplicate or unexpected guide demo: ${key}`);
    if (!Number.isInteger(row.frames) || row.frames < 2 || row.renderedFrames !== row.frames || row.firstFrame !== 0 || row.lastFrame !== row.frames - 1 || row.contiguous !== true) throw Error(`Partial frame coverage: ${key}`);
    if (!Array.isArray(row.drawnAssets) || !row.drawnAssets.length) throw Error(`No image drawing recorded: ${key}`);
    if (row.move === "final" && row.activatedFinal !== true) throw Error(`Definitive never activated: ${key}`);
    for (const id of row.drawnAssets) {
      if (!imageIds.has(id)) throw Error(`Unexpected drawn image: ${id}`);
      used.add(id);
    }
  }
  if (expected.size) throw Error("Incomplete guide demo coverage.");
  const reported = [...new Set(audit.usedAssets ?? [])].sort();
  if (JSON.stringify(reported) !== JSON.stringify([...used].sort())) throw Error("Guide draw audit asset union mismatch.");
  return { used, prunable: inputs.assets.filter(a => !a.protected && !used.has(a.id)).map(a => a.id) };
}

/** Identical byte payloads appear once while every loadImage ID remains valid. */
export function imageMapScript(assetMap) {
  const payloads = [], indexes = {}, known = new Map();
  for (const [id, value] of Object.entries(assetMap)) {
    if (typeof value !== "string") throw Error(`Invalid guide image URL: ${id}`);
    if (!known.has(value)) { known.set(value, payloads.length); payloads.push(value); }
    indexes[id] = known.get(value);
  }
  return `(()=>{const p=${JSON.stringify(payloads)},i=${JSON.stringify(indexes)};globalThis.__arenaGuideImages=Object.fromEntries(Object.entries(i).map(([id,n])=>[id,p[n]]))})();`;
}

/** Alias file URLs too, so an HTML renderer which auto-inlines local paths does
 * not re-expand byte-identical previews under different loader IDs. Every file
 * still exists and is hash-verified by the builder. */
export function previewFileAliases(assets) {
  const canonical = new Map(), aliases = {};
  for (const asset of assets) {
    if (!asset.previewSha256 || typeof asset.file !== "string") throw Error(`Invalid guide preview alias: ${asset.id}`);
    if (!canonical.has(asset.previewSha256)) canonical.set(asset.previewSha256, asset.file);
    aliases[asset.id] = canonical.get(asset.previewSha256);
  }
  return aliases;
}

export function injectImageMap(template, assetMap, guard = "") {
  const source = "globalThis.__arenaGuideImages=JSON.parse(document.getElementById('guide-images').textContent);";
  if (!template.includes(source)) throw Error("Review guide image map bootstrap: template changed");
  return template.replace("__ASSET_MAP__", "{}").replace(source, imageMapScript(assetMap) + guard);
}

/** Fail visibly if an un-audited path ever tries to draw a pruned placeholder. */
export function placeholderDrawGuard(ids) {
  if (!ids.length) return "";
  return `(()=>{const ids=${JSON.stringify(ids)},urls=new Set(ids.map(id=>new URL(globalThis.__arenaGuideImages[id],document.baseURI).href)),draw=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(image,...args){if(image instanceof HTMLImageElement&&urls.has(image.currentSrc||image.src)){const error=new Error('La guía intentó dibujar una imagen excluida de la auditoría.');document.getElementById('load-status').textContent=error.message;throw error}return draw.call(this,image,...args)}})();`;
}
