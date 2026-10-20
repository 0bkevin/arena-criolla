# Exact-quality asset delivery

Open [the interactive report](index.html), or use [the per-file CSV](per-asset-results.csv) and [summary JSON](summary.json). All sizes use decimal MB/KB unless explicitly called KiB.

Latest main was fetched and merged first: `origin/main` at `ad8398068014a02d687a1ccc6b5c52b26f57e5e5`, merge `bf55b82`. The package conflict retains both the entrance and finale asset commands. All 246 original public files, including the new main assets, are byte-identical to that merged baseline.

## Results

- All 218 source raster images were evaluated for lossless same-format compression and exact AVIF. At the tested settings, only the social preview PNG is smaller as AVIF. Encoding the entire image inventory as exact AVIF would increase 140,737,875 bytes to 211,936,200 bytes. This is a measured comparison of the documented encoders/settings, not a claim about every possible encoder configuration.
- Publish 40 derivatives for 39 source images, saving 1,087,460 bytes across those selected sources with AVIF support. One source has both an AVIF and a PNG fallback. The other derivatives retain their original format. Every original stays available; a stale source, missing file, invalid hash or unsupported AVIF falls back safely. Content type follows the actual encoded file. AVIF negotiation uses `Vary: Accept`; wildcards and `image/avif;q=0` do not opt in. Existing source URLs revalidate through ETag rather than being incorrectly cached as immutable.
- All 159 smaller same-format candidates are recorded, but publication requires at least 4 KiB and 1% saving per source. This avoids retaining many extra files for tiny reductions. The CSV records candidates and deployed choices separately. The 141.2 MB inventory total is **not** one user's initial download.
- Only load seated atlases when a fight can use them (Capriles, Juan José Pocaterra, Carlos or Florentino), and dance atlases when Nacho is present. Keep both affected characters' required poses, all signature attack art, canonical sprites, entrance images, couriers, props and fallback performers. The two byte-identical Nacho dance files share one request/cache entry; a failed primary URL can still use the alternate.
- Six representative match pairs were measured with three cold runs each. Payload reductions range from 0% for Lorenzo/Dayana (already relevant assets only) to 43.9% for Conde/Emilio. La Llorona/Dudamel drops from 11,296,428 to 7,057,750 image bytes and 12 to 8 requests. With a shared aggregate 5 Mbps body limit and 80 ms response delay, three-run medians fall from 18,315.9 to 11,474.7 ms: **6,841.2 ms / 37.4% less waiting**. This measures the real bundled match image loader, not total page startup or a physical mobile device.
- Local unthrottled timing is mixed; Zavarce/Vallenilla and Juan/Dudamel have small median CPU/loopback increases despite fewer bytes. No blanket decoding or frame-rate improvement is claimed. A full immediate warm loader-cache call takes approximately 0–0.2 ms in this fixture.

## Quality and coverage

No source resizing, near-lossless conversion, palette quantization, chroma subsampling or lossy re-encoding was introduced. Acceptance requires identical complete straight decoded RGBA (including nonzero RGB under zero alpha), dimensions, color profiles, orientation and animation semantics. This preserves current decoded images; it cannot recover information already lost by an earlier source encoding. Main's existing AVIF entrance/background files and their original quality settings remain unchanged. Both final benchmark sides use main's existing background negotiation, so it is not counted as a new gain.

- [Same-format audit](per-asset-audit.json): 246 original public files; 218 raster images; exact gzip/Brotli byte round trips for all 246. MP3, TTF, SVG and text are retained. Caddy already enables zstd/gzip; this task does not claim to have added HTTP compression.
- [AVIF audit](avif-audit.json): all 218 raster images, Sharp lossless AVIF effort 4, 4:4:4, 8 bit. Full RGBA/metadata semantics are proven. Installed `avifenc` identity/GBR lossless is available as a fallback or explicit `--fallback=all` comparison. No smaller-candidate browser claim is inferred solely from Sharp.
- [Native codec proof](native-codec-proof.json): every one of the 40 published derivatives decoded in Chromium and compared at native dimensions using complete sRGB canvas RGBA, with zero differing channels. Browser canvas uses premultiplied alpha; the independent straight-RGBA proof covers the invisible RGB it discards. Decode timings use three independent Blob/Image decodes, alternating ordering. The OG AVIF is slower locally (110.2 ms versus 23.9 ms median) but saves 735,626 bytes; it is outside gameplay. Its PNG fallback saves 456,132 bytes.
- [Loading/render proof](loading-visual-proof.json): every-frame image provenance over all 312 move demos / 48,544 frames; 3,300 full 1080×640 RGBA comparisons at the listed keyframes and fixtures; 882 rendering fixtures including mirrored slots, all seated/dance target identities, reduced motion and missing-art paths. This does **not** claim full pixel comparison on every frame or physics replays for every substituted target. The unchanged renderer/engine and exact source fingerprints are recorded. Source URLs in this proof use original files; derivative equality is separately established above.
- [Final loading measurements](native-final-loading.json): 42 runs (36 loopback plus six throttled), fresh loader and unique image URLs, then immediate warm loader cache. Bandwidth is shared across the run, not multiplied by the number of requests. The 80 ms delay is a response delay rather than a complete network-link emulator. Browser body bytes exclude HTTP headers. Earlier raw-source loading-only measurements are retained in `native-loading-comparison.json`; use the final report for combined loading + delivery results.
- [Production delivery proof](production-delivery-proof.json): all 40 responses verified against byte hash and MIME through `makeArenaServer({production:true})` and the built `dist`, plus a successful homepage response. This was local verification, not a deployment.
- [Verification](verification.json) rechecks every original against the audit and committed Git blob, all derivative hashes/complete RGBA, browser coverage and frozen renderer/runtime fingerprints. The previously published portable guide is byte-identical; only its future build adapter changed so the shared image helper continues to support embedded assets.

`npm test` passes all **1,191** tests, including the codec, delivery, all 2,704 ordered match dependency cases, retry/alias and guide-adapter regressions. `npm run build` passes; Vite retains its existing large-bundle advisory. Independent read-only review found and resolved generated-file inventory recursion and checkpoint-policy reuse issues. Checkpoints now bind to implementation/tool versions/options and AVIF encoder coverage; regression fixtures cover both.

## Reproduce

From the repository root:

```sh
npm test
npm run build
npm run assets:audit:lossless
npm run assets:audit:avif
npm run assets:publish:lossless
npm run assets:verify:lossless
npm run perf:assets:report
npm run perf:assets
```

Audits can take many minutes. They never modify original files. They write candidate images to the recorded temporary directory and resumable local `.progress.jsonl` checkpoints. Keep that temporary directory until publishing; otherwise rerun the audits to regenerate missing candidates. Generated `public/assets/optimized/` files are excluded from future source inventories and verified against originals separately. A policy/tool/option change invalidates cached rows. Publication rejects changed sources, changed candidates, mismatched inventories and incomplete audits. Rerun browser verification after publishing any new variants before treating its proof as current; the verifier refuses missing or stale coverage.

The benchmark server binds only to loopback port 5195. `/baseline/assets/` serves originals with the same main background negotiation; `/assets/` uses the real lossless middleware. `/originals/` gives source bytes for pixel checking. `/throttled/{baseline,optimized}/assets/` shares a 625,000 B/s scheduler across each unique `asset-bench` run. It exposes no accounts, generation or production data.

In the native browser on `/docs/performance/lossless-assets/benchmark.html`, inject `scripts/asset-loading-browser-benchmark.js`, call `assetLoadingBenchmark.runPair({runtime:'baseline-runtime.js', pair:0, repeat:0, label:'baseline', prefix:'/baseline'})` and the optimized equivalent with `runtime:'optimized-runtime.js', prefix:''`. The six pairs are exported as `.pairs`. Use `/throttled/baseline` and `/throttled/optimized` prefixes for the controlled network fixture. Repeat three times and alternate ordering. `.download()` exports resource timing, byte counts, cold/warm timing and prop lists.

For full-image codec proof, inject `scripts/verify-lossless-browser.js` into a source-serving page (the original static port 5194 server was used in the recorded proof). When using port 5195, set `globalThis.losslessOriginalPrefix = '/originals/'` before injecting it; derivative and manifest requests retain their current paths. Await `losslessBrowserProof.finished`, require `.complete` and empty `.errors`, then call `.download()`. Do not use negotiated variant bytes as the original comparison; the source hash check rejects that mistake.

The two frozen browser bundles correspond to the recorded source fingerprints: baseline uses `src/game/assets.ts` from `bf55b82`, optimized uses the current loader. They export `preloadAssets`, `renderMatch`, `BUILT_IN_FIGHTERS`, `STAGES` and `simulateMoveDemo` from the production modules/guide simulation via an esbuild browser IIFE named `assetBenchmarkRuntime` (ES2022, minified). When rebuilding either bundle, regenerate the loading/render proof rather than reusing the old fingerprint. `scripts/asset-loading-visual-proof.js` exposes `.start(config)`, `.runBatch()` and `.download()`; initialize it on an original-file static server with the current config matching `loading-visual-proof.json.inputs`, run batches until complete, and never publish partial or failed coverage.

Primary codec references: [Sharp WebP](https://sharp.pixelplumbing.com/api-output/#webp), [cwebp exact/lossless](https://developers.google.com/speed/webp/docs/cwebp), [Sharp AVIF](https://sharp.pixelplumbing.com/api-output/#avif), [libavif CICP](https://github.com/AOMediaCodec/libavif/wiki/CICP). Encoder options and versions are preserved in the audit JSON. `report-inputs.json` binds the readable report to its evidence.
