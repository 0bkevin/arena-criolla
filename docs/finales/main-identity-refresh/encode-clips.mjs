import fs from "node:fs/promises";
import sharp from "sharp";
import { spawnSync } from "node:child_process";
const base = "docs/finales/main-identity-refresh";
await fs.mkdir(`${base}/clips`, { recursive: true });
const rows = [];
for (const id of (await fs.readdir(`${base}/frames`)).sort()) {
  const frames = (await fs.readdir(`${base}/frames/${id}`)).filter(f => f.endsWith(".webp"));
  if (frames.length !== 36) throw Error(`${id}: source frame count`);
  const dance = id.startsWith("nacho-"), fps = dance ? 6 : 12;
  const output = `${base}/clips/${id}.webp`;
  const result = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", `${base}/frames/${id}/%03d.webp`, "-vf", "scale=640:355:flags=lanczos", "-c:v", "libwebp_anim", "-quality", "78", "-loop", "0", "-an", output], { encoding: "utf8" });
  if (result.status !== 0) throw Error(result.stderr);
  await sharp(`${base}/frames/${id}/${dance ? "017" : "014"}.webp`).resize(640, 355).webp({ quality: 90 }).toFile(`${base}/clips/${id}-still.webp`);
  const meta = await sharp(output, { animated: true }).metadata();
  const durationMs = meta.delay.reduce((a, b) => a + b, 0), sourceDurationMs = dance ? 6000 : 3000;
  // WebP stores integer millisecond delays; rational frame times round by 1ms.
  if (Math.abs(durationMs - sourceDurationMs) > 1) throw Error(`${id}: duration ${durationMs}`);
  rows.push({ id, sourceFrames: 36, encodedFrames: meta.pages, sourceDurationMs, durationMs, width: meta.width, height: meta.pageHeight, bytes: (await fs.stat(output)).size });
}
await fs.writeFile(`${base}/preview-validation.json`, JSON.stringify({ renderer: "src/game/renderer.ts:renderMatch", engine: "shared/engine.ts:stepMatch", audio: false, scenes: rows }, null, 2) + "\n");
console.log(`${rows.length} renderer clips encoded; ${(rows.reduce((n, r) => n + r.bytes, 0) / 1048576).toFixed(2)} MiB.`);
