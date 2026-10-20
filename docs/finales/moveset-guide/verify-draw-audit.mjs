import path from "node:path";
import { base, guideInputs, readJson, validateDrawAudit } from "./build-tools.mjs";
const file = process.argv[2] ?? path.join(base, "draw-audit.json");
const audit = await readJson(file), inputs = await guideInputs();
const { used, prunable } = validateDrawAudit(audit, inputs);
console.log(JSON.stringify({ fingerprint: inputs.fingerprint, demos: audit.cases.length, frames: audit.cases.reduce((n, row) => n + row.frames, 0), usedImages: used.size, protectedImages: inputs.assets.filter(a => a.protected).length, neverDrawnOptionalImages: prunable }, null, 2));
