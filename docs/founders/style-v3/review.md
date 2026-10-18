# Founder artwork consistency review — v3

Reviewed 18 October 2026. Scope: Enrique Rivas, Jesús Castillo, Carlos García Ottati, Víctor Cárdenas and Juan José Pocaterra.

## Findings and corrections

The v2 sheets met the technical eight-pose requirement. Their main visual weakness was a repeated deep, wide guard and nearly identical body template, with generic angular faces and simplified shading. The new sheets use Renny Ottolina as the illustrated style reference and each person's current portrait as the identity reference. Vicente Zavarce was also used for the final in-game comparison.

Each v3 sheet contains fresh artwork for all eight poses, with a more compact ready stance, a distinct raised guard, two running poses, a tucked jump, punch, kick and hurt reaction. The illustration keeps fine ink contours, cel shading and fabric detail. These remain illustrated interpretations; photographic identity references do not guarantee exact likeness.

| Fighter | Individual review |
| --- | --- |
| Enrique Rivas | Fuller cheeks, thick dark eyebrows, short black hair and a restrained smile; compact ready fists, purple-trim charcoal jacket, black shirt, jeans, watch and white shoes. The large lightning mark is replaced with a small violet accent. |
| Jesús Castillo | Longer oval face, subtler facial hair and a slimmer natural build; open leading hand, orange cap, navy polo, charcoal trousers and white/orange shoes. His airborne victory returns to a grounded ready frame. |
| Carlos García Ottati | Swept-back brown hair and a softer, more mature facial structure; focused expression, close guard, blue-trim black jacket, white shirt, dark jeans and white shoes. |
| Víctor Cárdenas | Softer facial proportions and visible light stubble, reduced arm bulk, compact upright guard; black tee, small orange accent, jeans and gray shoes. |
| Juan José Pocaterra | Shorter hair, close beard, relaxed open leading palm and grounded stance; pale blue rolled-sleeve shirt, navy trousers, brown belt and brown shoes. |

The first edit-based draft was rejected because it preserved too much of the old template. The accepted sheets were generated afresh from a photograph and the roster style reference. Rejected variants are not referenced by the game.

## Asset conventions

- Eight complete, separate silhouettes in four columns and two rows, facing right before the existing runtime mirror.
- Generated alpha is preserved. The existing strict atlas normalizer moves and uniformly scales whole silhouettes into padded 512-pixel cells; it does not invent limbs or missing poses.
- Final PNG sources are 2048 × 1024. Runtime WebP files use lossless encoding. The five sheets have approximately77–79% fully transparent pixels.
- Source and runtime silhouette geometry match. All forty poses render inside their portrait canvas in both directions, including extended kicks and tucked jumps.
- The existing abilities, balance values, presentation timings, choreography and victory profiles are preserved. Only the sprite references and artwork change.
- The founder gallery now calls the production `loadSprite` and `drawSprite` functions, so future sprite versions and frame geometry come from the current game catalog.

## Saved files and reproduction

- Original generated sheets: `assets/source/founders-v3/{enrique,jesus,carlos,victor,juan}-generated.png`.
- Packed game sources: `assets/source/{enrique,jesus,carlos,victor,juan}-v3.png`.
- Runtime assets: `public/assets/{enrique,jesus,carlos,victor,juan}-v3.webp`.
- [Exact prompts and references](prompts.json), [generation provenance](generated-assets.json), and the five `*-packing.json` audits.
- Run `node_modules/.bin/tsx scripts/pack-founder-style-v3.ts` to repack the tracked generated sheets, then `npm run check:assets` to rebuild the geometry manifest.
- `scripts/prepare-assets.mjs` also preserves lossless encoding for these sheets.
- [Updated founder gallery](../preview.html). It imports game modules and needs a Vite-served origin; this is a development review artifact, not a production route.

## Verification

[Runtime results](runtime-qa.json) record 80 complete pose/facing samples, 50 complete entrance samples, 25 rendered victory samples and a real UI match with each of the five fighters. Each match loaded its v3 sheet, reached play, and accepted special, jump and movement inputs. Energy measurements are recorded per character rather than assuming every special has the same cost.

The native browser screenshots show [all poses against two established fighters](all-poses.png), [entrance and victory samples](animations.png), [the founder gallery](gallery.png) and [an actual match](match.png). These were rendered with the production game code; generated atlases were also inspected individually.

## Identity reference sources

The photographs were downloaded again and inspected for this review. Existing multi-photo research remains in the founder dossiers.

- Enrique: [Fina's named portrait](https://www.finapartner.com/nuestra-historia/).
- Jesús: [Kontigo team](https://www.kontigo.com/quienes-somos).
- Carlos: [Kavak careers portrait](https://www.kavak.com/ar/empleos).
- Víctor: [Slash company portrait](https://www.slash.com/company/about).
- Juan José: [his public profile portrait](https://www.linkedin.com/in/juanpocaterra/) and [WEF profile](https://www.weforum.org/people/juan-jose-pocaterra/).
