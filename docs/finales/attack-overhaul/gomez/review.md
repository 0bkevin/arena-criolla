# Gómez — Carga del escuadrón

Reviewed 2026-10-19. Gómez now leads a mounted charge, followed by two cavalrymen. Three staggered contacts strike the rival; Gómez brakes, rides back, dismounts and resumes his canonical standing animation. The original arena, camera, captured player positions and central DEFINITIVA heading remain in use. The old office finale has been removed.

## Artwork and historical reference

The selected [v2 raw atlas](../../../../assets/source/finales/attack-overhaul/gomez/cavalry-v2-raw.png) preserves the established moustache, cap, navy uniform and illustrated ink treatment. Its eight complete poses cover readiness, two gallop strides, braking, two escort strides, dismount and the riderless horse. Hooves, reins, heads and boots were inspected over neutral gray and in the arena. The four generated raw files remain unchanged; [provenance.json](provenance.json) records their hashes alongside the unchanged canonical sprites and user reference.

The [research dossier](research.md) links the historical photograph, Fundación Empresas Polar biography and Academia Nacional de la Historia hosted biography. It explicitly separates documented period context from the fictional attack. The photograph's date is disputed and does not establish that Gómez himself is its mounted subject. Uniform details from the secondary discussion have lower confidence. The user's [mounted squadron reference](../references/gomez-mounted-squadron.png) remains byte-for-byte intact.

The selected sheet contained complete silhouettes crossing nominal grid boundaries. [Normalization](normalization.json) translates whole components into separate cells without scaling, rotation or painting. All 489,506 retained nonzero-alpha pixels preserve their exact RGBA, including the detached six-pixel alpha2 island inside the dismount silhouette. Only 2,083 wholly disconnected alpha1 noise pixels are discarded; invisible alpha0 background RGB is zeroed. Reconstructed retained-source RGBA matches exactly. [Packing audit](assets.json) verifies transparent gutters, real crop geometry and identical decoded RGBA between the packed PNG and runtime WebP. One source-pixel scale across poses avoids horses changing size between upright and galloping frames.

## Choreography and combat

[Implementation](../../../../src/game/finales/gomez.ts) preflights the image and all eight crops before painting. Missing, unloaded, undersized or incomplete art falls back to canonical bodies and damage. The escort uses horizontal staggering on the captured floor, with no decorative vertical depth offsets. Hurt frames react at each contact. Reduced-motion mode retains necessary travel and poses while omitting the optional impact ring.

| Ticks | Action |
| --- | --- |
| 0–17 | Mounted readiness; brief transition from canonical body |
| 18–75 | Commander gallops through contact at 48; escort follows |
| 70, 92 | Second and third cavalry contacts |
| 76–93 | Commander brakes within the existing viewport |
| 94–139 | Visible reverse ride toward his original captured location |
| 140–157 | Dismount with both boots and horse intact |
| 158–177 | Canonical standing body; riderless horse exits and fades |
| 178–180 | Clear normal stance, then engine release |

The near-edge review found that an unrestricted exit point hid braking and turnaround. The final path uses the common visible interval of the brake and both gallop poses in both facings. This keeps the commander readable without changing contact, scale, physical player positions or camera. The escort still leaves naturally. At a 1280-pixel viewport the complete P1 turning crop spans x=916.98–1270.45; P2 spans x=9.55–363.02. [P1 brake](p1-edge-brake.png), [P1 turn](p1-edge-turn.png), [P2 brake](p2-edge-brake.png) and [P2 turn](p2-edge-turn.png) were inspected and independently accepted by the root reviewer.

The [browser harness](../../../../scripts/gomez-overhaul-browser-qa.js) uses actual super inputs, production engine, renderer and loaded atlas. [Numerical evidence](browser-evidence.json) records identical P1/P2 results: 75 energy spent once, hits at ticks 48/70/92, 15.504 damage each and 46.512 total against the selected rival. Unlock remains three wins. Immediate release preserves captured positions: P1 [(430,554),(610,554)], P2 [(470,554),(650,554)]. The later targetPosition values in that file include normal post-release knockback; they are not release teleports. Guard, unlock and insufficient-energy rejection, deferred lethal stock resolution, frozen capture positions and clean input release are also covered by automated tests.

## Existing special

The regular special was inspected through actual inputs for both players at startup, contact and recovery. Its canonical raised-boot pose, ground wave and impact burst remain appropriate to the existing ground-command attack and match the character's established assets. No new mechanic or replacement art was needed. Both sides spent 25 energy, dealt one 25.704-damage hit against the selected rival and recovered normally. See [P1 special contact](p1-special-impact.png) and [P2 special contact](p2-special-impact.png); startup/recovery captures are saved beside them.

## Verification and captures

The focused command passed **45/45** tests:

```sh
npx tsx --test tests/gomez-overhaul.test.ts tests/attack-art.test.ts tests/character-audits/gomez.test.ts tests/finales.test.ts tests/finale-viewport.test.ts
```

Coverage includes actual crop use, charge travel, escort ordering, return/dismount, both sides, unequal captured heights, finite/world anchoring, near-edge bounds, reduced motion, missing art, combat gates/costs, exact damage timing, lethal stock resolution and clean release. The normalization helper's nine fixtures separately passed independent review. Root's full shared suite passed **935/935**, with TypeScript and whitespace checks clean.

[Full P1 sequence](p1-contact-sheet.png) and [full P2 sequence](p2-contact-sheet.png) show ticks 12, 32, 48, 70, 92, 120, 148, 165, 178 and immediate release, in reading order. Individual full-resolution captures are retained. [Reduced motion P1](p1-reduced-motion.png), [reduced motion P2](p2-reduced-motion.png) and [missing-art fallback](p1-missing-art.png) were also captured. All 33 individual screenshots use the live production engine/render/assets. The contact sheets were rebuilt from the final corrected capture batch and visually inspected. Root independently approved the selected raw artwork, ordinary contact, dismount and both near-edge turnaround sequences.

Guide source text is updated in `docs/finales/moveset-guide/descriptions.json`; generated guide HTML is intentionally left to the shared build step. No commits or pushes were made.

Root independent approval: inspected neutral-alpha raw variants, actual-input P1/P2 charge, grounded dismount and both near-ledge brake/turn captures. Complete commander silhouette stays visible without moving the camera; period riders and leather tack remain readable. Root independently ran33 character/provenance/world checks and the full935-test suite successfully. Regular special contact and recovery inspected. Character6 approved.
