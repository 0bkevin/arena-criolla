import { useEffect, useState } from "react";
import type {
  ArenaAccount,
  RankingEntry,
  RankingHistoryEntry,
} from "../../shared/ranking";
import { fighterById } from "../../shared/content";
import { creatorRequest } from "../creator-api";
import { Modal } from "./Modal";

const resultLabels = {
  win: "Victoria",
  loss: "Derrota",
  draw: "Empate",
  void: "Anulada",
};
const reasonLabels = {
  combat: "Combate",
  forfeit: "Abandono",
  both_disconnected: "Ambos desconectados",
  server_restart: "Interrupción del servidor",
  start_cancelled: "Inicio cancelado",
};
export function RankingDialog({
  account,
  revision,
  onClose,
  onAccount,
}: {
  account: ArenaAccount | null;
  revision: number;
  onClose: () => void;
  onAccount?: () => void;
}) {
  const [entries, setEntries] = useState<RankingEntry[]>([]),
    [me, setMe] = useState<RankingEntry | null>(null);
  const [history, setHistory] = useState<RankingHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setMe(null);
    setHistory([]);
    void Promise.all([
      creatorRequest<{ entries: RankingEntry[] }>("/api/ranking", {
        signal: controller.signal,
      }),
      account
        ? creatorRequest<{
            entry: RankingEntry;
            history: RankingHistoryEntry[];
          }>("/api/ranking/me", { signal: controller.signal })
        : Promise.resolve(null),
    ])
      .then(([board, profile]) => {
        if (!alive) return;
        setEntries(board.entries);
        setMe(profile?.entry ?? null);
        setHistory(profile?.history ?? []);
      })
      .catch((error) => {
        if (alive) setError(error.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [account?.id, revision, refresh]);
  return (
    <Modal title="Ranking global" wide onClose={onClose}>
      <p className="modal-intro">
        Victorias en clasificatorias verificadas por el servidor. Desempates por
        porcentaje de victorias, partidas jugadas y un orden estable de cuenta.
      </p>
      <div className="ranking-toolbar">
        <span>TOP 100</span>
        <button
          className="secondary-button"
          disabled={loading}
          onClick={() => setRefresh((value) => value + 1)}
        >
          Actualizar ranking
        </button>
      </div>
      {loading ? (
        <p role="status">Cargando clasificación…</p>
      ) : error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : (
        <>
          {me && (
            <div className="ranking-self" aria-label="Tu clasificación">
              <strong>
                {me.position
                  ? `#${me.position} · ${me.name}`
                  : `${me.name} · Sin clasificar`}
              </strong>
              <span>
                {me.wins} {me.wins === 1 ? "victoria" : "victorias"} ·{" "}
                {me.losses} {me.losses === 1 ? "derrota" : "derrotas"} ·{" "}
                {me.draws} {me.draws === 1 ? "empate" : "empates"} · {me.played}{" "}
                {me.played === 1 ? "partida" : "partidas"}
              </span>
            </div>
          )}
          {entries.length ? (
            <div
              className="ranking-table-wrap"
              role="region"
              aria-label="Tabla de clasificación"
              tabIndex={0}
            >
              <table className="ranking-table">
                <caption className="sr-only">
                  Clasificación global por victorias
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Posición</th>
                    <th scope="col">Jugador</th>
                    <th scope="col">Victorias</th>
                    <th scope="col">Derrotas</th>
                    <th scope="col">Empates</th>
                    <th scope="col">% victorias</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr
                      key={entry.userId}
                      className={
                        entry.userId === account?.id ? "is-you" : undefined
                      }
                    >
                      <td>#{entry.position}</td>
                      <th scope="row">
                        {entry.name}
                        {entry.userId === account?.id ? " (tú)" : ""}
                      </th>
                      <td>{entry.wins}</td>
                      <td>{entry.losses}</td>
                      <td>{entry.draws}</td>
                      <td>{entry.winRate.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="ranking-empty">
              Todavía no hay clasificatorias terminadas. ¡La primera victoria
              puede ser tuya!
            </p>
          )}
          {account && (
            <section
              className="ranking-history"
              aria-label="Tus últimas partidas"
            >
              <h3>Tus últimas partidas</h3>
              {history.length ? (
                <ol>
                  {history.map((match) => (
                    <li key={match.matchId}>
                      <div>
                        <strong className={`ranking-outcome ${match.outcome}`}>
                          {resultLabels[match.outcome]}
                        </strong>
                        <span>vs. {match.opponent}</span>
                      </div>
                      <p>
                        {fighterById(match.fighter).shortName} vs.{" "}
                        {fighterById(match.opponentFighter).shortName} ·{" "}
                        {reasonLabels[match.reason]}
                      </p>
                      <small>
                        {new Date(match.finishedAt).toLocaleString("es")} ·{" "}
                        {match.hits} {match.hits === 1 ? "golpe" : "golpes"} ·
                        Racha {match.peakCombo}
                      </small>
                    </li>
                  ))}
                </ol>
              ) : (
                <p>
                  Tus clasificatorias aparecerán aquí. Las partidas casuales y
                  el progreso anterior del navegador no cuentan para el ranking.
                </p>
              )}
            </section>
          )}
        </>
      )}
      {!account && (
        <div className="ranking-signin">
          <p>Entra con tu cuenta para participar y consultar tu historial.</p>
          {onAccount && (
            <button className="primary-button" onClick={onAccount}>
              Iniciar sesión o crear cuenta
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}
