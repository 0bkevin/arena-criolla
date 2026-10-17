# Valencia — Plaza de noche

Auditoría independiente del 17 de octubre de 2026. Se revisó exclusivamente este escenario, con una pestaña propia en https://arena.kevinbravo.com y lectura de `shared/content.ts`, `shared/stages.json`, `shared/engine.ts`, `src/game/stage-renderer.ts` y `src/game/viewport.ts`.

## Sitio publicado

- Se seleccionó **Plaza de noche**, se inició una pelea rápida y se comprobó su llegada a la pantalla de resultado. El fondo `assets/valencia.webp` respondió HTTP 200. El canvas publicado mide 1080 × 640 y ocupa 907.25 × 536 CSS px en una ventana de 1280 × 800.
- Las tres plataformas, los bordes del suelo y los indicadores P1/P2 quedan dentro de la vista. El HUD conserva contraste y no tapa las superficies de juego.
- El fondo nocturno tiene suficiente luz en la zona de combate, pero las plataformas grises se mezclan con la baranda y los escalones del fondo. La central es la menos evidente porque coincide con la baranda. Conviene un filo lavanda fino, usando el color del escenario `#b69cff`.
- El área jugable publicada tiene 940 unidades de suelo. El tamaño de los personajes y las tres plataformas concentra el combate en poco espacio, en línea con lo descrito por el usuario.
- El arte original mide 1536 × 1024; el renderer publicado lo dibuja con la proporción del canvas 1080 × 640. Debe respetarse la proporción de la imagen al cubrir el escenario ampliado.

Captura de la revancha en producción: `/home/ubuntu/.t3/userdata/browser-artifacts/browser-screenshot-arena-kevinbravo-com-mvcd5mor-a723355c.png`.

## Cambios locales del trabajo principal comprobados

El trabajo principal amplió el mundo a 1440 × 800 y el suelo a 1260 unidades, conservando la altura física del suelo en y=554. Las plataformas locales de Valencia son `(64,418,184)`, `(448,345,184)` y `(838,418,184)`, expresadas como x, y y ancho. Las nuevas posiciones dejan aire lateral y mantienen las alturas conocidas.

Se ejecutó una simulación dirigida sobre el engine local actualizado:

- Acceso a la izquierda y derecha desde el suelo con un salto: correcto. Separación vertical de 136; altura alcanzada y=402.8.
- Acceso directo a la central con doble salto: correcto. Separación vertical de 209; altura alcanzada y=293.08. La central conserva su función de altura superior.
- Bajar con una pulsación desde cada plataforma termina en el suelo, con soporte -1 y dos vidas; no se produce rebote a la plataforma.
- Salir por ambos límites ampliados, x=-301 y x=1381, resta una vida y devuelve al luchador a x=330.
- Las plataformas quedan dentro de los límites de suelo y el filo lavanda ya está agregado en el renderer local. El renderer local también utiliza las dimensiones reales de la imagen para mantener su proporción.

`tests/stages.test.ts` y `tests/viewport.test.ts`: **11/11 pruebas pasan** en el código local actualizado. Cubren física determinista, fondos presentes y conservación de la arena completa en varios tamaños de ventana, incluidos 568 × 320 y 844 × 390.

## Límite de la revisión

La comprobación visual de producción fue de escritorio. El control del browser falló al pausar y al redimensionar: `Preview automation click timed out after 15000ms.` y `No preview automation host is available for resize in environment 39104cbf-8b46-4a53-bc85-a1f2f3b750e4.` Por ello no se afirma una validación visual móvil del sitio publicado ni una inspección visual de los cambios locales. El comportamiento responsive de la geometría local está cubierto por las pruebas citadas.

No se identificó un bloqueo específico de Valencia. Tras publicar, corresponde confirmar visualmente el encuadre ampliado y el nuevo filo de plataformas en horizontal móvil.
