import { randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { CreatorDatabase } from "./database";
import {
  readAssetBundle,
  isInside,
  openDirectory,
  directoryPath,
} from "./asset-bundle";
import { makeDefinition, validateGeneratedGameplay } from "./pipeline";
import { packCharacterSprites } from "./sprites";
import { normalizeGeneratedAtlas } from "./normalize-atlas";

// Operator-only file import. No HTTP endpoint, model runtime or credentials.
export async function importCharacterAssets(options: {
  bundleDir: string;
  dataDir: string;
  ownerEmail: string;
  environment: string | undefined;
}) {
  if (options.environment !== "prod-tst")
    throw new Error("Asset import requires ARENA_ENVIRONMENT=prod-tst.");
  const dataDir = path.resolve(options.dataDir);
  // Resolve aliases before the privacy check, then retain directory descriptors
  // for the complete import so parent renames cannot redirect its authority.
  const resolved = await realpath(dataDir).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT")
        throw new Error("Create the staging owner account before importing.");
      throw error;
    },
  );
  const publicRoots = await Promise.all(
    ["public", "dist"].map((p) => realpath(p).catch(() => path.resolve(p))),
  );
  if (publicRoots.some((root) => isInside(root, resolved)))
    throw new Error("Creator storage must be outside public and dist.");
  const { bundle, source } = await readAssetBundle(options.bundleDir);
  const root = await openDirectory(dataDir);
  let characters: Awaited<ReturnType<typeof openDirectory>> | undefined;
  let packing: Awaited<ReturnType<typeof openDirectory>> | undefined;
  let db: CreatorDatabase | undefined;
  let temporary: string | undefined;
  let destination: string | undefined;
  let moved = false;
  let committed = false;
  try {
    const anchor = directoryPath(root);
    const database = path.join(anchor, "arena.sqlite");
    if (!(await lstat(database)).isFile())
      throw new Error(
        "The staging database must be a regular file, never a symlink.",
      );
    for (const suffix of ["-wal", "-shm", "-journal"]) {
      const info = await lstat(database + suffix).catch(
        (error: NodeJS.ErrnoException) => {
          if (error.code === "ENOENT") return null;
          throw error;
        },
      );
      if (info && !info.isFile())
        throw new Error(
          "The staging database sidecars must be regular files, never symlinks.",
        );
    }
    db = new CreatorDatabase(database);
    const owner = db.userByEmail(options.ownerEmail.trim().toLowerCase());
    if (!owner)
      throw new Error("Create the staging owner account before importing.");
    if (db.character(bundle.id))
      throw new Error("This character is already imported.");
    await mkdir(path.join(anchor, "characters"), { mode: 0o700 }).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code !== "EEXIST") throw error;
      },
    );
    characters = await openDirectory(path.join(anchor, "characters"));
    temporary = path.join(directoryPath(characters), `.import-${randomUUID()}`);
    destination = path.join(directoryPath(characters), bundle.id);
    await mkdir(temporary, { mode: 0o700 });
    packing = await openDirectory(temporary);
    const output = directoryPath(packing);
    const normalized = await normalizeGeneratedAtlas(source);
    const geometry = await packCharacterSprites(normalized.png, output);
    await writeFile(
      path.join(output, "normalization.json"),
      JSON.stringify(normalized.audit, null, 2) + "\n",
      { mode: 0o600, flag: "wx" },
    );
    const character = makeDefinition(
      bundle.id,
      bundle.input,
      bundle.design,
      geometry,
      owner.name,
    );
    validateGeneratedGameplay(character);
    await writeFile(path.join(output, "generated.png"), source, {
      mode: 0o600,
      flag: "wx",
    });
    await writeFile(
      path.join(output, "character.json"),
      JSON.stringify(character, null, 2) + "\n",
      { mode: 0o600, flag: "wx" },
    );
    await writeFile(
      path.join(output, "import-receipt.json"),
      JSON.stringify(bundle, null, 2) + "\n",
      { mode: 0o600, flag: "wx" },
    );
    await assertSameDirectory(dataDir, root);
    await assertSameDirectory(temporary, packing);
    // Reserve an empty destination, preventing accidental replacement of old art.
    await mkdir(destination);
    moved = true;
    await rename(temporary, destination);
    await assertSameDirectory(destination, packing);
    await assertSameDirectory(dataDir, root);
    db.db.exec("BEGIN IMMEDIATE");
    try {
      db.createCharacter(bundle.id, owner.id, bundle.input, []);
      db.update(bundle.id, {
        status: "ready",
        progress: 100,
        message: "¡Tu personaje está listo! Pruébalo y publícalo.",
        design: JSON.stringify(bundle.design),
        // Persist the app's stable path, never a process-local descriptor path.
        source_path: path.join(
          resolved,
          "characters",
          bundle.id,
          "generated.png",
        ),
        character: JSON.stringify(character),
      });
      db.db.exec("COMMIT");
      committed = true;
    } catch (error) {
      db.db.exec("ROLLBACK");
      throw error;
    }
    return character;
  } finally {
    db?.close();
    if (temporary) await rm(temporary, { recursive: true, force: true });
    if (destination && moved && !committed)
      await rm(destination, { recursive: true, force: true });
    await packing?.close();
    await characters?.close();
    await root.close();
  }
}

async function assertSameDirectory(
  directory: string,
  handle: Awaited<ReturnType<typeof openDirectory>>,
) {
  const [current, pinned] = await Promise.all([
    lstat(directory),
    handle.stat(),
  ]);
  if (
    !current.isDirectory() ||
    current.dev !== pinned.dev ||
    current.ino !== pinned.ino
  )
    throw new Error("The private storage directory changed during import.");
}
