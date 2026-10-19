# Melanio v44 adversarial review

Scope: the requested Melanio integration files and its shared projectile, presentation, and CPU paths. The follow-up includes inspection of the newly packed eight-pose WebP atlas.

## Findings and follow-up status

- **Resolved · Return turn has a clear visual direction cue** — [src/game/icon-renderer.ts](/home/ubuntu/.t3/projects/vepol/src/game/icon-renderer.ts:28). The updated signal adds a leading chevron, removes the spinning rotation, and changes color after `returnAfter`. The outer renderer mirrors by current `vx`, so the chevron points along the outbound and return legs and also follows reflected velocity. The strengthened behavior test observes both velocity directions before expiry.
- **Resolved · Presentation text now matches the authored gesture** — [shared/presentations.json](/home/ubuntu/.t3/projects/vepol/shared/presentations.json:6735). The captions now read “Asiente y abre la señal” and “Saludo breve de cabina”; neither claims an open palm or glasses adjustment. I visually inspected the packed eight-pose atlas and the remaining descriptions fit its poses and arm/head rig. No new art/presentation issue found.

No new integration issue found in this follow-up. The engine’s fixed projectile ownership, block removal, and reflection ownership transfer still align with the signal’s current-velocity direction cue.

## Behavior checks

- Follow-up exact command: `npx tsx --test tests/melanio-v44.test.ts tests/adversarial-online-roster-v41.test.ts` — **7/7 passed** (Melanio identity/registration, startup and energy, lifetime and observed reversal on both player sides, blocking and startup interruption on both sides, combo/super rules, deterministic moving-stage CPU use, online create/join/select/start on every stage, malformed input/rejoin handling).
- A focused simulation of unguarded spacing from 55 through 400 units produced one 8.24 HP hit at gaps through 220, then no hit at 240 and beyond; no repeated hit occurred on return. This agrees with the CPU’s projectile-specific spacing gate (~238 units) and shows the declared `range: 500` is not the effective reach for this returning shot.
- Engine-path inspection found no new multi-hit, block, or reflection defect: projectile ownership remains fixed on reversal, block removes the shot, and the existing reflection path transfers ownership and clears `returnAfter`. The focused Melanio test does not exercise counter/reflection contacts directly.
