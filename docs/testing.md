# Tests and CI

Keep a test when a realistic regression would make it fail and that failure
matters: combat rules and deterministic replay, authoritative multiplayer state,
security and input validation, account or filesystem isolation and billing in the
private creator, input and audio lifecycles, asset loading and recovery, server
delivery, and deploy safety. A character-specific test earns its place only for
a mechanic the shared engine tests do not cover, asserting behavior rather than
tuning.

Do not add tests that pin balance numbers, repeat a generic rule for every
fighter, inventory metadata or artwork versions, look for prose or CSS/source
fragments, or log evidence instead of asserting it.

## Layout checks

`e2e/` drives the real app in Chromium at phone, phone-landscape, tablet and
desktop sizes. It checks what a player would notice: no control or heading is
cut off at the screen edge, the start button is not covered, dialogs fit on
screen and return focus on Escape, roster search works, the arena keeps its
proportions, phones in portrait get the rotate prompt, and touch controls stay
on screen without overlapping. Do not add pixel or screenshot comparisons; they
break on every art change. The page clips horizontal overflow, so checks
measure elements, not page scroll width.

## Commands

- `npm test`: every automated test.
- `npm run test:ui`: layout checks in Chromium with Playwright (`e2e/`). Starts its
  own server; run `npx playwright install chromium` once.
- `npm run typecheck`: TypeScript, including tests and browser fixtures.
- `npm run check:assets`: public combat atlas transparency, complete silhouettes
  and runtime geometry.
- `npm run build`: type checking and the Vite client build.
- `node scripts/select-checks.mjs origin/main`: what CI would run for your branch.
- `npm run perf:engine` / `npm run perf:network`: opt-in performance probes.
- `tests/browser/README.md`: manual fixtures for real browser behavior.

## CI and delivery

`scripts/select-checks.mjs` reads the diff and selects only what it can affect:

- **Tests:** a test file runs when it, or any file it imports transitively (or
  reads by repository path), changed. Changes to `package.json`, the lockfile,
  `tsconfig.json`, `tests/helpers`, `tests/fixtures`, workflows or the selector
  itself run every test.
- **Layout (`test:ui`)** for changes to `src/`, `shared/`, `public/`, `index.html`,
  the Vite config or `e2e/`.
- **Type check** for TypeScript/JSON changes, **`check:assets`** for sprite and
  roster changes, **`npm audit`** for lockfile changes, and the **deploy-control
  tests** for `deploy/` changes.
- **Image:** the production Docker image is built and booted (HTTP and WebSocket
  smoke test) when something it ships changes; Trivy scans it when the Dockerfile
  or lockfile changes. Docs- or test-only changes skip it.

`validate` is the single required check. It fails if any job that ran failed or
was cancelled; skipped jobs were not needed. A passing run records the git tree it
tested as a `tested-tree-<tree>` artifact (kept 90 days). Any later run on the same
tree reuses that result instead of testing again.

1. **PR → `main`:** the selected checks for the PR's diff. Keep "Require branches
   to be up to date before merging" enabled on `main`. Then the merged commit has
   the tree the PR tested, and `main` turns green without re-running anything.
2. **Push to `main`:** reuses the PR's result. Only a tree that was never tested
   (a merge of an out-of-date PR) runs the checks selected for the diff since the
   previous `main`.
3. **Promotion PR `main` → `prod`:** opened only after `main` is green. Its head
   is that `main` commit, so `main`'s passing run provides `validate`. The
   **Check production promotion** workflow adds `prod-source`, which requires the
   PR to come from this repository's `main`. Nothing is re-tested.
4. **Push to `prod`:** refuses to deploy unless `prod`'s tree passed CI, then
   builds, scans and smoke-tests the image and delivers that exact image (see
   [deployment.md](deployment.md)).

A manual run of **Validate Arena Criolla** runs every check and records the tree when it passes.
