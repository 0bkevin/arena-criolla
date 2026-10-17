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
import { creatorApi } from "../creator-api";
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
  const [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [style, setStyle] = useState<FightingStyle>("agile"),
    [color, setColor] = useState(colors[0]);
  const [photos, setPhotos] = useState<File[]>([]),
    [previews, setPreviews] = useState<string[]>([]);
  const [records, setRecords] = useState<CreatorCharacter[]>([]),
    [capabilities, setCapabilities] = useState<CreatorCapabilities | null>(
      null,
    );
  const [error, setError] = useState(""),
    [submitting, setSubmitting] = useState(false),
    [pendingAction, setPendingAction] = useState("");
  const [notice, setNotice] = useState(""),
    [trial, setTrial] = useState<MatchState | null>(null);
  const [trialHelp, setTrialHelp] = useState(false);
  const generating = records.some((record) => busyStatuses.has(record.status));
  const fileInput = useRef<HTMLInputElement>(null),
    createForm = useRef<HTMLFormElement>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    void creatorApi
      .session()
      .then((data) => setUser(data.user))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    void creatorApi
      .capabilities()
      .then(setCapabilities)
      .catch(() => {});
  }, []);
  useEffect(() => {
    const urls = photos.map((photo) => URL.createObjectURL(photo));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [photos]);
  const refresh = async () => {
    const data = await creatorApi.mine();
    if (!alive.current) return;
    for (const record of data.characters)
      if (record.character) registerCommunityCharacter(record.character, false);
    setRecords(data.characters);
  };
  useEffect(() => {
    if (!user) {
      setRecords([]);
      return;
    }
    let active = true;
    const tick = () => {
      if (active && !document.hidden)
        void refresh().catch((e) => {
          if (active) setError(e.message);
        });
    };
    tick();
    const timer = setInterval(tick, generating ? 2500 : 15_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [user?.id, generating]);
  const authenticate = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const data =
        accountMode === "signup"
          ? await creatorApi.signUp(accountName, email, password)
          : await creatorApi.signIn(email, password);
      setUser(data.user);
      setPassword("");
      if (!name) setName(data.user.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos entrar.");
    } finally {
      setSubmitting(false);
    }
  };
  const addPhotos = (files: File[]) => {
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
    setError("");
    setSubmitting(true);
    try {
      if (!photos.length)
        throw new Error("Añade al menos una foto para crear tu personaje.");
      const body = new FormData();
      body.set("name", name.trim());
      body.set("description", description.trim());
      body.set("style", style);
      body.set("color", color);
      photos.forEach((photo) => body.append("photos", photo));
      const { character } = await creatorApi.create(body);
      setRecords((current) => [character, ...current]);
      setPhotos([]);
      setNotice(
        "¡Vamos! Puedes quedarte aquí o volver después. Tu progreso queda guardado.",
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos crear el personaje.",
      );
    } finally {
      setSubmitting(false);
    }
  };
  const act = async (id: string, action: "publish" | "retry" | "remove") => {
    setError("");
    setPendingAction(id + action);
    try {
      if (action === "remove") await creatorApi.remove(id);
      else await creatorApi[action](id);
      await refresh();
      if (action !== "retry") await onCatalogChange();
      if (action === "publish")
        setNotice("Publicado. Tu personaje ya está disponible para todos.");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos completar la acción.",
      );
    } finally {
      setPendingAction("");
    }
  };
  const tryFighter = (record: CreatorCharacter) => {
    if (!record.character) return;
    initAudio();
    beginMobilePlay();
    registerCommunityCharacter(record.character, false);
    setTrial(
      createMatch("caracas", [
        { fighter: record.character.id, name: record.input.name, wins: 3 },
        { fighter: "zavarce", name: "CPU", wins: 0 },
      ]),
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
              void creatorApi
                .signOut()
                .then(() => {
                  setUser(null);
                  setNotice("");
                })
                .catch((e) => setError(e.message));
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
            >
              <button
                role="tab"
                aria-selected={accountMode === "signup"}
                onClick={() => {
                  setAccountMode("signup");
                  setError("");
                }}
              >
                Crear cuenta
              </button>
              <button
                role="tab"
                aria-selected={accountMode === "signin"}
                onClick={() => {
                  setAccountMode("signin");
                  setError("");
                }}
              >
                Ya tengo cuenta
              </button>
            </div>
            <form onSubmit={authenticate}>
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
                <p className="creator-error" role="alert">
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
              <p className="creator-error" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="creator-notice" role="status">
                <Check size={16} />
                {notice}
              </p>
            )}
            <div className="creator-layout">
              <form className="creator-form" onSubmit={submit} ref={createForm}>
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
                    accept="image/jpeg,image/png,image/webp"
                    multiple
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
                  Rostro visible y buena luz. Tus fotos son privadas; se
                  comparte el personaje que publiques.
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
                    !capabilities?.generationAvailable
                  }
                >
                  {submitting ? (
                    <LoaderCircle className="creator-spinner" size={18} />
                  ) : (
                    <>
                      <PixelIcon kind="gamepad" size={20} />
                      {generating
                        ? "Tu personaje está en camino"
                        : "Crear mi luchador"}
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
                <p className="creator-hint creator-timing">
                  Tarda unos minutos. Puedes volver después; tu progreso queda
                  guardado.
                </p>
              </form>
              <aside className="creator-workbench" aria-label="Mis luchadores">
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
