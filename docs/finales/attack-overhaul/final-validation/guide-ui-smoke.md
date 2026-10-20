# Portable guide UI confirmation

All bounded checks passed. No defects found in the inspected scope.

| CSS viewport | Document width | Outer horizontal overflow | Minimum measured control height |
| --- | --- | --- | --- |
| 1280×800 | 1280 px | No | 44 px |
| 360×800 | 360 px | No | 44 px |
| 768×800 | 768 px | No | 44 px |

Maite’s heading and full in-canvas phrase remain contained. Native maria search finds María Corina Machado and María Lionza; Simon finds Simón Díaz and Simón Bolívar. An unmatched query shows an empty state; **Mostrar todos** restores all 52 options.

Native timeline **Home/End** reached 0/183 with a visible 3 px focus outline. Native play advanced to frame 14 after 250 ms with document.hidden=false; pause held frame 37 for 200 ms; restart resumed near the beginning (frame 5 after 100 ms). Seeding only the obsolete retry button’s visibility, then choosing Simón through the native select, hid it again. No visibility override was used.

Screenshots were saved by the native preview tool and visually inspected:

- [desktop](guide-ui-smoke.desktop.png) — native path: `/home/ubuntu/.t3/userdata/browser-artifacts/browser-screenshot-localhost-mvfylyz5-1aaa3d21.png`.
- [mobile-top](guide-ui-smoke.mobile-top.png) — native path: `/home/ubuntu/.t3/userdata/browser-artifacts/browser-screenshot-localhost-mvfymixg-6e09fc66.png`.
- [mobile-controls](guide-ui-smoke.mobile-controls.png) — native path: `/home/ubuntu/.t3/userdata/browser-artifacts/browser-screenshot-localhost-mvfymj28-1b5d4897.png`.
- [intermediate](guide-ui-smoke.intermediate.png) — native path: `/home/ubuntu/.t3/userdata/browser-artifacts/browser-screenshot-localhost-mvfymjcp-a7660cb5.png`.

Portable HTML SHA-256: `c86c703ecafe156cd10ad31d24da1b60c60e8925e9a685e3291a35a930cea428`. Build draw-audit fingerprint: `c602b9dc5daba5a354b96123e8067ae76b28b1c8a16a6121c9ccd8f0f917e45f`. All 604 frozen input files still match their original snapshot.

This confirms layout and bounded mouse/keyboard behavior in Chromium at resized viewports. It does not establish physical-touch behavior, full WCAG compliance, screen-reader coverage, themed rendering, or exhaustive move verification. The principal owns theme review and the 312-demo verifier. The owned tab was closed after preserving screenshots. No source, template, asset, or test edits; no tests or builds rerun.
