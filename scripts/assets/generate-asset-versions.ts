import { writeFile } from "node:fs/promises";
import { assetVersions } from "../../server/asset-versions";

await writeFile(
  "src/game/assets/manifests/asset-versions.json",
  JSON.stringify(await assetVersions("public"), null, 2) + "\n",
);
