import { parseArgs } from "node:util";
import { importCharacterAssets } from "../server/creator/import-assets";

try {
  const { values } = parseArgs({
    options: {
      bundle: { type: "string" },
      "owner-email": { type: "string" },
    },
  });
  if (!values.bundle || !values["owner-email"] || !process.env.ARENA_DATA_DIR)
    throw new Error(
      "Usage: ARENA_ENVIRONMENT=prod-tst ARENA_DATA_DIR=/private/staging/creator npm run creator:import -- --bundle /path/to/bundle --owner-email owner@example.com",
    );
  const character = await importCharacterAssets({
    bundleDir: values.bundle,
    ownerEmail: values["owner-email"],
    dataDir: process.env.ARENA_DATA_DIR,
    environment: process.env.ARENA_ENVIRONMENT,
  });
  console.log(
    JSON.stringify({
      id: character.id,
      name: character.fighter.name,
      status: "ready",
    }),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : "Import failed.");
  process.exitCode = 1;
}
