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
import os from "node:os";
import sharp from "sharp";
import { FINALE_ASSET_GROUPS } from "../shared/finales";
import {
  ACTOR_BASELINE,
  ACTOR_CELL,
  DANCER_ATLASES,
  PERFORMER_ATLASES,
  SEATED_IDENTITY_REFRESH,
  actorDanceAnchor,
  actorHeadAnchor,
  alignActorAtlas,
  normalizeActorPoses,
  prepareFinaleActors,
  validateActorAtlas,
} from "../scripts/prepare-finale-actors";

const sha = (data: Buffer) => createHash("sha256").update(data).digest("hex");

async function sourceSheet(
  columns = 2,
  options: {
    missing?: number;
    clipped?: boolean;
    duplicate?: boolean;
    seed?: number;
    varyHeight?: boolean;
  } = {},
) {
  const rows = 2,
    cellW = 192,
    cellH = 256;
  const shapes = Array.from({ length: columns * rows }, (_, index) => {
    if (index === options.missing) return "";
    const size = options.duplicate ? 0 : index;
    const bend = options.varyHeight ? index * 6 : 0;
    const x =
      (index % columns) * cellW + (options.clipped && index === 0 ? -40 : 0);
    const y = Math.floor(index / columns) * cellH;
    const color = `hsl(${(options.seed ?? 0) * 39 + size * 11},65%,55%)`;
    // A connected asymmetric seated silhouette: head/body, thigh, shin and foot.
    return `<g transform="translate(${x},${y})" fill="${color}"><circle cx="55" cy="40" r="14"/><rect x="40" y="50" width="30" height="58"/><rect x="55" y="99" width="65" height="20"/><rect x="105" y="111" width="20" height="${94 - bend}"/><rect x="100" y="${195 - bend}" width="${40 + size * 2}" height="20"/></g>`;
  }).join("");
  return sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${columns * cellW}" height="${rows * cellH}">${shapes}</svg>`,
    ),
  )
    .png()
    .toBuffer();
}

test("café normalization preserves four complete poses and anchors the head rather than asymmetric knees", async () => {
  const raw = await sourceSheet(2, { varyHeight: true });
  const normalized = await normalizeActorPoses(raw, 2, 2);
  const png = await alignActorAtlas(normalized, 2, 2);
  const webp = await sharp(png)
    .webp({ lossless: true, exact: true })
    .toBuffer();
  const result = await validateActorAtlas(png, webp, 2, 2, true);
  assert.equal(result.frames.length, 4);
  assert.ok(new Set(result.frames.map(({ frame }) => frame.height)).size > 1);
  const decoded = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (const [index, geometry] of result.frames.entries()) {
    const { frame } = geometry;
    assert.equal(
      frame.y + frame.height,
      Math.floor(index / 2) * ACTOR_CELL + ACTOR_BASELINE,
    );
    assert.equal(
      geometry.bodyHeight,
      result.frames[0].frame.height,
      "one actor keeps a fixed scale while its pose bends",
    );
    assert.equal(
      geometry.anchorX,
      actorHeadAnchor(decoded.data, decoded.info.width, frame),
    );
    assert.ok(
      geometry.anchorX < frame.width * 0.4,
      "head remains left of the projecting knees",
    );
    assert.ok(geometry.anchorX > 0 && geometry.anchorX < frame.width);
  }
  const renormalized = await alignActorAtlas(png, 2, 2);
  assert.ok(
    (await sharp(renormalized).raw().toBuffer()).equals(decoded.data),
    "alignment is idempotent and does not repaint pixels",
  );
});

test("café normalization rejects missing, duplicated and clipped figures instead of repairing them", async () => {
  for (const options of [
    { missing: 2 },
    { duplicate: true },
    { clipped: true },
  ])
    await assert.rejects(
      normalizeActorPoses(await sourceSheet(2, options), 2, 2),
    );
});

test("actor validation rejects WebP silhouette damage and a shifted baseline", async () => {
  const png = await alignActorAtlas(
    await normalizeActorPoses(await sourceSheet(), 2, 2),
    2,
    2,
  );
  const corrupted = await sharp(png)
    .extract({ left: 1, top: 0, width: 1023, height: 1024 })
    .extend({
      left: 0,
      right: 1,
      top: 0,
      bottom: 0,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ lossless: true, exact: true })
    .toBuffer();
  await assert.rejects(validateActorAtlas(png, corrupted, 2, 2), /alpha/);
  const shifted = await sharp(png)
    .extract({ left: 0, top: 1, width: 1024, height: 1023 })
    .extend({
      left: 0,
      right: 0,
      top: 0,
      bottom: 1,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  const shiftedWebp = await sharp(shifted)
    .webp({ lossless: true, exact: true })
    .toBuffer();
  await assert.rejects(
    validateActorAtlas(shifted, shiftedWebp, 2, 2),
    /baseline/,
  );
});

test("dancer anchor follows the torso when raised arms expand or reflect the crop", async () => {
  const anchors: number[] = [];
  const headAnchors: number[] = [];
  for (const side of ["left", "right"]) {
    for (const translated of [false, true]) {
      const left = translated ? 23 : 0;
      const top = translated ? 17 : 0;
      const arm =
        side === "left"
          ? '<path d="M102 120L45 20" stroke="black" stroke-width="14"/><circle cx="45" cy="20" r="16"/><rect x="10" y="151" width="100" height="8"/>'
          : '<path d="M118 120L175 20" stroke="black" stroke-width="14"/><circle cx="175" cy="20" r="16"/><rect x="110" y="151" width="100" height="8"/>';
      const { data, info } = await sharp(
        Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="340"><g transform="translate(${left},${top})"><circle cx="110" cy="80" r="18"/><rect x="95" y="97" width="30" height="103"/><rect x="95" y="195" width="12" height="100"/><rect x="113" y="195" width="12" height="100"/>${arm}</g></svg>`,
        ),
      )
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const frame = {
        x: left + (side === "left" ? 10 : 92),
        y: top + 4,
        width: 118,
        height: 291,
      };
      const anchor = frame.x + actorDanceAnchor(data, info.width, frame);
      assert.ok(Math.abs(anchor - left - 110) <= 1);
      anchors.push(anchor - left);
      headAnchors.push(
        frame.x + actorHeadAnchor(data, info.width, frame) - left,
      );
    }
  }
  assert.ok(Math.max(...anchors) - Math.min(...anchors) <= 1);
  assert.ok(Math.max(...headAnchors) - Math.min(...headAnchors) > 70);
  assert.throws(
    () =>
      actorDanceAnchor(Buffer.alloc(40 * 40 * 4), 40, {
        x: 0,
        y: 0,
        width: 40,
        height: 40,
      }),
    /torso/,
  );
});

test("actor pipeline packs all 46 authored IDs, keeps raws and reuses unchanged validated outputs", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "arena-finale-actors-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const folder = path.join(root, "assets/source/finales");
  await mkdir(folder, { recursive: true });
  const hashes = new Map<string, string>();
  for (let group = 1; group <= FINALE_ASSET_GROUPS.length; group++) {
    const file = `finales-seated-v1-${group}-generated.png`;
    const data = await sourceSheet(4, { seed: group });
    await writeFile(path.join(folder, file), data);
    hashes.set(file, sha(data));
  }
  const cafe = await sourceSheet(2, { seed: 9, varyHeight: true });
  await writeFile(
    path.join(folder, "finales-capriles-cafe-generated.png"),
    cafe,
  );
  hashes.set("finales-capriles-cafe-generated.png", sha(cafe));
  for (const [index, { file }] of PERFORMER_ATLASES.entries()) {
    const raw = await sourceSheet(4, { seed: 10 + index, varyHeight: true });
    const name = `${file}-generated.png`;
    await writeFile(path.join(folder, name), raw);
    hashes.set(name, sha(raw));
  }
  const first = await prepareFinaleActors(root, {
    only: [...hashes.keys()].map((name) => name.replace("-generated.png", "")),
  });
  assert.equal(first.converted, 9);
  assert.ok(first.manifest.caprilesCafe);
  assert.deepEqual(
    Object.keys(first.manifest.seated).sort(),
    FINALE_ASSET_GROUPS.flat().sort(),
  );
  assert.equal(first.manifest.caprilesCafe.frames.length, 4);
  assert.equal(first.manifest.performers.nacho.file, "finales-nacho-dance");
  assert.equal(
    first.manifest.performers.giuseppe.file,
    "finales-giuseppe-hack",
  );
  for (const { id } of PERFORMER_ATLASES) {
    const frames = first.manifest.performers[id].frames;
    assert.equal(frames.length, 8);
    assert.ok(new Set(frames.map((frame) => frame.height)).size > 1);
    for (const frame of frames)
      assert.equal(frame.bodyHeight, frames[0].height);
  }
  for (const frame of first.manifest.caprilesCafe.frames)
    assert.equal(
      frame.bodyHeight,
      first.manifest.caprilesCafe.frames[0].height,
    );
  for (const actor of Object.values(first.manifest.seated))
    assert.equal(actor.bodyHeight, actor.frame.height);
  assert.equal(
    first.assets.reduce((sum, asset) => sum + asset.frames.length, 0),
    68,
  );
  assert.equal(
    first.assets[5].frames.length,
    8,
    "the six-person last group still validates its two alternate poses",
  );
  const previousOutputs = await Promise.all(
    first.assets.flatMap(({ source, runtime }) =>
      [source, runtime].map(async (file) => ({
        file,
        hash: sha(await readFile(path.join(root, file))),
        modifiedAt: (await stat(path.join(root, file))).mtimeMs,
      })),
    ),
  );
  const dancerFile = `${DANCER_ATLASES[0].file}-generated.png`;
  const dancerRaw = await sourceSheet(4, { seed: 20 });
  await writeFile(path.join(folder, dancerFile), dancerRaw);
  hashes.set(dancerFile, sha(dancerRaw));
  const partial = await prepareFinaleActors(root, {
    only: [DANCER_ATLASES[0].file],
  });
  assert.equal(partial.converted, 1);
  assert.equal(partial.assets.length, 10);
  assert.equal(Object.keys(partial.manifest.dancers).length, 8);
  assert.deepEqual(partial.manifest.seated, first.manifest.seated);
  assert.deepEqual(partial.manifest.performers, first.manifest.performers);
  assert.deepEqual(partial.manifest.caprilesCafe, first.manifest.caprilesCafe);
  const manifestPath = path.join(root, "shared/finale-actor-assets.json");
  const beforeFailure = await readFile(manifestPath);
  await assert.rejects(
    prepareFinaleActors(root, { only: [DANCER_ATLASES[1].file] }),
    /ENOENT/,
    "requesting a missing raw fails instead of silently skipping it",
  );
  await writeFile(
    path.join(folder, `${DANCER_ATLASES[1].file}-generated.png`),
    await sourceSheet(4, { missing: 4 }),
  );
  await assert.rejects(
    prepareFinaleActors(root, { only: [DANCER_ATLASES[1].file] }),
    /finales-dance-v2-2/,
  );
  assert.ok((await readFile(manifestPath)).equals(beforeFailure));
  await writeFile(
    path.join(folder, `${DANCER_ATLASES[1].file}-generated.png`),
    await sourceSheet(4, { seed: 21 }),
  );
  await writeFile(
    path.join(folder, `${DANCER_ATLASES[2].file}-generated.png`),
    await sourceSheet(4, { clipped: true }),
  );
  await assert.rejects(
    prepareFinaleActors(root, {
      only: [DANCER_ATLASES[1].file, DANCER_ATLASES[2].file],
    }),
    /finales-dance-v2-3/,
  );
  await assert.rejects(
    readFile(path.join(root, `public/assets/${DANCER_ATLASES[1].file}.webp`)),
    /ENOENT/,
    "a later invalid pose prevents publishing earlier valid selected groups",
  );
  assert.ok((await readFile(manifestPath)).equals(beforeFailure));
  await assert.rejects(
    prepareFinaleActors(root, { only: ["unrecognized"] }),
    /desconocido/,
  );
  for (const [index, { file }] of DANCER_ATLASES.entries()) {
    if (index === 0) continue;
    const raw = await sourceSheet(4, { seed: 20 + index });
    const name = `${file}-generated.png`;
    await writeFile(path.join(folder, name), raw);
    hashes.set(name, sha(raw));
  }
  const complete = await prepareFinaleActors(root);
  assert.equal(complete.converted, 5);
  assert.equal(complete.cached, 10);
  assert.equal(complete.assets.length, 15);
  assert.deepEqual(
    Object.keys(complete.manifest.dancers).sort(),
    FINALE_ASSET_GROUPS.flat().sort(),
  );
  for (const { file, hash, modifiedAt } of previousOutputs) {
    assert.equal(sha(await readFile(path.join(root, file))), hash);
    assert.equal((await stat(path.join(root, file))).mtimeMs, modifiedAt);
  }
  const file = path.join(root, first.assets[0].runtime);
  const modifiedAt = (await stat(file)).mtimeMs;
  const second = await prepareFinaleActors(root);
  assert.equal(second.converted, 0);
  assert.equal(second.cached, 15);
  assert.equal((await stat(file)).mtimeMs, modifiedAt);
  assert.deepEqual(second.manifest, complete.manifest);
  for (const [name, digest] of hashes)
    assert.equal(sha(await readFile(path.join(folder, name))), digest, name);
  await writeFile(file, Buffer.from("damaged cache output"));
  const repaired = await prepareFinaleActors(root);
  assert.equal(
    repaired.converted,
    1,
    "only the invalidated atlas is converted again",
  );
  assert.equal(repaired.cached, 14);
  assert.equal(sha(await readFile(file)), first.assets[0].runtimeSha256);
});

test("shipped seated and dancing actors match all 46 authored fighters and every PNG/WebP alpha pixel", async () => {
  const manifest = JSON.parse(
    await readFile("shared/finale-actor-assets.json", "utf8"),
  );
  const audit = JSON.parse(
    await readFile("docs/finales/actor-packing.json", "utf8"),
  );
  assert.equal(Object.keys(manifest.seated).length, 46);
  assert.deepEqual(
    Object.keys(manifest.seated).sort(),
    FINALE_ASSET_GROUPS.flat().sort(),
  );
  assert.equal(manifest.caprilesCafe.file, "finales-capriles-cafe");
  assert.equal(manifest.caprilesCafe.frames.length, 4);
  assert.equal(audit.assets.length, 16);
  assert.deepEqual(
    Object.keys(manifest.dancers).sort(),
    FINALE_ASSET_GROUPS.flat().sort(),
  );
  assert.deepEqual(Object.keys(manifest.performers).sort(), [
    "giuseppe",
    "nacho",
  ]);
  const used = new Set<string>(),
    silhouettes = new Set<string>(),
    danced = new Set<string>(),
    danceSilhouettes = new Set<string>();
  for (const [index, asset] of audit.assets.entries()) {
    const dancer = DANCER_ATLASES.find(({ file }) => file === asset.file);
    const refreshed = asset.file === SEATED_IDENTITY_REFRESH.file;
    const [raw, png, webp] = await Promise.all([
      readFile(asset.raw),
      readFile(asset.source),
      readFile(asset.runtime),
    ]);
    assert.equal(
      sha(raw),
      asset.inputSha256,
      `${asset.file}: original remains unchanged`,
    );
    assert.equal(sha(png), asset.sourceSha256);
    assert.equal(sha(webp), asset.runtimeSha256);
    const verified = await validateActorAtlas(
      png,
      webp,
      asset.columns,
      asset.rows,
      !dancer && !refreshed && index >= FINALE_ASSET_GROUPS.length,
      dancer ? "dance" : "head",
    );
    assert.deepEqual(verified.frames, asset.frames);
    assert.equal(verified.alphaSha256, asset.alphaSha256);
    assert.equal(verified.rgbaSha256, asset.rgbaSha256);
    const ids = refreshed
      ? SEATED_IDENTITY_REFRESH.ids
      : (dancer?.ids ?? FINALE_ASSET_GROUPS[index]);
    if (ids) {
      assert.equal(asset.columns, refreshed ? 2 : 4);
      assert.equal(asset.rows, 2);
      for (const [slot, id] of ids.entries()) {
        const replaced = SEATED_IDENTITY_REFRESH.ids.some(
          (current) => current === id,
        );
        if (replaced && !refreshed && !dancer) continue;
        const entry = (dancer ? manifest.dancers : manifest.seated)[id],
          geometry = verified.frames[slot];
        if (replaced && dancer) {
          const latest = JSON.parse(
            await readFile("shared/perro-mujeriego-assets.json", "utf8"),
          ).dancers[id];
          const { bodyHeight, anchorX, ...frame } = latest.frames[2];
          assert.deepEqual(
            entry,
            { file: latest.file, frame, bodyHeight, anchorX },
            id,
          );
        } else assert.deepEqual(entry, { file: asset.file, ...geometry }, id);
        const idsUsed = dancer ? danced : used;
        assert.ok(!idsUsed.has(id));
        idsUsed.add(id);
        const { frame } = entry;
        const crop = await sharp(
          replaced && dancer
            ? await readFile(
                `assets/source/finales/perro-mujeriego-v3/${id}.png`,
              )
            : png,
        )
          .extract({
            left: frame.x,
            top: frame.y,
            width: frame.width,
            height: frame.height,
          })
          .ensureAlpha()
          .raw()
          .toBuffer();
        (dancer ? danceSilhouettes : silhouettes).add(sha(crop));
      }
    } else if (asset.file === "finales-capriles-cafe") {
      assert.equal(asset.columns, 2);
      assert.equal(asset.rows, 2);
      assert.deepEqual(
        manifest.caprilesCafe.frames,
        verified.frames.map(({ frame, bodyHeight, anchorX }) => ({
          ...frame,
          bodyHeight,
          anchorX,
        })),
      );
    } else {
      const performer = PERFORMER_ATLASES.find(
        ({ file }) => file === asset.file,
      );
      assert.ok(performer, asset.file);
      assert.equal(asset.columns, 4);
      assert.equal(asset.rows, 2);
      assert.equal(verified.frames.length, 8);
      assert.deepEqual(manifest.performers[performer.id], {
        file: asset.file,
        frames: verified.frames.map(({ frame, bodyHeight, anchorX }) => ({
          ...frame,
          bodyHeight,
          anchorX,
        })),
      });
    }
  }
  assert.equal(used.size, 46);
  assert.equal(danced.size, 46);
  assert.equal(silhouettes.size, 46, "every fighter has its own seated bitmap");
  assert.equal(
    danceSilhouettes.size,
    46,
    "every fighter has its own dancing bitmap",
  );
  assert.equal(
    audit.assets.reduce(
      (sum: number, asset: { frames: unknown[] }) => sum + asset.frames.length,
      0,
    ),
    120,
  );
});

test("an isolated identity refresh preserves other atlases and reuses current dance artwork", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "arena-finale-refresh-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const folder = path.join(root, "assets/source/finales");
  await mkdir(folder, { recursive: true });
  await mkdir(path.join(root, "shared"), { recursive: true });
  const raw = await sourceSheet(2);
  await writeFile(
    path.join(folder, `${SEATED_IDENTITY_REFRESH.file}-generated.png`),
    raw,
  );
  const dancers = Object.fromEntries(
    SEATED_IDENTITY_REFRESH.ids.map((id) => [
      id,
      {
        file: `perro-mujeriego-v3-${id}`,
        frames: Array.from({ length: 8 }, (_, index) => ({
          x: index * 512 + 80,
          y: 30,
          width: 300,
          height: 452,
          bodyHeight: 452,
          anchorX: 150,
        })),
      },
    ]),
  );
  await writeFile(
    path.join(root, "shared/perro-mujeriego-assets.json"),
    JSON.stringify({ dancers }),
  );
  const first = await prepareFinaleActors(root, {
    only: [SEATED_IDENTITY_REFRESH.file],
  });
  assert.equal(first.converted, 1);
  assert.equal(first.assets.length, 1);
  for (const [slot, id] of SEATED_IDENTITY_REFRESH.ids.entries()) {
    assert.deepEqual(first.manifest.seated[id], {
      file: SEATED_IDENTITY_REFRESH.file,
      ...first.assets[0].frames[slot],
    });
    assert.equal(first.manifest.dancers[id].file, dancers[id].file);
    assert.equal(first.manifest.dancers[id].frame.x, dancers[id].frames[2].x);
  }
  assert.equal(
    sha(
      await readFile(
        path.join(folder, `${SEATED_IDENTITY_REFRESH.file}-generated.png`),
      ),
    ),
    sha(raw),
  );
  const second = await prepareFinaleActors(root, {
    only: [SEATED_IDENTITY_REFRESH.file],
  });
  assert.equal(second.cached, 1);
  assert.deepEqual(second.manifest, first.manifest);
  Reflect.deleteProperty(dancers, "javier");
  await writeFile(
    path.join(root, "shared/perro-mujeriego-assets.json"),
    JSON.stringify({ dancers }),
  );
  await assert.rejects(
    prepareFinaleActors(root, { only: [SEATED_IDENTITY_REFRESH.file] }),
    /javier: prepare/,
  );
  // Once published, the refresh is required by a full rebuild. A missing raw
  // must not silently restore the four older seated likenesses.
  const legacy = [
    ...FINALE_ASSET_GROUPS.map((_, index) => `finales-seated-v1-${index + 1}`),
    ...DANCER_ATLASES.map(({ file }) => file),
    ...PERFORMER_ATLASES.map(({ file }) => file),
    "finales-capriles-cafe",
  ];
  for (const file of legacy)
    await writeFile(path.join(folder, `${file}-generated.png`), raw);
  await rm(path.join(folder, `${SEATED_IDENTITY_REFRESH.file}-generated.png`));
  await assert.rejects(
    prepareFinaleActors(root),
    /ENOENT.*finales-seated-main-v1-generated\.png/,
  );
  assert.deepEqual(
    JSON.parse(
      await readFile(
        path.join(root, "shared/finale-actor-assets.json"),
        "utf8",
      ),
    ),
    JSON.parse(JSON.stringify(second.manifest)),
  );
});
