# Renny Ottolina — El comercial del número uno

Reviewed locally 2026-10-19; awaiting root's independent approval.

Renny now sits on a painted aluminum stepladder and presents a commercial while two adult feather-costumed dancers attack the rival. The first dancer kicks at tick 42, the opposite dancer kicks at 90, and both push at 138. Opening and recovery use a distinct presentation pose. The ladder remains visible throughout. This replaces the old television/interview scene while retaining the current arena and camera.

## References and attribution

- The user's ladder photograph controls the seated-on-rung pose and full ladder contact. It appears to depict a stage portrayal, so the canonical `renny-v3` identity controls the face, hair, glasses, cream suit and burgundy tie. The user's second photograph controls the adult theatrical costumes and tall pink/yellow feather headdresses. The root preserved both reference files and hashes under `../references/`.
- [RCTV's 25-year anniversary archive, page 71](https://www.worldradiohistory.com/BOOKSHELF-ARH/Station-Books/Radio-Caracas-TV-Bodas-de-Plata-25-Year.pdf) describes the program's jingles and dance troupe, subsequently known as Las Chicas de Renny. This broadcaster archive is the primary historical support for the commercial/dancer theme.
- [Fundación Empresas Polar's biographical entry](https://bibliofep.fundacionempresaspolar.org/dhv/entradas/o/ottolina-renaldo-jose/) identifies the presenter and his television career.
- [El Estímulo's 2019 stage-tribute reporting](https://elestimulo.com/cultura/2019-10-03/renny-ottolina-merecia-este-tributo/) identifies actor Daniel Jiménez's portrayal and describes the revival's dancers and advertising references. [The companion theater coverage](https://elestimulo.com/climax/teatro/2019-07-26/renny-presente-la-vida-de-un-entertainer-sesudo/) provides additional context.
- The ladder pose is established by the supplied visual; research did not independently establish that this exact seated pose was part of the original television broadcasts. The attack kicks, joint push and “¡Y ahora, el comercial!” dialogue are original game choreography, not attributed historical acts or quotations. No external video or music is used.

## Art and runtime

Built-in `image_gen.imagegen` with `transparent_background=true` generated both raw originals. Exact prompts are `prompt-v1.txt` and `prompt-v2.txt`. Original PNGs remain unchanged in `assets/source/finales/attack-overhaul/renny/`; `provenance.json` records their SHA-256 and the unchanged canonical combat/entrance file hashes.

V1 had insufficient margins and was rejected. V2 is a 1254×1254 transparent 2×2 grid and required no padding. Its complete ladder, presentation, kick and push silhouettes pass the packer's visible and faint-alpha edge checks. `prepare.json` reproduces the build. `assets.json` records source/runtime/alpha/RGBA hashes, geometry and lossless WebP roundtrip verification. Runtime asset: `public/assets/renny-commercial-attack-v1.webp`.

The seated actor/ladder is one coherent drawing, keeping his weight on the rung, one shoe on a lower rung and the other low beside the ladder feet. Horizontal anchors use ladder/support-foot centers. The dancer heights (388/392/370 authored pixels) account for feathers and the bent push stance, preserving comparable human head/body scale. The visible core baseline keeps faint alpha from lifting supporting feet. Both helpers stay on the rival's captured surface even at unequal player heights. Main actor/rival anchors remain (273,516)/(785,516).

`src/game/finales/renny.ts` preflights all four poses and image dimensions before painting. Its canonical fallback retains both fighters and damage, without a television or desk; the obsolete Renny TV branch was removed. The target uses its actual canonical hurt frame. Copy and guide source descriptions were updated; the regular two-pulse special is unchanged.

## Verification

19 focused tests pass in `tests.txt`: actual P1/P2 super inputs; 3-win unlock and 75-energy cost; exact damage at all three beats; frozen capture coordinates/clock; release and discarded in-capture inputs; guard, behind, locked and depleted rejection; lethal-stock resolution on exit; real sprite crop selection and missing/unloaded-asset preflight; main and helper anchors at unequal heights; generated-original/canonical file hashes; dynamic source/runtime provenance; the existing Renny combat audit. TypeScript and `git diff --check` pass.

`scripts/renny-overhaul-browser-qa.js` ran in an owned native T3 preview against production engine/assets/camera/renderer. It triggers real super inputs and never assigns a synthetic finale. Both player slots paid 75 energy, took three hits totaling 40.8 damage against Zavarce, retained two stocks and released normally. `browser-evidence.json` records these measurements.

Inspected captures: `p1-present.webp`, `p1-kick.webp`, `p1-other-kick.webp`, `p1-push.webp`, `p2-kick.webp`, `p2-push.webp`, `p2-reduced-motion.webp`. The commercial bubble clears the feather crowns; the ladder rubber feet and supporting shoes meet the platform. Kicks reach the rival and the final dancers push from opposite sides. Reduced motion retains distinct attacking poses, damage and release. Existing arena/camera remain visible throughout. Root inspected the first kick capture and approved identity, scale and contact; final raised-bubble captures await independent review.

Root independent review approved the final P1 joint push and P2 kick captures: commercial text clears the feathers, both dancers and seated presenter remain readable, and soles/ladder feet contact the platform. Root re-ran 17 focused Renny, provenance and world tests successfully.

Common API cleanup: canonical damage reactions now use explicit FinaleView body mode `hurt`, replacing an expanding list of character IDs in the shared renderer. Renny/Javier rendering stays identical; 24 focused presentation/character tests and TypeScript passed after this refactor.

Root follow-up: helpers approach from arena interior near ledges without moving camera or physical fighter anchors. Front idle and kick faces clear presenter; rear push position accounts for forward-leaning painted face. Shared edge containment tests cover all ticks, mirrored camera/DPR and reduced motion.
