# Runtime performance follow-up

Applied the three highest-confidence findings from the Astra review of `7afaaa4` without changing artwork, dimensions, synthesis samples, gameplay, or the original asset negotiation policy.

| Measurement | Before | After |
| --- | ---: | ---: |
| Production entry JavaScript | 899,860 B | 766,534 B |
| Entry JavaScript, gzip | 252,282 B | 230,141 B |
| All JavaScript including both workers, gzip | 252,282 B | 233,773 B |
| Median main-thread timer gap during 48 kHz background synthesis | 379.5 ms | 4.2 ms |
| Vallenilla sprite preparation, median main-thread gap | 40.8 ms | 11.0 ms |
| Emilio sprite preparation, median main-thread gap | 47.4 ms | 11.6 ms |
| Maite sprite preparation, median main-thread gap | 72.5 ms | 9.4 ms |

These are native Chromium measurements on this Linux development machine, not mobile or field results. Music and sprite timings have three runs per variant. Sprite timing excludes network transfer and module parsing but includes decode/readback/analysis; runs alternate order. Worker startup and messaging can increase total preparation latency slightly: the improvement is responsiveness while preparation runs. The initial entry is 14.8% smaller raw and 8.8% smaller gzipped; including both on-demand workers, total JavaScript is 7.3% smaller gzipped. CSS and images are unchanged.

## Changes

- Generate only the personality and sprite-geometry fields the browser consumes. Complete authoring manifests remain in `docs`. `npm run build` regenerates the runtime projections; `npm run assets:metadata` updates them explicitly. A test compares every projected field with its source.
- Move deterministic music synthesis into a 7,046-byte worker. The same arithmetic runs in the same order at the actual AudioContext sample rate. Transfer completed Float32 channels without encoding or resampling. Prepare background, victory, draw and finale scores for the current match while its images load. Retain at most twelve prepared scores; playing sources retain their own buffer references.
- Move overlapping sprite-component isolation into an 841-byte worker. The existing isolation function, alpha thresholds, canvas crops and portrait calculations are unchanged. Keep input pixels available for recovery and transfer output buffers. Ordinary portraits and isolated attack poses preserve native resolution.
- Fall back to the same local algorithms if workers are absent, blocked, fail, or time out. Pending cue preparation never initiates playback: finale/victory playback uses the latest simulation clock. Background preparation uses a cancellation ticket so leaving or switching a match cannot revive stale music.
- Preserve the standalone HTML guide by compiling its exact local preparation path; downloaded HTML does not depend on sibling worker scripts. The existing published guide artifact remains unchanged.

## Verification

- Full suite: **1,194 tests passed**. Production build and TypeScript check passed. Focused guide compilation and asynchronous audio lifecycle tests also passed after the final guide adapter change.
- `quality-proof.json`: all 52 characters, eight poses, both facings; **832 complete rendered RGBA comparisons**, plus **29 isolated-frame RGBA comparisons**. Every geometry field and all portrait centers are equal. **212 stereo scores** (all character victories/finales, draw and background at both 44,100 and 48,000 Hz) match the frozen baseline byte for byte, including signed zero. Output hashes are recorded.
- `sprite-proof.json`: **1,664 complete 400×500 RGBA comparisons** covering every character/pose/facing in both full-body and bust portrait modes, plus sprite preparation measurements. Zero differing channels.
- `production-smoke.json`: actual production workers loaded successfully under the production CSP. The first background loop played at 44.1 kHz with no observed long task in the one-second window before/after its start; victory music played. A rematch reused the same music worker and cached assets. This smoke test is not a whole-game frame-rate benchmark.
- `provenance.json` binds the evidence to source hashes and baseline commit `7afaaa41fdbb028eb809cb166d892eabafb947b8`. `node scripts/verify-runtime-proof.mjs` checks completeness and freshness. The original lossless verifier now accepts this source-bound equivalence proof for the changed loader while retaining all other historical fingerprints. `npm run assets:verify:lossless` still verifies **246 unchanged original files and 40 exact derivatives**.

## Reproduce

1. Run `node scripts/build-runtime-baseline.mjs`, then start Vite locally. The ignored baseline bundle is regenerated from the fixed Git commit.
2. In a native browser on that Vite origin, import `/scripts/runtime-performance-browser.js`. Call `runtimeAudit.sprite(id)` for every `runtimeAudit.ids` entry; call `runtimeAudit.audio(id, rate)` for `ambience`, `draw` and every fighter at both rates. Run `runtimeAudit.timing(false)` and `runtimeAudit.timing(true)` three times. Preserve `runtimeAudit.report`, marking complete only after every call succeeds.
3. Import `/scripts/runtime-sprite-benchmark.js`. Call `spriteAudit.portraits()`, then `spriteAudit.timing(id, optimized, repeat)` for Vallenilla, Emilio and Maite, three repetitions, alternating variant order. Preserve `spriteAudit.results` after all calls complete.
4. Run `npm test`, `npm run build` and both proof verifiers. New measurements require new provenance hashes; never relabel an old run as current.

## Deferred findings

Local/practice speculative image prefetch is deferred: it can compete with visible portraits and spend bandwidth on abandoned selections. Coordinated image-cache eviction is also deferred: Astra's 344 MiB figure was a potential decoded capacity, not measured resident memory, and premature eviction can worsen rematches. Deeper application splitting remains a candidate for a separately measured change; the current entry still triggers Vite's 500 kB advisory. None of these should be introduced without a demonstrated user benefit and appropriate slow-network or memory evidence.

Worker packaging follows [Vite's documented worker construction](https://vite.dev/guide/features.html#web-workers); buffer transfer follows [the transferable-object API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects).
