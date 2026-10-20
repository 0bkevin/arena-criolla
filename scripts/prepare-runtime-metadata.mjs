import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
export async function runtimeMetadata() {
  const read = async (name) =>
    JSON.parse(await readFile(new URL(name, root), "utf8"));
  const manifest = await read("docs/character-manifest.json");
  const qa = await read("docs/character-sprite-qa.json");
  return {
    "character-personalities.json": {
      characters: Object.fromEntries(
        Object.entries(manifest.characters).map(([id, value]) => [
          id,
          {
            realName: value.realName,
            portrayal: value.portrayal,
            ...(value.quote ? { quote: value.quote } : {}),
            sources: value.sources,
          },
        ]),
      ),
    },
    "sprite-geometry.json": {
      sprites: qa.sprites.map(({ id, files }) => ({
        id,
        files: files
          .filter(
            ({ file }) =>
              file.startsWith("public/assets/") && file.endsWith(".webp"),
          )
          .map(({ file, passed, width, height, components }) => ({
            file,
            passed,
            width,
            height,
            components: components.map(({ minX, minY, maxX, maxY }) => ({
              minX,
              minY,
              maxX,
              maxY,
            })),
          })),
      })),
    },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = new URL("src/game/generated/", root);
  await mkdir(dir, { recursive: true });
  for (const [name, value] of Object.entries(await runtimeMetadata())) {
    const text = JSON.stringify(value) + "\n";
    if (process.argv.includes("--check")) {
      if ((await readFile(new URL(name, dir), "utf8")) !== text)
        throw new Error(`${name} is stale; run npm run assets:metadata`);
    } else await writeFile(new URL(name, dir), text);
  }
}
