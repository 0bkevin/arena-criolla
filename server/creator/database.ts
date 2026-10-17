import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type {
  CharacterInput,
  CommunityCharacter,
  CreationStatus,
  CreatorCharacter,
  CreatorUser,
} from "../../shared/creator";

export interface StoredCharacter {
  id: string;
  owner_id: string;
  input: string;
  photos: string;
  status: CreationStatus;
  progress: number;
  message: string;
  design: string | null;
  source_path: string | null;
  character: string | null;
  created_at: number;
  updated_at: number;
}
export class CreatorDatabase {
  readonly db: DatabaseSync;
  constructor(file: string) {
    if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db
      .exec(`PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS characters(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),input TEXT NOT NULL,photos TEXT NOT NULL,status TEXT NOT NULL,progress INTEGER NOT NULL DEFAULT 0,message TEXT NOT NULL,design TEXT,source_path TEXT,character TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS characters_owner ON characters(owner_id,created_at);
      CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
      CREATE TABLE IF NOT EXISTS generation_attempts(owner_id TEXT NOT NULL REFERENCES users(id),started_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS generation_attempts_time ON generation_attempts(started_at);
    `);
  }
  createUser(user: CreatorUser, passwordHash: string) {
    this.db
      .prepare("INSERT INTO users VALUES(?,?,?,?,?)")
      .run(user.id, user.name, user.email, passwordHash, Date.now());
  }
  createAccount(
    user: CreatorUser,
    passwordHash: string,
    session: { tokenHash: string; expiresAt: number },
  ) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.createUser(user, passwordHash);
      this.saveSession(session.tokenHash, user.id, session.expiresAt);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  userByEmail(email: string) {
    return this.db.prepare("SELECT * FROM users WHERE email=?").get(email) as
      (CreatorUser & { password_hash: string }) | undefined;
  }
  session(tokenHash: string) {
    const row = this.db
      .prepare(
        "SELECT u.id,u.name,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?",
      )
      .get(tokenHash, Date.now());
    return row as unknown as CreatorUser | undefined;
  }
  saveSession(tokenHash: string, userId: string, expires: number) {
    this.db.prepare("DELETE FROM sessions WHERE expires_at<?").run(Date.now());
    this.db
      .prepare("INSERT INTO sessions VALUES(?,?,?)")
      .run(tokenHash, userId, expires);
  }
  deleteSession(tokenHash: string) {
    this.db.prepare("DELETE FROM sessions WHERE token_hash=?").run(tokenHash);
  }
  createCharacter(
    id: string,
    owner: string,
    input: CharacterInput,
    photos: string[],
  ) {
    const now = Date.now();
    this.db
      .prepare(
        "INSERT INTO characters(id,owner_id,input,photos,status,message,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)",
      )
      .run(
        id,
        owner,
        JSON.stringify(input),
        JSON.stringify(photos),
        "queued",
        "Tu personaje está en la cola.",
        now,
        now,
      );
    return this.character(id)!;
  }
  generationBudget(
    owner: string,
    globalLimit: number,
    userLimit: number,
    reserve = false,
    onReserve?: () => void,
  ) {
    // A rolling 24-hour ledger survives retries, deleted characters and restarts.
    const since = Date.now() - 24 * 60 * 60 * 1000;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const counts = this.db
        .prepare(
          "SELECT COUNT(*) AS total,COALESCE(SUM(owner_id=?),0) AS owned FROM generation_attempts WHERE started_at>?",
        )
        .get(owner, since) as { total: number; owned: number };
      const allowed = counts.total < globalLimit && counts.owned < userLimit;
      if (allowed && reserve) {
        this.db
          .prepare("DELETE FROM generation_attempts WHERE started_at<=?")
          .run(since);
        this.db
          .prepare("INSERT INTO generation_attempts VALUES(?,?)")
          .run(owner, Date.now());
        onReserve?.();
      }
      this.db.exec("COMMIT");
      return allowed;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  character(id: string) {
    return this.db
      .prepare("SELECT * FROM characters WHERE id=?")
      .get(id) as unknown as StoredCharacter | undefined;
  }
  owned(owner: string) {
    return this.db
      .prepare(
        "SELECT * FROM characters WHERE owner_id=? AND status!='archived' ORDER BY created_at DESC",
      )
      .all(owner) as unknown as StoredCharacter[];
  }
  update(
    id: string,
    patch: Partial<
      Pick<
        StoredCharacter,
        | "status"
        | "progress"
        | "message"
        | "design"
        | "source_path"
        | "character"
      >
    >,
  ) {
    const entries = Object.entries(patch);
    if (!entries.length) return;
    const allowed = new Set([
      "status",
      "progress",
      "message",
      "design",
      "source_path",
      "character",
    ]);
    if (entries.some(([key]) => !allowed.has(key)))
      throw new Error("Invalid patch");
    this.db
      .prepare(
        `UPDATE characters SET ${entries.map(([key]) => `${key}=?`).join(",")},updated_at=? WHERE id=?`,
      )
      .run(...entries.map(([, value]) => value ?? null), Date.now(), id);
  }
  published() {
    return this.db
      .prepare(
        "SELECT c.*,u.name as creator_name FROM characters c JOIN users u ON c.owner_id=u.id WHERE c.status='published' ORDER BY c.created_at",
      )
      .all() as unknown as (StoredCharacter & { creator_name: string })[];
  }
  pending() {
    return this.db
      .prepare(
        "SELECT * FROM characters WHERE status IN ('queued','designing','drawing','packing','testing') ORDER BY created_at",
      )
      .all() as unknown as StoredCharacter[];
  }
  deleteCharacter(id: string) {
    this.db.prepare("DELETE FROM characters WHERE id=?").run(id);
  }
  view(row: StoredCharacter): CreatorCharacter {
    return {
      id: row.id,
      input: JSON.parse(row.input),
      status: row.status,
      progress: row.progress,
      message: row.message,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      character: row.character
        ? (JSON.parse(row.character) as CommunityCharacter)
        : null,
      photoUrls: (JSON.parse(row.photos) as string[]).map(
        (_, index) => `/api/creator/characters/${row.id}/photos/${index}`,
      ),
    };
  }
  close() {
    this.db.close();
  }
}
