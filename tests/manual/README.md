# Manual browser fixtures

These check what `npm test` cannot: pointer input, focus, scrolling and real audio.

```sh
npx vite --port 5174
```

Open `http://localhost:5174/tests/manual/<name>.html` and run the section's command in the console. Every scenario must pass.

## touch-controls

```js
await touchAudit.run();
```

Also try it with real fingers:

- One finger can slide between move, jump, dash, block and attacks without lifting. Special and super need a fresh press.
- Releasing one finger never releases another finger, key or gamepad holding the same control.
- Cancelling, losing focus, hiding the page or rotating the screen releases input.

## desktop-controls

```js
await desktopAudit.run();
```

Check focus by hand with Tab, Enter and Escape: synthetic key events do not move focus.

## modal-scroll

```js
await modalScrollAudit.run();
```

## audio-lifecycle

Click a lobby control first (a real click), then:

```js
await audioAudit.run(); // reload before repeating
```

## Physical devices

Before claiming a device is supported, play on iPhone Safari, iPad Safari, a low-end Android with Chrome, Samsung Internet and Firefox for Android. Rotate the device, switch apps and lock the screen, then confirm the controls still work.
