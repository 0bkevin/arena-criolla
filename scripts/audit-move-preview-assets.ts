import { readFile, stat } from "node:fs/promises";
import { BUILT_IN_FIGHTERS } from "../shared/content";
import { preloadAssets } from "../src/game/assets";
import { demoRivalFor, type GuideMove } from "../src/game/move-demo";
import { preloadMovePreviewAssets } from "../src/game/move-preview-assets";
import { browserFixture } from "../tests/helpers/asset-browser";

// Measures the real loader's cold image dependencies, not hardware speed.
// Use verified WebP alternatives for a conservative budget; AVIF can be smaller.
const manifest = JSON.parse(
  await readFile("shared/asset-variants.json", "utf8"),
);
const bytes = new Map<string, number>();
async function imageBytes(url: string) {
  if (!bytes.has(url)) {
    const sourceBytes = (await stat(`public${url}`)).size;
    const entry = manifest.assets[url.split("/").at(-1)!];
    bytes.set(
      url,
      Math.min(
        sourceBytes,
        ...(entry?.variants ?? [])
          .filter(
            (variant: { contentType: string }) =>
              variant.contentType === "image/webp",
          )
          .map((variant: { bytes: number }) => variant.bytes),
      ),
    );
  }
  return bytes.get(url)!;
}
function files(assets: Awaited<ReturnType<typeof preloadAssets>>) {
  return [
    ...new Set(
      [
        ...Object.values(assets.sprites).flatMap((sprite) => [
          sprite.image,
          sprite.entrance?.image,
        ]),
        ...Object.values(assets.stages),
        ...Object.values(assets.finaleProps),
      ]
        .filter((image): image is HTMLImageElement => Boolean(image))
        .map((image) => image.src),
    ),
  ];
}
async function budget(urls: string[]) {
  return {
    images: urls.length,
    bytes: (await Promise.all(urls.map(imageBytes))).reduce((a, b) => a + b, 0),
  };
}
const browser = browserFixture();
try {
  const characters = [];
  for (const fighter of BUILT_IN_FIGHTERS) {
    const full = await preloadAssets(
      [fighter.id, demoRivalFor(fighter.id)],
      ["caracas"],
    );
    const baseline = await budget(files(full));
    const idle = await budget([full.sprites[fighter.id].image.src]);
    const moves: Record<string, Awaited<ReturnType<typeof budget>>> = {};
    for (const move of [
      "light",
      "heavy",
      "special",
      "final",
      "combo1",
      "combo2",
    ] satisfies GuideMove[])
      moves[move] = await budget(
        files(await preloadMovePreviewAssets(fighter.id, move)),
      );
    characters.push({
      fighter: fighter.id,
      name: fighter.name,
      baseline,
      idle,
      moves,
    });
  }
  console.log(
    JSON.stringify(
      {
        policy:
          "Cold dependency bytes from the real loader; verified full-resolution WebP variants, shared URLs deduplicated. Excludes JS/CSS/audio, HTTP overhead, browser cache and hardware timing. AVIF negotiation may reduce these budgets further.",
        characters,
        summary: {
          characters: characters.length,
          moves: characters.length * 6,
          minimumBasicSavingsPercent: Math.min(
            ...characters.map(
              (c) => (1 - c.moves.light.bytes / c.baseline.bytes) * 100,
            ),
          ),
          maximumIdleBytes: Math.max(...characters.map((c) => c.idle.bytes)),
          maximumBasicBytes: Math.max(
            ...characters.map((c) => c.moves.light.bytes),
          ),
          maximumFinalBytes: Math.max(
            ...characters.map((c) => c.moves.final.bytes),
          ),
        },
      },
      null,
      2,
    ),
  );
} finally {
  browser.restore();
}
