import express, { type Request, type Response } from "express";
import multer from "multer";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, rm, access, rename } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { CreatorDatabase, type StoredCharacter } from "./database";
import {
  currentUser,
  hashPassword,
  verifyPassword,
  createSession,
  sessionToken,
  tokenHash,
  clearSession,
} from "./auth";
import { SpriteValidationError } from "./sprites";
import { buildCreatorGraph } from "./pipeline";
import { openAIProvider, type CharacterProvider } from "./provider";
import { CreatorWorker, creatorLimits, type CreatorLimits } from "./worker";
import {
  registerCommunityCharacter,
  unregisterCommunityCharacter,
} from "../../shared/community";
import type {
  CharacterInput,
  CommunityCharacter,
  CreatorUser,
} from "../../shared/creator";
import type { FighterId } from "../../shared/content";

const InputSchema = z.object({
  name: z.string().trim().min(2).max(24),
  description: z.string().trim().min(10).max(240),
  style: z.enum(["agile", "technical", "power"]),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
});
const SignUp = z.object({
  name: z.string().trim().min(2).max(24),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(128),
});
const SignIn = SignUp.omit({ name: true });
const busy = new Set(["queued", "designing", "drawing", "packing", "testing"]);
const maxBytes = 8 * 1024 * 1024;
export interface CreatorOptions {
  dataDir?: string;
  databasePath?: string;
  provider?: CharacterProvider | null;
  secureCookies?: boolean;
  onCatalogChange?: (characters: CommunityCharacter[]) => void;
  onSessionEnd?: (hash: string) => void;
  limits?: Partial<CreatorLimits>;
}

export function makeCreatorService(options: CreatorOptions = {}) {
  const limits = creatorLimits(options.limits);
  const dataDir = path.resolve(
    options.dataDir || process.env.ARENA_DATA_DIR || "data/creator",
  );
  for (const publicFolder of ["public", "dist"]) {
    const relative = path.relative(path.resolve(publicFolder), dataDir);
    if (
      relative !== ".." &&
      !relative.startsWith(".." + path.sep) &&
      !path.isAbsolute(relative)
    )
      throw new Error(
        "ARENA_DATA_DIR must be outside public and dist to keep reference photos private.",
      );
  }
  const databasePath =
    options.databasePath || path.join(dataDir, "arena.sqlite");
  const db = new CreatorDatabase(databasePath);
  const provider =
    options.provider === undefined ? openAIProvider() : options.provider;
  const graph = provider ? buildCreatorGraph(db, provider, dataDir) : null;
  const secure = options.secureCookies ?? process.env.NODE_ENV === "production";
  const router = express.Router();
  router.use(express.json({ limit: "32kb" }));
  const limiter = new Map<string, { count: number; end: number }>();
  const uploading = new Set<string>();
  router.use((req, res, next) => {
    if (stopped) {
      res
        .status(503)
        .json({ error: "La arena se está reiniciando. Vuelve a intentar." });
      return;
    }
    if (req.method === "GET") {
      next();
      return;
    }
    const origin = req.get("origin");
    if (
      req.get("sec-fetch-site") === "cross-site" ||
      (origin &&
        (() => {
          try {
            return new URL(origin).host !== req.get("host");
          } catch {
            return true;
          }
        })())
    ) {
      res
        .status(403)
        .json({ error: "Esta acción debe iniciarse desde Arena Criolla." });
      return;
    }
    const key =
      (req.ip || "unknown") +
      ":" +
      (req.path.startsWith("/auth") ? "auth" : "creator");
    const now = Date.now();
    const budget = limiter.get(key);
    if (!budget || budget.end < now)
      limiter.set(key, { count: 1, end: now + 60_000 });
    else if (++budget.count > 30) {
      res
        .status(429)
        .json({ error: "Espera un momento antes de volver a intentar." });
      return;
    }
    if (limiter.size > 2000)
      for (const [k, v] of limiter) if (v.end < now) limiter.delete(k);
    next();
  });
  const requireUser = (req: Request, res: Response): CreatorUser | null => {
    const user = currentUser(req, db);
    if (!user)
      res.status(401).json({
        error: "Entra a tu cuenta para crear y administrar tus personajes.",
      });
    return user || null;
  };
  const own = (req: Request, res: Response) => {
    const user = requireUser(req, res);
    if (!user) return null;
    const row = db.character(String(req.params.id));
    if (!row || row.owner_id !== user.id || row.status === "archived") {
      res.status(404).json({ error: "No encontramos ese personaje." });
      return null;
    }
    return row;
  };
  let stopped = false;
  const worker = new CreatorWorker(
    limits,
    async (id, signal) => {
      const row = db.character(id);
      if (!graph || !row || !busy.has(row.status)) return;
      await graph.invoke(
        { id, input: JSON.parse(row.input), photos: JSON.parse(row.photos) },
        { signal },
      );
    },
    (id, error) => {
      const message =
        error instanceof z.ZodError
          ? "No pudimos entender el diseño. Puedes volver a intentarlo."
          : error instanceof SpriteValidationError
            ? error.message
            : error instanceof Error && error.name === "TimeoutError"
              ? "La creación tardó demasiado y se detuvo. Tus datos están guardados. Revisa el resultado antes de continuar; una petición de imagen interrumpida puede haber tenido costo."
              : "No pudimos terminar el personaje. Tus fotos y tu descripción están guardadas; puedes volver a intentarlo.";
      db.update(id, {
        status: "failed",
        message,
        ...(error instanceof SpriteValidationError
          ? { source_path: null }
          : {}),
      });
      console.error(
        `Character generation ${id} failed:`,
        error instanceof Error ? error.name : "UnknownError",
      );
    },
  );
  const enqueue = (id: string) => worker.enqueue(id);
  const workshopAvailable = (res: Response) => {
    if (!worker.accepting) {
      res.status(503).set("Retry-After", "60").json({
        error: "El taller no está disponible por el momento. Vuelve más tarde.",
      });
      return false;
    }
    if (worker.size + uploading.size >= limits.capacity) {
      res.status(503).set("Retry-After", "30").json({
        error: "El taller está ocupado. Vuelve a intentar en un momento.",
      });
      return false;
    }
    return true;
  };
  const generationBudget = (
    owner: string,
    res: Response,
    reserve = false,
    onReserve?: () => void,
  ) => {
    if (
      !db.generationBudget(
        owner,
        limits.dailyAttempts,
        limits.dailyUserAttempts,
        reserve,
        onReserve,
      )
    ) {
      res.status(429).set("Retry-After", "3600").json({
        error: "Se alcanzó el límite de creaciones de hoy. Vuelve más tarde.",
      });
      return false;
    }
    return true;
  };
  let catalogWrite: Promise<void> = Promise.resolve();
  const writeCatalog = () => {
    catalogWrite = catalogWrite
      .catch(() => {})
      .then(async () => {
        const characters = db
          .published()
          .map((row) => JSON.parse(row.character!) as CommunityCharacter);
        // SQLite is authoritative. A derived JSON snapshot failing after commit
        // must not hide a published/retired fighter from connected players.
        options.onCatalogChange?.(characters);
        const temporary = path.join(dataDir, `community.${randomUUID()}.tmp`);
        try {
          await mkdir(dataDir, { recursive: true });
          await writeFile(
            temporary,
            JSON.stringify(characters, null, 2) + "\n",
          );
          await rename(temporary, path.join(dataDir, "community.json"));
        } catch (error) {
          console.error(
            "Creator catalog snapshot failed:",
            error instanceof Error ? error.name : "UnknownError",
          );
        } finally {
          await rm(temporary, { force: true }).catch(() => {});
        }
      });
    return catalogWrite;
  };
  const mutations = new Set<string>();
  const lockMutation = (id: string, res: Response) => {
    if (mutations.has(id)) {
      res.status(409).json({
        error: "Espera a que termine la otra acción de este personaje.",
      });
      return null;
    }
    mutations.add(id);
    return () => mutations.delete(id);
  };
  for (const row of db.published())
    registerCommunityCharacter(JSON.parse(row.character!));
  // A restarted process must not silently repeat an in-flight billed image request.
  for (const row of db.pending())
    db.update(row.id, {
      status: "failed",
      message:
        "La creación se interrumpió. Tus datos siguen guardados; puedes continuar.",
    });

  router.get("/auth/session", (req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({ user: currentUser(req, db) || null });
  });
  router.post("/auth/signup", async (req, res, next) => {
    try {
      const data = SignUp.safeParse(req.body);
      if (!data.success) {
        res.status(400).json({
          error:
            "Usa un nombre de 2–24 caracteres, un correo válido y una contraseña de 8 caracteres o más.",
        });
        return;
      }
      if (db.userByEmail(data.data.email)) {
        res.status(409).json({
          error:
            "Ese correo ya tiene una cuenta. Puedes entrar con tu contraseña.",
        });
        return;
      }
      const user = {
        id: randomUUID(),
        name: data.data.name,
        email: data.data.email,
      };
      const encoded = await hashPassword(data.data.password);
      try {
        db.createUser(user, encoded);
      } catch (error) {
        if (!db.userByEmail(data.data.email)) throw error;
        res.status(409).json({ error: "Ese correo ya tiene una cuenta." });
        return;
      }
      createSession(res, db, user.id, secure);
      res.status(201).json({ user });
    } catch (error) {
      next(error);
    }
  });
  router.post("/auth/signin", async (req, res, next) => {
    try {
      const data = SignIn.safeParse(req.body);
      if (!data.success) {
        res.status(400).json({ error: "Revisa el correo y la contraseña." });
        return;
      }
      const stored = db.userByEmail(data.data.email);
      const valid = await verifyPassword(
        data.data.password,
        stored?.password_hash ||
          "scrypt:00000000000000000000000000000000:" + "0".repeat(128),
      );
      if (!stored || !valid) {
        res
          .status(401)
          .json({ error: "El correo o la contraseña no coinciden." });
        return;
      }
      createSession(res, db, stored.id, secure);
      res.json({
        user: { id: stored.id, name: stored.name, email: stored.email },
      });
    } catch (error) {
      next(error);
    }
  });
  router.post("/auth/signout", (req, res) => {
    const token = sessionToken(req);
    if (token) {
      const hash = tokenHash(token);
      db.deleteSession(hash);
      options.onSessionEnd?.(hash);
    }
    clearSession(res, secure);
    res.json({ ok: true });
  });
  router.get("/creator/capabilities", (_req, res) =>
    res.json({
      generationAvailable: Boolean(provider) && worker.accepting,
      maxPhotos: 3,
      maxPhotoBytes: maxBytes,
    }),
  );
  router.get("/community/characters", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({
      characters: db.published().map((row) => JSON.parse(row.character!)),
    });
  });
  router.get("/creator/characters", (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    res.set("Cache-Control", "no-store");
    res.json({ characters: db.owned(user.id).map((row) => db.view(row)) });
  });
  router.get("/creator/characters/:id", (req, res) => {
    const row = own(req, res);
    if (row) {
      res.set("Cache-Control", "no-store");
      res.json({ character: db.view(row) });
    }
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { files: 3, fileSize: maxBytes, fields: 5, fieldSize: 2000 },
    fileFilter: (_req, file, done) =>
      done(
        null,
        ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype),
      ),
  });
  router.post(
    "/creator/characters",
    (req, res, next) => {
      const user = requireUser(req, res);
      if (!user) return;
      if (!provider) {
        res.status(503).json({
          error:
            "El taller de personajes todavía no está disponible. Vuelve pronto.",
        });
        return;
      }
      const owned = db.owned(user.id);
      if (
        uploading.has(user.id) ||
        owned.some((row) => busy.has(row.status)) ||
        owned.length >= 12
      ) {
        res.status(409).json({
          error:
            owned.length >= 12
              ? "Puedes guardar hasta 12 personajes. Elimina uno para crear otro."
              : "Ya estás creando un personaje. Espera a que termine.",
        });
        return;
      }
      if (!workshopAvailable(res) || !generationBudget(user.id, res)) return;
      if (uploading.size >= limits.uploads) {
        res.status(503).set("Retry-After", "5").json({
          error:
            "Hay varias fotos subiendo. Vuelve a intentar en unos segundos.",
        });
        return;
      }
      uploading.add(user.id);
      const timer = setTimeout(() => req.destroy(), limits.uploadTimeoutMs);
      const release = () => {
        clearTimeout(timer);
        uploading.delete(user.id);
      };
      res.locals.releaseUpload = release;
      req.once("aborted", release);
      upload.array("photos", 3)(req, res, (error) => {
        clearTimeout(timer);
        if (error) {
          release();
          next(error);
        } else next();
      });
    },
    async (req, res, next) => {
      let folder = "";
      try {
        const user = requireUser(req, res);
        if (!user) return;
        if (req.aborted || res.destroyed) return;
        const parsed = InputSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            error:
              "Añade un nombre, una descripción de 10–240 caracteres y elige tu estilo.",
          });
          return;
        }
        const files = req.files as Express.Multer.File[];
        if (!files?.length) {
          res.status(400).json({
            error: "Sube al menos una foto JPG, PNG o WebP (máximo 8 MB).",
          });
          return;
        }
        const id = "custom_" + randomUUID().replaceAll("-", "");
        folder = path.join(dataDir, "uploads", id);
        await mkdir(folder, { recursive: true });
        const photos: string[] = [];
        for (let index = 0; index < files.length; index++) {
          const target = path.join(folder, `${index}.jpg`);
          try {
            const photo = sharp(files[index].buffer, {
              limitInputPixels: 20_000_000,
            });
            const metadata = await photo.metadata();
            if (!["jpeg", "png", "webp"].includes(metadata.format ?? ""))
              throw new Error("Unsupported photo encoding");
            await photo
              .rotate()
              .resize({
                width: 1600,
                height: 1600,
                fit: "inside",
                withoutEnlargement: true,
              })
              .jpeg({ quality: 88 })
              .toFile(target);
          } catch {
            await rm(folder, { recursive: true, force: true });
            res.status(400).json({
              error:
                "Una foto no se pudo abrir. Usa JPG, PNG o WebP y vuelve a intentar.",
            });
            return;
          }
          photos.push(target);
        }
        if (stopped || req.aborted || res.destroyed) {
          await rm(folder, { recursive: true, force: true });
          return;
        }
        if (!worker.accepting) {
          workshopAvailable(res);
          await rm(folder, { recursive: true, force: true });
          return;
        }
        let row: StoredCharacter | undefined;
        if (
          !generationBudget(user.id, res, true, () => {
            row = db.createCharacter(
              id,
              user.id,
              parsed.data as CharacterInput,
              photos,
            );
          })
        ) {
          await rm(folder, { recursive: true, force: true });
          return;
        }
        enqueue(id);
        res.status(202).json({ character: db.view(row!) });
      } catch (error) {
        if (folder) await rm(folder, { recursive: true, force: true });
        next(error);
      } finally {
        res.locals.releaseUpload?.();
      }
    },
  );
  router.post("/creator/characters/:id/retry", (req, res) => {
    const row = own(req, res);
    if (!row) return;
    if (!graph) {
      res.status(503).json({ error: "El taller todavía no está disponible." });
      return;
    }
    if (row.status !== "failed") {
      res
        .status(409)
        .json({ error: "Este personaje ya está listo o sigue en proceso." });
      return;
    }
    if (
      uploading.has(row.owner_id) ||
      db
        .owned(row.owner_id)
        .some((other) => other.id !== row.id && busy.has(other.status))
    ) {
      res
        .status(409)
        .json({ error: "Espera a que termine tu otro personaje." });
      return;
    }
    if (
      !workshopAvailable(res) ||
      !generationBudget(row.owner_id, res, true, () => {
        db.update(row.id, {
          status: "queued",
          progress: 0,
          message: "Continuando la creación…",
        });
      })
    )
      return;
    enqueue(row.id);
    res.status(202).json({ character: db.view(db.character(row.id)!) });
  });
  router.post("/creator/characters/:id/publish", async (req, res, next) => {
    const row = own(req, res);
    if (!row) return;
    if (!row.character || !["ready", "published"].includes(row.status)) {
      res
        .status(409)
        .json({ error: "Espera a que el personaje termine de crearse." });
      return;
    }
    const unlock = lockMutation(row.id, res);
    if (!unlock) return;
    try {
      const character = JSON.parse(row.character) as CommunityCharacter;
      await access(path.join(dataDir, "characters", row.id, "sprite.webp"));
      db.update(row.id, {
        status: "published",
        message: "Publicado. Todos pueden elegir tu personaje en la arena.",
      });
      registerCommunityCharacter(character);
      await writeCatalog();
      res.json({ character: db.view(db.character(row.id)!) });
    } catch (error) {
      next(error);
    } finally {
      unlock();
    }
  });
  router.delete("/creator/characters/:id", async (req, res, next) => {
    const row = own(req, res);
    if (!row) return;
    if (busy.has(row.status)) {
      res
        .status(409)
        .json({ error: "Espera a que termine la creación para eliminarlo." });
      return;
    }
    const unlock = lockMutation(row.id, res);
    if (!unlock) return;
    try {
      // Keep published art available for already-started matches; remove it from discovery.
      unregisterCommunityCharacter(row.id as FighterId);
      if (row.status === "published")
        db.update(row.id, {
          status: "archived",
          message: "Retirado de la selección.",
        });
      else db.deleteCharacter(row.id);
      await rm(path.join(dataDir, "uploads", row.id), {
        recursive: true,
        force: true,
      });
      if (row.status !== "published")
        await rm(path.join(dataDir, "characters", row.id), {
          recursive: true,
          force: true,
        });
      await writeCatalog();
      res.json({ ok: true });
    } catch (error) {
      next(error);
    } finally {
      unlock();
    }
  });
  router.get("/creator/characters/:id/photos/:index", async (req, res) => {
    const row = own(req, res);
    if (!row) return;
    const index = Number(req.params.index),
      photos = JSON.parse(row.photos) as string[];
    if (!Number.isInteger(index) || index < 0 || !photos[index]) {
      res.sendStatus(404);
      return;
    }
    res.set("Cache-Control", "private, no-store");
    res.sendFile(photos[index], { dotfiles: "allow" });
  });
  router.get("/community/assets/:id/:file", (req, res) => {
    const id = String(req.params.id),
      file = String(req.params.file);
    if (
      !/^custom_[a-f0-9]{32}$/.test(id) ||
      !["sprite.webp", "portrait.webp"].includes(file)
    ) {
      res.sendStatus(404);
      return;
    }
    const row = db.character(id);
    if (
      !row ||
      (!["published", "archived"].includes(row.status) &&
        currentUser(req, db)?.id !== row.owner_id)
    ) {
      res.sendStatus(404);
      return;
    }
    res.set(
      "Cache-Control",
      ["published", "archived"].includes(row.status)
        ? "public, max-age=86400"
        : "private, no-store",
    );
    res.sendFile(path.join(dataDir, "characters", id, file), {
      dotfiles: "allow",
    });
  });
  router.use(
    (
      error: unknown,
      _req: Request,
      res: Response,
      _next: express.NextFunction,
    ) => {
      if (error instanceof multer.MulterError) {
        res
          .status(400)
          .json({ error: "Sube hasta 3 fotos de máximo 8 MB cada una." });
        return;
      }
      if (
        error &&
        typeof error === "object" &&
        "type" in error &&
        (error.type === "entity.parse.failed" ||
          error.type === "entity.too.large")
      ) {
        res.status(error.type === "entity.too.large" ? 413 : 400).json({
          error:
            "La solicitud no tiene un formato válido o es demasiado grande.",
        });
        return;
      }
      console.error(
        "Creator request failed:",
        error instanceof Error ? error.name : "UnknownError",
      );
      res
        .status(500)
        .json({ error: "No pudimos completar esa acción. Vuelve a intentar." });
    },
  );
  return {
    router,
    db,
    dataDir,
    databasePath,
    stop() {
      stopped = true;
      worker.stop();
    },
    async close() {
      stopped = true;
      await worker.close();
      await catalogWrite.catch(() => {});
      db.close();
    },
  };
}
