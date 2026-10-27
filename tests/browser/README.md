# Manual browser fixtures

These fixtures cover behaviour that only a real browser can show: pointer
capture and hit testing, native focus and scrolling, and real Web Audio output.
They are not part of `npm test`; `npm run typecheck` still type-checks them.
Each one mounts production components in React StrictMode and restores its
browser overrides on unmount.

Start the standalone Vite server:

```sh
npm ci
npx vite --host 0.0.0.0 --port 5174
```

Open the fixture's page at `http://localhost:5174/tests/browser/<name>.html` and
call the commands below from the console. A run passes when every scenario it
reports passes.

## touch-controls

```js
await touchAudit.run(); // all results must pass
touchAudit.layout(); // geometry at the current viewport
touchAudit.mount({ mobile: false }); // hybrid tablet/laptop layout
await touchAudit.mountHybridGame(); // production Game on a simulated hybrid device
touchAudit.gameLayout(); // resize the viewport, then repeat
touchAudit.update({ energy: 0 }); // deplete energy mid-gesture
touchAudit.state(); // engine inputs, callback order and highlights
```

This exercises the production `TouchControls` with real pointer events. Also
check it by hand with real fingers or a mouse. The rules it checks:

- A contact can slide between movement, jump, dash, block, light and heavy
  without lifting. Special and super need a fresh press on their enabled button.
  Sliding onto them does nothing, and getting energy back during a contact never
  fires them again.
- Each finger owns its own input. Releasing one finger never clears another
  finger, key or controller that holds the same control.
- Up, cancel, capture loss, blur, hidden visibility, pagehide, rotation, reset
  and unmount release input. A cancelled contact cannot restart from a stray move.
- Unavailable controls use `aria-disabled`, and pointer, keyboard and click
  activation all respect it.

## desktop-controls

```js
await desktopAudit.run(); // all scenarios must pass
await desktopAudit.mount("local"); // or "online" to capture outgoing input
desktopAudit.state();
desktopAudit.unmount(); // restores navigator.getGamepads
```

This mounts the production `Game` and `Help`. It checks focus returning from
help and the sound controls, browser shortcuts and IME composition (key code
229), key release after focus or modifier changes, blur during online play, and
Start pause/resume with synthesized gamepads. Use native Tab/Shift+Tab,
Enter/Space and Escape to check focus, because synthetic key events do not move
focus. The Node test `controls.test.ts` covers controller suspension and rearming.

## modal-scroll

```js
await modalScrollAudit.run(); // all scenarios must pass
```

This mounts the production `Modal` over a tall page. It checks that scrolling a
dialog to its end does not scroll the page behind it, that stacked dialogs stay
locked, that the last close restores the page's scroll position and inline
styles, and that hiding the button that opened the dialog moves focus to another
visible control.

## audio-lifecycle

Click a lobby control first, using a real click, then run:

```js
await audioAudit.run(); // reload before repeating
audioAudit.unmount();
```

This samples the real Web Audio graph. It checks that music plays after a user
gesture, mute and unmute, silence while the page is hidden and recovery from a
suspended context, combat effects, and decoding of the reaction clips. After
recovery there must be one context and one music loop. Autoplay rules depend on
the browser profile. The Node test `audio-mobile-lifecycle.test.ts` covers the
activation and resume logic.

## Physical devices

Before claiming device support, run touch-controls and the full game on iPhone
Safari, iPad Safari, a lower-end Android Chrome device, Samsung Internet and
Firefox Android, and record the OS and browser versions. Use several fingers,
use up energy mid-slide, rotate the device, switch apps, lock the screen and
deny fullscreen, then confirm that new gestures still work after each
interruption.
