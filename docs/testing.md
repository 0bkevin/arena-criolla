# Testing and CI

```sh
npm test               # automated tests
npm run test:ui        # layout tests in Chromium; first run: npx playwright install chromium
npm run typecheck
npm run check:assets   # published sprites
node scripts/ci/select-checks.ts origin/main   # what CI would run for your branch
```

Behavior that only a real browser shows is covered by the [manual fixtures](../tests/manual/README.md).

## What to test

Test what would break the game: combat rules, online state, security, controls, audio, asset loading and deployment. A test for one character is only worth it for a mechanic the engine tests do not cover.

Do not test balance numbers, the same rule for every fighter, art metadata, or text and CSS in the source. Do not use screenshot comparisons in `e2e/`.

## CI

CI runs only the checks the diff can affect: tests that import the changed files, layout, type check, formatting, sprites, dependency audit, the Worker and the Docker image.

`validate` is the only required check. When it passes, CI records the tested git tree and does not test that same tree again on `main` or `cloudflare-prod`. Keep "Require branches to be up to date before merging" enabled on `main`.
