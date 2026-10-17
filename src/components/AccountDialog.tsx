import { useState, type FormEvent } from "react";
import { creatorApi } from "../creator-api";
import type { ArenaAccount } from "../../shared/ranking";
import type { usePlayerRanking } from "../player-ranking";
import { Modal } from "./Modal";

export function AccountDialog({
  account,
  ranking,
  onRanking,
  onClose,
  onChanged,
}: {
  account: ArenaAccount | null;
  ranking: ReturnType<typeof usePlayerRanking>;
  onRanking: () => void;
  onClose: () => void;
  onChanged: (account: ArenaAccount | null) => void;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const result =
        mode === "signup"
          ? await creatorApi.signUp(name, email, password)
          : await creatorApi.signIn(email, password);
      setPassword("");
      onChanged(result.user);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "No pudimos entrar. Inténtalo de nuevo.",
      );
    } finally {
      setPending(false);
    }
  };
  return (
    <Modal
      title={account ? "Tu cuenta" : "Tu lugar en el ranking"}
      onClose={onClose}
    >
      {account ? (
        <div className="arena-account-form">
          <p>
            Has entrado como <strong>{account.name}</strong>. Tus
            clasificatorias se guardan en esta cuenta.
          </p>
          <div className="ranking-self" aria-label="Tu puntaje">
            {ranking.loading ? (
              <span role="status">Cargando puntaje…</span>
            ) : ranking.entry ? (
              <>
                <strong>{ranking.entry.points} puntos</strong>
                <span>
                  {ranking.entry.wins}{" "}
                  {ranking.entry.wins === 1 ? "victoria" : "victorias"} ·{" "}
                  {ranking.entry.draws}{" "}
                  {ranking.entry.draws === 1 ? "empate" : "empates"} ·{" "}
                  {ranking.entry.losses}{" "}
                  {ranking.entry.losses === 1 ? "derrota" : "derrotas"}
                </span>
              </>
            ) : (
              <>
                <p className="form-error" role="alert">
                  {ranking.error}
                </p>
                <button className="secondary-button" onClick={ranking.refresh}>
                  Reintentar puntaje
                </button>
              </>
            )}
          </div>
          <p className="modal-intro">
            3 puntos por victoria, 1 por empate y 0 por derrota. Solo cuentan
            las clasificatorias verificadas; las anuladas no suman.
          </p>
          <button className="secondary-button" onClick={onRanking}>
            Ver ranking e historial
          </button>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="secondary-button"
            disabled={pending}
            onClick={() => {
              setPending(true);
              setError("");
              void creatorApi
                .signOut()
                .then(() => onChanged(null))
                .catch((error) => setError(error.message))
                .finally(() => setPending(false));
            }}
          >
            {pending ? "Cerrando…" : "Cerrar sesión"}
          </button>
        </div>
      ) : (
        <>
          <p className="modal-intro">
            Usa la misma cuenta del taller para guardar tus clasificatorias y
            consultar tu historial desde otros dispositivos.
          </p>
          <div
            className="account-tabs"
            role="tablist"
            aria-label="Acceso a tu cuenta"
          >
            <button
              role="tab"
              aria-selected={mode === "signin"}
              onClick={() => {
                setMode("signin");
                setError("");
              }}
            >
              Iniciar sesión
            </button>
            <button
              role="tab"
              aria-selected={mode === "signup"}
              onClick={() => {
                setMode("signup");
                setError("");
              }}
            >
              Crear cuenta
            </button>
          </div>
          <form className="arena-account-form" onSubmit={submit}>
            {mode === "signup" && (
              <label htmlFor="arena-account-name">
                Nombre público
                <input
                  id="arena-account-name"
                  className="plain-input"
                  autoComplete="nickname"
                  required
                  minLength={2}
                  maxLength={24}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
            )}
            <label htmlFor="arena-account-email">
              Correo
              <input
                id="arena-account-email"
                className="plain-input"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label htmlFor="arena-account-password">
              Contraseña
              <input
                id="arena-account-password"
                className="plain-input"
                type="password"
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                required
                minLength={8}
                maxLength={128}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="primary-button" disabled={pending}>
              {pending
                ? "Entrando…"
                : mode === "signup"
                  ? "Crear cuenta y entrar"
                  : "Entrar"}
            </button>
          </form>
          <p className="modal-intro">
            Puedes seguir jugando partidas casuales sin cuenta.
          </p>
        </>
      )}
    </Modal>
  );
}
