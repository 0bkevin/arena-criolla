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
    assert.equal(receipts[0].receipt.pointsEarned, 3);
    assert.equal(receipts[1].receipt.pointsEarned, 0);
    await Promise.all(
      Array.from({ length: 12 }, () =>
        store.request("finish", { ...result, winner: 1 }),
      ),
    );
    const profileA = await store.request("profile", a);
    const profileB = await store.request("profile", b);
    assert.equal(profileA.entry.wins, 1);
    assert.equal(profileA.entry.points, 3);
    assert.equal(profileB.entry.points, 0);
    assert.equal(profileA.history[0].pointsEarned, 3);
    assert.equal(profileB.history[0].pointsEarned, 0);
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
    assert.equal(interrupted.entry.points, 0);
    assert.equal(interrupted.history[0].pointsEarned, 0);
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
    assert.equal(left.entry.points, 1);
    assert.equal(right.entry.points, 1);
    assert.equal(left.history[0].pointsEarned, 1);
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
    assert.equal((await store.request("profile", a)).entry.points, 0);
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

test("existing accounts receive points from their saved statistics without rewriting them", async () => {
  const dir = await mkdtemp(join(tmpdir(), "arena-ranking-points-"));
  const file = join(dir, "arena.sqlite");
  const legacy = new DatabaseSync(file);
  legacy.exec(`
    CREATE TABLE ranked_profiles(user_id TEXT PRIMARY KEY,name TEXT NOT NULL);
    CREATE TABLE ranked_stats(
      user_id TEXT PRIMARY KEY REFERENCES ranked_profiles(user_id),
      wins INTEGER NOT NULL DEFAULT 0,losses INTEGER NOT NULL DEFAULT 0,
      draws INTEGER NOT NULL DEFAULT 0,played INTEGER NOT NULL DEFAULT 0
    );
    INSERT INTO ranked_profiles VALUES('qa-a','QA A'),('qa-b','QA B');
    INSERT INTO ranked_stats VALUES('qa-a',2,3,1,6),('qa-b',0,2,4,6);
  `);
  legacy.close();
  const store = new RankingStore(file);
  try {
    const before = await store.request("profile", a);
    assert.equal(before.entry.points, 7);
    assert.equal((await store.request("profile", b)).entry.points, 4);
    assert.equal(
      (await store.request("profile", { id: "qa-new", name: "QA Nueva" })).entry
        .points,
      0,
    );
    await store.request("begin", start("qa-forfeit-points"));
    const finish = {
      matchId: "qa-forfeit-points",
      winner: 1 as const,
      reason: "forfeit" as const,
    };
    const receipts = await store.request("finish", finish);
    assert.equal(receipts[1].receipt.pointsEarned, 3);
    await store.request("finish", finish);
    const afterA = await store.request("profile", a),
      afterB = await store.request("profile", b);
    assert.equal(afterA.entry.points, 7);
    assert.equal(afterB.entry.points, 7);
    assert.equal(afterB.entry.wins, 1);
    assert.equal(afterB.entry.draws, 4);
    assert.equal(afterB.entry.played, 7);
    assert.deepEqual(
      (await store.request("board", null)).entries.map(
        ({ userId, points }) => ({ userId, points }),
      ),
      [
        { userId: a.id, points: 7 },
        { userId: b.id, points: 7 },
      ],
    );
  } finally {
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

test("mixed verified results conserve each account's points across conflicting retries and restart", async () => {
  const dir = await mkdtemp(join(tmpdir(), "arena-ranking-adversarial-"));
  const path = join(dir, "arena.sqlite");
  let store = new RankingStore(path);
  const accounts = Array.from({ length: 7 }, (_, i) => ({
    ...a,
    id: `qa-ledger-${i}`,
    name: `QA ledger ${i}`,
  }));
  const expected = accounts.map(() => ({
    wins: 0,
    losses: 0,
    draws: 0,
    played: 0,
    points: 0,
  }));
  let seed = 1729;
  const random = (n: number) =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) % n;
  try {
    for (let index = 0; index < 160; index++) {
      const left = random(accounts.length),
        right = (left + 1 + random(accounts.length - 1)) % accounts.length;
      const winner = ([0, 1, "draw", null] as const)[random(4)];
      const matchId = `qa-ledger-match-${index}`;
      await store.request("begin", {
        ...start(matchId),
        players: [accounts[left], accounts[right]],
      });
      const pending = await store.request("receipt", {
        userId: accounts[left].id,
        matchId,
      });
      assert.equal(pending?.status, "pending");
      assert.equal(pending?.pointsEarned, undefined);
      const result = {
        matchId,
        winner,
        reason:
          winner === null
            ? ("both_disconnected" as const)
            : ("combat" as const),
      };
      const receipts = await store.request("finish", result);
      assert.deepEqual(
        await store.request("finish", {
          ...result,
          winner: winner === 0 ? 1 : 0,
        }),
        receipts,
      );
      [left, right].forEach((account, slot) => {
        const points =
          winner === null ? 0 : winner === "draw" ? 1 : winner === slot ? 3 : 0;
        assert.equal(receipts[slot].receipt.pointsEarned, points);
        expected[account].points += points;
        if (winner !== null) {
          expected[account].played++;
          if (winner === "draw") expected[account].draws++;
          else if (winner === slot) expected[account].wins++;
          else expected[account].losses++;
        }
      });
      if (index === 79) {
        await store.close();
        store = new RankingStore(path);
      }
    }
    const board = (await store.request("board", null)).entries;
    for (const [index, account] of accounts.entries()) {
      const profile = await store.request("profile", account);
      for (const key of [
        "wins",
        "losses",
        "draws",
        "played",
        "points",
      ] as const)
        assert.equal(
          profile.entry[key],
          expected[index][key],
          `${account.name}: ${key}`,
        );
      assert.equal(
        board.find((row) => row.userId === account.id)?.points,
        expected[index].points,
      );
      assert.ok(
        profile.history.every(
          (match) =>
            match.pointsEarned ===
            (match.outcome === "win" ? 3 : match.outcome === "draw" ? 1 : 0),
        ),
      );
    }
    assert.ok(expected.some((account) => account.wins > 0));
    assert.ok(expected.some((account) => account.draws > 0));
  } finally {
    await store.close();
    await rm(dir, { recursive: true, force: true });
  }
});
