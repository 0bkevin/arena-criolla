# Melanio and Knoche: integration before PR

Validated on 2026-10-19 after merging current `main` (`9328221`, PR #17) into the nine pending character commits. Combined code commit: `c17427a`. The merge preserves upstream interface, touch-control readability and overlay/input fixes without conflicts. The five v39 additions were already merged in PR #16; the pending roster change adds Melanio as fighter 52 and replaces Doctor Knoche's existing artwork.

## Fresh checks

- `TMPDIR=/dev/shm npm test`: **813 passed, 0 failed, 0 skipped**.
- `npm run check:assets`: **52 active PNG/WebP pairs passed**; the recorded geometry changed only in its validation timestamp.
- `TMPDIR=/dev/shm npm run build -- --outDir /dev/shm/arena-roster-pr-dist --emptyOutDir`: TypeScript and production build passed. Vite retains the existing bundle-size warning.
- `TMPDIR=/dev/shm npm audit --audit-level=low`: **0 vulnerabilities**.
- `git diff --check`: passed.

## Interactive checks after the merge

Both fights were selected through the regular interface and controlled through ordinary DOM keyboard events. Live match state was read for assertions without injecting positions, health, energy or actions into the simulation.

| Match | Result |
| --- | --- |
| Melanio/P1 against Knoche/normal CPU in Altamira | Movement, jumps, attack counters, executed special and finite state passed. |
| Knoche/P2 against Melanio/local with active opponent in Los Roques | The same checks passed, including the second player input mapping. |

Both active atlas versions loaded. Blur paused the match and normal controls resumed it. The second fight also used an 844×390 landscape viewport with simulated touch capability: the canvas covered the exact viewport and no horizontal overflow occurred. This is browser simulation rather than physical-phone testing. The [structured results](roster-pr-integration.json) retain individual assertions and received action counters.

The nine source character commits retain the detailed [Melanio incorporation](melanio-v44/review.md), [movement/network adversarial review](melanio-v45/review.md) and [Knoche visual/combat review](knoche-v46/review.md). No generated art or combat balance was changed during this merge validation.

The local validation did not build or scan a Docker image. The existing GitHub workflow runs the production container build, container CVE scan and HTTP/WebSocket smoke checks. The temporary server at 5193 and the owned browser tab were closed after the checks.
