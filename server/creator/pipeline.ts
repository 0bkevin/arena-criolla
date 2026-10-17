import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { mkdir, readFile, writeFile, stat, rename, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  fighterById,
  type FighterDefinition,
  type FighterId,
} from "../../shared/content";
import { createMatch, emptyInput, stepMatch } from "../../shared/engine";
import {
  registerCommunityCharacter,
  unregisterCommunityCharacter,
} from "../../shared/community";
import type {
  CharacterInput,
  CommunityCharacter,
  SpriteGeometry,
} from "../../shared/creator";
import { INTRO_TOTAL_TICKS, presentationById } from "../../shared/presentation";
import { REST } from "../../shared/choreography";
import { packCharacterSprites, SpriteValidationError } from "./sprites";
import { abortable } from "./worker";
import {
  DesignSchema,
  type CharacterDesign,
  type CharacterProvider,
} from "./provider";
import type { CreatorDatabase } from "./database";

const State = Annotation.Root({
  id: Annotation<string>(),
  input: Annotation<CharacterInput>(),
  photos: Annotation<string[]>(),
  design: Annotation<CharacterDesign>(),
  source: Annotation<string>(),
  geometry: Annotation<SpriteGeometry>(),
  character: Annotation<CommunityCharacter>(),
});
export function makeDefinition(
  id: string,
  input: CharacterInput,
  design: CharacterDesign,
  geometry: SpriteGeometry,
  creatorName: string,
): CommunityCharacter {
  const template =
    input.style === "agile"
      ? "capriles"
      : input.style === "technical"
        ? "emilio"
        : "conde";
  const base = fighterById(template);
  const fighter: FighterDefinition = {
    ...base,
    id: id as FighterId,
    sprite: id,
    category: "community",
    name: input.name,
    shortName: input.name,
    title: design.title,
    role:
      input.style === "agile"
        ? "VELOCIDAD"
        : input.style === "technical"
          ? "TÉCNICA"
          : "POTENCIA",
    description: input.description,
    color: input.color,
    special: design.specialName,
    combos: design.combos,
  };
  const profile = structuredClone(presentationById("capriles"));
  profile.introName = profile.selectionName = design.welcome;
  profile.battleFrame = 0;
  profile.frameFacing = Array(8).fill(1);
  profile.color = input.color;
  profile.prop = "none";
  profile.introStyle = profile.selectionStyle = "salute";
  profile.durationMs = 1900;
  const pose = (at: number, frame: number, dx = 0, dy = 0) => ({
    at,
    frame,
    dx,
    dy,
    rotate: 0,
    scaleX: 1,
    scaleY: 1,
  });
  profile.introBeats = profile.selectionBeats = [
    pose(0, 0),
    pose(0.23, 1, 0, -0.008),
    pose(0.5, 1, 0, -0.01),
    pose(0.8, 0),
    pose(1, 0),
  ];
  const welcome = design.welcomeStyle ?? "wave";
  const accent =
    welcome === "bow"
      ? { lean: 0.12, head: 0.1 }
      : welcome === "nod"
        ? { head: 0.18 }
        : welcome === "salute"
          ? { front: -0.28, frontY: -0.035, head: -0.025 }
          : welcome === "fist_bump"
            ? { front: -0.08, frontX: 0.05, lean: -0.025 }
            : { front: -0.18, head: 0.04 };
  return {
    id: id as FighterId,
    creatorName,
    createdAt: Date.now(),
    fighter,
    presentation: profile,
    geometry,
    choreography: {
      name: design.welcome,
      neck: 0.21,
      shoulders: 0.28,
      hands: [
        [-0.1, 0.34],
        [0.12, 0.35],
      ],
      camera: { height: 700, shift: 0 },
      beats: [
        { ...REST, at: 0 },
        { ...REST, at: 0.25, front: -0.06 },
        { ...REST, ...accent, at: 0.5 },
        { ...REST, at: 0.75, front: -0.05 },
        { ...REST, at: 0.9 },
        { ...REST, at: 1 },
      ],
    },
  };
}
export function validateGeneratedGameplay(character: CommunityCharacter) {
  const previous = fighterById(character.id);
  registerCommunityCharacter(character, false);
  try {
    for (const side of [0, 1] as const) {
      const configs = [
        { fighter: "javier" as FighterId, name: "Rival", wins: 3 },
        { fighter: "javier" as FighterId, name: "Rival", wins: 3 },
      ];
      const players = [{ ...configs[0] }, { ...configs[1] }] as [
        (typeof configs)[0],
        (typeof configs)[1],
      ];
      players[side] = {
        fighter: character.id,
        name: character.fighter.name,
        wins: 3,
      };
      const match = createMatch("poliedro", players);
      const neutral: [
        ReturnType<typeof emptyInput>,
        ReturnType<typeof emptyInput>,
      ] = [emptyInput(), emptyInput()];
      for (let tick = 0; tick < INTRO_TOTAL_TICKS; tick++)
        stepMatch(match, neutral);
      match.players[side].x = side === 0 ? 350 : 730;
      match.players[1 - side].x = side === 0 ? 450 : 630;
      match.players[side].facing = side === 0 ? 1 : -1;
      const inputs: [
        ReturnType<typeof emptyInput>,
        ReturnType<typeof emptyInput>,
      ] = [emptyInput(), emptyInput()];
      inputs[side].actions.special++;
      for (let tick = 0; tick < 100; tick++) stepMatch(match, inputs);
      if (match.players[1 - side].hp >= 100)
        throw new Error("El especial no conectó en la prueba de combate.");
      if (
        match.players.some(
          (p) => ![p.x, p.y, p.vx, p.vy, p.hp, p.energy].every(Number.isFinite),
        )
      )
        throw new Error("El movimiento no pasó la prueba de combate.");
    }
  } finally {
    if (!previous) unregisterCommunityCharacter(character.id);
  }
}
export function buildCreatorGraph(
  db: CreatorDatabase,
  provider: CharacterProvider,
  dataDir: string,
) {
  return new StateGraph(State)
    .addNode("create_design", async (state, config) => {
      config.signal?.throwIfAborted();
      db.update(state.id, {
        status: "designing",
        progress: 12,
        message: "Encontrando tu estilo y tus movimientos…",
      });
      const saved = db.character(state.id)!;
      const design = DesignSchema.parse(
        saved.design
          ? JSON.parse(saved.design)
          : await abortable(config.signal, () =>
              provider.design(state.input, state.photos, config.signal),
            ),
      );
      config.signal?.throwIfAborted();
      db.update(state.id, { design: JSON.stringify(design) });
      return { design };
    })
    .addNode("draw", async (state, config) => {
      config.signal?.throwIfAborted();
      db.update(state.id, {
        status: "drawing",
        progress: 30,
        message: "Dibujando tus ocho poses. Puede tardar unos minutos…",
      });
      const folder = path.join(dataDir, "characters", state.id);
      await mkdir(folder, { recursive: true });
      config.signal?.throwIfAborted();
      const saved = db.character(state.id)!;
      const source = saved.source_path || path.join(folder, "generated.png");
      const cached = await stat(source).catch(
        (error: NodeJS.ErrnoException) => {
          if (error.code === "ENOENT") return null;
          throw error;
        },
      );
      config.signal?.throwIfAborted();
      if (!cached?.isFile()) {
        const image = await abortable(config.signal, () =>
          provider.draw(state.input, state.design, state.photos, config.signal),
        );
        config.signal?.throwIfAborted();
        if (!Buffer.isBuffer(image) || image.length > 32 * 1024 * 1024)
          throw new SpriteValidationError(
            "La imagen generada es demasiado grande. Vuelve a intentarlo.",
          );
        const temporary = path.join(folder, `generated.${randomUUID()}.tmp`);
        try {
          await writeFile(temporary, image);
          config.signal?.throwIfAborted();
          await rename(temporary, source);
        } finally {
          await rm(temporary, { force: true });
        }
        config.signal?.throwIfAborted();
      }
      // Recover a fully persisted response if its following DB write failed.
      // Failed packing removes an invalid cache before allowing a redraw.
      db.update(state.id, { source_path: source });
      return { source };
    })
    .addNode("pack", async (state, config) => {
      config.signal?.throwIfAborted();
      db.update(state.id, {
        status: "packing",
        progress: 73,
        message: "Ajustando las poses para que se muevan bien…",
      });
      let geometry: SpriteGeometry;
      try {
        geometry = await packCharacterSprites(
          await readFile(state.source),
          path.join(dataDir, "characters", state.id),
          config.signal,
        );
      } catch (error) {
        config.signal?.throwIfAborted();
        if (error instanceof SpriteValidationError)
          await rm(state.source, { force: true });
        throw error;
      }
      config.signal?.throwIfAborted();
      return { geometry };
    })
    .addNode("test", async (state, config) => {
      config.signal?.throwIfAborted();
      db.update(state.id, {
        status: "testing",
        progress: 90,
        message: "Probando tu personaje en ambos lados de la arena…",
      });
      const row = db.character(state.id)!;
      const owner = db.db
        .prepare("SELECT name FROM users WHERE id=?")
        .get(row.owner_id) as { name: string };
      const character = makeDefinition(
        state.id,
        state.input,
        state.design,
        state.geometry,
        owner.name,
      );
      validateGeneratedGameplay(character);
      return { character };
    })
    .addNode("save", async (state, config) => {
      config.signal?.throwIfAborted();
      const folder = path.join(dataDir, "characters", state.id);
      await writeFile(
        path.join(folder, "character.json"),
        JSON.stringify(state.character, null, 2) + "\n",
      );
      config.signal?.throwIfAborted();
      db.update(state.id, {
        status: "ready",
        progress: 100,
        message: "¡Tu personaje está listo! Pruébalo y publícalo.",
        character: JSON.stringify(state.character),
      });
      return {};
    })
    .addEdge(START, "create_design")
    .addEdge("create_design", "draw")
    .addEdge("draw", "pack")
    .addEdge("pack", "test")
    .addEdge("test", "save")
    .addEdge("save", END)
    .compile();
}
