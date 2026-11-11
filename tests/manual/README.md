# Fixtures manuales

Comprueban en un navegador real lo que `npm test` no puede: punteros, foco, scroll y audio.

```sh
npx vite --port 5174
```

Abre `http://localhost:5174/tests/manual/<nombre>.html` y ejecuta en la consola el comando de cada sección. Todos los escenarios deben pasar.

## touch-controls

```js
await touchAudit.run();
```

Pruébalo también con los dedos:

- Un dedo puede deslizarse entre movimiento, salto, dash, bloqueo y golpes sin levantarse. Especial y definitiva necesitan una pulsación nueva.
- Soltar un dedo no libera otro dedo, tecla o mando que use el mismo control.
- Cancelar, perder el foco, ocultar la página o girar la pantalla liberan la entrada.

## desktop-controls

```js
await desktopAudit.run();
```

Revisa el foco a mano con Tab, Enter y Escape: los eventos sintéticos no lo mueven.

## modal-scroll

```js
await modalScrollAudit.run();
```

## audio-lifecycle

Haz un clic real en el lobby y ejecuta:

```js
await audioAudit.run(); // recarga antes de repetir
```

## Dispositivos físicos

Antes de afirmar que un dispositivo es compatible, prueba el juego en Safari de iPhone y iPad, Chrome en un Android de gama baja, Samsung Internet y Firefox para Android. Gira el dispositivo, cambia de app y bloquea la pantalla, y comprueba que los controles siguen funcionando.
