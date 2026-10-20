# Guide controls — bounded refinement

The existing guide remains the visual authority. This is a narrow usability pass, using `/home/ubuntu/.agents/skills/impeccable/SKILL.md`; it does not replace the design or the game artwork.

Initial native-browser inspection covered desktop1280×800 and emulated mobile360×800, with Maite's long heading and actual production animation. Mobile document width was360: no horizontal page overflow. Native screenshot: `/home/ubuntu/.t3/userdata/browser-artifacts/browser-screenshot-localhost-mvfvt9k4-21ffbe10.png`. This establishes layout, not physical-device touch testing.

Measured small targets included32px character navigation,39px restart,40.5px play and a16px range input. The template now gives primary/secondary buttons, search/select, native timeline input, disclosures and table name buttons a44px minimum target. The light control border changed from `#8d98a6` to `#7d8998`. No new animation or decorative component was added.

Loading a new demo now hides the previous error's retry button immediately. Generation tokens, actual simulation and recovery paths remain intact.

Strict standalone guide type checking and `git diff --check` passed. No extra unit test was added for these reversible CSS changes.

The skill's mechanical detector ran once; its raw findings are retained in `guide-ui-detector-findings.json`. It emitted20 repeated contrast warnings pairing the dark-theme foreground/muted tokens with a white background while evaluating the unbuilt transparent template. These require checking the actual final rendered themes, rather than changing the intentionally transparent embed to satisfy the detector. No clean-detector or full WCAG conformance claim is made.

Final confirmation passed against the newly built, frozen portable HTML after all22 character changes. The independent native-browser report `final-validation/guide-ui-smoke.md` records desktop1280×800, mobile360×800 and intermediate768×800 with no outer horizontal overflow, all measured controls at least44CSSpx, Maite’s long label, accent-insensitive search, empty/reset search, keyboard Home/End and visible focus, real visible-document RAF play/pause/restart, and stale retry cleanup on a normal fighter change. Root independently inspected the saved mobile screenshots. Mobile evidence is resized Chromium, not physical-touch testing; stale retry seeding is not a failed-network recovery test.

Root also inspected final inline HTML through native `html_preview` at728px in both dark and light appearances: both rendered1337px content height with no console messages. Text, descriptions, controls and arena remained readable in both actual themes. The detector’s dark-foreground-on-white pairings do not describe these rendered themes. This resolves those template-only warnings within the bounded visual inspection; no clean-detector, numerical contrast audit or full WCAG claim is made. Exhaustive portable verification and publication are tracked separately.
