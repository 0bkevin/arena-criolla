import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { demoRivalFor, type GuideMove } from "../src/game/move-demo";
import { TECHNIQUES } from "../shared/techniques";
import test from "node:test";
import attackArt from "../shared/attack-assets.json";
import {
  BUILT_IN_FIGHTERS,
  fighterById,
  type FighterId,
} from "../shared/content";
import courier from "../shared/courier-assets.json";
import actors from "../shared/finale-actor-assets.json";
import cafe from "../shared/finale-cafe-assets.json";
import desk from "../shared/finale-desk-assets.json";
import { finaleAsset, finaleById } from "../shared/finales";
import choreography from "../shared/perro-mujeriego-assets.json";
import { browserFixture } from "./helpers/asset-browser";

const primaryDance = "perro-mujeriego-v3-nacho";
const alternateDance = "finales-nacho-dance";
const danceUrl = `/assets/${primaryDance}.webp`;
const alternateUrl = `/assets/${alternateDance}.webp`;
const seatedInitiators = new Set(["capriles", "juan", "carlos", "florentino"]);
const seated: Record<string, { file: string }> = actors.seated;
const performers: Record<string, { file: string }> = actors.performers;
const dancers: Record<string, { file: string }> = actors.dancers;
const recorded: Record<string, { file: string }> = choreography.dancers;
const attacks: Record<string, { file: string }> = attackArt;

// Each scenario gets its own real loader cache, without adding test-only cache
// controls to the production module.
async function loader(
  scenario: string,
): Promise<typeof import("../src/game/assets")> {
  const url = new URL("../src/game/assets.ts", import.meta.url);
  url.searchParams.set("asset-loading-test", scenario);
  return import(url.href);
}

test("the shared Nacho dance URLs remain byte-identical", () => {
  assert.deepEqual(
    readFileSync(`public/assets/${primaryDance}.webp`),
    readFileSync(`public/assets/${alternateDance}.webp`),
    "different artwork must never share the same image cache entry",
  );
});

test("both Nacho names share one in-flight request and the successfully cached image", async () => {
  const browser = browserFixture();
  try {
    const { loadImage } = await loader("alias-success");
    const first = loadImage(alternateDance);
    const second = loadImage(primaryDance);
    assert.equal(first, second);
    const image = await first;
    assert.equal(await second, image);
    assert.equal(loadImage(primaryDance), first);
    assert.equal(loadImage(alternateDance), first);
    assert.equal(browser.count(danceUrl), 1);
    assert.equal(browser.count(alternateUrl), 0);
  } finally {
    browser.restore();
  }
});

test("a failed primary dance URL recovers through the identical alternate URL", async () => {
  const browser = browserFixture((url) => url === danceUrl);
  try {
    const { loadImage } = await loader("alias-alternate");
    const first = loadImage(primaryDance);
    assert.equal(loadImage(alternateDance), first);
    const image = await first;
    assert.equal(await loadImage(primaryDance), image);
    assert.equal(await loadImage(alternateDance), image);
    assert.equal(browser.count(danceUrl), 1);
    assert.equal(browser.count(alternateUrl), 1);
  } finally {
    browser.restore();
  }
});

test("failure of both dance URLs clears their shared cache for the next attempt", async () => {
  const browser = browserFixture(
    (url, attempt) => [danceUrl, alternateUrl].includes(url) && attempt === 1,
  );
  try {
    const { loadImage } = await loader("alias-retry");
    const failed = loadImage(alternateDance);
    assert.equal(loadImage(primaryDance), failed);
    await assert.rejects(
      failed,
      /No se pudo cargar el asset finales-nacho-dance/,
    );
    assert.equal(browser.count(danceUrl), 1);
    assert.equal(browser.count(alternateUrl), 1);
    const retry = loadImage(primaryDance);
    assert.notEqual(retry, failed);
    assert.equal(loadImage(alternateDance), retry);
    const image = await retry;
    assert.equal(await loadImage(alternateDance), image);
    assert.equal(browser.count(danceUrl), 2);
    assert.equal(browser.count(alternateUrl), 1);
  } finally {
    browser.restore();
  }
});

test("a fight keeps both dance lookup keys and retries optional failures without reloading fighters", async () => {
  const browser = browserFixture(
    (url, attempt) => [danceUrl, alternateUrl].includes(url) && attempt === 1,
  );
  try {
    const { preloadAssets } = await loader("fight-retry");
    const first = await preloadAssets(["nacho", "capriles"], ["caracas"]);
    assert.equal(first.finaleProps[primaryDance], undefined);
    assert.equal(first.finaleProps[alternateDance], undefined);
    assert.ok(first.finaleProps[seated.capriles.file]);
    assert.ok(first.finaleProps[recorded.capriles.file]);
    const retry = await preloadAssets(["nacho", "capriles"], ["caracas"]);
    assert.ok(retry.finaleProps[primaryDance]);
    assert.equal(
      retry.finaleProps[primaryDance],
      retry.finaleProps[alternateDance],
    );
    assert.equal(retry.sprites.nacho, first.sprites.nacho);
    assert.equal(retry.sprites.capriles, first.sprites.capriles);
    assert.equal(retry.stages.caracas, first.stages.caracas);
    assert.equal(
      browser.count(`/assets/${fighterById("nacho").sprite}.webp`),
      1,
    );
    assert.equal(
      browser.count(`/assets/${fighterById("capriles").sprite}.webp`),
      1,
    );
    assert.equal(browser.count("/assets/caracas.webp"), 1);
    assert.equal(browser.count(danceUrl), 2);
    assert.equal(browser.count(alternateUrl), 1);
  } finally {
    browser.restore();
  }
});

test("every ordered match retains its required artwork and only requests relevant seated and dance atlases", async () => {
  const browser = browserFixture();
  try {
    const { preloadAssets } = await loader("all-pairs");
    let cases = 0;
    for (const actor of BUILT_IN_FIGHTERS) {
      for (const target of BUILT_IN_FIGHTERS) {
        const ids: FighterId[] = [...new Set([actor.id, target.id])];
        const label = `${actor.id}/${target.id}`;
        const hasSeats = ids.some((id) => seatedInitiators.has(id));
        const hasNacho = ids.includes("nacho");
        const expected = new Set<string>();
        for (const id of ids) {
          for (const file of [
            attacks[id]?.file,
            finaleById(id)?.mode === "capture"
              ? finaleAsset(id)?.file
              : undefined,
            finaleById(id)?.mode === "capture"
              ? performers[id]?.file
              : undefined,
          ])
            if (file) expected.add(file);
          if (hasSeats && seated[id]) expected.add(seated[id].file);
          if (hasNacho) {
            const dance = recorded[id] ?? dancers[id];
            if (dance) expected.add(dance.file);
          }
          if (id === "giuseppe") expected.add(desk.file);
          if (id === "capriles") {
            expected.add(actors.caprilesCafe.file);
            expected.add(cafe.file);
          }
          if (fighterById(id).ability === "courier") expected.add(courier.file);
        }
        const assets = await preloadAssets(ids, ["caracas"]);
        assert.deepEqual(
          Object.keys(assets.finaleProps).sort(),
          [...expected].sort(),
          label,
        );
        assert.deepEqual(
          Object.keys(assets.sprites).sort(),
          [...ids].sort(),
          label,
        );
        assert.deepEqual(Object.keys(assets.stages), ["caracas"], label);
        if (hasNacho)
          assert.equal(
            assets.finaleProps[primaryDance],
            assets.finaleProps[alternateDance],
            label,
          );
        cases++;
      }
    }
    assert.equal(cases, BUILT_IN_FIGHTERS.length ** 2);
    assert.equal(cases, BUILT_IN_FIGHTERS.length ** 2);
    assert.equal(browser.count(danceUrl), 1);
    assert.equal(browser.count(alternateUrl), 0);
    for (const [url, requests] of browser.requests)
      assert.equal(
        requests,
        1,
        `successful assets are reused across matches: ${url}`,
      );
  } finally {
    browser.restore();
  }
});

test("a cold basic Maite preview needs only three original images and at least 70% fewer source bytes", async () => {
  const baseline = browserFixture();
  let originalBytes = 0;
  try {
    const { preloadAssets } = await loader("preview-byte-baseline");
    await preloadAssets(["maite", demoRivalFor("maite")], ["caracas"]);
    originalBytes = [...baseline.requests.keys()].reduce(
      (sum, url) => sum + readFileSync(`public${url}`).length,
      0,
    );
  } finally {
    baseline.restore();
  }
  const browser = browserFixture();
  try {
    // Exercise the production entry point, including its move-to-scope mapping.
    const { preloadMovePreviewAssets } =
      await import("../src/game/move-preview-assets");
    const first = await preloadMovePreviewAssets("maite", "light");
    const bytes = [...browser.requests.keys()].reduce(
      (sum, url) => sum + readFileSync(`public${url}`).length,
      0,
    );
    assert.equal(browser.requests.size, 3);
    assert.ok(bytes < 2 * 1024 ** 2);
    assert.ok(
      bytes < originalBytes * 0.3,
      `${bytes}/${originalBytes} source bytes`,
    );
    for (const move of ["heavy", "combo1", "combo2"] satisfies GuideMove[]) {
      const next = await preloadMovePreviewAssets("maite", move);
      assert.equal(next.sprites.maite, first.sprites.maite);
      assert.equal(next.stages.caracas, first.stages.caracas);
    }
    assert.equal(browser.requests.size, 3);
    await preloadMovePreviewAssets("maite", "special");
    assert.equal(
      browser.requests.size,
      3,
      "Maite's special does not use her finale sheet",
    );
    await preloadMovePreviewAssets("maite", "final");
    assert.equal(
      browser.requests.size,
      4,
      "Maite's finale loads only her own extra attack sheet",
    );
  } finally {
    browser.restore();
  }
});

test("every preview loads full-quality combat sprites without unused entrances or rival finales", async () => {
  const browser = browserFixture();
  try {
    const { preloadMovePreviewAssets } =
      await import("../src/game/move-preview-assets");
    for (const fighter of BUILT_IN_FIGHTERS) {
      const rival = demoRivalFor(fighter.id);
      const ids = [fighter.id, rival];
      for (const move of [
        "light",
        "heavy",
        "combo1",
        "combo2",
        "special",
        "final",
      ] as const) {
        const attackIds =
          move === "special" || move === "final" ? [fighter.id] : [];
        if (move === "special" && TECHNIQUES[fighter.ability].reflect)
          attackIds.push(rival);
        const assets = await preloadMovePreviewAssets(fighter.id, move);
        const expected = new Set(
          attackIds.flatMap((id) => (attacks[id] ? [attacks[id].file] : [])),
        );
        if (
          move === "special" &&
          ![
            "vallenilla",
            "simon",
            "ali",
            "dorangel",
            "chataing",
            "melanio",
            "deyna",
            "dayana",
            "llorona",
            "dudamel",
            "bolivar",
            "lorenzo",
            "kevin",
          ].includes(fighter.id) &&
          attacks[fighter.id]
        )
          expected.delete(attacks[fighter.id].file);
        if (move === "final") {
          if (finaleById(fighter.id)?.mode === "capture") {
            const asset = finaleAsset(fighter.id);
            if (asset) expected.add(asset.file);
            if (performers[fighter.id])
              expected.add(performers[fighter.id].file);
          }
          if (seatedInitiators.has(fighter.id))
            for (const id of ids) if (seated[id]) expected.add(seated[id].file);
          if (fighter.id === "nacho")
            for (const id of ids) {
              const dancer = recorded[id] ?? dancers[id];
              if (dancer) expected.add(dancer.file);
            }
          if (fighter.id === "giuseppe") expected.add(desk.file);
          if (fighter.id === "capriles") {
            expected.add(actors.caprilesCafe.file);
            expected.add(cafe.file);
          }
        }
        const hasCourier = attackIds.some(
          (id) => fighterById(id).ability === "courier",
        );
        if (hasCourier) expected.add(courier.file);
        assert.deepEqual(
          Object.keys(assets.finaleProps).sort(),
          [...expected].sort(),
          `${fighter.id}/${move}`,
        );
        assert.equal(Boolean(assets.courier), hasCourier);
        for (const id of ids) {
          assert.equal(assets.sprites[id].entrance, undefined);
          assert.equal(assets.sprites[id].frames.length, 8);
          assert.ok(assets.sprites[id].image.width > 0);
        }
      }
    }
    assert.ok(
      [...browser.requests.keys()].every((url) => !url.includes("entrance")),
    );
    assert.ok(
      [...browser.requests.values()].every((count) => count === 1),
      "successful images are reused across moves and fighters",
    );
  } finally {
    browser.restore();
  }
});
