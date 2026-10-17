# Arena Criolla touch controls v33

## Interaction decisions

- The game still fills the mobile viewport. Its HUD and controls stay layered over the arena, with the existing safe-area insets keeping controls clear of the notch and home indicator.
- Gameplay buttons now have a 48 CSS px minimum side, with 8 CSS px between buttons. The size rule is a web CSS size; it is not a conversion to Apple points or Android dp. Apple recommends 44 × 44 pt for frequently used game controls, Android recommends 48 × 48 dp for interactive targets, and WCAG 2.2 AA sets a 24 × 24 CSS px minimum. CSS px, pt, and dp use different platform scales, so these values should not be treated as equal physical sizes.
- A press changes the button color and inset glow without scaling its box. Focus gets a visible outline. Labels, disabled state, and the reason a powered move is unavailable remain exposed on native buttons.
- Pointer down activates combat actions immediately for fighting-game timing. Held controls release on pointer up or cancellation. WCAG 2.5.2 allows down-event activation when timing is essential; its examples include a skeet-shooting game. Ordinary navigation should continue to use click activation.
- Each finger owns its own control source. Sliding between left, right, and down transfers the held direction. Sliding into a gap or another kind of button releases the direction, and re-entering a direction resumes it. Jump, dash, attacks, and block do not switch actions while sliding.
- Pointer capture is requested on the shared controls layer. A failed capture does not prevent the window-level pointerup, pointercancel, or lost-capture cleanup path. Blur, hidden page, pagehide, reset, disabled power moves, and component unmount release outstanding sources. A lost capture only cancels a pointer captured by this controls layer.
- Enter and Space hold a focused control until keyup, with global keyup cleanup if focus moves away. A click synthesized by assistive technology still activates the native button. This stops the game-wide Enter binding from firing a second action while a touch control has keyboard focus.
- `touch-action: none` remains scoped to gameplay controls and the arena so browser panning or zooming cannot take over a control gesture midway through a fight.

## Sources

- W3C Pointer Events Level 3: pointer capture retargets later events, is implicitly released after `pointerup`/`pointercancel`, and a cancelled pointer can stop producing events: <https://www.w3.org/TR/pointerevents3/>
- MDN Pointer Events: one pointer event model covers mouse, pen, and multiple touch contacts; `pointercancel` and capture behavior: <https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events>
- MDN `touch-action`: browsers use it to decide gesture handling before pointer listeners run, and can emit `pointercancel` when they take over a gesture: <https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action>
- W3C WCAG 2.2, Target Size (Minimum), SC 2.5.8: 24 × 24 CSS px at Level AA: <https://www.w3.org/TR/WCAG22/#target-size-minimum>
- W3C WCAG 2.2, Pointer Cancellation, SC 2.5.2: prefer release/abort behavior when possible; down-event activation is allowed when timing is essential: <https://www.w3.org/WAI/WCAG22/Understanding/pointer-cancellation.html>
- W3C CSS Values and Units: CSS `px` is a reference length (1/96 inch in the absolute-unit table), and physical size can differ on screens: <https://www.w3.org/TR/css-values-4/#absolute-lengths>
- Apple Human Interface Guidelines, Game Controls: thumb reach, safe areas, 44 × 44 pt frequent controls, and visible press feedback: <https://developer.apple.com/design/human-interface-guidelines/game-controls>
- Android accessibility guidance: recommended interactive touch target of at least 48 × 48 dp: <https://developer.android.com/guide/topics/ui/accessibility/views/apps-views>

## Verification limits

Root independently verified the real React component in the native browser: 27/27 interaction checks passed with a paused local match beneath the fixture. Additional checks covered hidden-page cleanup, independent Enter/Space holds, and 500 rapid press/release pairs without duplicate or stuck inputs. Unrelated pointer moves performed zero directional hit tests; one tracked slide performed one. These dispatch timings describe synthetic events, not hardware touch latency.

Five landscape viewports, from 568 × 320 through 1024 × 768, kept all ten gameplay targets inside the screen, at least 48 CSS px, with 8 CSS px gaps and no overlap. Back/pause/help/fullscreen utilities also measured 48 CSS px. Simulated safe-area insets kept targets within the usable area. A real local match consumed the expected energy when Special was pressed and accepted direction, jump and block together. Portrait rotation showed the orientation gate and held the local clock; desktop retained its original canvas and hid touch controls. The full suite passed 545/545 and the production build passed; Vite still reports its existing large-chunk advisory.

Measurements and test results are in [runtime-qa.json](runtime-qa.json); [controls-844x390.png](controls-844x390.png) shows the actual match. The isolated browser checks are preserved in [browser-fixture.js](browser-fixture.js) and [browser-checks.js](browser-checks.js). With the dev server running, use a coarse-pointer landscape preview, pause a match, evaluate the fixture in that tab, then evaluate the checks; the checks unmount their fixture. Run only in a development tab you own.

The focused unit tests exercise independent pointers, direction transfer and cancellation, duplicate releases, control disable, and release-all cleanup. The project build checks TypeScript and the production bundle. Browser-side PointerEvent injection can exercise the app's handling and a coarse-pointer viewport can exercise layout, but neither simulates operating-system touch hardware, physical multitouch sensing, device haptics, or browser-specific palm rejection. No physical-device claim is made here.
