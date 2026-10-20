# Final validation

All six requested checks passed. **1,171 tests passed, 0 failed, 0 skipped, 0 cancelled.**

| Check | Result | Duration | Log |
| --- | --- | --- | --- |
| Full TypeScript test suite | 1156/1156 passed; 0 failed; 0 skipped; 0 cancelled | 88.342741683 s runner / 88.866 s wall | [full-tests.log](full-tests.log) |
| Guide media/portable verifier tests | 15/15 passed; 0 failed; 0 skipped; 0 cancelled | 0.214420939 s runner / 0.262 s wall | [guide-pipeline-tests.log](guide-pipeline-tests.log) |
| Application TypeScript | Passed | 9.742 s wall | [typecheck.log](typecheck.log) |
| Strict guide TypeScript | Passed | 3.727 s wall | [guide-typecheck.log](guide-typecheck.log) |
| Production build | Passed | 13.491 s wall | [build.log](build.log) |
| Git whitespace check | Passed | 0.029 s wall | [diff-check.log](diff-check.log) |

The full suite includes the 52 guide simulation tests; they were not rerun separately. The production build emitted only the known warning about chunks larger than 500 kB.

The frozen input snapshot is stable: **604 files**, with no added, removed, or changed input files. Before and after aggregate SHA-256:

`a6b9d5781ac48c7f340b2b22cf037cc4cdb6bcd19f8601280109afcd3ba4bbb6`

The snapshot covers all files under `shared/`, `src/`, `server/`, `tests/`, and `scripts/`; root `package*.json` and `tsconfig*.json`; direct guide `.ts`, `.js`, `.mjs` source files, `template.html`, and `descriptions.json`; and current `public/assets/**/*.webp`. Generated guide media/HTML/manifests/audit output, documentation/evidence, and `dist/` are excluded.

See [report.json](report.json), [the before snapshot](input-snapshot-before.json), [the after snapshot](input-snapshot-after.json), and [the exact comparison](input-snapshot-comparison.json). Per-command status JSON records commands, UTC timestamps, exit codes, and wall durations. No source edits, browser/media pipeline runs, or Git mutations were performed by this validation task.

Final publication is now complete. Root subsequently ran the fresh raw draw audit and the newly built compressed portable verification: **312 demonstrations / 48,544 frames each**, zero failures, no external resource requests. The offline HTML is23.26MiB, with all used media at full dimensions and exact source alpha; new attack previews retain RGB quality34. These browser/media steps are separate from the six-check validation task above.

See [publication.json](publication.json), [the portable verification](../../moveset-guide/portable-verification.json), [the raw draw audit](../../moveset-guide/draw-audit.json), [the UI confirmation](guide-ui-smoke.md), and [the offline HTML](../../moveset-guide/ataques-arena-criolla.html). Native dark/light inline previews also passed with no console messages. The thread HTML was published after those previews.
