# Fixtures manuales de navegador

Estos fixtures cubren lo que solo un navegador real puede mostrar: captura de punteros, foco y scroll nativos, y salida real de Web Audio. No forman parte de `npm test`, aunque `npm run typecheck` sí los comprueba. Cada uno monta componentes de producción en React StrictMode y restaura lo que modificó al desmontarse.

Arranca Vite por separado:

```sh
npm ci
npx vite --host 0.0.0.0 --port 5174
```

Abre `http://localhost:5174/tests/manual/<nombre>.html` y ejecuta los comandos de cada sección en la consola. La prueba pasa cuando todos los escenarios que reporta pasan.

## touch-controls

```js
await touchAudit.run(); // todos los resultados deben pasar
touchAudit.layout(); // geometría con el tamaño de pantalla actual
touchAudit.mount({ mobile: false }); // diseño híbrido de tablet o portátil
await touchAudit.mountHybridGame(); // Game de producción en un dispositivo híbrido simulado
touchAudit.gameLayout(); // cambia el tamaño de la ventana y repite
touchAudit.update({ energy: 0 }); // agota la energía a mitad de un gesto
touchAudit.state(); // entradas del motor, orden de callbacks y resaltados
```

Usa `TouchControls` de producción con eventos de puntero reales. Pruébalo también a mano, con dedos o ratón. Debe cumplirse:

- Un dedo puede deslizarse entre movimiento, salto, dash, bloqueo, golpe ligero y fuerte sin levantarse. Especial y definitiva necesitan una pulsación nueva sobre su botón activo: deslizarse sobre ellos no hace nada, y recuperar energía durante el contacto no los vuelve a disparar.
- Cada dedo controla su propia entrada. Soltar un dedo nunca libera otro dedo, tecla o mando que mantenga el mismo control.
- Soltar, cancelar, perder la captura, perder el foco, ocultar la página, `pagehide`, girar, reiniciar y desmontar liberan la entrada. Un contacto cancelado no se reactiva con un movimiento suelto.
- Los controles no disponibles usan `aria-disabled`, y el puntero, el teclado y el clic lo respetan.

## desktop-controls

```js
await desktopAudit.run(); // todos los escenarios deben pasar
await desktopAudit.mount("local"); // o "online" para capturar la entrada enviada
desktopAudit.state();
desktopAudit.unmount(); // restaura navigator.getGamepads
```

Monta `Game` y `Help` de producción. Comprueba que el foco vuelve desde la ayuda y los controles de sonido, los atajos del navegador, la composición IME (código de tecla 229), la liberación de teclas al cambiar el foco o los modificadores, la pérdida de foco en partidas en línea, y pausar y reanudar con Start en mandos simulados.

Revisa el foco a mano con Tab, Shift+Tab, Enter, Espacio y Escape: los eventos de teclado sintéticos no mueven el foco. La suspensión y reactivación del mando la cubre `controls.test.ts`.

## modal-scroll

```js
await modalScrollAudit.run(); // todos los escenarios deben pasar
```

Monta `Modal` de producción sobre una página alta. Comprueba que llegar al final de un diálogo no desplaza la página de detrás, que los diálogos apilados siguen bloqueados, que el último cierre restaura el scroll y los estilos de la página, y que si se oculta el botón que abrió el diálogo, el foco pasa a otro control visible.

## audio-lifecycle

Haz primero un clic real en un control del lobby y luego:

```js
await audioAudit.run(); // recarga la página antes de repetir
audioAudit.unmount();
```

Muestrea el grafo real de Web Audio. Comprueba que la música suena tras un gesto del usuario, silenciar y reactivar, silencio con la página oculta y recuperación de un contexto suspendido, los efectos de combate y la decodificación de los clips de reacción. Tras recuperarse debe haber un solo contexto y un solo bucle de música. Las reglas de reproducción automática dependen del perfil del navegador. La lógica de activación y reanudación la cubre `audio-mobile-lifecycle.test.ts`.

## Dispositivos físicos

Antes de afirmar que un dispositivo es compatible, prueba touch-controls y el juego completo en Safari de iPhone, Safari de iPad, Chrome en un Android de gama baja, Samsung Internet y Firefox para Android, y anota las versiones del sistema y del navegador.

Usa varios dedos, agota la energía a mitad de un deslizamiento, gira el dispositivo, cambia de app, bloquea la pantalla y rechaza la pantalla completa. Después de cada interrupción, confirma que los gestos nuevos siguen funcionando.
