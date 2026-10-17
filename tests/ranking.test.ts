import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { RankingStore } from "../server/ranking";
import type { RankedStart } from "../shared/ranking";

const a = { id: "qa-a", name: "QA A", fighter: "zavarce" as const };
const b = { id: "qa-b", name: "QA B", fighter: "capriles" as const };
const start = (matchId: string): RankedStart => ({
  matchId,
  stage: "caracas",
  players: [a, b],
});

test("ranking request bursts are bounded and recover without blocking the arena", async () => {
  const store = new RankingStore(":memory:");
  try {
    await store.request("board", null);
    const results = await Promise.allSettled(
      Array.from({ length: 400 }, () => store.request("board", null)),
    );
    assert.ok(results.some((result) => result.status === "rejected"));
    assert.ok(results.some((result) => result.status === "fulfilled"));
    assert.deepEqual((await store.request("board", null)).entries, []);
  } finally {
    await store.close();
  }
});

test("ranked results commit once, keep both players consistent and survive a restart", async () => {
  const dir = await mkdtemp(join(tmpdir(), "arena-ranking-"));
  let store = new RankingStore(join(dir, "arena.sqlite"));
  try {
    await store.request("begin", start("qa-match"));
    assert.deepEqual((await store.request("board", null)).entries, []);
    const result = {
      matchId: "qa-match",
      winner: 0 as const,
      reason: "combat" as const,
      players: [
        { hits: 9, peakCombo: 5 },
        { hits: 2, peakCombo: 2 },
      ] as [
        { hits: number; peakCombo: number },
        { hits: number; peakCombo: number },
      ],
    };
    const receipts = await store.request("finish", result);
    assert.equal(receipts[0].receipt.outcome, "win");
    assert.equal(receipts[1].receipt.outcome, "loss");
    await Promise.all(
      Array.from({ length: 12 }, () =>
        store.request("finish", { ...result, winner: 1 }),
      ),
    );
    const profileA = await store.request("profile", a);
    const profileB = await store.request("profile", b);
    assert.equal(profileA.entry.wins, 1);
    assert.equal(profileA.entry.played, 1);
    assert.equal(profileB.entry.losses, 1);
    assert.equal(profileB.entry.played, 1);
    assert.equal(profileA.history[0].hits, 9);
    assert.equal(profileA.history[0].peakCombo, 5);
    assert.equal(profileB.history[0].outcome, "loss");
    assert.equal(
      await store.request("receipt", {
        userId: "another-account",
        matchId: result.matchId,
      }),
      null,
    );
    await store.close();
    store = new RankingStore(join(dir, "arena.sqlite"));
    assert.deepEqual(await store.request("profile", a), profileA);
    assert.deepEqual(await store.request("profile", b), profileB);
    assert.equal((await store.request("board", null)).entries[0].userId, a.id);
  } finally {
    await store.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("interrupted matches are void, draws count for both and a player cannot enter two active matches", async () => {
  const dir = await mkdtemp(join(tmpdir(), "arena-ranking-"));
  let store = new RankingStore(join(dir, "arena.sqlite"));
  try {
    await store.request("begin", start("interrupted"));
    await assert.rejects(
      store.request("begin", {
        ...start("overlap"),
        players: [a, { ...b, id: "qa-c" }],
      }),
    );
    await store.close();
    store = new RankingStore(join(dir, "arena.sqlite"));
    const interrupted = await store.request("profile", a);
    assert.equal(interrupted.entry.played, 0);
    assert.equal(interrupted.history[0].outcome, "void");
    assert.equal(interrupted.history[0].reason, "server_restart");
    await store.request("begin", start("draw"));
    await store.request("finish", {
      matchId: "draw",
      winner: "draw",
      reason: "combat",
    });
    const left = await store.request("profile", a),
      right = await store.request("profile", b);
    assert.equal(left.entry.draws, 1);
    assert.equal(right.entry.draws, 1);
    assert.equal(left.entry.played, 1);
    assert.equal(right.entry.played, 1);
    assert.equal((await store.request("board", null)).entries.length, 2);
  } finally {
    await store.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("a locked ranking database does not block the main event loop and can retry safely", async () => {
  const dir = await mkdtemp(join(tmpdir(), "arena-ranking-"));
  const file = join(dir, "arena.sqlite"),
    store = new RankingStore(file);
  let lock: DatabaseSync | undefined;
  try {
    await store.request("begin", start("locked"));
    lock = new DatabaseSync(file);
    lock.exec("BEGIN IMMEDIATE");
    const writing = store
      .request("finish", { matchId: "locked", winner: 0, reason: "combat" })
      .then(
        () => "saved",
        () => "busy",
      );
    const before = performance.now();
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.ok(
      performance.now() - before < 250,
      "the database wait must remain in its worker",
    );
    assert.equal(await writing, "busy");
    lock.exec("ROLLBACK");
    await store.request("finish", {
      matchId: "locked",
      winner: 0,
      reason: "combat",
    });
    assert.equal((await store.request("profile", a)).entry.wins, 1);
  } finally {
    lock?.close();
    await store.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("a failure between player updates rolls back the match and both statistics", async () => {
  const dir = await mkdtemp(join(tmpdir(), "arena-ranking-"));
  const file = join(dir, "arena.sqlite"),
    store = new RankingStore(file);
  let db: DatabaseSync | undefined;
  try {
    await store.request("begin", start("atomic"));
    db = new DatabaseSync(file);
    db.exec(
      "CREATE TRIGGER qa_fail_stats BEFORE INSERT ON ranked_stats WHEN NEW.user_id='qa-b' BEGIN SELECT RAISE(ABORT,'QA atomic failure'); END;",
    );
    await assert.rejects(
      store.request("finish", {
        matchId: "atomic",
        winner: 0,
        reason: "combat",
      }),
    );
    assert.equal((await store.request("profile", a)).entry.played, 0);
    assert.equal((await store.request("profile", b)).entry.played, 0);
    assert.equal(
      (await store.request("receipt", { userId: a.id, matchId: "atomic" }))
        ?.status,
      "pending",
    );
    db.exec("DROP TRIGGER qa_fail_stats");
    await store.request("finish", {
      matchId: "atomic",
      winner: 0,
      reason: "combat",
    });
    assert.equal((await store.request("profile", a)).entry.wins, 1);
    assert.equal((await store.request("profile", b)).entry.losses, 1);
  } finally {
    db?.close();
    await store.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("top100 excludes lower positions while a player's own rank and twenty latest matches remain available", async () => {
  const store = new RankingStore(":memory:");
  try {
    for (let i = 0; i < 100; i++) {
      const matchId = `top-${i}`;
      await store.request("begin", {
        ...start(matchId),
        players: [a, { ...b, id: `qa-opponent-${i}` }],
      });
      await store.request("finish", { matchId, winner: 1, reason: "combat" });
    }
    const board = await store.request("board", null),
      mine = await store.request("profile", a);
    assert.equal(board.entries.length, 100);
    assert.equal(
      board.entries.some((entry) => entry.userId === a.id),
      false,
    );
    assert.equal(mine.entry.position, 101);
    assert.equal(mine.entry.losses, 100);
    assert.equal(mine.history.length, 20);
  } finally {
    await store.close();
  }
});
