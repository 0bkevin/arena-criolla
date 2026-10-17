import { useCallback, useEffect, useRef, useState } from "react";
import type { CharacterInput } from "../shared/creator";

export interface CreatorDraft extends CharacterInput {
  requestKey: string;
  photos: File[];
  submitted?: boolean;
}
type DraftStatus =
  "loading" | "empty" | "saving" | "saved" | "unavailable" | "conflict";
interface StoredDraft {
  owner: string;
  version: 1;
  writeId?: string;
  input: CharacterInput;
  requestKey: string;
  submitted?: boolean;
  photos: { name: string; modified: number; blob: Blob }[];
}
const uuid =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const emptyDraft = (name = ""): CreatorDraft => ({
  name,
  description: "",
  style: "agile",
  color: "#ffd45a",
  requestKey: crypto.randomUUID(),
  photos: [],
});
let database: Promise<IDBDatabase> | undefined;
function openDrafts() {
  if (!database)
    database = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("arena-creator-drafts", 1);
      let failed = false;
      request.onupgradeneeded = () =>
        request.result.createObjectStore("drafts", { keyPath: "owner" });
      request.onerror = request.onblocked = () => {
        failed = true;
        reject(new Error("Draft storage unavailable"));
      };
      request.onsuccess = () => {
        const db = request.result;
        if (failed) {
          db.close();
          return;
        }
        db.onversionchange = () => {
          db.close();
          database = undefined;
        };
        resolve(db);
      };
    }).catch((error) => {
      database = undefined;
      throw error;
    });
  return database;
}
function decodeDraft(
  saved: StoredDraft | undefined,
  owner: string,
): CreatorDraft | null {
  if (!saved) return null;
  const input = saved.input;
  if (
    saved.version !== 1 ||
    saved.owner !== owner ||
    !input ||
    typeof input.name !== "string" ||
    input.name.length > 24 ||
    typeof input.description !== "string" ||
    input.description.length > 240 ||
    !["agile", "technical", "power"].includes(input.style) ||
    typeof input.color !== "string" ||
    !/^#[a-f0-9]{6}$/i.test(input.color) ||
    typeof saved.requestKey !== "string" ||
    !uuid.test(saved.requestKey) ||
    (saved.writeId !== undefined &&
      (typeof saved.writeId !== "string" || !uuid.test(saved.writeId))) ||
    (saved.submitted !== undefined && typeof saved.submitted !== "boolean") ||
    !Array.isArray(saved.photos) ||
    saved.photos.length > 3 ||
    saved.photos.some(
      (photo) =>
        !photo ||
        !(photo.blob instanceof Blob) ||
        photo.blob.size > 8 * 1024 * 1024 ||
        !["image/jpeg", "image/png", "image/webp"].includes(photo.blob.type) ||
        typeof photo.name !== "string" ||
        !Number.isFinite(photo.modified),
    )
  )
    return null;
  return {
    ...input,
    requestKey: saved.requestKey,
    submitted: saved.submitted,
    photos: saved.photos.map(
      (photo) =>
        new File([photo.blob], photo.name, {
          type: photo.blob.type,
          lastModified: photo.modified,
        }),
    ),
  };
}
export class DraftConflictError extends Error {
  constructor() {
    super(
      "El borrador cambió en otra pestaña. Recupera la versión guardada antes de continuar.",
    );
  }
}
const storedVersion = (saved?: StoredDraft): string | null => {
  if (!saved) return null;
  if (saved.writeId !== undefined)
    return typeof saved.writeId === "string" && uuid.test(saved.writeId)
      ? saved.writeId
      : "corrupt";
  return typeof saved.requestKey === "string" && uuid.test(saved.requestKey)
    ? saved.requestKey
    : "corrupt";
};

// One session serializes its writes; compare-and-swap inside IndexedDB protects
// against a second tab overwriting photos or deleting a newer saved draft.
export class CreatorDraftStorage {
  private version: string | null = null;
  private tail: Promise<unknown> = Promise.resolve();
  constructor(readonly owner: string) {}
  private enqueue<T>(action: () => Promise<T>): Promise<T> {
    const next = this.tail.catch(() => {}).then(action);
    this.tail = next;
    return next;
  }
  load() {
    return this.enqueue(async () => {
      const db = await openDrafts();
      const saved = await new Promise<StoredDraft | undefined>(
        (resolve, reject) => {
          const tx = db.transaction("drafts", "readonly");
          const read = tx.objectStore("drafts").get(this.owner);
          tx.oncomplete = () => resolve(read.result);
          tx.onabort = tx.onerror = () =>
            reject(new Error("Draft storage unavailable"));
        },
      );
      this.version = storedVersion(saved);
      const draft = decodeDraft(saved, this.owner);
      return { draft, corrupt: !!saved && !draft };
    });
  }
  private mutate(draft: CreatorDraft | null) {
    return this.enqueue(async () => {
      const db = await openDrafts();
      const writeId = crypto.randomUUID();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("drafts", "readwrite");
        const store = tx.objectStore("drafts");
        let conflict = false;
        const read = store.get(this.owner);
        read.onsuccess = () => {
          if (storedVersion(read.result) !== this.version) {
            conflict = true;
            tx.abort();
            return;
          }
          if (!draft) {
            store.delete(this.owner);
            return;
          }
          const {
            name,
            description,
            style,
            color,
            requestKey,
            submitted,
            photos,
          } = draft;
          store.put({
            owner: this.owner,
            version: 1,
            writeId,
            input: { name, description, style, color },
            requestKey,
            submitted,
            photos: photos.map((photo) => ({
              name: photo.name,
              modified: photo.lastModified,
              blob: photo,
            })),
          } satisfies StoredDraft);
        };
        tx.oncomplete = () => resolve();
        tx.onabort = tx.onerror = () =>
          reject(
            conflict
              ? new DraftConflictError()
              : new Error("Draft could not be saved"),
          );
      });
      this.version = draft ? writeId : null;
    });
  }
  save(draft: CreatorDraft) {
    return this.mutate(draft);
  }
  clear() {
    return this.mutate(null);
  }
}

export function useCreatorDraft(owner: string | undefined, initialName = "") {
  const [state, setState] = useState(() => ({
    owner: undefined as string | undefined,
    draft: emptyDraft(),
    ready: false,
    revision: 0,
  }));
  const [status, setStatus] = useState<DraftStatus>("loading");
  const current = useRef(state);
  const storage = useRef<CreatorDraftStorage | null>(null);
  const epoch = useRef(0);
  const replace = (next: typeof state) => {
    current.current = next;
    setState(next);
  };
  const failure = (error: unknown) =>
    setStatus(error instanceof DraftConflictError ? "conflict" : "unavailable");
  const reload = useCallback(async () => {
    const generation = ++epoch.current;
    const session = owner ? new CreatorDraftStorage(owner) : null;
    storage.current = session;
    replace({
      owner,
      draft: emptyDraft(initialName),
      ready: false,
      revision: 0,
    });
    setStatus("loading");
    if (!session) {
      replace({ owner, draft: emptyDraft(), ready: true, revision: 0 });
      setStatus("empty");
      return;
    }
    try {
      const { draft, corrupt } = await session.load();
      if (epoch.current !== generation) return;
      replace({
        owner,
        draft: draft || emptyDraft(initialName),
        ready: true,
        revision: 0,
      });
      setStatus(corrupt ? "unavailable" : draft ? "saved" : "empty");
    } catch (error) {
      if (epoch.current !== generation) return;
      replace({
        owner,
        draft: emptyDraft(initialName),
        ready: true,
        revision: 0,
      });
      failure(error);
    }
  }, [owner, initialName]);
  useEffect(() => {
    void reload();
    return () => {
      ++epoch.current;
    };
  }, [reload]);
  useEffect(() => {
    const session = storage.current;
    if (
      !session ||
      current.current !== state ||
      state.owner !== owner ||
      !state.ready ||
      state.revision === 0
    )
      return;
    let active = true;
    const generation = epoch.current;
    setStatus("saving");
    void session
      .save(state.draft)
      .then(() => {
        if (active && epoch.current === generation) setStatus("saved");
      })
      .catch((error) => {
        if (active && epoch.current === generation) failure(error);
      });
    return () => {
      active = false;
    };
  }, [owner, state]);
  useEffect(() => {
    const flush = () => {
      const latest = current.current;
      if (
        owner &&
        latest.owner === owner &&
        latest.ready &&
        latest.revision > 0
      )
        void storage.current?.save(latest.draft).catch(() => {});
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [owner]);
  const update = useCallback(
    (
      change:
        | Partial<CharacterInput>
        | { photos: File[] }
        | ((draft: CreatorDraft) => Partial<CreatorDraft>),
    ) => {
      const previous = current.current;
      if (
        previous.owner !== owner ||
        !previous.ready ||
        previous.draft.submitted
      )
        return;
      replace({
        ...previous,
        revision: previous.revision + 1,
        draft: {
          ...previous.draft,
          ...(typeof change === "function" ? change(previous.draft) : change),
          requestKey: crypto.randomUUID(),
        },
      });
    },
    [owner],
  );
  const persist = useCallback(async () => {
    const latest = current.current;
    const session = storage.current;
    if (!owner || latest.owner !== owner || !latest.ready || !session)
      throw new Error("Espera a que recuperemos tu borrador.");
    const next = {
      ...latest,
      draft: { ...latest.draft, submitted: true },
      revision: latest.revision + 1,
    };
    const generation = epoch.current;
    replace(next);
    setStatus("saving");
    try {
      await session.save(next.draft);
      return next.draft;
    } catch (error) {
      if (generation === epoch.current && storage.current === session)
        failure(error);
      throw error instanceof DraftConflictError
        ? error
        : new Error(
            "No pudimos guardar tu borrador. Revisa el espacio del navegador y vuelve a intentar.",
          );
    }
  }, [owner]);
  const clear = useCallback(
    async (requestKey: string) => {
      const latest = current.current;
      const session = storage.current;
      if (
        !owner ||
        latest.owner !== owner ||
        latest.draft.requestKey !== requestKey ||
        !session
      )
        return;
      const generation = ++epoch.current;
      replace({ ...latest, ready: false });
      try {
        await session.clear();
        if (epoch.current !== generation || storage.current !== session) return;
        replace({
          owner,
          draft: emptyDraft(initialName),
          ready: true,
          revision: 0,
        });
        setStatus("empty");
      } catch (error) {
        if (epoch.current === generation && storage.current === session) {
          replace(latest);
          failure(error);
        }
        throw error;
      }
    },
    [owner, initialName],
  );
  return {
    draft: state.draft,
    ready: state.owner === owner && state.ready,
    status,
    update,
    persist,
    clear,
    reload,
  };
}
