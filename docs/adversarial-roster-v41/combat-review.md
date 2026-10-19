# Adversarial combat review: roster v41

## Scope

Reviewed Javier, Dayana, Nacho, Capriles, Lorenzo, Carolina, Bolívar, and Édgar in the shared deterministic combat engine. The review focused on their interactions with existing projectile, control, dash, counter, reflect, and folklore fighters across the full stage list. No runtime files were changed.

## Scenarios

- Ran 144 opening sequences: each of the eight reviewed fighters on both player sides across all nine stages. Each sequence ran up to 300 simulation ticks against a deterministic schedule of eight rival archetypes and called `cpuInput` at easy, normal, or hard difficulty. Per-tick checks covered finite positions and velocities, bounded health and energy, valid stocks, projectile state, hitstop, attacks, landings, and stock-loss/respawn behavior.
- Checked 16 close-range dash crossings, one per fighter and player side.
- Checked 64 directional attack and guard cases: forward light attacks, attacks while facing away, correctly oriented guards, and rear-facing guards, for every fighter on both sides.
- Checked 48 special/super gate cases: special rejected at 24 energy, special accepted at 25 and charged once, and unlocked super accepted at 100 and charged 75, for each fighter on both sides.
- Ran 80 moving-platform cases across the five stages with moving platforms. Every reviewed fighter rode each moving platform from both player sides for 180 ticks while support and platform-relative position were checked.
- Ran 24 full CPU matches, one for every reviewed fighter and CPU difficulty, then replayed each case and compared the complete resulting state. Every bout finished within the 5,500-tick bound.
- Checked Dayana's three-pulse special through hitstop. It landed on attack ticks 13, 25, and 37, producing three hits with hitstop pauses between the impacts.

The stage matrix has 144 deterministic row seeds: row order follows the fighter list in the test, then `STAGES` order, then P1/P2. CPU-match stage and rival selection also derive from fighter/difficulty indices, so runs are reproducible without random state.

## Results

All seven tests in `tests/adversarial-roster-v41.test.ts` passed. The focused run completed in about 3.7 seconds, and `npx tsc --noEmit` passed. The scenarios exercised both sides, all stages, all three CPU difficulties, projectiles, hitstop, landings, ringouts, special costs, and match completion. I found no confirmed combat defect, so there is no red-before-fix runtime regression to add.

This report covers deterministic engine behavior. Browser presentation and native interactive checks are covered separately.
