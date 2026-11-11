# Damage balance

This pass aims for longer health depletion while retaining differences in roles,
range, control, armor and multi-hit patterns. Against 1.00 armor, the targets
are a median light near 6 HP, heavy near 10–11, and a typical special around
10–17 per activation, allowing up to 20 for high-risk punishes. The nominal full
definitive budget should be at most about 32 at the median and 36 for any
fighter; light-light-heavy should be around 27 at the median, and that string
plus a full definitive should stay under 60 for every fighter. These are formula
targets, not guarantees that all contacts connect. The empirical goals are
roughly 10–11 landed hits and 20–35% more seconds per 100 HP, with the largest
three-second burst near or below 55 and single HP drop below 36. A fighter's
damage rate outside 25% of the cast median warrants investigation, as does a CPU
win rate outside 35–65%; damage should not be used to compensate for unrelated
AI, movement or counter behavior.

## Calculation

For a normal or special contact, damage is
`(base * attacker.damage + bonus) * transformation * target.armor`. Armor is a
damage-taken multiplier. A guarded hit deals no HP damage. Heavy receives the
light-heavy or light-light-heavy bonus when the input history qualifies; a
definitive receives the definitive bonus. The bonuses are added after the
attacker multiplier. Specials may emit several pulses or projectiles, each with
the listed base damage, so their potential total must be evaluated across
contacts. Projectiles and field contacts can miss, be blocked or be suppressed
by invulnerability.

A damaging definitive's nominal budget is `(22 * attacker.damage + 7)` before
armor. Capture splits that budget into three beats and does not apply outgoing
transformation; field/projectile definitives snapshot the outgoing
transformation and divide the budget between contacts. Actual field contacts
depend on the individual finale and can be interrupted or overlap other attacks.
Conde and Emilio instead transform for 360 ticks at 1.2 outgoing damage; their
definitive is not a direct damage budget. The formula-only light-light-heavy
total is `22.4 * damage + 4`, and with a full damaging definitive it is
`44.4 * damage + 11`, before armor and transformation. At the median damage
multiplier of 0.98, light and heavy are 5.88 and 10.19 HP, the string is 25.95,
and the full definitive is 28.56. The largest formula-only string plus
definitive is Puma's 60.73 HP; this is a small exception to the approximate 60
HP target and assumes every contact lands. These are not verified true combos.

## Changes

Numbers are bases before multipliers, except Gómez's damage multiplier. Each row
affects only damage; force, health, stocks, energy and AI are unchanged.

| Location                | Value                   | Old → new              | Reason                                                                         |
| ----------------------- | ----------------------- | ---------------------- | ------------------------------------------------------------------------------ |
| `damage-values.ts`      | light                   | 7 → 6                  | Lengthen health depletion across the cast.                                     |
| `damage-values.ts`      | heavy                   | 13 → 10.4              | Reduce the dominant CPU attack and normal damage.                              |
| `damage-values.ts`      | light-heavy bonus       | 3 → 2                  | Reduce string amplification.                                                   |
| `damage-values.ts`      | light-light-heavy bonus | 7 → 4                  | Bring full strings near the median target.                                     |
| `damage-values.ts`      | definitive base         | 28 → 22                | Reduce full definitive budgets across modes.                                   |
| `damage-values.ts`      | definitive bonus        | 12 → 7                 | Reduce definitive and string burst.                                            |
| `fighters.json`         | Gómez damage multiplier | 1.20 → 1.08            | Reduce a cast-wide offense and defense advantage while retaining a power role. |
| `techniques.ts`         | Gómez command           | 21 → 17                | Grounded punish remains strong without the former 25.2 HP hit.                 |
| `techniques.ts`         | Simón cuatro            | 9 → 7 per projectile   | Reduce the three-projectile offered total.                                     |
| `techniques.ts`         | Conde whirl             | 20 → 16                | Reduce both normal and transformed punish damage.                              |
| `techniques.ts`         | Emilio echo             | 10 → 9 per pulse       | Reduce two-hit and transformed totals.                                         |
| `techniques.ts`         | George punchline        | 10 → 8.5 per pulse     | Reduce the observed two-hit total.                                             |
| `techniques.ts`         | Lionza wildspirit       | 19 → 17                | Keep the grounded punish strong but nearer the typical range.                  |
| `culture-techniques.ts` | Alí strum               | 7 → 6 per pulse        | Reduce the three-hit total.                                                    |
| `culture-techniques.ts` | Yordano fountain        | 7 → 6 per pulse        | Reduce the offered three-hit total.                                            |
| `culture-techniques.ts` | Lila cocotero           | 6 → 4.5 per projectile | Reduce the observed three-hit total without removing the spread identity.      |
| `culture-techniques.ts` | Rummy zapateo           | 5 → 4.5 per pulse      | Reduce the four-hit total.                                                     |
| `culture-techniques.ts` | Amanda curtain counter  | 17 → 14                | Reduce frequent counter damage and burst against the CPU.                      |
| `culture-techniques.ts` | Giuseppe audit          | 7 → 6 per pulse        | Reduce the observed three-hit total.                                           |
| `icon-techniques.ts`    | Edgar retake counter    | 18 → 14                | Reduce repeated counter burst against the CPU.                                 |

Lila's five offered projectiles still nominally total 24.3 HP against armor 1;
the audit's stationary trials observed at most three contacts, not five. This is
a deliberate exception to the nominal special target, pending wider human play
testing. Vicente's courier has a low per-contact value but repeated contacts and
control; Lele's special did not connect in the audit setup. Neither is evidence
for a blanket increase.

María Corina's caravan now offers four strikes, each one quarter of its
27.24 HP budget against armor 1, rather than one full hit. Its supporters do
not deal damage, and guarded strikes count toward the four-strike limit. At
armor 1 the full ride and formula-only light-light-heavy total 51.85 HP. No
damage adjustment was needed. Bolívar's cavalry, Gómez's horses, Lorenzo's
trucks and Vicente's couriers use force 1.5 per driving strike, down from 4.5.
María Corina's caravan uses up to 3, down from 4.5, with a cap of 4 on the
horizontal launch speed calculated before damage. Damage slightly increases
actual speed. Vicente's separate courier special keeps its force of 4.

In stationary Caracas and Guaira trials at 100 and 30 HP, rivals starting at
least 250 px from the forward edge stayed on stage unless damage depleted their
HP. At full HP central rides pushed roughly 40-165 px. Trials with a hard CPU
and immediate guard, jump or attack after the first hit did not show a loss of
most strikes from shorter stun; guarding blocked subsequent strikes both before
and after. These trials do not establish a general ring-out rate; human
play-testing remains necessary.

## Measurement and limitations

Run `npm run balance:report`; set `BALANCE_JSON=path` to save the structured
report and `BALANCE_STAGES=caracas,guaira` to select stages. The default runs
all distinct pairs on Caracas, both seats, four deterministic timing variants,
on hard difficulty, with a 10,000-tick limit. `BALANCE_DIFFICULTY` and
`BALANCE_LIMIT` override those settings. The report includes per-fighter
sources, matchups and static totals. Seconds per 100 HP uses total playing time
and HP removed, not stock duration. Burst is a rolling three-second sum, not a
proven combo. Capture beats count separately as HP drops. Individual pair
outcomes are noisy with eight games.

The hard CPU cadence chooses heavy rather than light, and most stocks are lost
to ring-outs rather than HP depletion. Its counter, movement and recovery
behavior is not representative of all human matchups. Lower damage can change
launch through lost-HP scaling without changing knockback itself, so health
metrics cannot promise longer stocks. Offered projectile totals are upper
arithmetic totals rather than guaranteed hits, and neither the CPU report nor
stationary trials exhausts possible inputs or positions. Human matchup and
stage-edge testing should follow, particularly for counters, mobility and
ring-out recovery; do not flatten damage to fix those separate mechanics.

## Results for this pass

The same Caracas settings before and after give the following cast results. The
reported largest drop and burst are the largest observed for any fighter, not
the cast medians. Baseline and final each cover 12,320 matches.

| Measure                       | Before                        | After                         |
| ----------------------------- | ----------------------------- | ----------------------------- |
| Median seconds per 100 HP     | 24.22                         | 29.94 (+23.6%)                |
| Median landed hits per 100 HP | 8.17                          | 9.84                          |
| Largest single HP drop        | George 43.64                  | George 30.54                  |
| Largest three-second burst    | Maite 74.23                   | Edgar 64.37                   |
| Fighter win-rate range        | Dorángel 30.45%–Amanda 82.95% | Dorángel 35.68%–Amanda 85.23% |
| HP KOs / ring-outs            | 4,768 / 29,912                | 2,530 / 32,221                |

After the caravan merge, María Corina's Caracas results changed from 32.32 to
32.33 seconds and 9.65 to 9.93 hits per 100 HP, 28.34 to 14.77 largest HP
drop, 46.38 to 40.63 maximum burst, and 43.86% to 45.23% wins. Her own stock
losses were 519 / 538 ring-outs before and 538 / 548 after; those figures are
not ring-outs she caused. Emilio lost three wins and Maite two; Lionza, Tío
Tigre and Carolina changed by one win each, out of 440 games. These
deterministic CPU results are not a causal estimate of the caravan's
competitive effect.

The hit count falls slightly short of the approximate 10–11 target. Edgar's
64.37 burst exceeds the 55 target, though it is below the old maximum; Amanda
reaches 56.12. The harness does not distinguish counters from ordinary special
contacts, but the counter users' special shares are 58.80% and 53.06% of
outgoing HP loss respectively. Edgar's observed burst went from 71.07 to 64.37
and his rate from 17.33 to 21.35 seconds per 100 HP. Their fast rates remain
below 75% of the 29.94-second median: Amanda 19.62 and Edgar 21.35. Dayana is
just above the 125% boundary at 37.51, with 38.18% wins. This is a measured CPU
cadence and contact-rate exception rather than proof of excessive per-hit
damage: Dayana's static heavy and special are 9.78 and 14.10 against armor 1.

Amanda (85.23%) and Edgar (75.91%) still win disproportionately; their high
special shares and the CPU's predictable attacks suggest counter behavior is a
major contributor, but these runs cannot isolate causation. Puma wins 67.50%,
with a 25.54-second damage rate within the 25% band; his power role and
mobility/knockback need human matchup testing before further damage changes.
Lowering counter damage alone did not resolve the CPU advantage, so investigate
counter frequency, counterplay, movement and edge recovery separately instead of
compensating with more damage reductions. The rate and win-rate ranges are
proxies, not a validated competitive tier list.

A separate full Guaira run gives 29.47 seconds and 9.82 hits per 100 HP, a 31.15
largest drop (George), and a 59.25 burst (Diablo). The win range is Juan
33.41%–Amanda 88.41%; Edgar is 71.36%. Amanda and Edgar remain the only fighters
outside the 25% damage-rate band there. Juan's 31.36 seconds is within that
band, so his low CPU win rate is not explained by damage rate alone. Stage
geometry and recovery deserve separate investigation.

## Follow-ups

- Investigate counter frequency and counterplay: Amanda and Edgar remain above
  the burst and win-rate targets against the CPU.
- Review the hard CPU's attack cadence, which only chooses heavy attacks.
- Play-test ride pushback and investigate other ring-outs, including edge
  recovery, jump cadence and knockback.
- Review same-tick trades: player 0 resolves first and is favored; the harness
  offsets seat timing to compensate.
- Play-test matchups with human players.
