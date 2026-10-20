/** Native-browser fixture. Keeps production middleware and main's background
 * negotiation on both sides; exposes originals separately for codec proof.
 * Run: npx tsx scripts/serve-asset-benchmark.ts (loopback port 5195).
 */
import express from "express";
import path from "node:path";
import manifest from "../shared/asset-variants.json";
import {
  losslessAssetDelivery,
  type LosslessAssetManifest,
} from "../server/asset-variants";

const app = express(),
  root = path.resolve("public"),
  port = 5195;
const background: express.RequestHandler = (req, res, next) => {
  res.vary("Accept");
  if (!req.accepts().includes("image/avif")) return next();
  res.sendFile(path.join(root, "assets/caracas.avif"), (error) => {
    if (error) next(error);
  });
};
app.get(
  "/assets/:file",
  losslessAssetDelivery(root, manifest as LosslessAssetManifest),
);
app.get(["/assets/caracas.webp", "/baseline/assets/caracas.webp"], background);
app.use("/baseline/assets", express.static(path.join(root, "assets")));
app.use("/originals", express.static(root));
app.use(express.static(root));

type Transfer = { res: express.Response; bytes: Buffer; offset: number };
const groups = new Map<
  string,
  { transfers: Transfer[]; timer: NodeJS.Timeout }
>();
app.get("/throttled/:mode/assets/:file", async (req, res, next) => {
  if (!["baseline", "optimized"].includes(req.params.mode))
    return res.sendStatus(404);
  const target = `${req.params.mode === "baseline" ? "/baseline" : ""}/assets/${encodeURIComponent(req.params.file)}`;
  try {
    const response = await fetch(`http://127.0.0.1:${port}${target}`, {
      headers: { Accept: req.get("Accept") ?? "*/*" },
    });
    if (!response.ok) return res.sendStatus(response.status);
    const bytes = Buffer.from(await response.arrayBuffer());
    res.set({
      "Content-Type":
        response.headers.get("Content-Type") ?? "application/octet-stream",
      "Content-Length": String(bytes.length),
      "Cache-Control": "no-store",
    });
    // One bucket shared by all image requests in a run: 10,000 bytes/16 ms =
    // 625,000 B/s = 5,000,000 bit/s. No per-request bandwidth multiplication.
    const key = String(req.query["asset-bench"] ?? "default");
    await new Promise((resolve) => setTimeout(resolve, 80));
    if (res.destroyed) return;
    let group = groups.get(key);
    if (!group) {
      const transfers: Transfer[] = [];
      const timer = setInterval(() => {
        let budget = 10000;
        while (budget && transfers.length) {
          const task = transfers.shift()!;
          if (task.res.destroyed) continue;
          const length = Math.min(
            4096,
            budget,
            task.bytes.length - task.offset,
          );
          task.res.write(
            task.bytes.subarray(task.offset, task.offset + length),
          );
          task.offset += length;
          budget -= length;
          if (task.offset === task.bytes.length) task.res.end();
          else transfers.push(task);
        }
        if (!transfers.length) {
          clearInterval(timer);
          groups.delete(key);
        }
      }, 16);
      group = { transfers, timer };
      groups.set(key, group);
    }
    group.transfers.push({ res, bytes, offset: 0 });
  } catch (error) {
    next(error);
  }
});
for (const directory of ["docs", "scripts", "shared"])
  app.use(`/${directory}`, express.static(path.resolve(directory)));
app.listen(port, "127.0.0.1", () =>
  console.log(
    `Native asset benchmark: http://localhost:${port}/docs/performance/lossless-assets/benchmark.html`,
  ),
);
