# Adversarial visual and animation review — roster v41

Reviewed 18 October 2026. Scope: Javier, Dayana, Nacho, Capriles, Lorenzo, Carolina, Bolívar, and Édgar.

## Finding

### P2 — Bolívar's charge special slides in a straight-punch pose

**Confidence: high.** Bolívar's special is `liberator`, a 10-tick forward dash after its startup (`shared/icon-techniques.ts:43-53`; the fighter binding is `shared/fighters.json:1276-1298`). The combat renderer gives ordinary specials pose 5 after tick 4, then only switches to running poses 2/3 for `runway`, `courier`, `sprint`, `whirl`, and `rally` (`src/game/renderer.ts:170-198`). `liberator` is omitted from that dash animation branch. During its actual dash, the state sets forward velocity and `p.dash` (`shared/engine.ts:663-667`), while the sprite remains on pose 5, the atlas's extended straight punch. The renderer also draws Bolívar's tricolor dash trails, so the moving punch is plainly visible against a charge effect (`src/game/icon-renderer.ts:94-107`).

**Reproduction:** select Simón Bolívar and trigger `Carga libertadora`. Once the startup ends and the fighter surges forward, watch the sprite through the dash: it keeps the extended-punch frame instead of a charge/run pose. The mismatch is especially clear against the run-cycle poses in `docs/roster-expansion-v39/all-poses.png`.

**Regression and resolution:** `tests/adversarial-render-roster-v41.test.ts` runs the real `createMatch` → `stepMatch` special sequence, then calls `renderMatch` with unique frame textures and records which one is drawn. Before the fix, the dash sample failed with `facing=1: dash should render run frame 2/3, got frame 5`. After adding `liberator` to the dash animation mapping, the targeted test passes for both facings. It also confirms ready guard pose 0 during startup and recovery, guard pose 1 while blocking, and hurt pose 7 while stunned. The check uses legal settled block/stun states; it does not combine those states with an active attack. Low/high-platform gameplay was not part of this regression.

The targeted renderer regression passes (1/1), and `npx tsc --noEmit` passes.

**Evidence checked:** inspected the full v39 roster pose montage and the dedicated entrance sheets for current v40 Javier/Nacho and v39 Capriles; traced Bolívar's ability configuration, real dash state, renderer frame selection, and rendered effect. The current sheets show complete silhouettes in the supplied poses.

## Other reviewed fighters

No other material pose-direction, costume-continuity, frame-crop, or presentation mismatch was evident in the supplied pose montages and the renderer paths inspected. This is an image and code-path review; it does not certify every live gameplay state for all eight fighters.
