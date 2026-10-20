import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BUILT_IN_FIGHTERS,
  fighterById,
  type FighterId,
} from "../shared/content";
import { finaleAsset } from "../shared/finales";
import atlas from "../shared/sprite-geometry.json";
import attackArt from "../shared/attack-assets.json";
import actors from "../shared/finale-actor-assets.json";
import cafe from "../shared/finale-cafe-assets.json";
import desk from "../shared/finale-desk-assets.json";
import choreography from "../shared/perro-mujeriego-assets.json";
import courier from "../shared/courier-assets.json";

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

function browserFixture(
  fail: (url: string, attempt: number) => boolean = () => false,
) {
  const originals = new Map(
    ["Image", "document"].map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ]),
  );
  const geometry = new Map<string, { width: number; height: number }>(
    atlas.sprites.flatMap((entry) =>
      entry.files
        .filter((file) => file.passed)
        .map(
          (file) => [`/${file.file.replace(/^public\//, "")}`, file] as const,
        ),
    ),
  );
  const requests = new Map<string, number>();
  class FixtureImage {
    width = 8;
    height = 4;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(url: string) {
      const attempt = (requests.get(url) ?? 0) + 1;
      requests.set(url, attempt);
      const checked = geometry.get(url);
      if (checked) {
        this.width = checked.width;
        this.height = checked.height;
      }
      queueMicrotask(() =>
        fail(url, attempt) ? this.onerror?.() : this.onload?.(),
      );
    }
  }
  Object.defineProperty(globalThis, "Image", {
    configurable: true,
    value: FixtureImage,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({
          drawImage() {},
          putImageData() {},
          getImageData: (
            _x: number,
            _y: number,
            width: number,
            height: number,
          ) => ({
            data: new Uint8ClampedArray(width * height * 4),
          }),
        }),
      }),
    },
  });
  return {
    requests,
    count: (url: string) => requests.get(url) ?? 0,
    restore() {
      for (const [name, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
      }
    },
  };
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

test("all 2704 ordered matches retain their required artwork and only request relevant seated and dance atlases", async () => {
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
            finaleAsset(id)?.file,
            performers[id]?.file,
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
    assert.equal(cases, 2704);
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
