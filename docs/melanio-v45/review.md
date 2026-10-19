# Melanio — adversarial movement review v45

Reviewed the three character commits (`e3cb373`, `c0c78a4`, `4bdbefb`) against merge-base `330787c`, then tested the correction in the current branch. Three independent agents reviewed engine contracts, visual/spec behavior, and network movement. The parent also drove actual browser matches and simulated multi-touch input.

## Standards

**0 findings.** The [engine review](engine-review.md) found no reproducible violation of the shared movement, platform, resource, collision or input contracts. Melanio continues to use the common deterministic simulation and server protocol.

## Spec

**1 Medium/P2 finding, resolved; high confidence.** At [renderer.ts:187](../../src/game/renderer.ts#L187), the signal previously inherited the generic special animation: guard for ticks 1–3, then a fully extended punch for ticks 4–51. The projectile actually launches at tick 21. This made the arm extend early and remain frozen through recovery.

The failing command was `npx tsx --test tests/melanio-render-v45.test.ts`: the test observed frame **5** instead of guarded frame **1** at tick 20. The correction now holds guard during grounded preparation, shows the release at ticks 21–28, then returns to the appropriate standing, running or jumping pose. Hitstun still selects recoil. Both-side tests run the actual engine and renderer and check ticks 20, 21 and 29, plus moving/airborne recovery. Attack damage, energy cost and physics required no change. See the independent [spec review](spec-review.md).

## Cases exercised

- **432 deterministic combat combinations:** eight rival abilities × nine stages × both player slots × three CPU difficulty levels. The matrix checks observed movement, attacks, hits, projectiles and input edges, along with bounded physics and repeatable results.
- Acceleration, rapid reversal, release-to-stop, double jump, rejected third jump and landing reset; dash direction/cooldown and interrupted startup; root escape, slow movement, hitstun, guard drift, insufficient-energy spam and ringout recovery.
- Platform drop-through, upward pass-through and landing on every stage; horizontal and vertical platform carry through movement and reversals.
- Signal hit/whiff, outbound and return contact, front/rear guard behavior, reflection ownership, counter contact and simultaneous two-player contact. Reflection/counter boundary fixtures are explicitly distinguished from ordinary emitted-projectile fights.
- **Real WebSocket integration:** Melanio as actual host/P1 and guest/P2; movement, jump, light/heavy/special; duplicate and lower action counters; released held inputs; stale old-match input after rematch; isolated concurrent rooms; identical returned-signal snapshots at the same authoritative match/tick. See the [network review](network-review.md).
- **Six browser fights:** Tío Tigre/hard CPU in Altamira; Carolina/local with Melanio P2 in Canaima; Knoche/normal CPU in Mérida; Zavarce/local with Melanio P2 in Maracaibo; then post-fix fights against Carolina/normal CPU in Valencia and Édgar/local with Melanio P2 in Poliedro. All exercised movement, jumps and attack input through the ordinary selection UI and keyboard handlers. Losing to a CPU is a legitimate combat outcome; the checks establish controls and finite game state, not guaranteed wins or that every attempted strike connects.
- **Six mobile input edge cases at 844×390:** opposing fingers cancel direction, releasing one finger preserves the other, pointer cancellation stops movement, a third jump is rejected, releasing the special after energy disables its button does not trap a pressed pointer, and blur pauses/releases inputs before resume. All ten 48×48 controls stayed inside the viewport; the arena canvas filled it exactly.

## Verification and limits

`npm test`: **813 passed, 0 failed, 0 skipped**. `npm run build -- --outDir /dev/shm/arena-melanio-v45-dist --emptyOutDir`: TypeScript and production build passed. The new renderer, engine and network regression suites are retained in `tests/melanio-*-v45.test.ts`. [Structured browser evidence](runtime-qa.json) includes the pre-fix and post-fix runs and individual mobile assertions.

Mobile capabilities and pointer events were simulated in the desktop browser; this is not physical-phone testing. WebSocket probes use local servers and sampled authoritative state, not a WAN latency/packet-loss certification. CI does not validate physical mobile hardware or real-world network conditions. Research images and character assets were not changed by this review. The temporary development server and browser tabs were closed.

Summary: Standards **0** findings; Spec **1 Medium/P2 resolved**; network **0** product findings. No unresolved product finding remains in the exercised cases.

RISKIEST LINE: [src/game/renderer.ts:187](../../src/game/renderer.ts#L187), where visual release timing follows `TECHNIQUES.signal.startup`; the regression protects both player sides if that timing changes.
