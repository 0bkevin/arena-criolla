# Javier Hala Madrid — scolding persona Definitiva

Reviewed 2026-10-19. Javier only; canonical `javier-v43` combat, entrance, source and identity master remain byte-identical (hashes in `provenance.json`).

The Definitiva is now **Regaño de campeonato**. Javier wears a red zip-neck top, black trousers and white sneakers, with a black T-shirt draped over his head as pretend hair. Four complete painted poses show him settling the shirt, wagging a finger, scolding with hands on hips and pointing at the rival. Generic original dialogue is used: “¡Un momentico!”, “¡A mí me escuchas!” and “¡Y punto!”. These are game dialogue, not verified quotations by the creator.

The three existing damage beats (42, 90, 138), 180-tick duration, three-win unlock and 75-energy cost remain. The target uses its canonical hurt frame on each beat. Actor/rival anchors remain `(362,515)` / `(789,510)`, retaining their own captured world positions, including unequal heights. The regular arena and camera stay active. The outfit is temporary and ends with the capture. The radial special remains intact.

`src/game/finales/javier.ts` preflights image dimensions and all four poses before painting. Missing artwork uses canonical combat bodies and damage text. The unused old football renderer was removed: Javier no longer uses sport, and Dayana (the only other sport profile) already uses her canonical icon sequence. No ball or goal fallback remains.

## References and attribution

- The user's supplied reference `df28393c-e9df-48e5-b42d-238b622bfd95-2b2c258d-0625-4c2b-8fcf-1f7521312449.png` directly establishes the black head-shirt and red top. This is the authoritative visual for the requested comedy persona.
- `assets/source/identity-v43/javier-classic-master.png` controls the current young, clean-shaven face, adult proportions and comic rendering style.
- [Creator Instagram](https://www.instagram.com/javierhalamadrid/) and [creator YouTube](https://www.youtube.com/@javierhalamadrid) were requested during research; direct fetches were rate-limited. No catchphrase is claimed from inaccessible footage.
- [El Farandi's 2017 coverage](https://www.elfarandi.com/2017/03/27/el-humorista-javier-hala-madrid-se-lanzo-al-aguafotos/) embeds the creator's Instagram posts under Javier Romero / `@javierhalamadrid`, confirming the creator identity.
- [Contemporaneous coverage of his 2015 comic posts](https://noticiasaldiayalahora.co/curiosidades/esto-fue-lo-que-hizo-el-tuitero-luego-de-que-maduro-leyera-su-mensaje-memes/) embeds his mother-character joke posts. It supplies context, not dialogue used in this sequence.

## Artwork and provenance

Built-in `image_gen.imagegen`, `transparent_background=true`, generated both raw versions. Exact prompts are `prompt-v1.txt` and `prompt-v2.txt`; both raw PNGs remain unchanged in `assets/source/finales/attack-overhaul/javier/`.

- V1 failed the packer's complete-cell alpha boundary check and was rejected.
- V2 preserves all four silhouettes. Its generated dimensions were 1205×1306, so `scolding-v2-grid.png` appends exactly one fully transparent column at the right edge for a divisible 2×2 grid. Every original RGBA pixel is unchanged. `provenance.json` records raw/grid SHA-256, dimensions and the row-by-row equality proof; `tests/javier-overhaul.test.ts` independently repeats that proof.
- `prepare.json` reproduces packing with `scripts/prepare-attack-art.ts`. The packer preserves connected faint alpha, discards only disconnected alpha-1 noise, rejects clipped cells, and emits exact RGBA lossless WebP. `assets.json` records source/packed/runtime/RGBA/alpha hashes and bounds.
- Runtime: `public/assets/javier-scolding-attack-v1.webp`. Packed PNG: `assets/source/finales/attack-overhaul/javier/javier-scolding-attack-v1-packed.png`.
- Root independently reviewed raw/packed art and a neutral-gray composite. The apparent red fringe in raw previews is invisible RGB under transparent pixels; runtime captures confirm clean edges. Each crouched pose renders at 276 authored pixels, versus standing 297/294, to preserve head/body scale rather than stretching the bent figure.
- Root's combat review detected faint alpha tails below the shoes. The shared packer now records a visible-core foot baseline (`anchorY`, alpha ≥40) and body height without removing any faint pixels; `drawAttackArt` uses those measurements. Repacking changed only geometry metadata, preserving the same packed/runtime pixel hashes. The feet now meet the arena surface. Horizontal anchors use each pose's foot midpoint, including fingerwag `.525` and extended point `.369`; the extended arm cannot shift the actor sideways. All captures below were refreshed after this correction.

## Verification

28 targeted tests pass (`tests.txt`): new persona/crop selection, P1/P2 costs and unlock, three equal damage beats, frozen capture coordinates and clock, release, blocked/behind captures, lethal-stock resolution, missing/unloaded-art preflight, unequal heights, raw padding proof, canonical asset hashes, exact runtime RGBA and the existing Javier character audit. `npx tsc --noEmit` and `git diff --check` pass.

The dedicated native T3 preview tab runs `scripts/javier-overhaul-browser-qa.js` against production `createMatch`, real super input, `stepMatch`, assets, camera and renderer. It never assigns a synthetic finale. Both sides consume 75 energy, draw exactly one painted Javier, apply three beats totalling 39.9432 damage against Zavarce, retain both stocks and release to normal combat (`browser-evidence.json`).

Inspected captures: `p1-headshirt.png`, `p1-fingerwag.png`, `p1-scold.png`, `p1-point.png`, `p2-fingerwag.png`, `p2-point.png`, `p2-reduced-motion.png`. Faces, shoes, fingers, head-shirt hems and both orientations are complete. The target visibly recoils; damage text is clear of the dialogue. Reduced motion retains the same poses and impacts. Root approved the persona and dialogue and supplied the final foot-baseline correction; refreshed captures are available for the final independent check.

Root independent approval: inspected raw and packed art, neutral-gray compositing and final P1/P2 combat captures after the baseline correction. The head-shirt persona, readable dialogue, stable gesture scale and visible shoe contact with the platform are approved. Root's 13 combined packing, provenance and Javier checks passed after the shared metadata change.

Root follow-up: extended kick appears on actual startup/damage tick9; radial visual sweep reaches its170-unit hit range. Actual mirrored contact captures approved,5 shared contact/readability tests pass.
