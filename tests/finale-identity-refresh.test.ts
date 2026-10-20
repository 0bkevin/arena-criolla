import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fighterById } from "../shared/content";
import {
  SEATED_IDENTITY_REFRESH,
  validateActorAtlas,
} from "../scripts/prepare-finale-actors";

const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const json = async (file: string) => JSON.parse(await readFile(file, "utf8"));

test("refreshed finale identities use main's current canonical art and preserve all eight authored poses losslessly", async () => {
  const index = await json("docs/finales/perro-mujeriego-v3/assets-index.json");
  const references = await json(
    "docs/finales/perro-mujeriego-v3/canonical-references.json",
  );
  const packing = await json("docs/finales/perro-mujeriego-v3.json");
  const manifest = await json("shared/perro-mujeriego-assets.json");
  const prior = await json(
    "docs/finales/main-identity-refresh/pre-main-assets-index.json",
  );
  const generations = await json(
    "docs/finales/main-identity-refresh/generations.json",
  );
  for (const id of SEATED_IDENTITY_REFRESH.ids) {
    const fighter = fighterById(id);
    const ref = references.find((entry: { id: string }) => entry.id === id);
    assert.equal(ref.sprite, fighter.sprite);
    const canonical = await readFile(`assets/source/${fighter.sprite}.png`);
    assert.equal(sha(await readFile(ref.file)), sha(canonical));
    assert.equal(ref.sha256, sha(canonical));
    assert.equal(ref.sourceSha256, sha(canonical));
    const asset = index.assets.find((entry: { id: string }) => entry.id === id);
    const record = packing.assets.find(
      (entry: { id: string }) => entry.id === id,
    );
    const raw = await readFile(record.raw);
    assert.equal(asset.sha256, sha(raw));
    assert.equal(record.inputSha256, sha(raw));
    assert.equal(asset.promptSha256, sha(await readFile(asset.prompt)));
    assert.equal(asset.canonicalReferenceSha256, sha(canonical));
    const generated = generations.entries.find(
      (entry: { id: string }) =>
        entry.id === (id === "nacho" ? "nacho_identity" : id),
    );
    assert.equal(generated.generationPath, asset.generationPath);
    assert.equal(
      generated.prompt.trim(),
      (await readFile(asset.prompt, "utf8")).trim(),
    );
    const previous = prior.assets.find(
      (entry: { id: string }) => entry.id === id,
    );
    const archived = await readFile(
      `assets/source/finales/main-identity-refresh/pre-main/${id}-dance-generated.png`,
    );
    assert.equal(sha(archived), previous.sha256);
    assert.notEqual(sha(raw), sha(archived));
    const png = await readFile(record.source),
      webp = await readFile(record.runtime);
    assert.equal(sha(png), record.sourceSha256);
    assert.equal(sha(webp), record.runtimeSha256);
    const verified = await validateActorAtlas(png, webp, 4, 2, true, "dance");
    assert.equal(verified.alphaSha256, record.alphaSha256);
    assert.equal(verified.rgbaSha256, record.rgbaSha256);
    assert.deepEqual(
      verified.frames.map(({ frame, bodyHeight, anchorX }) => ({
        ...frame,
        bodyHeight,
        anchorX,
      })),
      manifest.dancers[id].frames,
    );
    assert.equal(manifest.dancers[id].frames.length, 8);
  }
});

test("café guests and dance fallback roles select the refreshed drawings with current provenance", async () => {
  const actors = await json("shared/finale-actor-assets.json");
  const dancers = await json("shared/perro-mujeriego-assets.json");
  const packing = await json("docs/finales/actor-packing.json");
  assert.equal(
    packing.danceOverrides.sha256,
    sha(await readFile(packing.danceOverrides.manifest)),
  );
  assert.deepEqual(packing.danceOverrides.ids, SEATED_IDENTITY_REFRESH.ids);
  const seats = packing.assets.find(
    (asset: { file: string }) => asset.file === SEATED_IDENTITY_REFRESH.file,
  );
  for (const [slot, id] of SEATED_IDENTITY_REFRESH.ids.entries()) {
    assert.deepEqual(actors.seated[id], {
      file: seats.file,
      ...seats.frames[slot],
    });
    const { bodyHeight, anchorX, ...frame } = dancers.dancers[id].frames[2];
    assert.deepEqual(actors.dancers[id], {
      file: dancers.dancers[id].file,
      frame,
      bodyHeight,
      anchorX,
    });
  }
  assert.equal(
    sha(
      await readFile("assets/source/finales/finales-nacho-dance-generated.png"),
    ),
    sha(
      await readFile(
        "assets/source/finales/perro-mujeriego-v3/nacho-generated.png",
      ),
    ),
    "Nacho's other dance roles use the same new identity and ordered poses",
  );
});
