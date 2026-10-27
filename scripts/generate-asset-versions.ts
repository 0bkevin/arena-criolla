import { writeFile } from "node:fs/promises";
import { assetVersions } from "../shared/asset-versions";

await writeFile(
  "shared/asset-versions.json",
  JSON.stringify(await assetVersions("public"), null, 2) + "\n",
);
