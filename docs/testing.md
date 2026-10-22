# Tests and CI

Keep a test when its assertions detect an important behavioral failure: combat
rules, authoritative multiplayer state, account or filesystem isolation, paid
operator workflow correctness, input lifecycles, recovery from missing assets,
audio activation, or rendering geometry needed to play. A regression with exact
ticks or positions remains useful when those values reproduce a real boundary.

Remove tests that repeat the same shared behavior for every fighter, inventory
old artwork migrations, require specific prose or CSS/source fragments, enforce
decorative choices, or print observations without asserting the intended result.
Runtime relevance alone is not the criterion: the retained private creator and
operator import tests protect account boundaries, stored data and paid requests.

The 2026-10-22 static inspection covered all 167 original automated test files and
the seven manual browser fixtures. It removed 352 of 1,070 test declarations and
deleted 20 files. The remaining 718 declarations include parameterized tests;
these are source counts, not runtime case counts. More than 10,000 lines of test
code were removed. The inspection recorded each original file, its rationale,
removed titles and retained titles separately from the repository's operational
documentation. No tests, browser fixtures,
builds, smoke checks or benchmarks were executed during this cleanup, and there
was no adversarial review round. TypeScript and workflow checks were static.

The retained tests cover each fighter's distinct special mechanics. Shared engine
tests cover ordinary movement, guards, jumping, combos, stocks and deterministic
replay. Controls tests and browser fixtures cover input and focus/scroll behavior.
Artwork preparation scripts remain available, but their offline packing and
recompression test suites were removed from the routine suite. Those tools no
longer have dedicated automated coverage; inspect their outputs when changing
the authoring pipeline. `check:assets` still validates the public combat atlases
against runtime geometry. Asset loading, delivery, fallback and retry tests remain.

## Commands

- `npm test`: all retained automated tests.
- `npm run typecheck`: TypeScript only, including test and browser-fixture types.
- `npm run check:assets`: public combat atlas transparency, complete silhouettes
  and runtime geometry.
- `npm run build`: type checking and the Vite client build.
- `npm run perf:engine` / `npm run perf:network`: opt-in performance investigations,
  outside ordinary CI. Run these on comparable machines when changing performance.
- `npm run assets:audit:lossless` / `npm run assets:audit:avif`: opt-in image
  compression investigations. These are authoring tools that generate candidates,
  not quick validation commands.
- `tests/browser/README.md`: manual integration fixtures for real browser behavior.

## CI execution

The [last inspected baseline run](https://github.com/0bkevin/arena-criolla/actions/runs/39721004023)
took about four minutes, including 135 seconds for `npm test`. Recent feature
branches ran the same workflow for both push and PR events. No new duration has
been measured; the next CI runs must establish the actual improvement.

- Run on PR events, pushes to `main`, and manual dispatch. Feature branch pushes
  receive validation through their PR; a branch without a PR can use manual
  dispatch. Superseded runs for the same PR/ref are cancelled.
- Run the retained tests in two disjoint Node test-runner shards. Both receive the
  same explicit test-file globs as `npm test`; each file runs in one shard.
- Install dependencies with npm's download cache. Run the dependency audit and
  type check once on shard 1, and sprite validation once on shard 2. `npm ci`
  omits its implicit audit because the explicit audit covers the complete lockfile.
- Build the production image in parallel using Buildx and the GitHub Actions
  layer cache. The Docker build performs the client build; CI no longer builds
  that client again on the host. Changes confined to tests/docs do not invalidate
  the image's application-copy layer.
- Keep pulling base images, scan the complete runtime image with Trivy, and reuse
  its vulnerability database cache in six-hour buckets. Trivy's normal database
  refresh stays enabled. The scanner download retains its checksum verification.
- Boot the built image with the existing read-only filesystem and restricted
  container settings. Check HTTP readiness through its published host port, then
  run the HTTP/WebSocket smoke script inside the container using its installed
  runtime dependencies. No extra host npm install is needed for that job.
- Keep `validate` as the final required check. It succeeds only when both test
  shards and production-image checks succeed; a failed, cancelled or skipped
  dependency cannot pass the gate.

This repository has one GitHub Actions workflow and no separate automated deploy
workflow. The Docker install changes also avoid implicit npm audits during deploy
builds; production compose and operator deployment procedures are unchanged.

References: [Node test sharding](https://nodejs.org/api/test.html#runoptions),
[Docker's GitHub Actions layer cache](https://docs.docker.com/build/ci/github-actions/cache/).
