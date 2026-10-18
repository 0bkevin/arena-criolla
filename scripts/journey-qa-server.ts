// Isolated UI QA: real auth, SQLite, creator pipeline, rooms, and combat.
// Only character art/design is deterministic; no generation API calls are made.
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { makeArenaServer } from "../server/index";
import { STAGES } from "../shared/content";
import { WORLD } from "../shared/engine";
import {
  deterministicCreatorProvider,
  referencePhoto,
} from "../tests/fixtures/creator-provider";

const folder = await mkdtemp(path.join(os.tmpdir(), "arena-journey-qa-"));
const photo = path.join(folder, "reference.jpg");
await writeFile(photo, await referencePhoto());
const production = process.argv.includes("--production");
const server = await makeArenaServer({
  workshopEnabled: true,
  production,
  creator: {
    dataDir: folder,
    provider: deterministicCreatorProvider(),
    secureCookies: production,
  },
});
server.creator.router.get("/qa/fixture", (_req, res) => {
  res.json({ provider: "deterministic", production });
});
server.creator.router.get("/qa/stages", (_req, res) => {
  res.json({ stages: STAGES, world: WORLD });
});
const port = Number(process.env.ARENA_QA_PORT) || 5380;
server.http.listen(port, "127.0.0.1", () => {
  console.log(
    JSON.stringify({
      url: `http://localhost:${port}`,
      photo,
      production,
      provider: "deterministic",
    }),
  );
});
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    void server
      .close()
      .then(() => rm(folder, { recursive: true, force: true }))
      .then(() => process.exit(0));
  });
