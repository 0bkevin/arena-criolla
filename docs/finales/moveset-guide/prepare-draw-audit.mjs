import fs from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { base, compileGuide, guideInputs, injectImageMap } from "./build-tools.mjs";

const runtime = await compileGuide(), inputs = await guideInputs(runtime);
const template = await fs.readFile(path.join(base, "template.html"), "utf8");
const instrument = await fs.readFile(path.join(base, "audit-browser.js"), "utf8");
const urls = Object.fromEntries(inputs.assets.map(a => [a.id, `/assets/${a.id}.webp`]));
const fonts = `@font-face{font-family:'DM Sans';font-weight:400;src:url(/fonts/dm-sans-400.ttf)}@font-face{font-family:'DM Sans';font-weight:700;src:url(/fonts/dm-sans-700.ttf)}@font-face{font-family:'Barlow Condensed';font-weight:800;src:url(/fonts/barlow-800.ttf)}`;
const instrumentation = `globalThis.__arenaGuideAuditInputs=${JSON.stringify(inputs)};${instrument}`;
const html = injectImageMap(template, urls, instrumentation).replace("__FONTS__", fonts).replace("__POSTER__", "/docs/finales/moveset-guide/media/poster.webp").replace("__RUNTIME_GZIP__", gzipSync(runtime, { level: 9 }).toString("base64"));
await fs.writeFile(path.join(base, "draw-audit.html"), html);
console.log(`Audit prepared for ${inputs.fighters.length * inputs.moves.length} demos; fingerprint ${inputs.fingerprint}.`);
console.log("Run node docs/finales/moveset-guide/serve-draw-audit.mjs, then open http://localhost:5193/docs/finales/moveset-guide/draw-audit.html in the native browser. Run bounded arenaGuideDrawAudit.runBatch(300) calls until complete, then save arenaGuideDrawAudit.report() as draw-audit.json.");
