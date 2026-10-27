import test from "node:test";
import assert from "node:assert/strict";
import { fighterById } from "../shared/content";
import actors from "../shared/finale-actor-assets.json";
import choreography from "../shared/perro-mujeriego-assets.json";
import { browserFixture } from "./helpers/asset-browser";

const primaryDance = "perro-mujeriego-v3-nacho";
const alternateDance = "finales-nacho-dance";
const danceUrl = `/assets/${primaryDance}.webp`;
const alternateUrl = `/assets/${alternateDance}.webp`;
const seated: Record<string, { file: string }> = actors.seated;
const recorded: Record<string, { file: string }> = choreography.dancers;

// Each scenario gets its own real loader cache, without adding test-only cache
// controls to the production module.
async function loader(
  scenario: string,
): Promise<typeof import("../src/game/assets")> {
  const url = new URL("../src/game/assets.ts", import.meta.url);
  url.searchParams.set("asset-loading-test", scenario);
  return import(url.href);
}

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

test("a fight starts before its super cinematic art, which joins the same record later", async () => {
  const browser = browserFixture();
  try {
    const { preloadAssets } = await loader("defer-finales");
    const cafe = `/assets/${actors.caprilesCafe.file}.webp`;
    const assets = await preloadAssets(["capriles", "giuseppe"], ["caracas"], {
      deferFinales: true,
    });
    assert.ok(assets.sprites.capriles && assets.stages.caracas);
    assert.equal(assets.finaleProps[actors.caprilesCafe.file], undefined);
    assert.equal(assets.finaleProps[seated.capriles.file], undefined);
    // Requested only once the mandatory art has resolved.
    assert.equal(browser.count(cafe), 1);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.ok(assets.finaleProps[actors.caprilesCafe.file]);
    assert.ok(assets.finaleProps[seated.capriles.file]);
    assert.equal(browser.count(cafe), 1);
  } finally {
    browser.restore();
  }
});

test("the lobby prefetch leaves super cinematic art to the started match", async () => {
  const browser = browserFixture();
  try {
    const { prefetchMatchAssets } = await loader("prefetch-without-finales");
    prefetchMatchAssets(["capriles", "giuseppe"], ["caracas"]);
    assert.equal(browser.count(`/assets/${actors.caprilesCafe.file}.webp`), 0);
    assert.equal(browser.count(`/assets/${seated.capriles.file}.webp`), 0);
    assert.equal(
      browser.count(`/assets/${fighterById("capriles").sprite}.webp`),
      1,
    );
    assert.equal(browser.count("/assets/caracas.webp"), 1);
  } finally {
    browser.restore();
  }
});
