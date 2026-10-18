# Javier, Dayana and Nacho — identity artwork revision v40

Reviewed on 18 October 2026. This revision follows the v39 roster expansion without removing any of its five added fighters.

## Appearance changes

- **Javier Hala Madrid:** researched his own public October 2026 videos and additional three-quarter photographs. Replaced the clean-shaven 2021-inspired face, oversized smooth quiff and black shirt with current wavy hair, moustache/short goatee and the textured gray shirt visible in his video. Kept the corrected adult head/body proportions. Rebuilt his entrance to use the same face and clothes. The likeness remains an illustrated interpretation; an independent review found the facial improvement partial rather than an exact portrait. [Sources and inspected frames](javier-research.md).
- **Dayana Mendoza:** the user confirmed a football **Vinotinto jersey**. Her face references come from Miss Universe and her own gallery; the burgundy/gold/tricolor costume comes from adidas's official Venezuela 26 photographs. Removed the gown, crown and heels. The sports costume is a requested fictional adaptation, not a claim that she wore this whole outfit in a real photograph. Updated the visible description, intro and victory names to fit the costume; preserved special timings, damage and unlocks. [Sources and costume distinction](dayana-research.md).
- **Nacho:** inspected May 2026 publisher photographs and actual interview frames, within the requested 18 October 2024–18 October 2026 window. Used a single coherent look: forward black cap, short full beard, black satin bomber with asymmetric silver graphic, black trousers and white/black trainers. Rebuilt his entrance with the same wardrobe and face. Carefully distinguished him from Chyno in two-person photographs. [Dated sources and inspected frames](nacho-research.md).

## Saved assets and production integration

Selected raw generations are in `assets/source/identity-v40/`. Normalized PNG sources are `assets/source/{javier,dayana,nacho}-v40.png` and `assets/source/{javier,nacho}-v40-defiant-entrance.png`; matching lossless WebP files are in `public/assets/`.

The built-in `image_gen.imagegen` tool produced the artwork. [Exact prompts, references and corrections](prompts.json) and [selected/rejected generation provenance](generated-assets.json) are retained. `npx tsx scripts/pack-identity-v40.ts` validates complete isolated silhouettes and packs all five selected sources into padded 2048×1024 atlases. It does not reconstruct missing limbs. A cropped entrance draft and a premature arm-release frame were rejected/corrected before publication.

Updated the live fighter catalog, entrance geometry, sprite QA metadata, manifest, encoder policy and preview image. All three fighters use ready frame 0 and eight right-facing source poses; the renderer mirrors them toward the opponent. Existing identifiers, combat balance and generic sound effects remain compatible. Entrance pose 5 holds crossed arms before the shared single-play action releases to guard.

## Verification

- **737/737 project tests**, including movement, double jumps, block direction, ordinary attacks, specials, combos, super gates and deterministic complete fights. The v39 individual suite now also exercises Nacho; existing individual Javier/Nacho audits pass.
- **93/93 focused checks** for the revised roster, entrances, presentation and victory behavior.
- **51/51 active PNG/WebP atlas pairs** pass the repository validator. Independent inspection confirmed exact alpha and visible color equality for the five new lossless pairs.
- Native-browser production-renderer review: **48/48 pose/facing samples**, **66/66 entrance samples**, 30 intro cinematic renders and 30 victory renders without exceptions or cropped silhouette samples.
- Actual UI matches exercised Javier and Dayana together, then Nacho against Javier. Recorded special-action history, energy costs, jumps, movement, facing and actual v40 resource paths. These were ordinary keyboard events through the game UI, not patched simulation state.
- TypeScript and Vite production build pass. The temporary development review HTML was removed from `public/` before building.

[Structured runtime evidence](runtime-qa.json), [before/after](comparison.png), [all poses with established roster references](all-poses.png), [Javier vs. Dayana](javier-vs-dayana.png), [Nacho vs. Javier](nacho-vs-javier.png).

The 844×390 browser viewport was also inspected, but this task did not test physical touch hardware or change mobile controls. Publication dates are distinguished from original filming dates in each research dossier. No real voice samples were added.
