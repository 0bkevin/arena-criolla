import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import type { ThreadEvent } from "@openai/codex-sdk";
import {
  generateCodexCharacter,
  packCodexJob,
} from "../scripts/creator-codex/workflow";
import {
  assertCodexBillingPolicy,
  codexEnvironment,
  completedOutput,
  nativeRunner,
  type NativeRunner,
} from "../scripts/creator-codex/native";
import { importCharacterAssets } from "../server/creator/import-assets";
import { CreatorDatabase } from "../server/creator/database";
import { makeArenaServer } from "../server/index";
import { unregisterCommunityCharacter } from "../shared/community";
import { normalizeGeneratedAtlas } from "../server/creator/normalize-atlas";

const input = {
  name: "Pana QA",
  description: "Chaqueta clara y pantalón azul de diseño ficticio.",
  style: "agile",
  color: "#ee7c34",
};
const design = {
  title: "Pana del barrio",
  specialName: "Paso orbital",
  outfit: "Chaqueta clara; pantalón azul y botas son una elección de diseño.",
  likeness: "Cabello corto y rostro visible en el retrato.",
  welcome: "Saludo con la mano",
  welcomeStyle: "wave",
  combos: ["Primer paso", "Segundo paso", "Gran remate"],
};
async function atlas(opaque = false) {
  const rects = Array.from(
    { length: 8 },
    (_, i) =>
      `<rect x="${(i % 4) * 192 + 50}" y="${Math.floor(i / 4) * 256 + 25}" width="${90 + i * 2}" height="210" rx="20" fill="#527fab"/>`,
  ).join("");
  return sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="512">${opaque ? '<rect width="768" height="512" fill="white"/>' : ""}${rects}</svg>`,
    ),
  )
    .png()
    .toBuffer();
}
async function fixture(t: TestContext) {
  const root = await mkdtemp(path.join(os.tmpdir(), "arena-codex-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const photo = path.join(root, "upper-body.jpg");
  await sharp({
    create: { width: 150, height: 100, channels: 3, background: "#847262" },
  })
    .jpeg()
    .toFile(photo);
  const generatedImagesDir = path.join(root, "generated_images");
  await mkdir(generatedImagesDir);
  let calls = 0;
  const run: NativeRunner = async (request) => {
    calls++;
    const metadata = await sharp(request.photos[0]).metadata();
    assert.equal(metadata.width, 150);
    assert.equal(
      metadata.height,
      100,
      "An upper-body crop is kept as a reference, not rejected or stretched.",
    );
    if (calls % 2 === 1) return design;
    const file = path.join(generatedImagesDir, `result-${calls}.png`);
    await writeFile(file, await atlas());
    return { generatedImagePath: file };
  };
  const options = {
    input,
    photos: [photo],
    job: path.join(root, "job"),
    creatorName: "QA local",
    generatedImagesDir,
    run,
  };
  return { root, photo, options, calls: () => calls };
}

test(
  "private SDK workflow exports only assets, imports a draft and publishes through the real service",
  { timeout: 15_000 },
  async (t) => {
    const f = await fixture(t);
    const result = await generateCodexCharacter(f.options);
    assert.equal(f.calls(), 2, "Exactly one design and one image request.");
    assert.equal((await stat(f.options.job)).mode & 0o777, 0o700);
    assert.equal(result.character.geometry.frames.length, 8);
    assert.deepEqual((await readdir(result.bundleDir)).sort(), [
      "character.json",
      "generated.png",
      "geometry.json",
      "manifest.json",
      "normalization.json",
      "portrait.webp",
      "sprite.png",
      "sprite.webp",
    ]);
    const server = await makeArenaServer({
      workshopEnabled: true,
      serveClient: false,
      creator: {
        dataDir: path.join(f.root, "prod-tst"),
        provider: null,
        secureCookies: false,
      },
    });
    t.after(async () => {
      unregisterCommunityCharacter(result.character.id);
      await server.close();
    });
    await new Promise<void>((resolve) =>
      server.http.listen(0, "127.0.0.1", resolve),
    );
    const address = server.http.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}`;
    const signup = await fetch(base + "/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Staging Owner",
        email: "owner@example.test",
        password: "test-password-123",
      }),
    });
    assert.equal(signup.status, 201);
    const cookie = signup.headers.get("set-cookie")!.split(";")[0];
    const options = {
      bundleDir: result.bundleDir,
      dataDir: server.creator.dataDir,
      ownerEmail: "owner@example.test",
      environment: "prod-tst",
    };
    const imported = await importCharacterAssets(options);
    assert.equal(
      imported.creatorName,
      "Staging Owner",
      "Ownership is resolved on staging, never supplied by the bundle.",
    );
    assert.equal(server.creator.db.character(imported.id)?.status, "ready");
    assert.equal(server.creator.db.published().length, 0);
    assert.deepEqual(
      JSON.parse(server.creator.db.character(imported.id)!.photos),
      [],
    );
    assert.equal(
      (await fetch(base + `/api/creator/characters/${imported.id}`)).status,
      401,
    );
    const ownerView = await fetch(
      base + `/api/creator/characters/${imported.id}`,
      { headers: { Cookie: cookie } },
    );
    assert.equal(ownerView.status, 200);
    const publish = await fetch(
      base + `/api/creator/characters/${imported.id}/publish`,
      { method: "POST", headers: { Cookie: cookie } },
    );
    assert.equal(publish.status, 200);
    const catalog = await (
      await fetch(base + "/api/community/characters")
    ).json();
    assert.equal(catalog.characters[0].id, imported.id);
    assert.equal(
      (await fetch(base + `/api/community/assets/${imported.id}/sprite.webp`))
        .status,
      200,
    );
    await assert.rejects(importCharacterAssets(options), /already imported/);
    assert.equal(server.creator.db.character(imported.id)?.status, "published");
  },
);

test("malformed photos and character data fail before any model request", async (t) => {
  const f = await fixture(t);
  await writeFile(f.photo, "not a real photograph");
  await assert.rejects(generateCodexCharacter(f.options));
  await assert.rejects(
    generateCodexCharacter({
      ...f.options,
      input: { ...input, style: "unsafe" },
    }),
  );
  await assert.rejects(generateCodexCharacter({ ...f.options, photos: [] }));
  assert.equal(f.calls(), 0);
  await assert.rejects(stat(f.options.job), { code: "ENOENT" });
});

test("reference jobs cannot be placed in web-served workspace folders or public symlinks", async (t) => {
  const f = await fixture(t);
  await assert.rejects(
    generateCodexCharacter({
      ...f.options,
      job: path.resolve("scripts", "codex-private-test"),
    }),
    /under data/,
  );
  const alias = path.join(f.root, "public-alias");
  await symlink(path.resolve("public"), alias);
  await assert.rejects(
    generateCodexCharacter({
      ...f.options,
      job: path.join(alias, "codex-private-test"),
    }),
  );
  assert.equal(f.calls(), 0);
});

test("a timeout never retries, accepts a late result or exports an importable bundle", async (t) => {
  const f = await fixture(t);
  let calls = 0;
  const run: NativeRunner = async () => {
    calls++;
    return new Promise(() => {});
  };
  const keepAlive = setTimeout(() => {}, 1000);
  t.after(() => clearTimeout(keepAlive));
  await assert.rejects(
    generateCodexCharacter({ ...f.options, run, timeoutMs: 20 }),
    { name: "TimeoutError" },
  );
  assert.equal(calls, 1);
  const status = JSON.parse(
    await readFile(path.join(f.options.job, "status.json"), "utf8"),
  );
  assert.equal(status.status, "failed");
  assert.equal(status.automaticRetry, false);
  await assert.rejects(stat(path.join(f.options.job, "bundle/manifest.json")), {
    code: "ENOENT",
  });
  await assert.rejects(generateCodexCharacter(f.options), { code: "EEXIST" });
  assert.equal(
    f.calls(),
    0,
    "Rerunning an existing job cannot spend more usage.",
  );
});

test("unavailable image tool, external path and stale image are rejected without fallback", async (t) => {
  const f = await fixture(t);
  const external = path.join(f.root, "old.png");
  await writeFile(external, await atlas());
  const stale = path.join(f.options.generatedImagesDir, "old.png");
  await writeFile(stale, await atlas());
  await utimes(stale, new Date(0), new Date(0));
  for (const [index, image] of [null, external, stale].entries()) {
    let calls = 0;
    const job = path.join(f.root, `reject-${index}`);
    await assert.rejects(
      generateCodexCharacter({
        ...f.options,
        job,
        run: async () =>
          ++calls === 1 ? design : { generatedImagePath: image },
      }),
    );
    assert.equal(calls, 2);
    await assert.rejects(stat(path.join(job, "bundle/manifest.json")), {
      code: "ENOENT",
    });
  }
});

test("invalid generated atlas is retained for inspection but cannot be imported", async (t) => {
  const f = await fixture(t);
  let calls = 0;
  await assert.rejects(
    generateCodexCharacter({
      ...f.options,
      run: async () => {
        if (++calls === 1) return design;
        const file = path.join(f.options.generatedImagesDir, "opaque.png");
        await writeFile(file, await atlas(true));
        return { generatedImagePath: file };
      },
    }),
  );
  assert.ok(await stat(path.join(f.options.job, "bundle/generated.png")));
  await assert.rejects(packCodexJob(f.options.job));
  await assert.rejects(stat(path.join(f.options.job, "bundle/manifest.json")), {
    code: "ENOENT",
  });
  assert.equal(calls, 2, "Repacking never invokes a model.");
});

test("staging import rejects wrong environments, unknown owners, checksum changes and escaping symlinks", async (t) => {
  const f = await fixture(t);
  const result = await generateCodexCharacter(f.options);
  const options = {
    bundleDir: result.bundleDir,
    dataDir: path.join(f.root, "prod-tst"),
    ownerEmail: "owner@example.test",
    environment: "prod-tst",
  };
  await assert.rejects(
    importCharacterAssets({ ...options, environment: "production" }),
    /prod-tst/,
  );
  await assert.rejects(stat(options.dataDir), { code: "ENOENT" });
  await assert.rejects(importCharacterAssets(options), /owner account/);
  const db = new CreatorDatabase(path.join(options.dataDir, "arena.sqlite"));
  t.after(() => db.close());
  db.createUser(
    { id: "owner", name: "Owner", email: options.ownerEmail },
    "unused-test-hash",
  );
  const image = path.join(result.bundleDir, "generated.png");
  await writeFile(image, await atlas(true));
  await assert.rejects(importCharacterAssets(options), /checksum/);
  await rm(image);
  await symlink(f.photo, image);
  await assert.rejects(
    importCharacterAssets(options),
    /symlink|symbolic|ELOOP/,
  );
  assert.equal(db.owned("owner").length, 0);
});

test("SDK stream must reach terminal completion, not just return text", async () => {
  const message: ThreadEvent = {
    type: "item.completed",
    item: { id: "msg", type: "agent_message", text: '{"ok":true}' },
  };
  async function* stream(events: ThreadEvent[]) {
    yield* events;
  }
  await assert.rejects(completedOutput(stream([message])), /did not complete/);
  await assert.rejects(
    completedOutput(
      stream([
        message,
        { type: "turn.failed", error: { message: "fixture upstream failure" } },
      ]),
    ),
    /failed/,
  );
  assert.deepEqual(
    await completedOutput(
      stream([
        message,
        {
          type: "turn.completed",
          usage: {
            input_tokens: 1,
            cached_input_tokens: 0,
            cache_write_input_tokens: 0,
            output_tokens: 1,
            reasoning_output_tokens: 0,
          },
        },
      ]),
    ),
    { ok: true },
  );
});

test("credits-only policy blocks native generation before a Codex runtime can start", () => {
  assert.throws(
    () => assertCodexBillingPolicy("credits-only"),
    /Credits-only billing cannot be enforced/,
  );
  assert.throws(
    () => nativeRunner("credits-only"),
    /No model request was sent/,
  );
  assert.throws(() => assertCodexBillingPolicy("unexpected"), /must be/);
  assert.doesNotThrow(() =>
    assertCodexBillingPolicy("chatgpt-plan-and-credits"),
  );
});

test("native runtime environment excludes billing keys and application credentials", () => {
  const env = codexEnvironment({
    HOME: "/private/user",
    PATH: "/usr/bin",
    CODEX_HOME: "/private/codex",
    OPENAI_API_KEY: "fixture",
    CODEX_API_KEY: "fixture",
    OPENAI_BASE_URL: "https://invalid.test",
    CODEX_ACCESS_TOKEN: "fixture",
    DATABASE_URL: "fixture",
    OCI_PRIVATE_KEY: "fixture",
  });
  assert.deepEqual(env, {
    HOME: "/private/user",
    PATH: "/usr/bin",
    CODEX_HOME: "/private/codex",
  });
});

test("both Codex phases select Luna High without forwarding API credentials", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "arena-codex-model-"));
  const executable = path.join(root, "codex-fixture.mjs");
  const previousPath = process.env.ARENA_CODEX_PATH;
  const previousHome = process.env.CODEX_HOME;
  t.after(async () => {
    if (previousPath === undefined) delete process.env.ARENA_CODEX_PATH;
    else process.env.ARENA_CODEX_PATH = previousPath;
    if (previousHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = previousHome;
    await rm(root, { recursive: true, force: true });
  });
  await writeFile(
    executable,
    `#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
if(process.argv.includes('mcp')) { console.log('[{"name":"fixture.connector"}]'); process.exit(0); }
for await (const chunk of process.stdin) {}
appendFileSync(process.env.CODEX_HOME + '/calls.jsonl', JSON.stringify({
  args: process.argv.slice(2),
  apiKeyPresent: Boolean(process.env.OPENAI_API_KEY || process.env.CODEX_API_KEY)
}) + '\\n');
console.log(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', id: 'reply', text: '{"ok":true}' } }));
console.log(JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 1, cached_input_tokens: 0, output_tokens: 1 } }));
`,
    { mode: 0o700 },
  );
  process.env.ARENA_CODEX_PATH = executable;
  process.env.CODEX_HOME = root;
  const run = nativeRunner("chatgpt-plan-and-credits");
  for (const phase of ["design", "drawing"]) {
    assert.deepEqual(
      await run({
        prompt: phase,
        imageGeneration: phase === "drawing",
        photos: [],
        directory: root,
        outputSchema: {
          type: "object",
          properties: { ok: { type: "boolean" } },
          required: ["ok"],
          additionalProperties: false,
        },
        signal: AbortSignal.timeout(3000),
      }),
      { ok: true },
    );
  }
  const calls = (await readFile(path.join(root, "calls.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .map(
      (line) => JSON.parse(line) as { args: string[]; apiKeyPresent: boolean },
    );
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.equal(call.args[call.args.indexOf("--model") + 1], "gpt-6-luna");
    assert.ok(call.args.includes('model_reasoning_effort="high"'));
    assert.ok(call.args.includes("features.shell_tool=false"));
    assert.ok(call.args.includes("features.hooks=false"));
    assert.ok(call.args.includes("features.plugins=false"));
    assert.ok(
      call.args.includes('mcp_servers={"fixture.connector"={enabled=false}}'),
    );
    assert.ok(
      call.args.includes("features.unbounded_connection_retries=false"),
    );
    assert.equal(call.apiKeyPresent, false);
  }
  assert.ok(calls[0].args.includes("features.image_generation=false"));
  assert.ok(calls[1].args.includes("features.image_generation=true"));
});

test("a completed native image turn recovers only its own single fresh PNG when Luna omits the path", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "arena-codex-receipt-"));
  const executable = path.join(root, "codex-fixture.mjs");
  const previousPath = process.env.ARENA_CODEX_PATH;
  const previousHome = process.env.CODEX_HOME;
  t.after(async () => {
    if (previousPath === undefined) delete process.env.ARENA_CODEX_PATH;
    else process.env.ARENA_CODEX_PATH = previousPath;
    if (previousHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = previousHome;
    await rm(root, { recursive: true, force: true });
  });
  await writeFile(path.join(root, "source.png"), await atlas());
  await writeFile(
    executable,
    `#!/usr/bin/env node
import { mkdirSync, copyFileSync, utimesSync, symlinkSync } from 'node:fs';
if(process.argv.includes('mcp')) { console.log('[]'); process.exit(0); }
let scenario=''; for await (const chunk of process.stdin) scenario+=chunk;
const id='018f1717-1717-4717-8717-' + ({success:'000000000001',missing:'000000000002',stale:'000000000003',ambiguous:'000000000004',symlink:'000000000005'})[scenario];
const directory=process.env.CODEX_HOME+'/generated_images/'+id;
mkdirSync(directory,{recursive:true});
if(scenario==='symlink')symlinkSync(process.env.CODEX_HOME+'/source.png',directory+'/exec-one.png');
else if(scenario!=='missing')copyFileSync(process.env.CODEX_HOME+'/source.png',directory+'/exec-one.png');
if(scenario==='stale')utimesSync(directory+'/exec-one.png',1,1);
if(scenario==='ambiguous')copyFileSync(process.env.CODEX_HOME+'/source.png',directory+'/exec-two.png');
console.log(JSON.stringify({type:'thread.started',thread_id:id}));
console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',id:'reply',text:'{"generatedImagePath":null}'}}));
console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:1,cached_input_tokens:0,output_tokens:1}}));
`,
    { mode: 0o700 },
  );
  process.env.ARENA_CODEX_PATH = executable;
  process.env.CODEX_HOME = root;
  const run = nativeRunner("chatgpt-plan-and-credits");
  const request = {
    photos: [],
    directory: root,
    outputSchema: {
      type: "object",
      properties: { generatedImagePath: { type: ["string", "null"] } },
      required: ["generatedImagePath"],
      additionalProperties: false,
    },
    signal: AbortSignal.timeout(5000),
  };
  const success = await run({ ...request, prompt: "success" });
  assert.deepEqual(success, {
    generatedImagePath: path.join(
      root,
      "generated_images/018f1717-1717-4717-8717-000000000001/exec-one.png",
    ),
  });
  for (const scenario of ["missing", "stale", "ambiguous", "symlink"])
    assert.deepEqual(
      await run({ ...request, prompt: scenario }),
      { generatedImagePath: null },
      scenario,
    );
});

test("atlas normalization recovers complete figures crossing tile lines and rejects canvas clipping, merged or missing poses", async () => {
  const sheet = async (
    kind: "crossing" | "row-crossing" | "clipped" | "merged" | "missing",
  ) => {
    const rects = Array.from({ length: 8 }, (_, i) => {
      if (kind === "missing" && i === 7) return "";
      let x = (i % 4) * 192 + 50;
      if (kind === "crossing" && i === 3) x = 573;
      if (kind === "clipped" && i === 0) x = 0;
      if (kind === "merged" && i === 1) x = 135;
      const y =
        kind === "row-crossing" && i === 4 ? 245 : Math.floor(i / 4) * 256 + 25;
      return `<rect x="${x}" y="${y}" width="${90 + i * 2}" height="210" rx="8" fill="#527fab"/>`;
    }).join("");
    return sharp(
      Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="512">${rects}</svg>`,
      ),
    )
      .png()
      .toBuffer();
  };
  const normalized = await normalizeGeneratedAtlas(await sheet("crossing"));
  assert.equal(normalized.audit.frames.length, 8);
  assert.equal(
    normalized.audit.frames[3].minX,
    573,
    "The complete original silhouette crosses the line at x=576.",
  );
  const acrossRows = await normalizeGeneratedAtlas(await sheet("row-crossing"));
  assert.equal(acrossRows.audit.frames[4].minY, 245);
  assert.equal(acrossRows.audit.frames[4].frame, 4);
  const metadata = await sharp(normalized.png).metadata();
  assert.equal(metadata.width, 2048);
  assert.equal(metadata.height, 1024);
  assert.ok(metadata.hasAlpha);
  for (const invalid of ["clipped", "merged", "missing"] as const)
    await assert.rejects(normalizeGeneratedAtlas(await sheet(invalid)));
});
