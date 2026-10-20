import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";
import { BUILT_IN_FIGHTERS } from "../shared/content";
import { preparePerroMujeriego } from "../scripts/prepare-perro-mujeriego";
import { auditPerroMujeriego } from "../scripts/validate-perro-mujeriego";
import {
  ACTOR_BASELINE,
  ACTOR_CELL,
  actorDanceAnchor,
} from "../scripts/prepare-finale-actors";

const sha = (data: Buffer) => createHash("sha256").update(data).digest("hex");
async function dancerSheet(
  options: {
    missing?: number;
    duplicate?: boolean;
    clipped?: boolean;
    seed?: number;
  } = {},
) {
  const figures = Array.from({ length: 8 }, (_, index) => {
    if (index === options.missing) return "";
    const pose = options.duplicate ? 0 : index;
    const x = (index % 4) * 192 + (options.clipped && index === 0 ? -70 : 0);
    const y = Math.floor(index / 4) * 256;
    const color = `hsl(${(options.seed ?? 1) * 31 + pose * 9},65%,52%)`;
    // Connected poses vary both arm reach and knee flexion, so a loose crop
    // must not become a separate per-pose display scale.
    return `<g transform="translate(${x},${y})" fill="${color}"><circle cx="76" cy="38" r="16"/><rect x="61" y="51" width="30" height="89"/><rect x="86" y="74" width="${35 + pose * 3}" height="12"/><rect x="61" y="130" width="12" height="${80 - pose * 3}"/><rect x="79" y="130" width="12" height="${80 - pose * 3}"/><rect x="57" y="${202 - pose * 3}" width="27" height="14"/><rect x="79" y="${202 - pose * 3}" width="${29 + pose}" height="14"/></g>`;
  }).join("");
  return sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="512">${figures}</svg>`,
    ),
  )
    .png()
    .toBuffer();
}
async function addRaw(root: string, id: string, raw: Buffer) {
  const file = path.join(
    root,
    `assets/source/finales/perro-mujeriego-v3/${id}-generated.png`,
  );
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, raw);
  return file;
}

test("an authored eight-pose dancer keeps one scale, baseline, torso anchoring, source and exact lossless RGBA", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "arena-perro-one-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const original = await dancerSheet();
  const raw = await addRaw(root, "nacho", original);
  const plan = Buffer.from('{"fixture":"authored choreography metadata"}\n');
  const planPath = path.join(
    root,
    "docs/finales/perro-mujeriego-v3/choreography.json",
  );
  await mkdir(path.dirname(planPath), { recursive: true });
  await writeFile(planPath, plan);
  const result = await preparePerroMujeriego(root, {
    only: ["nacho", "nacho"],
  });
  assert.equal(result.converted, 1);
  const actor = result.manifest.dancers.nacho;
  assert.equal(actor.file, "perro-mujeriego-v3-nacho");
  assert.equal(actor.frames.length, 8);
  assert.ok(new Set(actor.frames.map((frame) => frame.height)).size > 1);
  const audit = result.assets[0];
  const png = await readFile(path.join(root, audit.source));
  const webp = await readFile(path.join(root, audit.runtime));
  const decoded = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(decoded.info.width, ACTOR_CELL * 4);
  assert.equal(decoded.info.height, ACTOR_CELL * 2);
  assert.deepEqual(
    await sharp(webp).ensureAlpha().raw().toBuffer(),
    decoded.data,
  );
  for (const [index, frame] of actor.frames.entries()) {
    assert.equal(frame.bodyHeight, actor.frames[0].height);
    assert.equal(
      frame.y + frame.height,
      Math.floor(index / 4) * ACTOR_CELL + ACTOR_BASELINE,
    );
    assert.equal(
      frame.anchorX,
      actorDanceAnchor(decoded.data, decoded.info.width, frame),
    );
    assert.ok(frame.anchorX > 0 && frame.anchorX < frame.width);
  }
  assert.equal(sha(await readFile(raw)), sha(original));
  assert.equal(audit.inputSha256, sha(original));
  assert.equal(audit.choreographySha256, sha(plan));
  assert.equal(audit.rgbaSha256, sha(decoded.data));
  assert.equal(audit.runtimeSha256, sha(webp));
  assert.ok(
    !("ticks" in actor) && !actor.frames.some((frame) => "tick" in frame),
    "packing does not invent choreography timing",
  );
});

test("incremental dancer publication retains prior people, validates caches and rejects malformed selected batches without partial writes", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "arena-perro-cache-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await addRaw(root, "nacho", await dancerSheet());
  const first = await preparePerroMujeriego(root, { only: ["nacho"] });
  const runtime = path.join(root, first.assets[0].runtime);
  const modifiedAt = (await stat(runtime)).mtimeMs;
  const cached = await preparePerroMujeriego(root, { only: ["nacho"] });
  assert.equal(cached.cached, 1);
  assert.equal(cached.converted, 0);
  assert.equal((await stat(runtime)).mtimeMs, modifiedAt);
  await addRaw(root, "rummy", await dancerSheet({ seed: 2 }));
  const partial = await preparePerroMujeriego(root, { only: ["rummy"] });
  assert.deepEqual(
    partial.manifest.dancers.nacho,
    first.manifest.dancers.nacho,
  );
  assert.ok(partial.manifest.dancers.rummy);
  assert.equal((await stat(runtime)).mtimeMs, modifiedAt);
  const manifestPath = path.join(root, "shared/perro-mujeriego-assets.json");
  const beforeFailure = await readFile(manifestPath);
  await assert.rejects(
    preparePerroMujeriego(root),
    /ENOENT/,
    "full publication requires every current built-in source",
  );
  await assert.rejects(
    preparePerroMujeriego(root, { only: ["custom_unsupported"] }),
    /desconocido/,
  );
  await assert.rejects(preparePerroMujeriego(root, { only: [] }), /vacía/);
  for (const malformed of [
    { missing: 4 },
    { duplicate: true },
    { clipped: true },
  ]) {
    await addRaw(root, "zavarce", await dancerSheet({ seed: 3 }));
    await addRaw(root, "capriles", await dancerSheet(malformed));
    await assert.rejects(
      preparePerroMujeriego(root, { only: ["zavarce", "capriles"] }),
      /capriles:/,
    );
    await assert.rejects(
      readFile(
        path.join(root, "public/assets/perro-mujeriego-v3-zavarce.webp"),
      ),
      /ENOENT/,
    );
    assert.deepEqual(await readFile(manifestPath), beforeFailure);
  }
  await writeFile(runtime, "corrupt lossless output");
  const repaired = await preparePerroMujeriego(root, { only: ["nacho"] });
  assert.equal(repaired.converted, 1);
  assert.equal(sha(await readFile(runtime)), first.assets[0].runtimeSha256);
  const auditPath = path.join(root, "docs/finales/perro-mujeriego-v3.json");
  const changed = JSON.parse(await readFile(auditPath, "utf8"));
  changed.assets.find(
    (asset: { id: string }) => asset.id === "nacho",
  ).frames[0].anchorX += 20;
  await writeFile(auditPath, JSON.stringify(changed));
  const geometryRepaired = await preparePerroMujeriego(root, {
    only: ["nacho"],
  });
  assert.equal(
    geometryRepaired.converted,
    1,
    "invalid cached geometry is checked against real pixels",
  );
  assert.deepEqual(
    geometryRepaired.manifest.dancers.nacho,
    first.manifest.dancers.nacho,
  );
});

test("the complete synthetic roster publishes the current roster of independent eight-pose dancer assets", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "arena-perro-roster-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const planPath = path.join(
    root,
    "docs/finales/perro-mujeriego-v3/choreography.json",
  );
  await mkdir(path.dirname(planPath), { recursive: true });
  await writeFile(planPath, '{"fixture":"authored choreography metadata"}\n');
  await Promise.all(
    BUILT_IN_FIGHTERS.map(async ({ id }, index) =>
      addRaw(root, id, await dancerSheet({ seed: index + 1 })),
    ),
  );
  const result = await preparePerroMujeriego(root);
  assert.equal(result.converted, BUILT_IN_FIGHTERS.length);
  assert.equal(result.assets.length, BUILT_IN_FIGHTERS.length);
  assert.deepEqual(
    Object.keys(result.manifest.dancers).sort(),
    BUILT_IN_FIGHTERS.map(({ id }) => id).sort(),
  );
  assert.equal(
    new Set(result.assets.map((asset) => asset.runtime)).size,
    BUILT_IN_FIGHTERS.length,
  );
  assert.equal(
    result.assets.reduce((sum, asset) => sum + asset.frames.length, 0),
    BUILT_IN_FIGHTERS.length * 8,
  );
  const verified = await auditPerroMujeriego(root);
  assert.equal(verified.fighters, BUILT_IN_FIGHTERS.length);
  assert.equal(verified.poses, BUILT_IN_FIGHTERS.length * 8);
  assert.equal(verified.cached, BUILT_IN_FIGHTERS.length);
  const manifestPath = path.join(root, "shared/perro-mujeriego-assets.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.dancers.nacho.frames[7].bodyHeight += 10;
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(
    auditPerroMujeriego(root),
    /manifest and packing geometry disagree/,
  );
});
