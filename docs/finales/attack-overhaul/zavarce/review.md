# Vicente Zavarce attack review — 2026-10-19

Implemented and reviewed: **Entrega exprés** is one motorcycle, available at zero wins for 25 energy. **Pelotón Yummy** is the seven-motorcycle Definitiva, available at three wins for 75 energy. The arena, camera, platforms and canonical Zavarce sprite remain visible throughout.

## References and art decision

- [Y Combinator: Yummy](https://www.ycombinator.com/companies/yummy-inc) identifies Vicente Zavarce as the founder and describes Yummy's delivery and ridesharing business. This supports the courier theme.
- [Vicente Zavarce's own year-end account](https://www.linkedin.com/posts/vzavarce_as-the-year-comes-to-an-end-i-wanted-to-activity-7279610949056020481-J0AH) describes motorcycle and car trips, food delivery, and the driver fleet. The seven-bike attack is fictional game choreography inspired by that fleet.
- Inspected `assets/source/yummy-courier-v1.png`, its four runtime crops in `public/assets/yummy-courier-v1.webp`, and the current canonical `public/assets/zavarce-v5.webp`. The courier source has complete motorcycles, helmeted riders, green Yummy delivery bags and a consistent painted style. The packed atlas removes the source background and preserves whole wheels and riders.
- Retained the existing painted art. No image was generated, so there is no new generation prompt. No external video or audio was used.

## Behavior and rendering

The regular special retains its 12-frame startup, ground requirement, 8.5-unit projectile speed, jump/block counterplay and original per-bike damage. It creates exactly one projectile and expires or is consumed once. Its single rider is aligned to the launch surface instead of inheriting the old rear-lane offset.

The dedicated finale renderer draws seven complete raster crops, using the existing arena transform for P1/P2 orientation. Seven impacts occur at frames 42, 58, 74, 90, 106, 122 and 138 of the existing 180-frame finale. Each front wheel passes the target around its corresponding impact. Damage remains the original definitive total, divided into seven equal pulses; it is owned by the deterministic finale engine rather than duplicate projectile collisions. The popup now uses each finale's actual beat count.

Removed the old orbiting generic props and descending rocket delivery. The new sequence leaves Zavarce and the rival readable among the motorcycles. The final depth offsets are limited to ±6 authored units, keeping the wheels on the platform. Reduced motion keeps seven stationary riders and the same damage timing. A missing courier bitmap declines the revised renderer before painting; the fallback retains the canonical fighters and damage feedback without inventing replacement vehicles.

The third combo label and definitive title are now «Pelotón Yummy». Source guide descriptions have been updated; generated guide HTML was deliberately left for the root integration step.

## Actual engine and browser evidence

The native browser loaded the production `createMatch`, `stepMatch`, `preloadAssets`, camera and `renderMatch` from Vite. `scripts/zavarce-overhaul-browser-qa.js` triggers attacks through real action inputs, counts rendered courier images, records HP changes and checks release. These are not hand-authored finale states.

| Slot | Attack | Wins | Energy after input | Painted bikes | Damage pulses | Damage vs Javier |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| P1 | Ataque especial | 0 | 75 | 1 | 1 | 3.3887 |
| P2 | Ataque especial | 0 | 75 | 1 | 1 | 3.3887 |
| P1 | Definitiva | 3 | 25 | 7 | 7 | 39.4696 |
| P2 | Definitiva | 3 | 25 | 7 | 7 | 39.4696 |

All four cases preserved both stocks through attack release. The existing definitive knockback can subsequently cause a ring-out; the scene itself does not consume an additional stock. Full numerical evidence is in [browser-evidence.json](browser-evidence.json).

- [P1 special, simulation tick 23](p1-special.png)
- [P2 special, simulation tick 23](p2-special.png)
- [P1 definitive, scene tick 90](p1-final.png)
- [P2 definitive, scene tick 90](p2-final.png)
- [P2 definitive with reduced motion](reduced-final.png)

## Verification

- `npx tsc --noEmit` passed.
- 56 targeted tests passed across the Zavarce audit, overhaul tests, character abilities, finale engine, courier asset/matchup coverage, main integration, and attack-art tests.
- Courier matrix: 3,744 matchup cases, 936 special clashes, 90 platform cases and 120 interaction cases, covering the existing roster, nine arenas, both slots, guard/jump defenses, counters/reflection, deterministic replay, ground/platform launches and stock outcomes.
- Two targeted online room tests passed: one-bike synchronization against nine rivals across all nine stages, and reflected-bike synchronization for both player slots on three stages.
- Dedicated tests verify zero-/three-win gates, 25-/75-energy thresholds, seven equal damage beats, frozen combat positions/clock, facing and guard rejection, deferred lethal-stock resolution, input consumption during capture, clean release, whole atlas crops in both motion modes, and missing-image handling.
- Impeccable detector reported no findings for the changed courier renderers.
- Root independently reviewed the final P2 screenshot and approved the corrected floor contact and visible character identities.

The first visual pass revealed exaggerated depth offsets that lifted or lowered the bikes relative to the platform. One correction reduced those offsets, and the final screenshots above were captured after that change.

Root integration follow-up: corrected the remaining stale room gate test to reject the **definitive** below three wins, while the nine-stage single-motorcycle network matrix now runs with **zero wins**. Both targeted socket tests pass. In-game Help and README now describe one unlocked motorcycle versus the three-win peloton.
