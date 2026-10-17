import { readFile, writeFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";

const partial = process.argv.includes("--partial");
const planned = JSON.parse(await readFile("docs/roster-v3.json", "utf8"));
const previous = JSON.parse(
  await readFile("docs/character-manifest.json", "utf8"),
);
const characters = {};
const fighters = [];
const clips = [];
const pending = [];
for (const fighter of planned.fighters) {
  let character;
  try {
    character = JSON.parse(
      await readFile(`docs/characters-v3/${fighter.id}.json`, "utf8"),
    );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    if (partial && previous.characters[fighter.id])
      character = previous.characters[fighter.id];
    else {
      pending.push(fighter.id);
      continue;
    }
  }
  if (character.id && character.id !== fighter.id)
    throw new Error(`Identidad incorrecta: ${fighter.id}`);
  const sprite = character.sprite || fighter.sprite;
  await stat(`assets/source/${sprite}.png`);
  await stat(`public/assets/${sprite}.webp`);
  const lines = character.lines || {};
  for (const [cue, line] of Object.entries(lines)) {
    if (
      !["select", "special", "win"].includes(cue) ||
      line.kind !== "original" ||
      !line.sourceUrl?.startsWith("https://") ||
      !line.verification ||
      !Number.isFinite(line.start) ||
      !Number.isFinite(line.end) ||
      line.end <= line.start ||
      line.end - line.start > 4.5 ||
      !line.file.startsWith(`/audio/${fighter.id}/original-`)
    ) {
      throw new Error(`Fragmento sin procedencia válida: ${fighter.id}/${cue}`);
    }
    const file = `public${line.file}`;
    const bytes = await readFile(file);
    if (bytes.length < 1000) throw new Error(`Audio vacío: ${file}`);
    clips.push({
      fighter: fighter.id,
      cue,
      ...line,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
  if (Array.isArray(character.audioResearch?.limitations))
    character.audioResearch.limitations =
      character.audioResearch.limitations.join(" ");
  characters[fighter.id] = { ...character, sprite, lines };
  fighters.push({ ...fighter, sprite });
}
if (!partial && pending.length)
  throw new Error(`Paquetes pendientes: ${pending.join(", ")}`);
if (!partial && fighters.length < 15)
  throw new Error("El elenco requiere al menos 15 personajes.");
await writeFile(
  "docs/character-manifest.json",
  JSON.stringify({ version: 3, characters }, null, 2) + "\n",
);
await writeFile(
  "shared/fighters.json",
  JSON.stringify(fighters, null, 2) + "\n",
);
await writeFile(
  "docs/audio-provenance.json",
  JSON.stringify(
    {
      version: 3,
      policy:
        "Solo recortes de voces originales; sin síntesis, clonación, cambio de tono ni sustitución del hablante.",
      clips,
      withoutVerifiedSpeech: fighters
        .filter((f) => !Object.keys(characters[f.id].lines).length)
        .map((f) => f.id),
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `${fighters.length} personajes integrados, ${clips.length} recortes originales. Pendientes: ${pending.join(", ") || "ninguno"}.`,
);
