# Pedro Vallenilla — attack overhaul review

Reviewed 2026-10-19. Scope: Pedro only. Canonical `vallenilla-v5` fighter sprite/source retained.

## Result

- Combo `Pago en cadena` is now `Cuota atrasada`, including the character audit assertion.
- Special retains its existing three installment projectiles, timing, damage, collision and 25-energy cost. Each now paints a complete yellow Cashea delivery box with a black C. The box drawing cancels the projectile's horizontal mirror so the brandmark stays readable for P1 and P2.
- Definitive `Cobro en equipo` uses a new canonical Pedro summon pose and exactly two white Cashea mascots, at distinct heights 236/260 in authored coordinates. They face inward and alternate jab, hook and uppercut on ticks 44, 62, 80, 98, 116 and 134. They arrive, strike and retire; the defender reacts on each damage beat.
- The existing 3-win unlock, 75-energy cost and 180-tick capture remain. Six equal portions total the same existing damage. Normal combat resumes after release.
- Dedicated layout anchors `(296,508)` and `(724,508)` keep the painted fighters at their captured world coordinates, including unequal heights. The regular arena and camera remain in use.
- Module checks the loaded image dimensions and all five required character poses before painting anything. The normal finale fallback remains available if the new sheet cannot load.

## Research and references

- [Cashea official site](https://www.cashea.app/) establishes the installment-purchase model and yellow/black branding.
- [Endeavor's Pedro Vallenilla profile](https://www.endeavor.org.ar/emprendedores/pedro-vallenilla/) identifies him as Cashea cofounder/CEO.
- [Cashea official X account](https://x.com/somoscashea) and its [brand banner](https://pbs.twimg.com/profile_banners/1573692721851777030/1752683531) show the white pointed-nose cartoon character in the yellow brand world.
- The user's two-mascot illustration and black-C-on-yellow reference control the likeness. New fighting poses are fictional game choreography, not a claim about the company or person.

Exact prompts, reference paths and tool provenance are in `provenance.json`. The built-in `image_gen.imagegen` tool generated all artwork with `transparent_background=true`; no CLI fallback or procedural substitute was used.

## Asset inspection

Raw generations remain unchanged in `assets/source/finales/attack-overhaul/vallenilla/`:

1. `cashea-v1-generated.png`: recognizable box, Pedro and white mascots, but poses exceeded equal-cell gutters. Rejected.
2. `cashea-v2-generated.png`: clean silhouettes and improved spacing; Pedro's extended finger still crossed the center cell's right border. Packing rejected it. Root independently approved identity/style but confirmed the gutter issue.
3. `cashea-v3-generated.png`: targeted uniform reduction/recentering of Pedro preserves whole finger, both hands and both shoes. All six complete silhouettes fit their cells. Approved and packed.

The generated-image preview shows colors under transparent pixels; those colors are invisible when composited. Real alpha was checked, and runtime screenshots have clean edges without background rectangles or glows. The packer retains connected faint alpha, validates complete-cell geometry, and writes exact RGBA lossless WebP. `assets.json` contains source, normalized, runtime and alpha SHA-256 hashes plus frame bounds. `prepare.json` reproduces the packing step.

Runtime sheet: `public/assets/vallenilla-cashea-attack-v1.webp`. Normalized source: `assets/source/finales/attack-overhaul/vallenilla/vallenilla-cashea-attack-v1-packed.png`.

## Validation

`npx tsc --noEmit` passed. The targeted run in `tests.txt` passed 32 tests across `finale-world`, `vallenilla-overhaul`, `character-audits/vallenilla` and `attack-art`.

Coverage includes P1/P2 costs/unlock, three blocked boxes, six precisely timed damage portions, frozen clock/world positions, queued-input rejection, release/knockback, lethal stock resolution at exit, missing/unloaded-image preflight, loaded real crop geometry, two-helper pose alternation, unequal-height anchor placement, provenance hashes and exact runtime RGBA.

Native T3 browser was opened in a dedicated tab after `preview_status`. `scripts/vallenilla-overhaul-browser-qa.js` imports the production engine/assets/renderer, dispatches actual `special`/`super` inputs and advances `stepMatch`; it never assigns a finale state. Both sides produced identical measured results in `browser-combat.json`:

| Attack | Energy paid | Spawned boxes | Damage beats | Total damage against Javier | Release |
| --- | ---: | ---: | ---: | ---: | --- |
| Special | 25 | 3 | 3 | 18.7254 | Passed |
| Definitive | 75 | 0 | 6 | 41.4884 | Passed |

The browser draw spy confirms the loaded sheet is used for three definitive images (Pedro plus two helpers), and that every special box has a positive horizontal transform, protecting the readable C on both sides. At the selected special snapshot one box is in flight while another has just impacted; all three are counted across the actual simulation.

Reviewed captures in `evidence/`: `p1-special.png`, `p2-special.png`, `p1-final.png`, `p2-final.png`, `p1-uppercut.png`, `p2-uppercut.png`, `p1-reduced-motion.png`. They show complete silhouettes, inward-facing helpers, hand contact at the defender, readable logos and the unchanged Poliedro arena. Reduced motion retains the correct strike pose/count while removing helper lunges.

The live move guide was also selected through `window.arenaMoveGuide.selectFighter('vallenilla')` and `selectMove('final')`, and sought to scene tick 116; it loaded the new sheet and retained `vallenilla-v5` as its canonical sprite. Descriptions were updated in source JSON; generated guide HTML was not rebuilt.

Root independent review: inspected the v2 and accepted v3 raw art, a neutral-background alpha diagnostic, the actual P1 final and the corrected P2 special capture. Canonical likeness, complete silhouettes, readable Cashea C, two distinct helper placements and arena contact are approved. Re-ran the 32 focused provenance, character, finale and world-position tests successfully.

Shared baseline follow-up: root repacked Pedro after adding visible-core anchorY/bodyHeight metadata to the packer; RGBA remains identical. All seven combat captures were refreshed using the actual-input browser harness and inspected again. Costs, three box hits, six mascot hits and damage totals are unchanged. The combined 25-test packing/provenance/Pedro/Javier/world run passed.

Root follow-up: optional missing artwork now draws visible yellow Cashea C boxes. Helpers use physical offsets independent of close capture spacing, alternate inward approach at a ledge, stay on rival surface and keep rival face foreground. Refreshed mirrored edge jab/hook captures show both helper faces and defender distinctly. The runtime bitmap and retained source art remain unchanged.
