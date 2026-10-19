import "../creator.css";
import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ImagePlus,
  LoaderCircle,
  LogOut,
  Plus,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import {
  creatorApi,
  CreatorRequestError,
  creatorSessionEvent,
} from "../creator-api";
import { useCreatorDraft } from "../creator-draft";
import { registerCommunityCharacter } from "../../shared/community";
import { createMatch, type MatchState } from "../../shared/engine";
import type {
  CreatorCapabilities,
  CreatorCharacter,
  CreatorUser,
  FightingStyle,
} from "../../shared/creator";
import { PixelIcon } from "./PixelIcon";
import { Portrait } from "./Portrait";
import { Game } from "./Game";
import { Help } from "./Help";
import { beginMobilePlay } from "../game/mobile";
import { initAudio } from "../audio";

const styles = [
  {
    id: "agile" as const,
    name: "Ágil",
    hint: "Entra rápido. Sal con estilo.",
    icon: "↗",
  },
  {
    id: "technical" as const,
    name: "Técnico",
    hint: "Ritmo, precisión y combos.",
    icon: "✦",
  },
  {
    id: "power" as const,
    name: "Potente",
    hint: "Cada golpe deja huella.",
    icon: "⚡",
  },
];
const colors = ["#ffd45a", "#669bff", "#fa7c6d", "#8fe0b1", "#c39bf2"];
const busyStatuses = new Set([
  "queued",
  "designing",
  "drawing",
  "packing",
  "testing",
]);

export function CreatorStudio({
  onBack,
  onCatalogChange,
}: {
  onBack: () => void;
  onCatalogChange: () => Promise<void>;
}) {
  const [user, setUser] = useState<CreatorUser | null>(null),
    [loading, setLoading] = useState(true);
  const [accountMode, setAccountMode] = useState<"signin" | "signup">("signup");
  const [accountName, setAccountName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const {
    draft,
    ready: draftReady,
    status: draftStatus,
    update: updateDraft,
    persist: persistDraft,
    clear: clearDraft,
    reload: reloadDraft,
  } = useCreatorDraft(user?.id, user?.name);
  const { name, description, style, color, photos } = draft;
  const setName = (name: string) => updateDraft({ name });
  const setDescription = (description: string) => updateDraft({ description });
  const setStyle = (style: FightingStyle) => updateDraft({ style });
  const setColor = (color: string) => updateDraft({ color });
  const setPhotos = (change: File[] | ((current: File[]) => File[])) =>
    updateDraft((current) => ({
      photos: typeof change === "function" ? change(current.photos) : change,
    }));
  const [previews, setPreviews] = useState<string[]>([]);
  const [storedRecords, setRecords] = useState<CreatorCharacter[]>([]),
    [recordsOwner, setRecordsOwner] = useState<string>(),
    [capabilities, setCapabilities] = useState<CreatorCapabilities | null>(
      null,
    );
  const [error, setError] = useState(""),
    [submitting, setSubmitting] = useState(false),
    [pendingAction, setPendingAction] = useState("");
  const [notice, setNotice] = useState(""),
    [trial, setTrial] = useState<MatchState | null>(null);
  const [trialHelp, setTrialHelp] = useState(false);
  const [connectionLost, setConnectionLost] = useState(false);
  const ownerRef = useRef(user?.id);
  ownerRef.current = user?.id;
  const refreshSequence = useRef(0);
  const sessionEpoch = useRef(0);
  const authenticating = useRef(false);
  const submissionActive = useRef(false);
  const records = recordsOwner === user?.id ? storedRecords : [];
  const generating = records.some((record) => busyStatuses.has(record.status));
  const fileInput = useRef<HTMLInputElement>(null),
    createForm = useRef<HTMLFormElement>(null),
    errorMessage = useRef<HTMLParagraphElement>(null),
    workbench = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!error) return;
    errorMessage.current?.focus({ preventScroll: true });
    errorMessage.current?.scrollIntoView({ block: "nearest" });
  }, [error]);
  const alive = useRef(true);
  const currentSession = (epoch: number) =>
    alive.current && sessionEpoch.current === epoch;
  const updateAccount = (next: CreatorUser | null) => {
    if (ownerRef.current !== next?.id) {
      ++sessionEpoch.current;
      ownerRef.current = next?.id;
      setAccountName("");
      setEmail("");
      setPassword("");
      setError("");
      setNotice("");
      setTrial(null);
      setTrialHelp(false);
    }
    setUser(next);
  };
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const sessionFailure = (failure: unknown, owner: string | undefined) => {
    if (
      !(failure instanceof CreatorRequestError) ||
      (failure.status !== 401 && failure.code !== "SESSION_CHANGED") ||
      ownerRef.current !== owner
    )
      return false;
    updateAccount(null);
    setError(
      "La sesión terminó o cambió en otra pestaña. Entra de nuevo para recuperar tu borrador.",
    );
    return true;
  };
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key !== creatorSessionEvent) return;
      ++sessionEpoch.current;
      authenticating.current = false;
      updateAccount(null);
      setLoading(false);
      setSubmitting(false);
      submissionActive.current = false;
      setError(
        "La sesión cambió en otra pestaña. Entra de nuevo para recuperar tu borrador.",
      );
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);
  useEffect(() => {
    setSubmitting(false);
    submissionActive.current = false;
    setPendingAction("");
    setNotice("");
    setTrial(null);
    setRecords([]);
    setRecordsOwner(undefined);
    setConnectionLost(false);
    ++refreshSequence.current;
  }, [user?.id]);
  useEffect(() => {
    let active = true;
    let sequence = 0;
    const checkSession = () => {
      if (authenticating.current) return;
      const request = ++sequence;
      const generation = sessionEpoch.current;
      void creatorApi
        .session()
        .then((data) => {
          if (active && request === sequence && currentSession(generation)) {
            updateAccount(data.user);
            setLoading(false);
          }
        })
        .catch((e) => {
          if (active && request === sequence && currentSession(generation))
            setError(e.message);
        })
        .finally(() => {
          if (active && request === sequence && currentSession(generation))
            setLoading(false);
        });
    };
    checkSession();
    const visible = () => {
      if (!document.hidden) checkSession();
    };
    window.addEventListener("focus", checkSession);
    document.addEventListener("visibilitychange", visible);
    void creatorApi
      .capabilities()
      .then(setCapabilities)
      .catch(() => {});
    return () => {
      active = false;
      window.removeEventListener("focus", checkSession);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  useEffect(() => {
    const urls = photos.map((photo) => URL.createObjectURL(photo));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [photos]);
  const refresh = async () => {
    const owner = ownerRef.current;
    if (!owner) return;
    const generation = sessionEpoch.current;
    const sequence = ++refreshSequence.current;
    const data = await creatorApi.mine(owner);
    if (
      !currentSession(generation) ||
      ownerRef.current !== owner ||
      sequence !== refreshSequence.current
    )
      return;
    for (const record of data.characters)
      if (record.character) registerCommunityCharacter(record.character, false);
    setRecords(data.characters);
    setRecordsOwner(owner);
    setConnectionLost(false);
  };
  useEffect(() => {
    if (
      !draftReady ||
      !records.some((record) => record.requestKey === draft.requestKey)
    )
      return;
    const generation = sessionEpoch.current;
    const owner = user?.id;
    void clearDraft(draft.requestKey)
      .then(() => {
        if (currentSession(generation) && ownerRef.current === owner)
          setNotice(
            "Recuperamos tu creación. El progreso sigue guardado en Mis luchadores.",
          );
      })
      .catch(() => {});
  }, [draftReady, draft.requestKey, records, clearDraft]);
  useEffect(() => {
    if (!user) {
      setRecords([]);
      return;
    }
    let active = true;
    const tick = () => {
      if (active && !document.hidden)
        void refresh().catch((error) => {
          if (active && !sessionFailure(error, user.id))
            setConnectionLost(true);
        });
    };
    tick();
    const timer = setInterval(tick, generating ? 2500 : 15_000);
    window.addEventListener("focus", tick);
    window.addEventListener("online", tick);
    window.addEventListener("pageshow", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", tick);
      window.removeEventListener("online", tick);
      window.removeEventListener("pageshow", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [user?.id, generating]);
  const authenticate = async (event: FormEvent) => {
    event.preventDefault();
    if (authenticating.current) return;
    authenticating.current = true;
    const generation = ++sessionEpoch.current;
    setError("");
    setSubmitting(true);
    try {
      const data =
        accountMode === "signup"
          ? await creatorApi.signUp(accountName, email, password)
          : await creatorApi.signIn(email, password);
      if (!currentSession(generation)) return;
      authenticating.current = false;
      updateAccount(data.user);
      setLoading(false);
      setPassword("");
    } catch (e) {
      if (!currentSession(generation)) return;
      setError(e instanceof Error ? e.message : "No pudimos entrar.");
    } finally {
      if (currentSession(generation)) {
        authenticating.current = false;
        setSubmitting(false);
      }
    }
  };
  const addPhotos = (files: File[]) => {
    if (submitting || draft.submitted) return;
    setError("");
    if (
      files.some(
        (file) =>
          !["image/jpeg", "image/png", "image/webp"].includes(file.type),
      )
    ) {
      setError("Usa fotos JPG, PNG o WebP.");
      return;
    }
    if (files.some((file) => file.size > 8 * 1024 * 1024)) {
      setError("Cada foto debe pesar menos de 8 MB.");
      return;
    }
    if (files.length + photos.length > 3) {
      setError("Puedes subir hasta 3 fotos.");
      return;
    }
    setPhotos((current) => [...current, ...files]);
  };
  const drop = (event: DragEvent) => {
    event.preventDefault();
    addPhotos(Array.from(event.dataTransfer.files));
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submissionActive.current || !user) return;
    const generation = sessionEpoch.current;
    submissionActive.current = true;
    setError("");
    setSubmitting(true);
    const owner = user?.id;
    try {
      if (!photos.length)
        throw new Error("Añade al menos una foto para crear tu personaje.");
      const saved = await persistDraft();
      if (!currentSession(generation) || ownerRef.current !== owner) return;
      const body = new FormData();
      body.set("name", saved.name.trim());
      body.set("description", saved.description.trim());
      body.set("style", saved.style);
      body.set("color", saved.color);
      saved.photos.forEach((photo) => body.append("photos", photo));
      const { character } = await creatorApi.create(
        body,
        saved.requestKey,
        owner,
      );
      if (!currentSession(generation) || ownerRef.current !== owner) return;
      setRecordsOwner(owner);
      setRecords((current) => [
        character,
        ...current.filter((record) => record.id !== character.id),
      ]);
      void clearDraft(saved.requestKey).catch(() => {});
      setNotice(
        "¡Vamos! Puedes quedarte aquí o volver después. Tu progreso queda guardado.",
      );
      requestAnimationFrame(() => {
        if (!currentSession(generation) || ownerRef.current !== owner) return;
        workbench.current?.focus({ preventScroll: true });
        workbench.current?.scrollIntoView({ block: "start" });
      });
    } catch (e) {
      if (!currentSession(generation) || ownerRef.current !== owner) return;
      if (sessionFailure(e, owner)) return;
      if (e instanceof CreatorRequestError && e.code === "CREATION_REMOVED")
        await clearDraft(draft.requestKey).catch(() => {});
      void refresh().catch(() => {});
      setError(
        e instanceof Error ? e.message : "No pudimos crear el personaje.",
      );
    } finally {
      if (currentSession(generation) && ownerRef.current === owner) {
        submissionActive.current = false;
        setSubmitting(false);
      }
    }
  };
  const act = async (id: string, action: "publish" | "retry" | "remove") => {
    const owner = user?.id;
    if (!owner) return;
    const generation = sessionEpoch.current;
    setError("");
    setPendingAction(id + action);
    try {
      if (action === "remove") await creatorApi.remove(id, owner);
      else await creatorApi[action](id, owner);
      if (!currentSession(generation) || ownerRef.current !== owner) return;
      await refresh();
      if (!currentSession(generation) || ownerRef.current !== owner) return;
      if (action !== "retry") await onCatalogChange();
      if (
        action === "publish" &&
        currentSession(generation) &&
        ownerRef.current === owner
      )
        setNotice("Publicado. Tu personaje ya está disponible para todos.");
    } catch (e) {
      if (
        !currentSession(generation) ||
        ownerRef.current !== owner ||
        sessionFailure(e, owner)
      )
        return;
      setError(
        e instanceof Error ? e.message : "No pudimos completar la acción.",
      );
    } finally {
      if (currentSession(generation) && ownerRef.current === owner)
        setPendingAction("");
    }
  };
  const discard = async () => {
    const owner = user?.id;
    if (!owner || submissionActive.current) return;
    const generation = sessionEpoch.current;
    submissionActive.current = true;
    setSubmitting(true);
    try {
      if (draft.submitted)
        await creatorApi.discardRequest(draft.requestKey, owner);
      if (!currentSession(generation) || ownerRef.current !== owner) return;
      await clearDraft(draft.requestKey);
      await refresh();
    } catch (error) {
      if (
        currentSession(generation) &&
        ownerRef.current === owner &&
        !sessionFailure(error, owner)
      )
        setError(
          error instanceof Error
            ? error.message
            : "No pudimos descartar el borrador.",
        );
    } finally {
      if (currentSession(generation) && ownerRef.current === owner) {
        submissionActive.current = false;
        setSubmitting(false);
      }
    }
  };
  const tryFighter = (record: CreatorCharacter) => {
    if (!record.character) return;
    initAudio();
    beginMobilePlay();
    registerCommunityCharacter(record.character, false);
    setTrial(
      createMatch(
        "caracas",
        [
          { fighter: record.character.id, name: record.input.name, wins: 3 },
          { fighter: "zavarce", name: "CPU", wins: 0 },
        ],
        crypto.randomUUID(),
      ),
    );
    window.scrollTo({ top: 0 });
  };
  if (trial)
    return (
      <div className="app-shell arcade-app in-match">
        <Game
          key={trial.id}
          initial={trial}
          mode="practice"
          difficulty="easy"
          onExit={() => setTrial(null)}
          onResult={() => {}}
          onRematch={() =>
            setTrial(
              createMatch(
                trial.stage,
                trial.players.map((p) => p.config) as [
                  (typeof trial.players)[0]["config"],
                  (typeof trial.players)[1]["config"],
                ],
                crypto.randomUUID(),
              ),
            )
          }
          onHelp={() => setTrialHelp(true)}
        />
        {trialHelp && <Help onClose={() => setTrialHelp(false)} />}
      </div>
    );
  return (
    <div className="creator-shell">
      <header className="creator-header">
        <button className="creator-back" onClick={onBack}>
          <ArrowLeft size={17} /> Arena
        </button>
        <span className="creator-brand">
          <PixelIcon kind="gamepad" size={20} /> ARENA <b>CRIOLLA</b>
        </span>
        {user && (
          <button
            className="creator-account"
            onClick={() => {
              const owner = user.id;
              updateAccount(null);
              const generation = sessionEpoch.current;
              void creatorApi.signOut(owner).catch((e) => {
                if (currentSession(generation)) setError(e.message);
              });
            }}
            aria-label="Cerrar sesión"
          >
            <span>{user.name}</span>
            <LogOut size={16} />
          </button>
        )}
      </header>
      <main className="creator-main">
        {loading ? (
          <div className="creator-loading" role="status">
            <LoaderCircle className="creator-spinner" /> Abriendo el taller…
          </div>
        ) : !user ? (
          <section className="creator-auth">
            <span className="creator-eyebrow">TU LUGAR EN LA ARENA</span>
            <h1>
              El próximo luchador
              <br />
              puedes ser <em>tú.</em>
            </h1>
            <p>
              Unas fotos, un poco de tu personalidad y un personaje listo para
              el pique.
            </p>
            <div
              className="creator-auth-tabs"
              role="tablist"
              aria-label="Acceso al taller"
              onKeyDown={(event) => {
                const modes = ["signup", "signin"] as const;
                const index = modes.indexOf(accountMode);
                const next =
                  event.key === "ArrowRight" || event.key === "ArrowLeft"
                    ? 1 - index
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? 1
                        : undefined;
                if (next === undefined) return;
                event.preventDefault();
                setAccountMode(modes[next]);
                setError("");
                event.currentTarget
                  .querySelectorAll<HTMLButtonElement>("[role=tab]")
                  [next]?.focus();
              }}
            >
              <button
                id="creator-signup-tab"
                role="tab"
                aria-controls="creator-auth-panel"
                aria-selected={accountMode === "signup"}
                tabIndex={accountMode === "signup" ? 0 : -1}
                onClick={() => {
                  setAccountMode("signup");
                  setError("");
                }}
              >
                Crear cuenta
              </button>
              <button
                id="creator-signin-tab"
                role="tab"
                aria-controls="creator-auth-panel"
                aria-selected={accountMode === "signin"}
                tabIndex={accountMode === "signin" ? 0 : -1}
                onClick={() => {
                  setAccountMode("signin");
                  setError("");
                }}
              >
                Ya tengo cuenta
              </button>
            </div>
            <form
              id="creator-auth-panel"
              role="tabpanel"
              aria-labelledby={`creator-${accountMode}-tab`}
              onSubmit={authenticate}
            >
              {accountMode === "signup" && (
                <label>
                  Tu nombre
                  <input
                    required
                    minLength={2}
                    maxLength={24}
                    autoComplete="nickname"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="¿Cómo te llaman tus panas?"
                  />
                </label>
              )}
              <label>
                Correo
                <input
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                />
              </label>
              <label>
                Contraseña
                <input
                  type="password"
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete={
                    accountMode === "signup"
                      ? "new-password"
                      : "current-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    accountMode === "signup"
                      ? "8 caracteres o más"
                      : "Tu contraseña"
                  }
                />
              </label>
              {error && (
                <p
                  className="creator-error"
                  role="alert"
                  tabIndex={-1}
                  ref={errorMessage}
                >
                  {error}
                </p>
              )}
              <button className="creator-primary" disabled={submitting}>
                {submitting ? (
                  <LoaderCircle className="creator-spinner" size={18} />
                ) : (
                  <>
                    {accountMode === "signup" ? "Entrar al taller" : "Entrar"}
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
            <small>Para jugar puedes seguir entrando sin cuenta.</small>
          </section>
        ) : (
          <>
            <div className="creator-intro">
              <span className="creator-eyebrow">EL TALLER CRIOLLO</span>
              <h1>
                Tu cara. Tu estilo.
                <br />
                <em>Tu luchador.</em>
              </h1>
              <p>
                Crea tu versión de la arena. Pruébala y compártela con tus
                panas.
              </p>
            </div>
            {error && (
              <p
                className="creator-error"
                role="alert"
                tabIndex={-1}
                ref={errorMessage}
              >
                {error}
              </p>
            )}
            {notice && (
              <p className="creator-notice" role="status">
                <Check size={16} />
                {notice}
              </p>
            )}
            {connectionLost && (
              <p className="creator-notice" role="status">
                No pudimos actualizar el progreso. Reintentaremos al volver la
                conexión.
              </p>
            )}
            <div className="creator-layout">
              {!draftReady ? (
                <div className="creator-loading" role="status">
                  <LoaderCircle className="creator-spinner" /> Recuperando tu
                  borrador…
                </div>
              ) : (
                <form
                  className="creator-form"
                  onSubmit={submit}
                  ref={createForm}
                >
                  <div className="creator-section-title">
                    <span>01</span>
                    <h2>Así te ves</h2>
                    <small>1–3 fotos</small>
                  </div>
                  <div
                    className={`creator-upload ${photos.length ? "has-photos" : ""}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={drop}
                  >
                    <input
                      ref={fileInput}
                      className="creator-file-input"
                      type="file"
                      tabIndex={-1}
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      disabled={submitting || draft.submitted}
                      aria-label="Subir fotos de referencia"
                      onChange={(e) => {
                        addPhotos(Array.from(e.target.files || []));
                        e.target.value = "";
                      }}
                    />
                    {photos.length ? (
                      <div className="creator-photo-grid">
                        {previews.map((url, index) => (
                          <div className="creator-photo" key={url}>
                            <img
                              src={url}
                              alt={`Tu foto de referencia ${index + 1}`}
                            />
                            <button
                              type="button"
                              disabled={submitting || draft.submitted}
                              aria-label={`Quitar foto ${index + 1}`}
                              onClick={() =>
                                setPhotos((current) =>
                                  current.filter((_, i) => i !== index),
                                )
                              }
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                        {photos.length < 3 && (
                          <button
                            type="button"
                            disabled={submitting || draft.submitted}
                            className="creator-photo-add"
                            onClick={() => fileInput.current?.click()}
                            aria-label="Añadir otra foto"
                          >
                            <Plus size={24} />
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={submitting || draft.submitted}
                        className="creator-upload-action"
                        onClick={() => fileInput.current?.click()}
                      >
                        <ImagePlus size={30} />
                        <strong>Sube tus fotos</strong>
                        <span>O arrástralas aquí</span>
                      </button>
                    )}
                  </div>
                  <p className="creator-hint">
                    Rostro visible y buena luz. Puede ser una selfie o una foto
                    de medio cuerpo; completamos la ropa que no se vea. Tus
                    fotos son privadas; se comparte el personaje que publiques.
                  </p>
                  <div className="creator-section-title">
                    <span>02</span>
                    <h2>Así eres tú</h2>
                  </div>
                  <label>
                    Nombre en la arena
                    <input
                      required
                      minLength={2}
                      maxLength={24}
                      value={name}
                      disabled={submitting || draft.submitted}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Tu nombre o tu apodo"
                    />
                  </label>
                  <label>
                    Cuéntanos un poquito
                    <textarea
                      required
                      minLength={10}
                      maxLength={240}
                      rows={3}
                      value={description}
                      disabled={submitting || draft.submitted}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Soy diseñador, salsero y fan de las arepas. Casi siempre llevo lentes y una chaqueta azul."
                    />
                    <span className="creator-counter">
                      {description.length}/240
                    </span>
                  </label>
                  <fieldset className="creator-style">
                    <legend>¿Cómo quieres pelear?</legend>
                    <div>
                      {styles.map((item) => (
                        <button
                          type="button"
                          disabled={submitting || draft.submitted}
                          key={item.id}
                          aria-pressed={style === item.id}
                          onClick={() => setStyle(item.id)}
                        >
                          <span>{item.icon}</span>
                          <strong>{item.name}</strong>
                          <small>{item.hint}</small>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset className="creator-colors">
                    <legend>Tu toque de color</legend>
                    {colors.map((value) => (
                      <button
                        type="button"
                        disabled={submitting || draft.submitted}
                        key={value}
                        style={{ backgroundColor: value }}
                        aria-label={`Elegir color ${value}`}
                        aria-pressed={color === value}
                        onClick={() => setColor(value)}
                      >
                        {color === value && <Check size={15} />}
                      </button>
                    ))}
                  </fieldset>
                  {capabilities && !capabilities.generationAvailable && (
                    <p className="creator-service-note">
                      El taller todavía no está disponible para generar
                      personajes. Puedes preparar tu idea y volver pronto.
                    </p>
                  )}
                  <button
                    className="creator-primary"
                    disabled={
                      submitting ||
                      generating ||
                      draftStatus === "conflict" ||
                      (!draft.submitted && !capabilities?.generationAvailable)
                    }
                  >
                    {submitting ? (
                      <LoaderCircle className="creator-spinner" size={18} />
                    ) : (
                      <>
                        <PixelIcon kind="gamepad" size={20} />
                        {generating
                          ? "Tu personaje está en camino"
                          : draft.submitted
                            ? "Comprobar mi creación"
                            : "Crear mi luchador"}
                        <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                  <p className="creator-hint creator-timing">
                    {draft.submitted
                      ? "La creación pudo empezar. Comprueba el resultado o descarta este borrador antes de editarlo."
                      : "Tarda unos minutos. Puedes volver después; tu progreso queda guardado."}
                  </p>
                  <p className="creator-hint" role="status" aria-live="polite">
                    {draftStatus === "saved"
                      ? "Borrador guardado en este dispositivo."
                      : draftStatus === "saving"
                        ? "Guardando borrador…"
                        : draftStatus === "conflict"
                          ? "El borrador cambió en otra pestaña. Recupera la versión guardada antes de continuar."
                          : draftStatus === "unavailable"
                            ? "No pudimos guardar el borrador en este dispositivo. Revisa el espacio del navegador."
                            : "Tu borrador se guarda en este dispositivo."}
                  </p>
                  {draftStatus === "conflict" && (
                    <button
                      type="button"
                      className="creator-account"
                      onClick={() => void reloadDraft()}
                    >
                      Recuperar borrador guardado
                    </button>
                  )}
                  {(draft.submitted ||
                    description ||
                    photos.length > 0 ||
                    name !== user.name) && (
                    <button
                      type="button"
                      className="creator-account"
                      disabled={submitting}
                      onClick={() => void discard()}
                    >
                      Descartar borrador <Trash2 size={14} />
                    </button>
                  )}
                </form>
              )}
              <aside
                className="creator-workbench"
                aria-label="Mis luchadores"
                ref={workbench}
                tabIndex={-1}
              >
                <div className="creator-section-title">
                  <h2>Mis luchadores</h2>
                  {records.length > 0 && <small>{records.length}/12</small>}
                </div>
                {!records.length ? (
                  <div className="creator-empty">
                    <PixelIcon kind="gamepad" size={44} />
                    <h3>
                      Tu primer pique
                      <br />
                      empieza aquí.
                    </h3>
                    <p>
                      Tu personaje aparecerá en este espacio cuando empieces a
                      crearlo.
                    </p>
                  </div>
                ) : (
                  <div className="creator-records">
                    {records.map((record) => (
                      <article className="creator-record" key={record.id}>
                        <div
                          className="creator-record-art"
                          style={
                            {
                              "--fighter-color": record.input.color,
                            } as React.CSSProperties
                          }
                        >
                          {record.character ? (
                            <Portrait fighter={record.character.id} />
                          ) : (
                            <PixelIcon kind="gamepad" size={42} />
                          )}
                        </div>
                        <div className="creator-record-info">
                          <span
                            className={`creator-state state-${record.status}`}
                          >
                            {record.status === "published"
                              ? "EN LA ARENA"
                              : record.status === "ready"
                                ? "LISTO"
                                : record.status === "failed"
                                  ? "POR TERMINAR"
                                  : "CREANDO"}
                          </span>
                          <h3>{record.input.name}</h3>
                          {record.character ? (
                            <p>{record.character.fighter.special}</p>
                          ) : (
                            <p>{record.message}</p>
                          )}
                          {busyStatuses.has(record.status) && (
                            <div
                              className="creator-progress"
                              role="progressbar"
                              aria-label={`Creación de ${record.input.name}`}
                              aria-valuenow={record.progress}
                              aria-valuemin={0}
                              aria-valuemax={100}
                            >
                              <span style={{ width: `${record.progress}%` }} />
                            </div>
                          )}
                          <div className="creator-record-actions">
                            {record.character && (
                              <button onClick={() => tryFighter(record)}>
                                Probar <Zap size={13} />
                              </button>
                            )}
                            {record.status === "ready" && (
                              <button
                                className="creator-publish"
                                disabled={!!pendingAction}
                                onClick={() => void act(record.id, "publish")}
                              >
                                {pendingAction === record.id + "publish"
                                  ? "Publicando…"
                                  : "Publicar"}
                                <ArrowRight size={13} />
                              </button>
                            )}
                            {record.status === "failed" && (
                              <button
                                disabled={
                                  !!pendingAction ||
                                  !capabilities?.generationAvailable
                                }
                                onClick={() => void act(record.id, "retry")}
                              >
                                Continuar <ArrowRight size={13} />
                              </button>
                            )}
                            {!busyStatuses.has(record.status) && (
                              <button
                                className="creator-delete"
                                disabled={!!pendingAction}
                                aria-label={`Eliminar ${record.input.name}`}
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      `¿Eliminar a ${record.input.name}?`,
                                    )
                                  )
                                    void act(record.id, "remove");
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </aside>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
