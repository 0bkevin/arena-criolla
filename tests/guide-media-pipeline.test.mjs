import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import fs from "node:fs/promises";
import sharp from "sharp";
import { imageMapScript, injectImageMap, placeholderDrawGuard, previewFileAliases, validateDrawAudit } from "../docs/finales/moveset-guide/build-tools.mjs";
import { compactGuideImage } from "../docs/finales/moveset-guide/prepare-media.mjs";

const inputs = {
  fingerprint: "current", fighters: ["a", "b"], moves: ["light", "special", "final"],
  assets: [{ id: "fighter", protected: true }, { id: "new-attack", protected: true }, { id: "used", protected: false }, { id: "unused", protected: false }],
};
function validAudit() {
  return { schema: 1, fingerprint: "current", complete: true, fighters: inputs.fighters, moves: inputs.moves, errors: [], pendingImages: [], usedAssets: ["used"], cases: inputs.fighters.flatMap(fighter => inputs.moves.map(move => ({ fighter, move, frames: 4, renderedFrames: 4, firstFrame: 0, lastFrame: 3, contiguous: true, activatedFinal: true, drawnAssets: ["used"] }))) };
}
test("pruning is derived from exhaustive use and protects canonical/new attack assets", () => {
  const result = validateDrawAudit(validAudit(), inputs);
  assert.deepEqual(result.prunable, ["unused"]);
});
test("stale, incomplete, sampled, duplicate and unknown-image reports are rejected", () => {
  const mutations = [
    audit => { audit.fingerprint = "old"; },
    audit => { audit.complete = false; },
    audit => { audit.errors.push("decode failed"); },
    audit => { audit.pendingImages.push("still-loading"); },
    audit => { audit.cases.pop(); },
    audit => { audit.cases[0].renderedFrames = 3; },
    audit => { audit.cases[0].firstFrame = 1; },
    audit => { audit.cases[0].lastFrame = 2; },
    audit => { audit.cases[0].contiguous = false; },
    audit => { audit.cases[1] = audit.cases[0]; },
    audit => { audit.cases[2].activatedFinal = false; },
    audit => { audit.cases[0].drawnAssets.push("unlisted"); },
    audit => { audit.usedAssets = []; },
  ];
  for (const mutate of mutations) { const audit = validAudit(); mutate(audit); assert.throws(() => validateDrawAudit(audit, inputs)); }
});
test("duplicate payloads are embedded once while preserving every image loader ID", () => {
  const payload = "data:image/webp;base64,EXACT_PAYLOAD";
  const script = imageMapScript({ a: payload, b: payload, c: "different" });
  assert.equal(script.split(payload).length - 1, 1);
  const context = vm.createContext({}); vm.runInContext(script, context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.__arenaGuideImages)), { a: payload, b: payload, c: "different" });
  const template = "__ASSET_MAP__globalThis.__arenaGuideImages=JSON.parse(document.getElementById('guide-images').textContent);START";
  assert.equal(injectImageMap(template, { a: payload }).includes("__ASSET_MAP__"), false);
  assert.throws(() => injectImageMap("changed bootstrap", {}), /bootstrap/);
});
test("local and inline preview URLs also alias identical verified image hashes", () => {
  const rows = [
    { id: "nacho-a", file: "media/a.webp", previewSha256: "identical" },
    { id: "nacho-b", file: "media/b.webp", previewSha256: "identical" },
    { id: "other", file: "media/c.webp", previewSha256: "different" },
  ];
  assert.deepEqual(previewFileAliases(rows), { "nacho-a": "media/a.webp", "nacho-b": "media/a.webp", other: "media/c.webp" });
  assert.equal(rows[1].file, "media/b.webp"); // Manifest and on-disk copies are preserved.
  assert.equal(imageMapScript(previewFileAliases(rows)).split("media/a.webp").length - 1, 1);
});
test("a pruned image drawn by an unexpected path fails visibly for relative URLs and embedded data", () => {
  class Image { constructor(src) { this.src = new URL(src, "http://test/guide/").href; } }
  class Context { drawImage() { return "original draw"; } }
  const status = { textContent: "" };
  const context = vm.createContext({ URL, HTMLImageElement: Image, CanvasRenderingContext2D: Context, document: { baseURI: "http://test/guide/", getElementById: () => status }, __arenaGuideImages: { unused: "transparent", used: "painted", embedded: "data:image/webp;base64,AAA" } });
  vm.runInContext(placeholderDrawGuard(["unused", "embedded"]), context);
  assert.equal(new Context().drawImage(new Image("painted")), "original draw");
  assert.throws(() => new Context().drawImage(new Image("transparent")), /excluida/);
  assert.throws(() => new Context().drawImage(new Image("data:image/webp;base64,AAA")), /excluida/);
  assert.match(status.textContent, /excluida/);
});
test("preview compression preserves all dimensions and every alpha value; unused placeholders are zero RGBA", async () => {
  const width = 19, height = 11, rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) rgba.set([i % 255, 150, 225, i % 256], i * 4);
  const original = await sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
  const used = await compactGuideImage(original);
  assert.equal(used.width, width); assert.equal(used.height, height);
  assert.deepEqual(await sharp(used.bytes).extractChannel("alpha").raw().toBuffer(), await sharp(original).extractChannel("alpha").raw().toBuffer());
  const unused = await compactGuideImage(original, { pruned: true });
  assert.equal(unused.width, width); assert.equal(unused.height, height);
  assert.equal((await sharp(unused.bytes).ensureAlpha().raw().toBuffer()).some(value => value !== 0), false);
});
test("browser audit renders every frame, carries image provenance through loader-created canvases and rejects load errors", async () => {
  class Image {
    constructor() { this.handlers = {}; this._src = ""; }
    addEventListener(type, callback) { (this.handlers[type] ??= []).push(callback); }
    get src() { return this._src; }
    set src(value) { this._src = new URL(value, "http://test/").href; }
    get currentSrc() { return this._src; }
    emit(type) { for (const handler of this.handlers[type] ?? []) handler(); }
  }
  class Context {
    constructor(canvas) { this.canvas = canvas; }
    drawImage() {}
    clearRect() {}
    getTransform() { return { isIdentity: true }; }
  }
  const config = { ...inputs, assets: [{ id: "used" }, { id: "unused" }] };
  const context = vm.createContext({ URL, location: { href: "http://test/" }, HTMLImageElement: Image, CanvasRenderingContext2D: Context, addEventListener() {}, __arenaGuideAuditInputs: config, __arenaGuideImages: { used: "/assets/used.webp", unused: "/assets/unused.webp" } });
  vm.runInContext(await fs.readFile("docs/finales/moveset-guide/audit-browser.js", "utf8"), context);
  const image = new Image(); image.src = "/assets/used.webp"; image.emit("load");
  const texture = { width: 20, height: 20 }, loader = new Context(texture);
  loader.drawImage(image, 0, 0); // The game isolates some fighter frames BEFORE painting.
  // A shifted clear leaves the rightmost source column. Clipping can also leave
  // live pixels even for an exact-origin full-size clear. Never discard provenance.
  loader.clearRect(-1, 0, 20, 20);
  loader.clearRect(0, 0, 20, 20);
  const arena = new Context({ width: 1080, height: 640 });
  let selected = "a", mode = "light", state, seekCount = 0;
  const states = Array.from({ length: 4 }, (_, i) => ({ players: [{ attack: i === 1 ? "super" : null, energy: i > 0 ? 25 : 100 }]}));
  const guide = {
    ready: true, pause() {}, async selectFighter(id) { selected = id; }, async selectMove(value) { mode = value; },
    get selected() { return selected; }, get mode() { return mode; }, get snapshots() { return states; }, get state() { return state; },
    seek(frame) { seekCount++; state = states[frame]; arena.clearRect(0, 0, 1080, 640); arena.drawImage(texture, 0, 0); },
  };
  context.arenaMoveGuide = guide;
  const auditor = context.arenaGuideDrawAudit;
  assert.throws(() => auditor.report(), /not completed/);
  let progress;
  do { progress = await auditor.runBatch(3); } while (!progress.complete);
  const report = JSON.parse(JSON.stringify(auditor.report()));
  assert.equal(seekCount, 24);
  assert.equal(report.cases.length, 6);
  assert.equal(report.errors.length, 0);
  assert.deepEqual(report.usedAssets, ["used"]);
  assert.equal(report.cases.every(row => row.renderedFrames === 4 && row.firstFrame === 0 && row.lastFrame === 3 && row.contiguous), true);
  const broken = new Image(); broken.src = "/assets/unused.webp"; broken.emit("error");
  assert.match(auditor.report().errors.join(" "), /Image load failed/);
});
