import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import {
  CreatorDraftStorage,
  DraftConflictError,
  type CreatorDraft,
} from "../src/creator-draft";

const draft = (
  name = "Pana",
  requestKey = crypto.randomUUID(),
): CreatorDraft => ({
  name,
  description: "Soy salsero y fan de las arepas.",
  style: "technical",
  color: "#669bff",
  requestKey,
  photos: [
    new File([new Uint8Array([1, 2, 3])], "private-face.jpg", {
      type: "image/jpeg",
      lastModified: 123,
    }),
  ],
});
async function rawWrite(value: unknown) {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const open = indexedDB.open("arena-creator-drafts", 1);
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("drafts", "readwrite");
      tx.objectStore("drafts").put(value);
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

test("draft fields, exact pending UUID and private photo bytes survive reopening and remain scoped by owner", async () => {
  const owner = crypto.randomUUID();
  const original = { ...draft(), submitted: true };
  const tab = new CreatorDraftStorage(owner);
  assert.equal((await tab.load()).draft, null);
  await tab.save(original);
  const reopened = await new CreatorDraftStorage(owner).load();
  assert.equal(reopened.corrupt, false);
  assert.equal(reopened.draft?.requestKey, original.requestKey);
  assert.equal(reopened.draft?.submitted, true);
  assert.equal(reopened.draft?.name, original.name);
  assert.equal(reopened.draft?.photos[0].name, "private-face.jpg");
  assert.equal(reopened.draft?.photos[0].lastModified, 123);
  assert.deepEqual(
    [...new Uint8Array(await reopened.draft!.photos[0].arrayBuffer())],
    [1, 2, 3],
  );
  assert.equal(
    (await new CreatorDraftStorage(crypto.randomUUID()).load()).draft,
    null,
  );
});

test("a stale tab cannot overwrite or discard another tab's newer photo draft", async () => {
  const owner = crypto.randomUUID();
  const initial = new CreatorDraftStorage(owner);
  await initial.load();
  await initial.save(draft("Initial"));
  const a = new CreatorDraftStorage(owner),
    b = new CreatorDraftStorage(owner);
  await Promise.all([a.load(), b.load()]);
  const latest = draft("New saved photos");
  await a.save(latest);
  await assert.rejects(b.save(draft("Stale tab")), DraftConflictError);
  await assert.rejects(b.clear(), DraftConflictError);
  assert.equal(
    (await new CreatorDraftStorage(owner).load()).draft?.requestKey,
    latest.requestKey,
  );
  assert.equal(
    (await b.load()).draft?.name,
    latest.name,
    "explicit reload reconciles a conflicting tab",
  );
  await b.clear();
  assert.equal((await new CreatorDraftStorage(owner).load()).draft, null);
});

test("autosaves and discard execute in order and cannot resurrect the discarded draft", async () => {
  const owner = crypto.randomUUID();
  const tab = new CreatorDraftStorage(owner);
  await tab.load();
  await Promise.all([
    tab.save(draft("One")),
    tab.save(draft("Two")),
    tab.clear(),
  ]);
  assert.equal((await new CreatorDraftStorage(owner).load()).draft, null);
});

test("an aborted storage write preserves the committed draft and does not poison subsequent saves", async () => {
  const owner = crypto.randomUUID();
  const tab = new CreatorDraftStorage(owner);
  await tab.load();
  await tab.save(draft("Committed"));
  const put = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function () {
    this.transaction.abort();
    return {} as IDBRequest;
  };
  try {
    await assert.rejects(tab.save(draft("Quota failed")), /could not be saved/);
  } finally {
    IDBObjectStore.prototype.put = put;
  }
  assert.equal(
    (await new CreatorDraftStorage(owner).load()).draft?.name,
    "Committed",
  );
  await tab.save(draft("Recovered"));
  assert.equal(
    (await new CreatorDraftStorage(owner).load()).draft?.name,
    "Recovered",
  );
});

test("corrupt photo records fail closed with a visible corruption result and can be explicitly replaced", async () => {
  const owner = crypto.randomUUID();
  const tab = new CreatorDraftStorage(owner);
  await tab.load();
  const input = draft();
  await rawWrite({
    owner,
    version: 1,
    input,
    requestKey: input.requestKey,
    photos: [null],
  });
  const reopened = new CreatorDraftStorage(owner);
  assert.deepEqual(await reopened.load(), { draft: null, corrupt: true });
  await reopened.save(draft("Repaired"));
  assert.equal(
    (await new CreatorDraftStorage(owner).load()).draft?.name,
    "Repaired",
  );
});

test("nonprimitive corrupt metadata remains recoverable instead of conflicting with its own structured clone", async () => {
  for (const metadata of [
    { writeId: { corrupt: true } },
    { writeId: ["corrupt"] },
    { requestKey: { corrupt: true } },
    { requestKey: ["corrupt"] },
  ]) {
    const owner = crypto.randomUUID();
    const tab = new CreatorDraftStorage(owner);
    await tab.load();
    const input = draft();
    await rawWrite({
      owner,
      version: 1,
      input,
      requestKey: input.requestKey,
      photos: [],
      ...metadata,
    });
    const corrupt = new CreatorDraftStorage(owner);
    assert.deepEqual(await corrupt.load(), { draft: null, corrupt: true });
    await corrupt.clear();
    assert.equal((await new CreatorDraftStorage(owner).load()).draft, null);
    await rawWrite({
      owner,
      version: 1,
      input,
      requestKey: input.requestKey,
      photos: [],
      ...metadata,
    });
    await corrupt.load();
    await corrupt.save(draft("Repaired metadata"));
    assert.equal(
      (await new CreatorDraftStorage(owner).load()).draft?.name,
      "Repaired metadata",
    );
  }
});
