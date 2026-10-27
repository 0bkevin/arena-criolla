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

## Commands

- `npm test`: every automated test.
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
- **Type check** for TypeScript/JSON changes, **`check:assets`** for sprite and
  roster changes, **`npm audit`** for lockfile changes, and the **deploy-control
  tests** for `deploy/` changes.
- **Image:** the production Docker image is built and booted (HTTP and WebSocket
  smoke test) when something it ships changes; Trivy scans it when the Dockerfile
  or lockfile changes. Docs- or test-only changes skip it.

`validate` is the single required check. It fails if planning fails or any
selected job fails; skipped jobs were not needed.

Each step runs once:

1. **PR → `main`:** the selected checks for the PR's diff.
2. **Promotion PR `main` → `prod`:** the tests affected by the whole `prod...main`
   diff (the combined result of several PRs), plus `prod-source`. No image build.
3. **Push to `prod`:** no tests. Build the image, scan it, smoke-test it, then
   deliver that exact image (see [deployment.md](deployment.md)).

A manual run of **Validate Arena Criolla** without inputs runs every check.
