import { parentPort, workerData } from "node:worker_threads";
import { DatabaseSync } from "node:sqlite";
import { RANKED_POINTS } from "../shared/ranking.ts";
import type {
  RankedFinish,
  RankedStart,
  RankingCommands,
  RankingEntry,
  RankingHistoryEntry,
  RankingReason,
  RankingReceipt,
} from "../shared/ranking.ts";

// Node 24 runs this isolated worker with native type stripping. Only built-in
// runtime imports are used, so the game's tsx/Vite loaders are not required.
const port = parentPort!;
const db = new DatabaseSync(workerData.databasePath);
db.exec(`
  PRAGMA foreign_keys=ON;
  PRAGMA busy_timeout=500;
  PRAGMA journal_mode=WAL;
  CREATE TABLE IF NOT EXISTS ranked_profiles(user_id TEXT PRIMARY KEY,name TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS ranked_matches(
    id TEXT PRIMARY KEY,
    user0 TEXT NOT NULL REFERENCES ranked_profiles(user_id),
    user1 TEXT NOT NULL REFERENCES ranked_profiles(user_id),
    fighter0 TEXT NOT NULL,fighter1 TEXT NOT NULL,stage TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('playing','finished','void')),
    winner INTEGER CHECK(winner IN (0,1)),reason TEXT,
    started_at INTEGER NOT NULL,finished_at INTEGER,
    metrics TEXT NOT NULL DEFAULT '[{"hits":0,"peakCombo":0},{"hits":0,"peakCombo":0}]',
    CHECK(user0 != user1)
  );
  CREATE INDEX IF NOT EXISTS ranked_matches_user0 ON ranked_matches(user0,finished_at DESC);
  CREATE INDEX IF NOT EXISTS ranked_matches_user1 ON ranked_matches(user1,finished_at DESC);
  CREATE TABLE IF NOT EXISTS ranked_stats(
    user_id TEXT PRIMARY KEY REFERENCES ranked_profiles(user_id),
    wins INTEGER NOT NULL DEFAULT 0,losses INTEGER NOT NULL DEFAULT 0,
    draws INTEGER NOT NULL DEFAULT 0,played INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS ranked_stats_wins ON ranked_stats(wins DESC);
`);
db.prepare(
  "UPDATE ranked_matches SET status='void',reason='server_restart',finished_at=? WHERE status='playing'",
).run(Date.now());

interface MatchRow {
  id: string;
  user0: string;
  user1: string;
  fighter0: RankingHistoryEntry["fighter"];
  fighter1: RankingHistoryEntry["fighter"];
  stage: RankingHistoryEntry["stage"];
  status: "playing" | "finished" | "void";
  winner: 0 | 1 | null;
  reason: RankingReason;
  started_at: number;
  finished_at: number;
  metrics: string;
}
const match = (id: string) =>
  db.prepare("SELECT * FROM ranked_matches WHERE id=?").get(id) as unknown as
    MatchRow | undefined;
function transaction<T>(operation: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = operation();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
function begin(start: RankedStart) {
  transaction(() => {
    if (match(start.matchId))
      throw new Error("Esa partida ya está registrada.");
    for (const player of start.players) {
      if (
        db
          .prepare(
            "SELECT 1 FROM ranked_matches WHERE status='playing' AND (user0=? OR user1=?) LIMIT 1",
          )
          .get(player.id, player.id)
      )
        throw new Error(
          "Una cuenta ya tiene una pelea clasificatoria en curso.",
        );
      db.prepare(
        "INSERT INTO ranked_profiles VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET name=excluded.name",
      ).run(player.id, player.name);
    }
    db.prepare(
      "INSERT INTO ranked_matches(id,user0,user1,fighter0,fighter1,stage,status,started_at) VALUES(?,?,?,?,?,?,'playing',?)",
    ).run(
      start.matchId,
      start.players[0].id,
      start.players[1].id,
      start.players[0].fighter,
      start.players[1].fighter,
      start.stage,
      Date.now(),
    );
  });
}
function receipt(userId: string, matchId: string): RankingReceipt | null {
  const row = match(matchId);
  if (!row || (row.user0 !== userId && row.user1 !== userId)) return null;
  if (row.status === "playing") return { matchId, status: "pending" };
  const slot = row.user0 === userId ? 0 : 1;
  const outcome =
    row.status === "void"
      ? "void"
      : row.winner === null
        ? "draw"
        : row.winner === slot
          ? "win"
          : "loss";
  return {
    matchId,
    status: row.status === "void" ? "void" : "saved",
    reason: row.reason,
    outcome,
    pointsEarned: RANKED_POINTS[outcome],
  };
}
function finish(result: RankedFinish) {
  return transaction(() => {
    const row = match(result.matchId);
    if (!row) throw new Error("La partida no está registrada.");
    if (row.status === "playing") {
      const isVoid = result.winner === null;
      db.prepare(
        "UPDATE ranked_matches SET status=?,winner=?,reason=?,finished_at=?,metrics=? WHERE id=? AND status='playing'",
      ).run(
        isVoid ? "void" : "finished",
        typeof result.winner === "number" ? result.winner : null,
        result.reason,
        Date.now(),
        JSON.stringify(
          result.players ?? [
            { hits: 0, peakCombo: 0 },
            { hits: 0, peakCombo: 0 },
          ],
        ),
        row.id,
      );
      if (!isVoid)
        [row.user0, row.user1].forEach((userId, index) => {
          const won = result.winner === index,
            draw = result.winner === "draw";
          db.prepare(
            `INSERT INTO ranked_stats(user_id,wins,losses,draws,played) VALUES(?,?,?,?,1)
          ON CONFLICT(user_id) DO UPDATE SET wins=wins+excluded.wins,losses=losses+excluded.losses,draws=draws+excluded.draws,played=played+1`,
          ).run(userId, Number(won), Number(!won && !draw), Number(draw));
        });
    }
    return [row.user0, row.user1].map((userId) => ({
      userId,
      receipt: receipt(userId, row.id)!,
    }));
  });
}
const ranked = `SELECT p.user_id AS userId,p.name,s.wins,s.losses,s.draws,s.played,
  s.wins*${RANKED_POINTS.win}+s.draws*${RANKED_POINTS.draw} AS points,
  100.0*s.wins/s.played AS winRate,
  ROW_NUMBER() OVER(ORDER BY s.wins DESC,1.0*s.wins/s.played DESC,s.played DESC,p.user_id ASC) AS position
  FROM ranked_stats s JOIN ranked_profiles p ON p.user_id=s.user_id WHERE s.played>0`;
function profile(user: { id: string; name: string }) {
  const entry = db
    .prepare(`SELECT * FROM (${ranked}) WHERE userId=?`)
    .get(user.id) as unknown as RankingEntry | undefined;
  const rows = db
    .prepare(
      `SELECT m.*,p0.name AS name0,p1.name AS name1 FROM ranked_matches m
    JOIN ranked_profiles p0 ON p0.user_id=m.user0 JOIN ranked_profiles p1 ON p1.user_id=m.user1
    WHERE (m.user0=? OR m.user1=?) AND m.status!='playing' ORDER BY m.finished_at DESC,m.id DESC LIMIT 20`,
    )
    .all(user.id, user.id) as unknown as (MatchRow & {
    name0: string;
    name1: string;
  })[];
  const history: RankingHistoryEntry[] = rows.map((row) => {
    const slot = row.user0 === user.id ? 0 : 1;
    const metrics = JSON.parse(row.metrics)[slot];
    const result = receipt(user.id, row.id)!;
    return {
      matchId: row.id,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      stage: row.stage,
      fighter: slot ? row.fighter1 : row.fighter0,
      opponentFighter: slot ? row.fighter0 : row.fighter1,
      opponent: slot ? row.name0 : row.name1,
      outcome: result.outcome!,
      reason: row.reason,
      hits: metrics.hits,
      peakCombo: metrics.peakCombo,
      pointsEarned: result.pointsEarned!,
    };
  });
  return {
    entry: entry ?? {
      userId: user.id,
      name: user.name,
      position: null,
      wins: 0,
      losses: 0,
      draws: 0,
      played: 0,
      winRate: 0,
      points: 0,
    },
    history,
  };
}
port.on(
  "message",
  ({
    id,
    type,
    args,
  }: {
    id: number;
    type: keyof RankingCommands;
    args: unknown;
  }) => {
    try {
      let value: unknown;
      if (type === "begin") value = begin(args as RankedStart);
      else if (type === "finish") value = finish(args as RankedFinish);
      else if (type === "board")
        value = {
          entries: db.prepare(`${ranked} ORDER BY position LIMIT 100`).all(),
        };
      else if (type === "profile")
        value = profile(args as { id: string; name: string });
      else if (type === "receipt") {
        const data = args as { userId: string; matchId: string };
        value = receipt(data.userId, data.matchId);
      } else if (type === "close") {
        db.prepare(
          "UPDATE ranked_matches SET status='void',reason='server_restart',finished_at=? WHERE status='playing'",
        ).run(Date.now());
        db.close();
      } else throw new Error("Unknown ranking operation");
      port.postMessage({ id, value });
      if (type === "close") port.close();
    } catch (error) {
      // Internal paths, SQL statements and account details never cross to clients.
      const busy = error instanceof Error && /locked|busy/i.test(error.message);
      port.postMessage({
        id,
        error: busy
          ? "El ranking está ocupado. Reintentando…"
          : "No pudimos guardar o consultar el ranking.",
        retryable: busy,
      });
    }
  },
);
port.postMessage({ ready: true });
