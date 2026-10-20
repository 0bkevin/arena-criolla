import fs from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { base, compileGuide, guideInputs, injectImageMap, placeholderDrawGuard, previewFileAliases, readJson, sha256, validateDrawAudit } from "./build-tools.mjs";
const root = process.cwd();
const options = process.argv.slice(2);
if (options.some(arg => !arg.startsWith("--out="))) throw Error("Only --out=directory is supported");
const output = options.length ? path.resolve(options[0].slice(6)) : base;
const runtime = await compileGuide(), compressed = gzipSync(runtime, { level: 9 }).toString("base64");
const inputs = await guideInputs(runtime);
const manifest = await readJson(path.join(output, "media-manifest.json"));
if (manifest.schema !== 2 || manifest.inputFingerprint !== inputs.fingerprint) throw Error("Guide media is stale; complete the draw audit and prepare-media again.");
const auditBytes = await fs.readFile(path.resolve(output, manifest.auditFile));
if (sha256(auditBytes) !== manifest.auditSha256) throw Error("Guide draw audit changed after media preparation.");
const audit = JSON.parse(auditBytes), { prunable } = validateDrawAudit(audit, inputs);
const pruned = manifest.assets.filter(asset => asset.pruned).map(asset => asset.id).sort();
if (JSON.stringify(pruned) !== JSON.stringify(prunable.sort())) throw Error("Guide media pruning disagrees with its exhaustive draw audit.");
if (JSON.stringify(manifest.assets.map(a => a.id).sort()) !== JSON.stringify(inputs.assets.map(a => a.id).sort())) throw Error("Guide media inventory mismatch.");
const template = await fs.readFile(path.join(base, "template.html"), "utf8");
const fontLicenses = await Promise.all(["OFL-dm-sans.txt", "OFL-barlow-condensed.txt"].map(file => fs.readFile(path.join(root, "public/fonts", file), "utf8")));
let fonts = "";
for (const [file, name, weight] of [["dm-sans-400.ttf", "DM Sans", 400], ["dm-sans-700.ttf", "DM Sans", 700], ["barlow-800.ttf", "Barlow Condensed", 800]]) {
  const bytes = await fs.readFile(path.join(root, "public/fonts", file));
  fonts += `@font-face{font-family:'${name}';font-weight:${weight};font-style:normal;font-display:swap;src:url(data:font/ttf;base64,${bytes.toString("base64")}) format('truetype')}\n`;
}
const poster = path.join(root, "docs/finales/main-identity-refresh/clips/capriles-nacho-still.webp");
const maps = { local: {}, inline: {}, portable: {} };
const aliases = previewFileAliases(manifest.assets);
for (const asset of manifest.assets) {
  const source = inputs.assets.find(row => row.id === asset.id);
  if (source.sourceSha256 !== asset.sourceSha256 || source.attack && asset.quality !== 34) throw Error(`Guide source/quality policy mismatch: ${asset.id}`);
  const preview = await fs.readFile(path.join(output, asset.file));
  if (sha256(preview) !== asset.previewSha256) throw Error(`Guide preview changed: ${asset.id}`);
  maps.local[asset.id] = aliases[asset.id];
  maps.inline[asset.id] = path.join(output, aliases[asset.id]);
  maps.portable[asset.id] = `data:image/webp;base64,${preview.toString("base64")}`;
}
const posters = { local: "media/poster.webp", inline: path.join(output, "media/poster.webp"), portable: `data:image/webp;base64,${(await fs.readFile(poster)).toString("base64")}` };
const names = { local: "index.html", inline: "inline.html", portable: "ataques-arena-criolla.html" };
const pages = {};
for (const mode of ["local", "inline", "portable"]) {
  pages[mode] = injectImageMap(template, maps[mode], placeholderDrawGuard(pruned)).replace("__FONTS__", fonts).replace("__POSTER__", posters[mode]).replace("__RUNTIME_GZIP__", compressed).replace("</head>", `<!-- Embedded font licenses\n${fontLicenses.join("\n\n").replaceAll("--", "—")}\n-->\n</head>`);
}
const size = Buffer.byteLength(pages.portable);
if (size > 24 * 1048576) throw Error(`Portable guide exceeds inline budget: ${(size / 1048576).toFixed(2)} MiB`);
if ((await guideInputs()).fingerprint !== inputs.fingerprint) throw Error("Guide inputs changed during build; no HTML was published.");
await fs.copyFile(poster, path.join(output, "media/poster.webp"));
for (const mode of Object.keys(names)) await fs.writeFile(path.join(output, names[mode]), pages[mode]);
await fs.writeFile(path.join(output, "build-summary.json"), JSON.stringify({ fighters: inputs.fighters.length, movesPerFighter: inputs.moves.length, engine: "shared/engine.ts", renderer: "src/game/renderer.ts", images: manifest.assets.length, uniqueEmbeddedPayloads: new Set(Object.values(maps.portable)).size, auditedUnusedPlaceholders: pruned, auditFingerprint: inputs.fingerprint, auditedFrames: audit.cases.reduce((n, row) => n + row.frames, 0), runtimeBytes: runtime.length, portableBytes: size, fonts: ["DM Sans", "Barlow Condensed"], offline: true, previewOnlyAdaptations: ["Map image loads to embedded preview copies; identical payloads embedded once", "Skip entrances because this guide shows attacks", "Unused optional images replaced by guarded transparent placeholders only after exhaustive current-source draw audit"], outputs: Object.values(names) }, null, 2) + "\n");
console.log(`Guide built: ${inputs.fighters.length} characters, ${inputs.moves.length} moves each, ${manifest.assets.length} image IDs, ${(size / 1048576).toFixed(2)} MiB standalone.`);
