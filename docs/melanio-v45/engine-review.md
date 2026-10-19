# Melanio v45 engine and standards review

Scope: Melanio's movement and `Señal libre` against the repository's README gameplay contracts and the v44 review documentation. No project `AGENTS.md`, `CONTRIBUTING`, or standalone standards file was present. The README establishes the movement controls, double jump, blocking, platforms and stock-based combat; the shared engine defines acceleration, energy, 60 Hz simulation and deterministic CPU behavior. The v44 review documents the 21-tick startup, interruptibility, one returning projectile, and both-side use.

## Standards

No finding. The addition keeps Melanio on the shared `stepMatch` and `TECHNIQUES` path instead of adding character-specific movement or combat branches. The tuning and tests use simulation ticks and existing `Input`/`PlayerState` contracts. The review found no README gameplay convention that the movement integration contradicts.

## Runtime contracts

No reproducible defect found in the reviewed movement and signal paths. `tests/melanio-adversarial-v45.test.ts` exercises acceleration, reversal, settling, two-jump limit and landing reset; drop-through, underside pass-through and landing in all nine stages on both player sides; moving-platform carry; dash direction/cooldown and hit interruption; root, slow, hitstun, guarding, low-energy special attempts and ringout recovery. Signal cases observe actual contact, front blocking, long-range whiff, and second contact on return on both sides; they also stage a rear contact, verify projectile reflection ownership, Edgar's counter, simultaneous two-sided contact, and finite state.

The deterministic matrix covers 8 rival abilities × 9 stages × 2 Melanio sides × 3 CPU difficulties (432 rows). It asserts movement, confirmed hit damage, special starts, projectile activity, contact effects, hitstop, and CPU action edges, in addition to bounded state. Matrix runtime was under one second in the focused run.

The riskiest new runtime value is [shared/icon-techniques.ts](/home/ubuntu/.t3/projects/vepol/shared/icon-techniques.ts:71), where the projectile reverses at age 24 while expiring at 58. Those values depend on the shared projectile update order and hitstop behavior; both player-side tests observe outbound and return velocity on the same packet before expiry. Reflection and counter fixtures directly stage a signal projectile at the engine contact boundary, while separate tests verify actual signal emission and simultaneous actual signal contact.

Exact command: `npx tsx --test tests/melanio-adversarial-v45.test.ts tests/melanio-v44.test.ts` — **14/14 passed**, no skipped tests. The test-only run produced no unresolved failure.
