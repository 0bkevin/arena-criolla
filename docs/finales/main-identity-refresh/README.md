# Finale identity refresh — 2026-10-19

The painted finale actors now follow the four updated designs brought in from main:

| Character | Current canonical sprite | Refreshed roles |
| --- | --- | --- |
| Capriles | `capriles-v39` | Four café gestures, seated guest, eight dance poses |
| Nacho | `nacho-v42` | Seated guest, eight dance poses, other dance performer roles |
| Javier Hala Madrid | `javier-v43` | Seated guest, eight dance poses |
| Doctor Knoche | `knoche-v46` | Seated guest, eight dance poses |

There are **40 new illustrated poses**: 32 dance figures, four seated guests, and four coffee gestures. Nacho's legacy performer sheet reuses his new eight-pose source. The current combat and entrance images remain byte-identical to main, recorded in [main-preservation.json](main-preservation.json).

Generation used **built-in `image_gen.imagegen`**, with genuine transparent backgrounds. Exact prompts and generation paths are in [generations.json](generations.json) and [prompts/](prompts/). Each dance sheet used its previous choreography sheet as the edit target and the current combat sheet as identity/style authority; Nacho and Knoche also used their latest identity masters. Capriles's coffee sheet used its previous four gestures and the v39 combat reference. The seated sheet used all four current combat references, with the old group sheet only as a sitting-anatomy example.

Visual review corrected clipped outer margins on the first seated and café candidates, and requested a closer match to Nacho's current face. The accepted generated PNGs are preserved unchanged; processing only isolates, scales and aligns complete figures. No hands, faces, clothing or limbs are reconstructed by code. Previous source sheets, prompts and individual canonical references are retained under `assets/source/finales/main-identity-refresh/pre-main/`; prior metadata is retained here with the `pre-main-` prefix. The 42 other dancers and all six old seated group sheets remain unchanged.

## Saved assets

- `assets/source/finales/perro-mujeriego-v3/{capriles,nacho,javier,knoche}-generated.png` → corresponding normalized PNGs and `public/assets/perro-mujeriego-v3-{id}.webp`.
- `assets/source/finales/finales-seated-main-v1-generated.png` → normalized PNG and `public/assets/finales-seated-main-v1.webp`.
- `assets/source/finales/finales-capriles-cafe-generated.png` → normalized PNG and `public/assets/finales-capriles-cafe.webp`.
- `assets/source/finales/finales-nacho-dance-generated.png` → normalized PNG and `public/assets/finales-nacho-dance.webp` (same current Nacho source, used by other finale roles).

The actor packer publishes the separate seated sheet over the four corresponding manifest entries. Other entries retain their original geometry and files. Its fallback dancer entries reuse actual poses from the current eight-frame sheets, with a hash of that dependency in `actor-packing.json`.

## Reproduce packing and verification

```sh
npx tsx scripts/prepare-perro-mujeriego.ts --only capriles,nacho,javier,knoche
npx tsx scripts/prepare-finale-actors.ts --only finales-seated-main-v1,finales-capriles-cafe,finales-nacho-dance
npx tsx --test tests/finale-identity-refresh.test.ts tests/finale-actors.test.ts
npm run build
```

Both packers reject incomplete or clipped selected art before publishing outputs. The tests compare every RGBA/alpha pixel of the four refreshed dance sequences and the seated/café atlases, their geometry, references, prompts, archive hashes and manifest selection. The isolated packing test also checks cache reuse, that a missing dance dependency cannot partially publish a seated update, and that a full rebuild cannot silently revert to older likenesses if the published refresh source disappears.

The focused regression run passed **101 tests**, including the character audits for all four refreshed identities, asset recovery, finale gameplay, world layout, choreography, audio and packing. After the final source-preservation guard, all nine actor/identity tests passed again. The production TypeScript/Vite build passed; Vite retains its existing bundle-size warning. Eight animated previews decoded in the native browser, and the inline review was checked at 728 px and 360 px widths.

The existing 360-tick choreography and its eight timestamps are unchanged. Both participants dance the same screen directions. All attacks remain in the current arena. No external song, YouTube player or video was added.

The expanded roster still has six newer fighters using their canonical sprite fallbacks. This refresh covers the four changed identities from the original 46 painted actors; it does not claim that all 52 fighters now have exclusive painted dance sheets. The strict full-roster audit continues to require 52.

## Actual renderer previews

The local capture harness uses the game's `preloadAssets`, `renderMatch` and `stepMatch` directly. Run Vite on 5184 and `node docs/finales/main-identity-refresh/frame-receiver.mjs`, then evaluate `export-frames.js` in a native T3 preview at `http://localhost:5191/` and call `identityExport.start()`. Encode with `node docs/finales/main-identity-refresh/encode-clips.mjs` (FFmpeg and Sharp). Captures contain 36 frames per scene: three seconds for the café/other attacks and six seconds for Nacho. WebP integer-millisecond timing differs by at most 1 ms. Full-resolution frame directories are ignored; compact review clips are retained in [review.html](review.html), with measurements in [preview-validation.json](preview-validation.json).
