# Controls validation

## Dialog and game overlay layout review

With the standalone Vite server below, open
`http://localhost:5174/tests/browser/overlay-layout.html`.

```js
await overlayReview.runRosterNavigation(); // desktop: all three scenarios pass
await overlayReview.runMovePreviewLayout(); // live combo canvas cannot overlap its controls
overlayReview.movePreviewLayout(); // repeat after resizing the open movement dialog
await overlayReview.mount("playing", true); // portrait: orientation gate; landscape: pause via UI
await overlayReview.mount("victory"); // production Game result, including its focus management
await overlayReview.mount("draw");
overlayReview.state(); // rematch/exit callback counts after native button clicks
overlayReview.unmount();
```

The roster regression mounts the production App and checks that closing fighter
details preserves the roster, its scroll position, focus, and the page scroll lock.
Choosing a fighter must close both dialogs. The overlay fixture controls the
initial match state and touch-device properties, loads the production fonts and
styles, and restores its device overrides on unmount. It does not emulate
physical touch gestures or test fullscreen/orientation browser permissions.

Review at 320×568, 390×844, 844×390, 768×1024, 1024×768, and 1440×900. Check
native keyboard focus and clicks, scroll each view to both ends, and resize with
the dialog open. A result may scroll vertically on a short phone; its rematch and
exit actions must remain reachable without horizontal overflow.

## Dialog scroll regressions

With the standalone Vite server below, open
`http://localhost:5174/tests/browser/modal-scroll.html` and run
`await modalScrollAudit.run()`. All four scenarios must pass.

The fixture mounts the production `Modal` in React StrictMode over a tall page.
It checks that reaching the dialog's scroll limit cannot move the background,
that closing a stacked dialog keeps the remaining dialog locked, and that the
final close or unmount restores the original page position and inline styles.
It also checks that hiding the opener while a dialog is open returns focus to a
visible control in the same context.
The checks drive browser scroll APIs; physical touch gestures are not emulated.

## Desktop regressions

With the standalone Vite server below, open
`http://localhost:5174/tests/browser/desktop-controls.html` and run:

```js
await desktopAudit.run(); // all eleven scenarios must pass
desktopAudit.state();
await desktopAudit.mount("local"); // or "online" for captured outgoing input
desktopAudit.unmount(); // restores navigator.getGamepads
```

This mounts the production `Game` and `Help` in React StrictMode. It covers
returning focus from help and pointer-activated sound controls, retaining sound
button focus for keyboard activation, browser shortcuts and IME input, key
release after focus/modifier changes, visible-window blur in online play,
Start pause/resume, fresh action presses in the first frame after resume,
disconnected-controller recovery, Start immediately after keyboard pause, and
Start suppression under modal help.
Explicit resume snapshots buttons already held at that moment, so those still
require release while later presses work on the very next frame for either player.
Reconnected/replacement controllers preserve their player assignment and require
held action/Menu buttons to be released before activating them again. Movement
holds can resume immediately. IME checks include composition boundary events
with key code 229, even when `isComposing` is false.
Gamepads and lifecycle events are synthesized; no physical controller or OS
focus switching is claimed. Use native Enter after closing help or clicking
sound to check P2's dodge; sound must stay unchanged by that dodge. Reach the
sound button with Tab/Shift+Tab and verify native Enter/Space toggle it while
retaining button focus. Use native Escape/Tab/Shift+Tab to check pause focus.

The Node regressions in `controls.test.ts` and `attack-buffer.test.ts` cover
controller suspension/rearming and a five-frame (83 ms at 60 Hz) attack buffer.
The buffer accepts light, heavy and special attacks. Definitives keep their
separate hold-to-charge and one-use-per-fight rules; a fresh definitive press
clears a pending normal attack, and attacks cannot queue during the charge.
The latest fresh attack replaces the pending request. Requests outside
the window are discarded; blocking, stun, stock loss and capture finales clear
the buffer. Energy and character restrictions are checked again on execution.
The buffer is part of the shared deterministic simulation and serialized state,
so local and online play use the same rules.

## Mobile controls

This harness exercises the production `TouchControls`, input ownership, React
lifecycle, and styles in a real browser. It is separate from `npm test`, which
runs the state and combat-engine regressions. No browser package is required.

## Run

```sh
npm ci
npx vite --host 0.0.0.0 --port 5174
```

Open `http://localhost:5174/tests/browser/touch-controls.html` in the target
browser. In its console:

```js
await touchAudit.run(); // all results must pass
touchAudit.layout(); // geometry at the current viewport
touchAudit.mount({ mobile: false }); // hybrid tablet/laptop layout
touchAudit.layout();
await touchAudit.mountHybridGame(); // production Game on a simulated hybrid device
touchAudit.gameLayout(); // resize the viewport, then repeat; pass must stay true
```

`touchAudit.mount()` resets the pad and exposes it for real finger or mouse input.
Use `touchAudit.state()` to inspect engine inputs, callback order, and highlights.
`touchAudit.update({ energy: 0 })` tests energy depletion mid-gesture. Set energy
back to 100 to restore available actions. The harness uses React StrictMode.

`mountHybridGame()` requires a fine primary pointer and temporarily models five
touch points on a 1280×800 physical screen while the viewport can be resized.
It mounts the production `Game`, including the arena, toolbar, pad, and keyboard
hints. `unmount()` or the next `mount()` restores the device properties. This is
a layout regression fixture, not hardware emulation.

## Victory timing validation

With the same Vite server running, open
`http://localhost:5174/tests/browser/victory-timing.html` and run
`await victoryTiming.run()` in the console. All fifteen scenarios must pass.

This mounts the production `Game` in React StrictMode with an actual engine
knockout. Controlled frame timestamps verify that the result appears after two
active seconds at normal and slow frame rates in local, online, and practice
modes. Window blur, hidden tabs, and real help dialogs suspend the clock even
when no frame runs while blocked. The audit also checks seven stars, one result
callback, immutable match state, and frame-loop cleanup after unmount.

The harness restores its browser clock and visibility overrides after each run.
It uses a simulated remote state for online mode; it does not exercise network
transport.

## Interaction contract

- A contact beginning anywhere inside a control group can slide between movement,
  jump, dash, block, light, and heavy without lifting. Contacts beginning elsewhere
  do not join the gesture.
- Special and super require a **fresh press directly on their enabled button**.
  Sliding across either is neutral. Leaving and re-entering an ability, or regaining
  enough energy during a contact, never fires it again. Keyboard and accessible
  clicks can still activate either ability normally.
- A six-CSS-pixel tolerance retains the current button when the finger jitters
  into a gap in the same group. Hitting another button takes priority immediately,
  with no timer or input delay. This is an explicit product tuning value, not a
  standard-mandated threshold. It does not enlarge initial hit targets, extend
  outside the group, or keep input active under an overlay/on a disabled button.
- Larger gaps and unavailable attacks release the selected control while retaining
  the contact until release/cancel. Spending energy does not strand the finger on
  the original attack; it can still slide to an ordinary control.
- Every finger owns its input independently. Releasing one finger never clears
  another finger, keyboard key, or controller holding the same control.
- Entering an ordinary action button fires once. Movement inside it or the small
  gap tolerance does not repeat it. Deliberately leaving and returning fires again;
  the combat engine still decides whether the action is legal given cooldowns,
  energy, and current animation.
- Up, cancel, actual container capture loss, blur, hidden visibility, pagehide,
  rotation, reset, and unmount clear the relevant inputs. A cancelled contact
  cannot restart from a stray move event.
- Unavailable controls use `aria-disabled` so pointer delivery survives dynamic
  availability changes. Pointer, keyboard, and accessible-click activation all
  explicitly enforce that state. They retain their accessible explanations.

## Research basis

Sources checked on 2026-10-20. These distinguish browser requirements, platform
recommendations, and this game's chosen slide behavior:

- [W3C Pointer Events](https://www.w3.org/TR/pointerevents3/): use pointer IDs,
  explicit capture on a stable container, and `touch-action` declared before the
  gesture. Capture retargets events, so the original `event.target` is unsuitable
  for finding the button currently under a finger. Chorded mouse/pen button
  releases can arrive as `pointermove`; retain ownership only while the primary
  button's `buttons` bit remains set.
- [CSSOM View hit-testing](https://www.w3.org/TR/cssom-view/#dom-document-elementfrompoint):
  `elementFromPoint` uses viewport coordinates. Hit-test the current coordinates,
  resolve SVG/text descendants to their button, and restrict results to this pad.
- [Phaser input guidance](https://docs.phaser.io/phaser/concepts/input): a mature
  game engine also uses independent pointers and explicit hit areas. The slide
  policy and gap tolerance are product decisions, not universal framework rules.
- [Apple buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)
  recommend 44×44 pt targets and visible feedback;
  [Android accessibility](https://developer.android.com/guide/topics/ui/accessibility/views/apps-views)
  recommends 48×48 dp targets. This web game's chosen floor is **48×48 CSS px**.
  These units are not physical pixels or interchangeable conformance standards.
  [WCAG 2.2 AA target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum)
  specifies 24×24 CSS px with exceptions; the
  [enhanced AAA criterion](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced)
  specifies 44×44 CSS px with exceptions.
- [WebKit safe areas](https://webkit.org/blog/7929/designing-websites-for-iphone-x/):
  combine `viewport-fit=cover`, safe-area insets, and ordinary edge spacing.
  Preserve the existing VisualViewport tracking and short-landscape layout.
- [Chrome page lifecycle](https://developer.chrome.com/docs/web-platform/page-lifecycle-api):
  hidden visibility is often the last reliable mobile lifecycle signal. Do not
  depend solely on unload or pagehide to release input.
- [WAI button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/): preserve
  native button names, Space/Enter activation, and focus. `aria-pressed` is for
  toggles, so these momentary controls use visual held feedback instead.

## Recorded review results

2026-10-20, Chromium 154 on Linux through the collaborative browser:

- State-level regressions reproduced three original failures before the fix:
  movement→jump did not activate jump; block→punch left block held; disabling an
  attack deleted its contact and prevented subsequent sliding.
- Follow-up regressions failed before the gesture-policy refinement: sliding into
  special/super consumed an action, and a two-pixel excursion into a gap released
  an attack and permitted accidental re-entry. Both now pass.
- All **1,303** repository tests and the production type-check/build passed after
  integration with current `main`. Character-asset validation passed during the
  initial review; assets were unchanged. The build retained its large-chunk warning.
- **18 browser scenarios** passed at each of the eight viewport sizes below,
  including all **100 ordered button pairs** with the protected-ability policy,
  independent contacts, shared input ownership, disabled/energy changes, gaps,
  boundary jitter, cleanup, keyboard/accessible clicks, and compatibility-click
  deduplication. Browser scenarios use the mobile layout; geometry checks also
  cover the hybrid layout.
- A native browser mouse drag from block to punch produced exactly
  `press block → release → press light → release`. Trusted capture events
  confirmed capture belonged to the stable control container.
- After the refinement, a native mouse drag from heavy to special activated heavy
  once and special zero times; a subsequent fresh press activated special once.
- All ten controls were visible, hit-testable, and at least 48×48 CSS px at
  **320×240, 568×320, 667×280, 740×260, 844×390, 915×412, 1024×768, and 1280×800**,
  in both the mobile and hybrid harness layouts: **16 layout checks**.
- The actual running game's mobile pad also passed geometry/hit-testing checks
  at 320×240, 568×320, 667×280, 844×390, and 1024×768. Two synthetic contacts held
  movement while sliding block→punch; pause removed the active pad. After resume,
  stale moves did not reactivate those contacts. Portrait resizing showed the
  orientation gate with no pressed controls, and landscape restored the pad.
- Adversarial Astra review reproduced a chorded mouse/pen release defect: after
  releasing primary while secondary remained held, the control stayed active and
  could slide into attacks. A regression failed before the primary-button bit
  check and now passes for both pointer types without releasing the other finger.
- The review also reproduced overflow in the **full hybrid game** at 1280×800
  (page height 874px) and 320×240 (page height 300px). The original pad-only
  fixture missed the arena/toolbar height. The game now reserves measured chrome
  height, and compact hybrid pads use two rows. The production-Game fixture passes
  at all eight sizes, including live resizing, with all controls visible and the
  arena's 1.8 aspect ratio preserved. Pause removes the measured budget; resume
  restores it and passes geometry again.
- Astra's focused follow-up found no remaining actionable issues. It also checked
  650×500/651×500 breakpoint transitions, hybrid/mobile mode changes, and unmount
  cleanup, with no observer-loop or browser error events.
- Súper is available from zero wins and costs 90 energy. A browser regression
  verifies that recovering energy during a contact cannot activate it; a fresh
  direct press is still required.

The browser suite dispatches synthetic DOM PointerEvents through real React
handlers and real coordinate hit-testing. It exercises the capture-failure
fallback; synthetic events cannot establish native active-pointer capture.
The separate trusted mouse drag covers native capture for mouse input only.
Viewport resizing does not emulate a mobile OS, touch hardware, or browser UI.

## Physical-device acceptance

Physical-device testing was removed from this task at the user's request.
No physical-device test is claimed; the results above cover the implementation,
repository tests, and browser checks.

Before claiming broad device validation, run the
same pad and the full game on small/notched iPhone Safari, iPad Safari (including
trackpad and split view), a lower-end Android Chrome device, Samsung Internet,
and Firefox Android. Record actual OS and browser versions.

Use two thumbs and a third finger; slide through every group, gaps, and disabled
attacks; deplete energy mid-slide; lift fingers in different orders. Try rapid
direction changes, long presses, both landscape directions, expanded/retracted
browser bars, home/back edge swipes, app switching, screen lock, pause/resume, and
fullscreen denial. Verify fresh gestures work after every interruption.

Check VoiceOver/TalkBack names, unavailable states, and activation, plus keyboard
play and focus on hybrid devices. Inspect safe areas on real notched hardware.
Core Pointer Events are supported in current mainstream mobile engines, but
neither API availability nor these automated checks certify every device,
overall accessibility compliance, or thumb comfort and latency on hardware.
