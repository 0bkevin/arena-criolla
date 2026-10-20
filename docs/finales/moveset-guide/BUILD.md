The portable guide uses the actual engine and renderer, full image dimensions, exact alpha, and RGB quality 34 for new attack art. Original files under `public/assets` are never changed. Identical preview payloads are embedded once while retaining every loader ID. Local/inline maps also alias identical verified preview hashes to one canonical file URL, so a renderer that auto-inlines local image paths does not expand duplicate payloads again. Every original preview file remains present and hash-checked.

Optional legacy images may be replaced with transparent placeholders only after an exhaustive draw audit proves that they are never drawn in any of the guided demonstrations. Canonical fighter sheets, the stage and every new attack sheet are always retained. A placeholder keeps the original dimensions; a runtime guard throws visibly if an unexpected path ever attempts to draw it.

Run this workflow **after all character and guide edits have settled**. Any subsequent change to the bundled engine/renderer/guide, template, audit implementation or any full-quality source WebP invalidates the audit and requires another run. No historical allowlist is trusted.

1. Prepare a frozen bundle and start the static server. Vite HMR must not host this audit because unrelated edits can reload its page midway through the run.

   ```sh
   node docs/finales/moveset-guide/prepare-draw-audit.mjs
   node docs/finales/moveset-guide/serve-draw-audit.mjs
   ```

2. In the native collaborative browser, open a new owned tab at `http://localhost:5193/docs/finales/moveset-guide/draw-audit.html`. Wait until `arenaMoveGuide.ready`. Repeatedly evaluate `await arenaGuideDrawAudit.runBatch(2000)` until its status says `complete: true`. Each call is bounded to at most 2000 frames; smaller budgets work too. The audit renders **every frame from 0 through the last**, including startup and release, for all 52 fighters × 6 moves. It records actual image draws, carries image provenance through cached canvas frame textures, checks that every definitive activated, and rejects image load/render errors. Canvas provenance is retained conservatively even after clears, since an offset or clipped clear can leave source pixels alive.

3. Evaluate the following in that tab to verify that sources still match and download the report. The native browser's downloads list supplies its saved local path; copy that file to `docs/finales/moveset-guide/draw-audit.json`. Do not return the entire report through an evaluate result because it can exceed the browser tool's result limit.

   ```js
   (async () => {
     const report = await arenaGuideDrawAudit.finish();
     const json = JSON.stringify(report, null, 2) + "\n";
     const link = document.createElement("a");
     link.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
     link.download = "draw-audit.json";
     link.click();
     setTimeout(() => URL.revokeObjectURL(link.href), 1000);
     return { ...arenaGuideDrawAudit.status, reportBytes: new Blob([json]).size };
   })()
   ```

4. Verify the saved report, prepare previews, then build. Both preparation and build independently reject stale or incomplete reports. Changed inputs during either command abort before publishing its output. The build checks the 24 MiB portable budget **before writing any HTML**.

   ```sh
   node docs/finales/moveset-guide/verify-draw-audit.mjs
   node docs/finales/moveset-guide/prepare-media.mjs
   node docs/finales/moveset-guide/build.mjs
   node --test tests/guide-media-pipeline.test.mjs tests/portable-guide-verifier.test.mjs
   npx tsx --test tests/guide-simulation.test.ts
   ```

   If a measured final build exceeds 24 MiB, `prepare-media.mjs --legacy-quality=24` is an explicit optional tradeoff for older preview RGB only. New attack sheets stay at quality 34; no dimensions or alpha values change. Try the default quality 34 build first.

5. Verify the **newly generated** portable HTML through a new owned native browser tab at `http://localhost:5193/docs/finales/moveset-guide/ataques-arena-criolla.html`. This is separate from the raw draw audit: it checks the actual compressed embedded media, production bundle and placeholder guard. It must run against the final build after all 22 character changes, not against a historical portable page.

   Wait for `arenaMoveGuide.ready`, then inject the complete contents of `verify-portable-browser.js` through native `preview_evaluate`. The verifier has no imports, fetches, source-file requests or server dependencies. For example, from Codex tool orchestration:

   ```js
   const source = await tools.exec_command({
     cmd: "cat docs/finales/moveset-guide/verify-portable-browser.js",
     max_output_tokens: 20000,
   });
   await tools.mcp__t3_code__preview_evaluate({
     tabId: ownedPortableTabId,
     expression: source.output + "\n;({version:arenaPortableGuideVerification.version})",
   });
   ```

   In that tab, run `await arenaPortableGuideVerification.start()` with its default 52-fighter contract. Repeatedly run `await arenaPortableGuideVerification.runBatch(2000)` until `complete: true`. Each result is small and includes failed demo/error counts. Every timeline frame must produce a fresh source image render and a guide canvas copy; matching UI state alone is insufficient.

   It checks real action starts and contacts, every distinct light/heavy combo hit, combo naming, costs/controls/descriptions, capture release and paused clock, ranged super projectiles, HP minima and stocks across ringout resets, counters/reflection and described slow/root effects. A final timeline must also finish any positive `knockoutDelay` on either player; ordinary hit stun/invulnerability remain allowed. For Conde and Emilio it checks all 360 active gameplay ticks, pause behavior, stable form/multiplier, actual powered light plus bonused combo1-heavy damage against the untransformed demos of the same rival, and expiry. It checks HP/stock/time/status/countdown UI on every frame. Decode failures, placeholder guard exceptions, uncaught errors and any external resource/network request fail the run.

   Download a passing report without returning its potentially large JSON through the tool result:

   ```js
   (() => {
     arenaPortableGuideVerification.finish(); // Throws if anything failed.
     return arenaPortableGuideVerification.download("portable-verification.json");
   })()
   ```

   Copy the native browser's downloaded file to this directory. Failed/incomplete evidence can still be downloaded explicitly with `arenaPortableGuideVerification.download("portable-verification-failed.json")`; it remains marked `passed: false`. Inspect concise failures with `arenaPortableGuideVerification.report({allowIncomplete:true}).rows.filter(row => !row.passed).map(row => ({fighter:row.fighter,move:row.move,failures:row.failures}))`. Correct real failures rather than weakening the checks, rebuild from a fresh raw audit if source inputs changed, and reload the tab before another run.

   Automated traversal does not replace visual review or the historical UI smoke: check accented search, empty/reset search, play/pause/restart, the timeline input itself, desktop/mobile layouts and dark/light themes separately. Close the owned verification tab after saving evidence.

For a nonpublished benchmark, pass `--out=/tmp/arena-guide-benchmark` to **both** prepare-media and build, and an absolute `--audit=/path/to/draw-audit.json` to preparation. This reads the current sources but writes previews/manifests/HTML only under the chosen directory. The fingerprint must still match; a stale report cannot authorize a dry-run prune either.

`draw-audit.html` is disposable and regenerated by the preparation command. `draw-audit.json`, `media-manifest.json` and `build-summary.json` provide the reproducible audit and hashes for the final publication. The static server binds only to 127.0.0.1 and serves GET/HEAD requests; `GUIDE_AUDIT_PORT` can choose a different port.

The pure guide simulation lives in `simulation.ts`. Combo demonstrations use ordinary movement and legal input timing after recovery/landing, rather than pressing the second light into an airborne rival. The 52 integration cases verify all 104 complete combos, contact order, heavy bonuses, energy/input semantics and the actual combo window. Combo posters select the observed heavy impact. Other attack/special/final inputs and initial placements retain their prior behavior; the extraction/combo change has a 208-demo snapshot-equivalence proof in `../attack-overhaul/guide-combo-simulation-noncombo-proof.json`.
