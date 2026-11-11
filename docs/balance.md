# Damage balance

This pass aims for longer health depletion while retaining differences in roles,
range, control, armor and multi-hit patterns. Against 1.00 armor, the targets
are a median light near 6 HP, heavy near 10–11, and a typical special around
10–17 per activation. Safe or ranged specials cap at 17 HP per activation;
deliberate punishes cap at 20, and transformed specials at 24. The nominal full
definitive budget should be at most about 32 at the median and 36 for any
fighter; light-light-heavy should be around 27 at the median, and that string
plus a full definitive should stay under 60 for every fighter. These are formula
targets, not guarantees that all contacts connect. The empirical goals are
roughly 10–11 landed hits and 20–35% more seconds per 100 HP, with the largest
three-second burst near or below 55 and single HP drop below 36. A fighter's
damage rate outside 25% of the cast median warrants investigation, as does a CPU
win rate outside 35–65%; damage should not be used to compensate for unrelated
AI, movement or counter behavior.

The observed specials above 17 are deliberate close-range punishes: Gómez 18.36
(grounded command), George 18.19 (two close pulses), Emilio 17.82 (two close
pulses) and Bolívar 18.72 (three close pulses). Puma's mid-range roar and
Rummy's fast, two-sided zapateo are classified as low-risk and capped at 17.

Conde and Emilio can transform for 1.2 times outgoing damage; their transformed
values remain below 24. These classifications are provisional pending human
play.

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

Numbers are bases before multipliers, except Gómez's damage multiplier. Damage
bases do not change health, stocks, energy or AI. Gómez's damage multiplier also
feeds the sound weight in `src/game/audio/sound-effects.ts`.

| Location                | Value                   | Old → new                    | Reason                                                                                    |
| ----------------------- | ----------------------- | ---------------------------- | ----------------------------------------------------------------------------------------- |
| `damage-values.ts`      | light                   | 7 → 6                        | Lengthen health depletion across the cast.                                                |
| `damage-values.ts`      | heavy                   | 13 → 10.4                    | Reduce the dominant CPU attack and normal damage.                                         |
| `damage-values.ts`      | light-heavy bonus       | 3 → 2                        | Reduce string amplification.                                                              |
| `damage-values.ts`      | light-light-heavy bonus | 7 → 4                        | Bring full strings near the median target.                                                |
| `damage-values.ts`      | definitive base         | 28 → 22                      | Reduce full definitive budgets across modes.                                              |
| `damage-values.ts`      | definitive bonus        | 12 → 7                       | Reduce definitive and string burst.                                                       |
| `fighters.json`         | Gómez damage multiplier | 1.20 → 1.08                  | Reduce a cast-wide offense and defense advantage while retaining a power role.            |
| `techniques.ts`         | Gómez command           | 21 → 17                      | Grounded punish remains strong without the former 25.2 HP hit.                            |
| `techniques.ts`         | Puma roar               | 16 → 15.1                    | Reclassified as a low-risk mid-range poke.                                                |
| `techniques.ts`         | Simón cuatro            | 9 → 7 per projectile         | Reduce the three-projectile offered total.                                                |
| `techniques.ts`         | Conde whirl             | 20 → 15.3                    | Keep the dash and transformed damage within budget.                                       |
| `techniques.ts`         | Emilio echo             | 10 → 9 per pulse             | Reduce two-hit and transformed totals.                                                    |
| `techniques.ts`         | George punchline        | 10 → 8.5 per pulse           | Reduce the observed two-hit total.                                                        |
| `techniques.ts`         | Lionza wildspirit       | 19 → 16.1                    | Cap the ranged ground projectile.                                                         |
| `culture-techniques.ts` | Alí strum               | 7 → 5.4 per pulse            | Cap the observed three-hit total.                                                         |
| `culture-techniques.ts` | Yordano fountain        | 7 → 5.6 per pulse            | Cap the observed three-hit total.                                                         |
| `culture-techniques.ts` | Lila cocotero           | 6 → 4.5 per projectile       | Reduce the observed three-hit total without removing the spread identity.                 |
| `culture-techniques.ts` | Rummy zapateo           | 5 → 4.3 per pulse            | Reclassified as low-risk given its speed and two-sided coverage.                          |
| `culture-techniques.ts` | Amanda curtain counter  | 17 → 14                      | Reduce frequent counter damage and burst against the CPU.                                 |
| `culture-techniques.ts` | Giuseppe audit          | 7 → 5.8 per pulse            | Cap the observed three-hit total.                                                         |
| `culture-techniques.ts` | Gualberto tremolo       | 9 → 8.6 per projectile       | Cap the observed two-hit total.                                                           |
| `culture-techniques.ts` | Gabriela mirror         | 9 → 8.4 per pulse            | Cap the observed two-hit total.                                                           |
| `founder-techniques.ts` | Carlos ignition         | 17 → 16.4                    | Cap the observed dash hit.                                                                |
| `techniques.ts`         | Vallenilla installments | 6 → 5.5 per pulse            | Cap the observed three-hit total.                                                         |
| `techniques.ts`         | Diablo hellfire         | 17 → 15.9                    | Cap the ranged hit.                                                                       |
| `attacks.ts`            | connected counter       | follow-up allowed → consumed | Prevent the counter and its special strike stacking in one activation.                    |
| `arena-finale-specs.ts` | ride helper force       | 4.5 → 1.5                    | Reduce pushback for Bolívar, Gómez, Lorenzo, Vicente and Simón while preserving old stun. |
| `arena-finale-specs.ts` | María Corina ride force | 4.5 → at most 3              | Reduce pushback, cap launch speed and preserve old stun.                                  |
| `arena-finale-specs.ts` | Puma handchain throw    | 19 → 9                       | Keep edge throws dangerous without a full-health ring-out from mid-stage.                 |
| `icon-techniques.ts`    | Lorenzo polar           | 7 → 5.9 per projectile       | Cap the three-hit ranged total at 16.99 HP.                                               |
| `icon-techniques.ts`    | Edgar retake counter    | 18 → 14                      | Reduce repeated counter burst against the CPU.                                            |

Lila's five offered projectiles still nominally total 24.3 HP against armor 1;
the audit's stationary trials observed at most three contacts, not five.
Lorenzo's three projectiles can all connect at lower HP, dealing 16.99 HP after
this change. Simón (19.95) and Nacho (17.10) offer more than 17 HP, but their
full totals were not observed in roughly 4,900 trials each, except for Simón
during edge ring-outs. These exceptions need wider human testing. Vicente's
courier has one low-damage contact per activation: it is removed on hit. Norkys
observed 7.60 of 15.20 offered, Melanio 8.00, and Amanda 8.40 plus her counter;
these low-side specials were not changed in this pass. Lele's special did not
connect in the original audit setup.

María Corina's caravan now offers four strikes, each one quarter of its 27.24 HP
budget against armor 1, rather than one full hit. Its supporters do not deal
damage, and guarded strikes count toward the four-strike limit. At armor 1 the
full ride and formula-only light-light-heavy total 51.85 HP. No damage
adjustment was needed. Bolívar's cavalry, Gómez's horses, Lorenzo's trucks,
Vicente's couriers and Simón's wooden horses use force 1.5 per driving strike,
down from 4.5; the mount bodies of Bolívar, Gómez and Lorenzo also use 1.5, down
from 4.5. María Corina's caravan uses up to 3, down from 4.5, with a cap of 4 on
the horizontal launch speed calculated before damage. Damage slightly increases
actual speed. A counter that lands consumes the follow-up strike. A stun floor
derived from the old 4.5 force prevents early recovery from interrupting the
ride. Simón's wooden horses use a longer floor to cover their contact spacing.
Vicente's separate courier special keeps its force of 4.

In stationary Caracas and Guaira trials at 100 and 30 HP, rivals starting at
least 250 px from the forward edge stayed on stage unless damage depleted their
HP. At full HP central rides pushed roughly 45–181 px, including about 181 px
for María Corina; at 60 HP displacement reached about 215 px. The smaller push
retains the old 17 ticks of stun, so a rival cannot cancel the ride by attacking
between strikes. Ride strikes ignore dash invincibility; guarding blocks them. A
normal dash during the short post-hit protection window replaces that protection
with exactly eight dash-only ticks and can expose the rival to rides; this is
practically unreachable in ordinary play. These trials do not establish a
general ring-out rate; human play-testing remains necessary.

Puma's handchain still catches and throws on the same beats with the same
damage. Its final throw uses force 9 instead of 19; the initial catch retains
force 1. In stationary trials on Caracas and Guaira, both directions, against
armor 0.86, 1 and 1.07, all catches landed both contacts. At full HP, rivals
starting 150, 250 or 300 px from the forward edge were rung out; at 400 px or
more they stayed on stage. At 50 HP, they were rung out at 400 px but not at 550
px. At 70 HP, the armor 1.07 rival also rang out at 400 px. At 30 HP the armor
0.86 rival survived the damage and was rung out from 400 px, while the other two
lost their stock to damage. The old throw rang out every surviving target even
at 700 px. These are stationary measurements, not a guarantee for moving rivals
or other stages.

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

Each stage uses 12,320 matches at the same hard CPU settings. The baseline is
commit `9643479`; the final includes the ride, counter and Puma throw fixes. The
baseline predates the merge of main's caravan multi-strike and finale collision
changes, so the differences also include those changes, especially for María
Corina. Largest hit and burst are the largest observed for any fighter, not cast
medians.

| Measure                       | Caracas before → after                                        | Guaira before → after                                     |
| ----------------------------- | ------------------------------------------------------------- | --------------------------------------------------------- |
| Median seconds per 100 HP     | 24.22 → 29.98 (+23.8%)                                        | 24.22 → 29.52 (+21.9%)                                    |
| Median landed hits per 100 HP | 8.17 → 9.84                                                   | 8.16 → 9.83                                               |
| Largest single HP drop        | George 43.64 → George 30.54                                   | George 43.22 → George 31.15                               |
| Largest three-second burst    | Maite 74.23 → Amanda 56.12                                    | Gómez 75.76 → Amanda 57.77                                |
| Fighter win-rate range        | Dorángel 30.45%–Amanda 82.95% → Dorángel 36.14%–Amanda 85.45% | Dorángel 31.14%–Amanda 87.73% → Juan 33.41%–Amanda 88.41% |
| HP KOs / ring-outs            | 4,768 / 29,912 → 2,531 / 32,233                               | 5,061 / 29,173 → 2,638 / 31,080                           |
| Median stock duration         | 11.95 → 11.55 s (-3.3%)                                       | 11.92 → 11.98 s (+0.6%)                                   |
| Mean stock duration           | 12.77 → 13.10 s (+2.6%)                                       | 12.83 → 13.36 s (+4.1%)                                   |
| Mean match duration           | 25.94 → 26.85 s (+3.5%)                                       | 26.02 → 27.01 s (+3.8%)                                   |

Fights grew by under one second on average in both stages, while the median
Caracas stock got shorter. Ring-outs account for 92.72% of final Caracas stocks
and 92.18% in Guaira; damage changes alone have limited effect on fight length
against this CPU. Seconds per 100 HP grew much more than actual durations.

María Corina took 478 stocks in the baseline Caracas run, 438 by ring-out;
afterward she took 548, 526 by ring-out. These are opponent stocks she took, not
her own losses. In the final run she lost 652 stocks, 617 by ring-out. Her wins
changed from 37.50% to 46.14%; the combined changes and deterministic CPU trials
do not isolate the caravan's competitive effect.

The final hit count remains just below the approximate 10–11 target. Amanda's
56.12 and 57.77 bursts exceed the 55 target; she wins 85.45% in Caracas and
88.41% in Guaira. Edgar wins 77.05% and 67.05%, respectively. Their counter
frequency and the CPU's predictable attacks warrant investigation; these figures
do not isolate causation. Puma wins 63.64% in Caracas and 61.82% in Guaira,
within the 35–65% band; before the throw adjustment he won 64.55% and 62.50%,
respectively. Dayana wins 37.73% and 45.45%, and Juan wins 37.50% and 33.41%,
respectively. Damage rates and win rates are proxies, not a validated
competitive tier list.

## Ring-out penalty

The goal of #76 is to let a player recover from a fall and continue fighting.
Falling out of the arena originally removed all remaining health and one stock.
The selected rule separates the health penalty from the stock-loss threshold:
a fall with **10 HP or more removes exactly 40% of current health**. A fighter
with **less than 10 HP before the fall loses the stock**. There is no minimum
HP damage. This keeps the percentage consistent at 20 HP and other low-health
values while retaining a clear end to repeated escapes near defeat.

| Location           | Value                           | Selected rule                                  |
| ------------------ | ------------------------------- | ---------------------------------------------- |
| `damage-values.ts` | `RING_OUT_DAMAGE_FRACTION`      | 0.4 of current HP for a surviving fall         |
| `damage-values.ts` | `RING_OUT_STOCK_LOSS_THRESHOLD` | lose the stock only below 10 HP before falling |

### Current behavior

Calculate the penalty once from health immediately before leaving the arena:
`hp < 10 ? hp : 0.4 * hp`. The stock-loss check uses health **before** the
penalty. Fractional HP is retained, matching ordinary combat; the penalty is
not rounded up or down at every fall.

| HP before fall | HP lost | HP after fall |
| -------------: | ------: | ------------: |
|            100 |      40 |            60 |
|             75 |      30 |            45 |
|             50 |      20 |            30 |
|             25 |      10 |            15 |
|             20 |       8 |            12 |
|             15 |       6 |             9 |
|             10 |       4 |             6 |
|           9.99 |    9.99 |    stock lost |

A surviving fall preserves the stock, energy and active transformation, and
returns the fighter to their normal spawn. The penalty ignores armor and
transformation multipliers: equal starting health produces the same loss for
every fighter and seat. Ordinary jumps, platform landings, and recoverable trips
beyond the floor edge do not incur damage; crossing the left, right, or bottom
blast boundary triggers a fall. Crossing multiple boundaries in a tick still
charges once. Returning inside the arena prevents repeat charges for that fall.

A fighter at exactly 10 HP survives a fall with 6 HP. A fighter at 15 HP
survives with 9 HP; the next fall then loses the stock because it starts below 10. Losing a stock does not carry damage into the next stock. On the final
stock, a fall starting below 10 HP ends the match. Simultaneous lethal falls
can still produce a draw.

The HUD rounds to tenths below the cutoff, keeping the displayed value below
the cutoff and positive health visibly positive. This prevents an actual value such as 9.99
HP from being rounded up to a displayed 10 HP even though the next fall would
lose a stock. The mechanic itself uses the unrounded value.

Returning fighters can move and jump immediately, with the existing 30-tick
attack cooldown. A surviving fall grants 60 active ticks (one second) of return
protection; beginning an attack or charging a definitive ends that protection,
and a normal dash replaces it with its usual eight ticks. Rejected attack
requests do not remove protection. Separately granted technique immunity is
retained. Idle returns land within 22–34 ticks in the tested stages and seats,
so protection covers the descent without offering invulnerable attacks.

The reset clears obsolete dash, guard, attack, buffered input and combo state.
Input counters, match statistics and the once-per-match definitive usage flag
remain intact. Owned tethers and active field finales end because their old
coordinates and attached actions no longer match the returned fighter. Free-moving projectiles already launched remain live, as after a lost stock. A
transformation keeps its remaining duration and continues ticking normally;
it is neither renewed nor refunded. Surviving falls do not restore health or
energy, reward an opponent with hit energy, or refund a definitive use.

Actual stock loss retains its existing 110-tick respawn protection, 20-energy
cost and transformation cleanup. The balance report separates surviving falls
from damage dealt by the opponent.

### Current threshold-rule verification

Commit `3e4aa8f` removes the minimum damage and introduces the strict pre-fall
stock-loss threshold. Commit `71a1e3b` makes the low-health HUD respect that
visible cutoff. The same full Caracas hard CPU schedule was rerun:

| Full Caracas result                 | Previous percentage + minimum | Current percentage + stock-loss threshold |
| ----------------------------------- | ----------------------------: | ----------------------------------------: |
| Matches                             |                        12,320 |                                    12,320 |
| Mean match duration                 |                       41.65 s |                                   41.88 s |
| Mean surviving-fall HP loss         |                         19.91 |                                     19.16 |
| Falls that kept a stock             |                        50,359 |                                    50,506 |
| Stocks lost to falls                |       8,615 / 35,654 (24.16%) |                   9,028 / 35,638 (25.33%) |
| Timeouts / simulation-limit results |                         0 / 0 |                                     0 / 0 |

The current run uses every distinct fighter pair, both seats and the four
existing CPU timing variants. It is a mechanical proxy, not a measurement of
human enjoyment. An independent check verified exact 40% damage for all
**50,506** surviving falls, confirmed each fell from at least 10 HP, and
verified health conservation across all **35,638** completed stocks. Every
ring-out stock loss began with positive health strictly below 10 HP.

All **554 automated tests** pass, including explicit 20 → 12, 15 → 9 and 10 → 6
cases and both sides of the strict threshold on each seat and final stock.
Additional direct-engine checks cover **3,200** health/seat/stock combinations
and repeated resolution of the same exit. The graph matches the engine at
nine starting-health selections, including 9, 10 and 20 HP; its old minimum
reference line is removed. Build, TypeScript and formatting checks pass. All
12 browser layout checks pass in the nonhidden source copy described below.

### Historical percentage-plus-minimum verification

The intermediate percentage-plus-minimum policy is implemented by commit `8586139`. It keeps
the refined return behavior and changes the health calculation from fixed 10
HP to 40% of current HP with a 10 HP minimum. The same full Caracas schedule
was rerun against the fixed-10-HP results from commit `2b4c046`:

| Full Caracas hard CPU result        |             Fixed 10 HP | 40% of current HP, minimum 10 |
| ----------------------------------- | ----------------------: | ----------------------------: |
| Matches                             |                  12,320 |                        12,320 |
| Mean match duration                 |                 46.30 s |                       41.65 s |
| Mean surviving-fall HP loss         |                      10 |                         19.91 |
| Median surviving-fall HP loss       |                      10 |                         18.56 |
| Falls that kept a stock             |                  58,133 |                        50,359 |
| Stocks lost to falls                | 8,712 / 35,571 (24.49%) |       8,615 / 35,654 (24.16%) |
| Timeouts / simulation-limit results |                   0 / 0 |                         0 / 0 |

The 10 HP knockout threshold remains the same; the percentage increases the
cost of earlier falls while the player is healthier. In these CPU matches,
that makes the average surviving fall cost about 20 HP and shortens matches,
while the share of stocks directly ended by falls stays similar. This does not
establish balanced human matchups: the current CPU extremes are Amanda 88.41%
and Dayana 29.77%.

The other eight stages each ran 224 hard CPU matches, and all nine stages each
ran 224 matches at normal and easy difficulty, using the roster-ring sample
schedule described below. All **18,144** percentage-policy matches completed
without a timeout or simulation-limit result. Normal/easy sample mean match
times were 32.82/32.78 seconds. These samples exercise every fighter and both
seats, but are not complete matchup measurements outside the full Caracas run.

The recorder now observes the exact HP drop and pre-fall HP instead of assuming
a fixed loss or reconstructing it from a constant. It removes the fall's own
last drop for that victim from opponent damage, preserving legitimate hits in
the same step even when they deal an equal amount. Reports publish the
percentage/minimum policy and actual fall-damage distributions. An independent
check verified the formula for all **50,359** surviving falls and verified that
hit loss, surviving-fall loss and HP left account for the full health of all
**35,654** completed stocks in the Caracas report.

The full automated suite passes **552 tests**. Additional direct-engine checks
covered **1,600** starting-health/seat combinations, including repeat resolution
without another exit. The examples, crossover at 25 HP, fractional HP and
100 → 60 → 36 → 21.6 → 11.6 → 1.6 → stock-loss sequence have explicit regressions.
Build, TypeScript and formatting checks pass. All 12 browser checks also pass
in the nonhidden source copy described in the historical verification below.

### Reset problems found in the initial proposal

The initial proposal reused the entire stock-loss reset. An isolated
surviving fall from 100 HP and 70 energy produced 70 HP and 50 energy, cleared
an active transformation, and left an old dash and guard flag set. Those were
extra costs and stale state beyond the stated health penalty.

The original 110-tick protection outlasted the 30-tick attack cooldown. In a
reproduction, a returned fighter began a light attack with 79 protection ticks
remaining and an opposing hit was rejected. Making falls cheaper without
addressing this would increase the value of deliberately escaping for an
invulnerable attack. Shorter protection that ends on offense addresses that
specific exploit; teleporting back to spawn still offers positional relief.
The health cost makes that relief finite rather than free.

### Historical fixed-damage sensitivity

The comparison changes only `RING_OUT_DAMAGE` in isolated copies of commit
`66d4da7`, keeping the initial reset otherwise identical. Each candidate runs
all 1,540 distinct fighter pairs in Caracas, both seats, and all four existing
CPU timing variants: **12,320 hard CPU matches per candidate**. Each also runs
224 matches on every other stage: adjacent roster pairs plus last/first, both
seats and two timing variants. This exercises every fighter on all nine stages;
the sparse stage samples are not complete matchup balance measurements.

| HP penalty | Mean Caracas match |     Stocks lost to falls | Falls that kept a stock |
| ---------- | -----------------: | -----------------------: | ----------------------: |
| 30         |            37.86 s | 18,657 / 35,494 (52.56%) |                  34,548 |
| 20         |            41.76 s | 15,003 / 35,673 (42.06%) |                  45,699 |
| 15         |            44.46 s | 12,250 / 35,708 (34.31%) |                  53,039 |
| 10         |            47.75 s |  9,224 / 35,800 (25.77%) |                  61,679 |

All **56,448** hard CPU matches completed without a timeout or simulation-limit
result. Lower penalties let more falls preserve a stock without pushing these
CPU matches into the two-minute limit. An additional 2,016 normal and 2,016 easy
CPU matches using the original 30 HP reset also finished without either result.
Generated report snapshots stay outside the repository, following its policy
for generated reports. Reproduce a full Caracas case with
`BALANCE_JSON=/tmp/falls.json npm run balance:report`; stage samples use
`simulate` with the pair and timing scheme above.

These numbers isolate the health amount; they are not measurements of the
revised protection and energy behavior. Hard CPU attacks follow the documented
heavy-only cadence and do not represent a new player's input, frustration or
intentional escape tactics. Character extremes also persist: in the damage-only
10 HP case, Amanda wins 90.91% and Chataing 27.95% of their Caracas matches. This
is not evidence of balanced human matchups, and unrelated attack damage should
not be changed to make this fall experiment fit a win-rate band.

### Historical fixed-10-HP verification

The intermediate fixed 10 HP policy, including energy/transformation preservation, shorter
return protection and cancellation on offense, was then run independently with
the same pair schedule. It is the behavior implemented by commit `2b4c046`.

| Full Caracas result                 |      Initial 30 HP reset |     Revised 10 HP reset |
| ----------------------------------- | -----------------------: | ----------------------: |
| Hard CPU matches                    |                   12,320 |                  12,320 |
| Mean match duration                 |                  37.86 s |                 46.30 s |
| Stocks lost to falls                | 18,657 / 35,494 (52.56%) | 8,712 / 35,571 (24.49%) |
| Falls that kept a stock             |                   34,548 |                  58,133 |
| Player 0 / player 1 wins            |            6,167 / 6,153 |           6,189 / 6,131 |
| Timeouts / simulation-limit results |                    0 / 0 |                   0 / 0 |

All 14,112 revised-policy hard matches, including the eight other stage samples,
completed without a timeout or simulation-limit result. Two further all-stage
samples of 2,016 matches each did the same at normal and easy difficulty:

| All-stage roster-ring sample | Initial 30 HP mean match | Revised 10 HP mean match |
| ---------------------------- | -----------------------: | -----------------------: |
| Normal CPU                   |                  30.63 s |                  36.13 s |
| Easy CPU                     |                  30.59 s |                  34.64 s |

Across all five policy cases and the two difficulty comparisons, **78,624** CPU
matches were simulated. The revised full Caracas character extremes remain
Amanda 91.59% and Chataing 29.09%; preserving a player's opportunity to continue
is not equivalent to equalizing character matchups.

At that intermediate policy, the full automated suite passed **549 tests**, with 15 added fall regressions
and an updated real Puma edge-throw scenario. Coverage includes all fighters in
both seats, one charge for a multi-boundary exit, surviving and lethal final
stocks, simultaneous defeats, consecutive distinct falls, ordinary landings,
safe return landings on every stage, immediate movement, energy and
transformation preservation, stale action cleanup, buffered and rejected attacks,
protection cancellation, unrelated immunity and JSON round-trip determinism.
Additional seeded checks compared overlapping immunity with independent timers:
1,000 cancellation sequences and 128 expiry/cancellation sequences (15,360 ticks)
passed. Build, TypeScript and formatting checks also pass.

All 12 Playwright browser checks pass from an identical source copy outside the
hidden `.t3` directory. Running directly inside that directory exposes an
existing Express `sendFile` issue: the explicit Caracas AVIF route returns 404
because an ancestor is hidden, preventing two gameplay checks from loading.
No asset/server changes are included in this fall adjustment.

### Original whole-stock baseline

For context, the original whole-stock rule versus the initial 30 HP proposal,
using the same full Caracas configuration:

| Measure                  | Whole stock → initial 30 HP proposal |
| ------------------------ | ------------------------------------ |
| HP KOs / ring-out stocks | 2,531 / 32,233 → 16,837 / 18,657     |
| Ring-outs of all stocks  | 92.72% → 52.56%                      |
| HP left at a ring-out    | median 55.52 → 14.67                 |
| Median stock duration    | 11.55 → 18.57 s                      |
| Mean match duration      | 26.85 → 37.86 s                      |

### Remaining play-test questions

The user selected consistent percentage damage without a minimum, combined
with a separate stock-loss threshold below 10 HP. A pure percentage without
that threshold would keep leaving positive health. Starting at 100 HP with no
other damage, six distinct falls exhaust a stock:
100 → 60 → 36 → 21.6 → 12.96 → 7.776 → stock lost.
Starting at 20 HP gives 20 → 12 → 7.2 → stock lost. These sequences preserve
40% damage until a fall starts below the threshold.

Human play should check whether the larger loss while healthy feels fair,
whether the shrinking cost is clear, whether landing feels safe, whether
repeated knock-offs feel oppressive, and whether intentional escapes are too
valuable. Test close-range and projectile fighters, the last stock at low HP,
and local and online controls. Distinguishing accidental and opponent-caused
falls would require a trustworthy causal rule the current timing proxy cannot
provide. Do not infer improved player enjoyment solely from CPU results.

## Follow-ups

- Investigate counter frequency and counterplay: Amanda and Edgar remain above
  the burst and win-rate targets against the CPU.
- Review the hard CPU's attack cadence, which only chooses heavy attacks.
- Play-test ride pushback and investigate other ring-outs, including edge
  recovery, jump cadence and knockback.
- Play-test the 40%-of-current-HP penalty, below-10 stock-loss threshold and return protection; review
  intentional escapes and Chataing's CPU matchup results separately.
- Review same-tick trades: player 0 resolves first and is favored; the harness
  offsets seat timing to compensate.
- Revisit Gómez's PODER identity after human play. His 1.08 damage multiplier is
  now below Puma's 1.12 and Conde's 1.10, and his CPU win rate fell from about
  63% to about 48%.
- Review transformed Conde and Emilio damage and the low-side Norkys, Melanio
  and Amanda specials after human play.
- Play-test matchups with human players.
