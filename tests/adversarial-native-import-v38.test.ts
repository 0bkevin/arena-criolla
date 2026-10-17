import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
  symlink,
  rename,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { watch } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import {
  nativeRunner,
  disabledMcpOverrides,
  codexEnvironment,
} from "../scripts/creator-codex/native";
import { packCodexJob } from "../scripts/creator-codex/workflow";
import {
  readAssetBundle,
  readLimited,
  sha256,
  openDirectory,
  directoryPath,
} from "../server/creator/asset-bundle";
import { importCharacterAssets } from "../server/creator/import-assets";
import { CreatorDatabase } from "../server/creator/database";
import { normalizeGeneratedAtlas } from "../server/creator/normalize-atlas";
import { packCharacterSprites } from "../server/creator/sprites";

const input = {
  name: "Pana QA",
  description: "Chaqueta clara con pantalones azules.",
  style: "agile",
  color: "#ee7c34",
};
const design = {
  title: "Pana del barrio",
  specialName: "Paso orbital",
  outfit: "Chaqueta clara con pantalones azules.",
  likeness: "Cabello corto y rostro visible.",
  welcome: "Saludo con la mano",
  welcomeStyle: "wave",
  combos: ["Primer paso", "Segundo paso", "Gran remate"],
};
const id = "custom_11111111111111111111111111111111";
async function atlas(duplicate = false) {
  return sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="512">${Array.from({ length: 8 }, (_, i) => `<rect x="${(i % 4) * 192 + 50}" y="${Math.floor(i / 4) * 256 + 25}" width="${90 + (duplicate ? 0 : i * 2)}" height="210" rx="20" fill="#527fab"/>`).join("")}</svg>`,
    ),
  )
    .png()
    .toBuffer();
}
async function fixture(t: TestContext) {
  const root = await mkdtemp(
    path.join(os.tmpdir(), "arena-native-adversarial-"),
  );
  t.after(() => rm(root, { recursive: true, force: true }));
  const bundleDir = path.join(root, "bundle");
  const dataDir = path.join(root, "data");
  await mkdir(bundleDir);
  const source = await atlas();
  await writeFile(path.join(bundleDir, "generated.png"), source);
  await writeFile(
    path.join(bundleDir, "manifest.json"),
    JSON.stringify({
      version: 1,
      generator: "codex-chatgpt",
      id,
      input,
      design,
      source: "generated.png",
      sha256: sha256(source),
    }),
  );
  const db = new CreatorDatabase(path.join(dataDir, "arena.sqlite"));
  db.createUser(
    { id: "owner", name: "Owner", email: "owner@example.test" },
    "fixture-only",
  );
  db.close();
  return {
    root,
    bundleDir,
    dataDir,
    ownerEmail: "owner@example.test",
    environment: "prod-tst",
  };
}

test("native explicit image paths cannot substitute another thread or a symlink receipt", async (t) => {
  const f = await fixture(t);
  const executable = path.join(f.root, "codex-fixture.mjs");
  const saved = [process.env.CODEX_HOME, process.env.ARENA_CODEX_PATH];
  t.after(() => {
    for (const [i, name] of ["CODEX_HOME", "ARENA_CODEX_PATH"].entries()) {
      if (saved[i] === undefined) delete process.env[name];
      else process.env[name] = saved[i];
    }
  });
  await writeFile(
    executable,
    `#!/usr/bin/env node
import { mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
if(process.argv.includes('mcp')) { console.log('[]'); process.exit(0); }
let scenario=''; for await (const chunk of process.stdin) scenario+=chunk;
const id='018f1717-1717-4717-8717-000000000001';
const root=process.env.CODEX_HOME+'/generated_images';
mkdirSync(root+'/'+id,{recursive:true}); mkdirSync(root+'/other-thread',{recursive:true});
writeFileSync(root+'/other-thread/exec-foreign.png','fixture');
const own=root+'/'+id+'/exec-one.png';
if(scenario==='symlink')symlinkSync(root+'/other-thread/exec-foreign.png',own);
const file=scenario==='symlink'?own:root+'/other-thread/exec-foreign.png';
console.log(JSON.stringify({type:'thread.started',thread_id:id}));
console.log(JSON.stringify({type:'item.completed',item:{id:'reply',type:'agent_message',text:JSON.stringify({generatedImagePath:file})}}));
console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:1,cached_input_tokens:0,output_tokens:1}}));
`,
    { mode: 0o700 },
  );
  process.env.ARENA_CODEX_PATH = executable;
  process.env.CODEX_HOME = f.root;
  const run = nativeRunner("chatgpt-plan-and-credits");
  for (const prompt of ["foreign", "symlink"]) {
    assert.deepEqual(
      await run({
        prompt,
        photos: [],
        directory: f.root,
        outputSchema: {
          type: "object",
          properties: { generatedImagePath: { type: ["string", "null"] } },
          required: ["generatedImagePath"],
          additionalProperties: false,
        },
        signal: AbortSignal.timeout(5000),
      }),
      { generatedImagePath: null },
      prompt,
    );
  }
});

test("import cannot follow its characters directory outside private storage", async (t) => {
  const f = await fixture(t);
  const external = path.join(f.root, "external");
  await mkdir(external);
  await symlink(external, path.join(f.dataDir, "characters"));
  await assert.rejects(
    importCharacterAssets(f),
    /symlink|directory|symbolic|ELOOP|ENOTDIR/i,
  );
  assert.deepEqual(await readdir(external), []);
});

test("import resolves private storage aliases before rejecting a public destination", async (t) => {
  const f = await fixture(t);
  const publicDir = await mkdtemp(
    path.resolve("public", ".import-adversarial-"),
  );
  t.after(() => rm(publicDir, { recursive: true, force: true }));
  const db = new CreatorDatabase(path.join(publicDir, "arena.sqlite"));
  db.createUser(
    { id: "owner", name: "Owner", email: f.ownerEmail },
    "fixture-only",
  );
  db.close();
  const alias = path.join(f.root, "public-alias");
  await symlink(publicDir, alias);
  await assert.rejects(
    importCharacterAssets({ ...f, dataDir: alias }),
    /public|dist|symlink|symbolic|ELOOP|ENOTDIR/i,
  );
  assert.equal(
    (await readdir(publicDir)).some((name) => name === "characters"),
    false,
  );
});

test("import rejects a symlinked database before modifying another storage root", async (t) => {
  const f = await fixture(t);
  const aliasDir = path.join(f.root, "alias-data");
  await mkdir(aliasDir);
  await symlink(
    path.join(f.dataDir, "arena.sqlite"),
    path.join(aliasDir, "arena.sqlite"),
  );
  await assert.rejects(
    importCharacterAssets({ ...f, dataDir: aliasDir }),
    /symlink|symbolic|ELOOP|regular/i,
  );
  const db = new CreatorDatabase(path.join(f.dataDir, "arena.sqlite"));
  assert.equal(db.character(id), undefined);
  db.close();
});

test("bounded reads reject symlinks even when their target is a valid small file", async (t) => {
  const f = await fixture(t);
  const alias = path.join(f.root, "alias.json");
  await symlink(path.join(f.bundleDir, "manifest.json"), alias);
  await assert.rejects(readLimited(alias, 32768), /symlink|symbolic|ELOOP/i);
  assert.deepEqual(
    await readLimited(
      path.join(f.bundleDir, "generated.png"),
      32 * 1024 * 1024,
    ),
    await readFile(path.join(f.bundleDir, "generated.png")),
  );
});

test("bundle rejects in-directory source symlinks rather than accepting resolved aliases", async (t) => {
  const f = await fixture(t);
  await writeFile(path.join(f.bundleDir, "alias.png"), await atlas());
  await rm(path.join(f.bundleDir, "generated.png"));
  await symlink("alias.png", path.join(f.bundleDir, "generated.png"));
  await assert.rejects(readAssetBundle(f.bundleDir), /symlink|symbolic|ELOOP/i);
});

test("manual repacking cannot follow a bundle symlink and erase outside manifests", async (t) => {
  const f = await fixture(t);
  const job = path.join(f.root, "job");
  await mkdir(job);
  await writeFile(
    path.join(job, "request.json"),
    JSON.stringify({ id, input, creatorName: "Owner" }),
  );
  await writeFile(path.join(job, "design.json"), JSON.stringify(design));
  await symlink(f.bundleDir, path.join(job, "bundle"));
  const manifest = await readFile(path.join(f.bundleDir, "manifest.json"));
  await assert.rejects(packCodexJob(job), /symlink|symbolic|ELOOP|ENOTDIR/i);
  assert.deepEqual(
    await readFile(path.join(f.bundleDir, "manifest.json")),
    manifest,
  );
});

test("eight exact repeated poses fail both normalization and direct packing", async (t) => {
  const f = await fixture(t);
  const repeated = await atlas(true);
  await assert.rejects(
    normalizeGeneratedAtlas(repeated),
    /repet|distinct|different/i,
  );
  await assert.rejects(
    packCharacterSprites(repeated, path.join(f.root, "packed")),
    /repet|distinct|different/i,
  );
  const valid = await normalizeGeneratedAtlas(await atlas());
  assert.equal(valid.audit.frames.length, 8);
});

test("repacking failure revokes an earlier manifest before validating edited job metadata", async (t) => {
  const f = await fixture(t);
  const job = path.join(f.root, "job");
  await mkdir(job);
  await writeFile(
    path.join(job, "request.json"),
    JSON.stringify({ id, input, creatorName: "Owner" }),
  );
  await writeFile(path.join(job, "design.json"), "{}");
  await mkdir(path.join(job, "bundle"));
  await writeFile(path.join(job, "bundle/generated.png"), await atlas());
  await writeFile(
    path.join(job, "bundle/manifest.json"),
    await readFile(path.join(f.bundleDir, "manifest.json")),
  );
  await assert.rejects(packCodexJob(job));
  await assert.rejects(readFile(path.join(job, "bundle/manifest.json")), {
    code: "ENOENT",
  });
});

test("abort during the last packing writes cannot leave an importable manifest", async (t) => {
  const f = await fixture(t);
  const job = path.join(f.root, "job");
  const bundle = path.join(job, "bundle");
  await mkdir(bundle, { recursive: true });
  await writeFile(
    path.join(job, "request.json"),
    JSON.stringify({ id, input, creatorName: "Owner" }),
  );
  await writeFile(path.join(job, "design.json"), JSON.stringify(design));
  await writeFile(path.join(bundle, "generated.png"), await atlas());
  const controller = new AbortController();
  const watcher = watch(bundle, (_event, filename) => {
    if (filename === "character.json") controller.abort();
  });
  t.after(() => watcher.close());
  await assert.rejects(packCodexJob(job, controller.signal), {
    name: "AbortError",
  });
  assert.equal(controller.signal.aborted, true);
  await assert.rejects(readFile(path.join(bundle, "manifest.json")), {
    code: "ENOENT",
  });
});

test("a pinned bundle directory cannot be redirected by a parent rename and symlink swap", async (t) => {
  const f = await fixture(t);
  const handle = await openDirectory(f.bundleDir);
  try {
    const original = await readFile(path.join(f.bundleDir, "manifest.json"));
    await rename(f.bundleDir, f.bundleDir + "-moved");
    const external = path.join(f.root, "external");
    await mkdir(external);
    await writeFile(
      path.join(external, "manifest.json"),
      "external replacement",
    );
    await symlink(external, f.bundleDir);
    assert.deepEqual(
      await readLimited(
        path.join(directoryPath(handle), "manifest.json"),
        32768,
      ),
      original,
    );
    await assert.rejects(
      readAssetBundle(f.bundleDir),
      /symlink|symbolic|ELOOP|ENOTDIR/i,
    );
  } finally {
    await handle.close();
  }
});

test("import ignores hostile prepacked files and commits only recomputed private owner assets", async (t) => {
  const f = await fixture(t);
  for (const filename of [
    "sprite.png",
    "sprite.webp",
    "portrait.webp",
    "geometry.json",
    "character.json",
  ])
    await writeFile(
      path.join(f.bundleDir, filename),
      "untrusted prepacked replacement",
    );
  const imported = await importCharacterAssets(f);
  assert.equal(imported.creatorName, "Owner");
  assert.equal(imported.geometry.frames.length, 8);
  const db = new CreatorDatabase(path.join(f.dataDir, "arena.sqlite"));
  try {
    assert.equal(db.character(id)?.status, "ready");
    assert.equal(db.character(id)?.owner_id, "owner");
    assert.equal(db.character(id)?.photos, "[]");
    assert.equal(db.published().length, 0);
    assert.ok(!db.character(id)?.source_path?.includes("/proc/self/fd"));
  } finally {
    db.close();
  }
  assert.equal(
    (
      await sharp(
        path.join(f.dataDir, "characters", id, "sprite.png"),
      ).metadata()
    ).format,
    "png",
  );
});

test("manual repacking rejects web-served jobs without modifying their manifests", async (t) => {
  const directory = await mkdtemp(path.resolve("public", ".pack-adversarial-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(path.join(directory, "bundle"));
  await writeFile(
    path.join(directory, "bundle/manifest.json"),
    "keep existing public file",
  );
  await assert.rejects(packCodexJob(directory), /under data|private job/);
  assert.equal(
    await readFile(path.join(directory, "bundle/manifest.json"), "utf8"),
    "keep existing public file",
  );
});

test("pinned Codex CLI really disables configured MCP servers with quoted dotted names", async (t) => {
  const f = await fixture(t);
  const names = ["ordinary", 'odd.server "label"'];
  await writeFile(
    path.join(f.root, "config.toml"),
    names
      .map(
        (name) =>
          `[mcp_servers.${JSON.stringify(name)}]\ncommand="/bin/false"\nenv={SYNTHETIC_SECRET="fixture-marker-not-a-secret"}\n`,
      )
      .join("\n"),
  );
  const saved = [
    process.env.CODEX_HOME,
    process.env.HOME,
    process.env.ARENA_CODEX_PATH,
  ];
  t.after(() => {
    for (const [i, name] of [
      "CODEX_HOME",
      "HOME",
      "ARENA_CODEX_PATH",
    ].entries()) {
      if (saved[i] === undefined) delete process.env[name];
      else process.env[name] = saved[i];
    }
  });
  process.env.CODEX_HOME = f.root;
  process.env.HOME = f.root;
  process.env.ARENA_CODEX_PATH = path.resolve("node_modules/.bin/codex");
  const overrides = await disabledMcpOverrides(
    f.root,
    AbortSignal.timeout(5000),
  );
  assert.equal(overrides.length, 1);
  for (const name of names)
    assert.ok(overrides[0].includes(`${JSON.stringify(name)}={enabled=false}`));
  const result = await promisify(execFile)(
    process.env.ARENA_CODEX_PATH,
    [
      ...overrides.flatMap((override) => ["-c", override]),
      "mcp",
      "list",
      "--json",
    ],
    { cwd: f.root, env: codexEnvironment(), timeout: 5000 },
  );
  const servers: { name: string; enabled: boolean }[] = JSON.parse(
    result.stdout,
  );
  assert.equal(servers.length, 2);
  assert.ok(servers.every((server) => !server.enabled));
});

test("MCP enumeration fails closed without exposing subprocess output or starting a turn", async (t) => {
  const f = await fixture(t);
  const executable = path.join(f.root, "codex-fixture.mjs");
  const saved = process.env.ARENA_CODEX_PATH;
  t.after(() => {
    if (saved === undefined) delete process.env.ARENA_CODEX_PATH;
    else process.env.ARENA_CODEX_PATH = saved;
  });
  await writeFile(
    executable,
    `#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
if(process.argv.includes('mcp')) { console.log('fixture-marker-not-a-secret malformed JSON'); process.exit(0); }
writeFileSync(${JSON.stringify(path.join(f.root, "model-was-started"))},'unexpected');
`,
    { mode: 0o700 },
  );
  process.env.ARENA_CODEX_PATH = executable;
  await assert.rejects(
    nativeRunner("chatgpt-plan-and-credits")({
      prompt: "fixture",
      photos: [],
      directory: f.root,
      outputSchema: {},
      signal: AbortSignal.timeout(5000),
    }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /No model request was sent/);
      assert.ok(!error.message.includes("fixture-marker"));
      return true;
    },
  );
  await assert.rejects(readFile(path.join(f.root, "model-was-started")), {
    code: "ENOENT",
  });
});
