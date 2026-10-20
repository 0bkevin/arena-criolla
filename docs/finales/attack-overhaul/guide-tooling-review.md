Generic guide tooling and combo simulation review

The fixed second light at frame 32 could swing below a rival still airborne from the first hit. The guide now sends ordinary movement/attack inputs after recovery, approaches and brakes, and waits for the rival to land and lose invincibility. Every required hit connects before the real combo window expires. No engine, character balance, assets, HP or mid-fight positions were edited for this correction. Combo posters now select their observed heavy impact.

The simulation was extracted to `../moveset-guide/simulation.ts`. All 208 non-combo demonstrations compare exactly, snapshot for snapshot, with the pre-extraction controller. The proof is in `guide-combo-simulation-noncombo-proof.json`. This is an equivalence check for the generic change, not a frozen expectation that future character revisions must preserve.

Validation completed:

- 52 integration tests cover all 104 complete combos: distinct contact order, actual HP changes/hit rewards, heavy name/bonus, legal inputs, free energy semantics and the real 150-tick window.
- 15 focused JavaScript tests cover media/audit/alias guards and the portable verifier, including fake repeated contacts, early or altered forms, hitstop, expiry-boundary damage, ringout HP resets, pending knockout flight, counters/reflection/status and ranged super projectiles.
- Strict standalone TypeScript compilation passed.
- All 312 current demonstrations passed mechanical state verification. `guide-combo-mechanical-verification.json` contains the results. This does not claim 312 rendered portable demos.
- A temporary frozen HTML with compressed embedded media passed all 36 demonstrations and 5,994 rendered frames for Javier, Capriles, Conde, Emilio, Maite and Nacho. Both forms lasted exactly 360 active ticks, connected verified powered light and bonused heavy follow-ups, and expired. Maite's ranged super damaged and removed a stock correctly. There were no network/load/render errors. `portable-verifier-six-fighter-after-combo-fix.json` records this subset; it is not the final 312-demo publication audit.
- Native negative probes detected a late image request through `setAttribute` and a seek that advanced source state/UI without fresh image rendering. See `portable-verifier-negative-probes.json`.

The reusable browser-only verifier is `../moveset-guide/verify-portable-browser.js`. It has no source/network dependencies and is injected into the newly built portable page through the native browser. It checks every frame in bounded batches and downloads useful per-case evidence. `finish()` refuses failed or incomplete runs. The raw full-quality draw audit remains separate proof for pruning.

`build.mjs` also maps identical verified preview hashes to one canonical file URL in local/inline modes. All loader IDs, files and manifest hash checks remain present; portable payload deduplication remains intact.

No published media, media manifest or existing portable HTML was rebuilt. The temporary smoke HTML was removed and its owned browser tab was closed. The final raw audit, media preparation/build, 312-demo portable traversal, and manual responsive/search/playback review must run after all 22 character revisions settle. Exact commands and injection instructions are in `../moveset-guide/BUILD.md`.
