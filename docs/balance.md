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

The observed specials above 17 are deliberate close-range punishes: Gómez
18.36 (grounded command), Puma 17.92 (close strike), George 18.19 (two
close pulses), Emilio 17.82 (two close pulses), Rummy 17.46 (four close
pulses) and Bolívar 18.72 (three close pulses). Conde and Emilio can transform
for 1.2 times outgoing damage; their transformed values remain below 24.
These classifications are provisional pending human play.

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

| Location                   | Value                   | Old → new                    | Reason                                                                                    |
| -------------------------- | ----------------------- | ---------------------------- | ----------------------------------------------------------------------------------------- |
| `damage-values.ts`         | light                   | 7 → 6                        | Lengthen health depletion across the cast.                                                |
| `damage-values.ts`         | heavy                   | 13 → 10.4                    | Reduce the dominant CPU attack and normal damage.                                         |
| `damage-values.ts`         | light-heavy bonus       | 3 → 2                        | Reduce string amplification.                                                              |
| `damage-values.ts`         | light-light-heavy bonus | 7 → 4                        | Bring full strings near the median target.                                                |
| `damage-values.ts`         | definitive base         | 28 → 22                      | Reduce full definitive budgets across modes.                                              |
| `damage-values.ts`         | definitive bonus        | 12 → 7                       | Reduce definitive and string burst.                                                       |
| `fighters.json`            | Gómez damage multiplier | 1.20 → 1.08                  | Reduce a cast-wide offense and defense advantage while retaining a power role.            |
| `techniques.ts`            | Gómez command           | 21 → 17                      | Grounded punish remains strong without the former 25.2 HP hit.                            |
| `techniques.ts`            | Simón cuatro            | 9 → 7 per projectile         | Reduce the three-projectile offered total.                                                |
| `techniques.ts`            | Conde whirl             | 20 → 15.3                    | Keep the dash and transformed damage within budget.                                       |
| `techniques.ts`            | Emilio echo             | 10 → 9 per pulse             | Reduce two-hit and transformed totals.                                                    |
| `techniques.ts`            | George punchline        | 10 → 8.5 per pulse           | Reduce the observed two-hit total.                                                        |
| `techniques.ts`            | Lionza wildspirit       | 19 → 16.1                    | Cap the ranged ground projectile.                                                         |
| `culture-techniques.ts`    | Alí strum               | 7 → 5.4 per pulse            | Cap the observed three-hit total.                                                         |
| `culture-techniques.ts`    | Yordano fountain        | 7 → 5.6 per pulse            | Cap the observed three-hit total.                                                         |
| `culture-techniques.ts`    | Lila cocotero           | 6 → 4.5 per projectile       | Reduce the observed three-hit total without removing the spread identity.                 |
| `culture-techniques.ts`    | Rummy zapateo           | 5 → 4.5 per pulse            | Reduce the four-hit total.                                                                |
| `culture-techniques.ts`    | Amanda curtain counter  | 17 → 14                      | Reduce frequent counter damage and burst against the CPU.                                 |
| `culture-techniques.ts`    | Giuseppe audit          | 7 → 5.8 per pulse            | Cap the observed three-hit total.                                                         |
| `culture-techniques.ts`    | Gualberto return        | 9 → 8.6 per projectile       | Cap the observed two-hit total.                                                           |
| `culture-techniques.ts`    | Gabriela pulses         | 9 → 8.4 per pulse            | Cap the observed two-hit total.                                                           |
| `founder-techniques.ts`    | Carlos dash             | 17 → 16.4                    | Cap the observed dash hit.                                                                |
| `techniques.ts`            | Vallenilla installments | 6 → 5.5 per pulse            | Cap the observed three-hit total.                                                         |
| `techniques.ts`            | Diablo projectile       | 17 → 15.9                    | Cap the ranged hit.                                                                       |
| `attacks.ts`               | connected counter       | follow-up allowed → consumed | Prevent the counter and its special strike stacking in one activation.                    |
| `arena-finale-specs.ts`    | ride helper force       | 4.5 → 1.5                    | Reduce pushback for Bolívar, Gómez, Lorenzo, Vicente and Simón while preserving old stun. |
| `arena-finale-contacts.ts` | María Corina ride force | 4.5 → at most 3              | Reduce pushback, cap launch speed and preserve old stun.                                  |
| `icon-techniques.ts`       | Edgar retake counter    | 18 → 14                      | Reduce repeated counter burst against the CPU.                                            |

Lila's five offered projectiles still nominally total 24.3 HP against armor 1;
the audit's stationary trials observed at most three contacts, not five.
Lorenzo (20.16), Simón (19.95) and Nacho (17.10) also offer more than 17 HP,
but their full totals were not observed in roughly 4,900 trials each, except
for Simón during edge ring-outs. These exceptions need wider human testing. Vicente's courier has one low-damage contact per activation: it is
removed on hit. Norkys observed 7.60 of 15.20 offered, Melanio 8.00, and
Amanda 8.40 plus her counter; these low-side specials were not changed in this
pass. Lele's special did not connect in the original audit setup.

María Corina's caravan now offers four strikes, each one quarter of its
27.24 HP budget against armor 1, rather than one full hit. Its supporters do
not deal damage, and guarded strikes count toward the four-strike limit. At
armor 1 the full ride and formula-only light-light-heavy total 51.85 HP. No
damage adjustment was needed. Bolívar's cavalry, Gómez's horses, Lorenzo's
trucks, Vicente's couriers and Simón's wooden horses use force 1.5 per driving
strike, down from 4.5.
María Corina's caravan uses up to 3, down from 4.5, with a cap of 4 on the
horizontal launch speed calculated before damage. Damage slightly increases
actual speed. A counter that lands consumes the follow-up strike. A stun floor derived from
the old 4.5 force prevents early recovery from interrupting the ride. Vicente's separate courier special keeps
its force of 4.

In stationary Caracas and Guaira trials at 100 and 30 HP, rivals starting at
least 250 px from the forward edge stayed on stage unless damage depleted their
HP. At full HP central rides pushed roughly 45-183 px, including about 181 px
for María Corina; at 60 HP displacement reached about 215 px. The smaller push
retains the old 17 ticks of stun, so a rival cannot cancel the ride by attacking
between strikes; guarding can still block subsequent strikes. These trials do not establish a general ring-out rate; human
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

Each stage uses 12,320 matches at the same hard CPU settings. The baseline is
commit `9643479`; the final includes the ride and counter fixes. The baseline
predates the merge of main's caravan multi-strike and finale collision changes,
so the differences also include those changes, especially for María Corina.
Largest hit
and burst are the largest observed for any fighter, not cast medians.

| Measure                       | Caracas before → after                                        | Guaira before → after                                     |
| ----------------------------- | ------------------------------------------------------------- | --------------------------------------------------------- |
| Median seconds per 100 HP     | 24.22 → 29.87 (+23.4%)                                        | 24.22 → 29.26 (+20.8%)                                    |
| Median landed hits per 100 HP | 8.17 → 9.84                                                   | 8.16 → 9.84                                               |
| Largest single HP drop        | George 43.64 → George 30.54                                   | George 43.22 → George 31.15                               |
| Largest three-second burst    | Maite 74.23 → Amanda 56.12                                    | Gómez 75.76 → Amanda 57.77                                |
| Fighter win-rate range        | Dorángel 30.45%–Amanda 82.95% → Dorángel 36.59%–Amanda 85.23% | Dorángel 31.14%–Amanda 87.73% → Juan 33.86%–Amanda 87.95% |
| HP KOs / ring-outs            | 4,768 / 29,912 → 2,570 / 32,184                               | 5,061 / 29,173 → 2,672 / 31,063                           |
| Median stock duration         | 11.95 → 11.57 s (-3.2%)                                       | 11.92 → 12.00 s (+0.7%)                                   |
| Mean stock duration           | 12.77 → 13.11 s (+2.7%)                                       | 12.83 → 13.37 s (+4.2%)                                   |
| Mean match duration           | 25.94 → 26.87 s (+3.6%)                                       | 26.02 → 27.02 s (+3.8%)                                   |

Fights grew by under one second on average in both stages, while the median
Caracas stock got shorter. Ring-outs account for 92.6% of final Caracas stocks
and 92.1% in Guaira; damage changes alone have limited effect on fight length
against this CPU. Seconds per 100 HP grew much more than actual durations.

María Corina took 478 stocks in the baseline Caracas run, 438 by ring-out;
afterward she took 551, 529 by ring-out. These are opponent stocks she took,
not her own losses. In the final run she lost 651 stocks, 614 by ring-out.
Her wins changed from 37.50% to 46.36%; the combined changes and deterministic
CPU trials do not isolate the caravan's competitive effect.

The final hit count remains just below the approximate 10–11 target. Amanda's
56.12 and 57.77 bursts exceed the 55 target; she wins 85.23% in Caracas and
87.95% in Guaira. Edgar wins 77.05% and 68.18%, respectively. Their counter
frequency and the CPU's predictable attacks warrant investigation; these
figures do not isolate causation. Puma wins 67.27% in Caracas. Damage rates and
win rates are proxies, not a validated competitive tier list.

## Follow-ups

- Investigate counter frequency and counterplay: Amanda and Edgar remain above
  the burst and win-rate targets against the CPU.
- Review the hard CPU's attack cadence, which only chooses heavy attacks.
- Play-test ride pushback and investigate other ring-outs, including edge
  recovery, jump cadence and knockback.
- Review same-tick trades: player 0 resolves first and is favored; the harness
  offsets seat timing to compensate.
- Test Puma's definitive: its handchain throws with force 19 and rang out a
  full-HP stationary rival from every tested position up to 700 px from the
  edge. This may contribute to his CPU win rate.
- Revisit Gómez's PODER identity after human play. His 1.08 damage multiplier
  is now below Puma's 1.12 and Conde's 1.10, and his CPU win rate fell from
  about 63% to about 48%.
- Review transformed Conde and Emilio damage and the low-side Norkys, Melanio
  and Amanda specials after human play.
- Play-test matchups with human players.
