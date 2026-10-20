# Capriles · revisión de textos · 2026-10-19

Petición: sustituir «Paso a paso» por «¡Qué manguangua, ah!», añadir «Hay un camino» al otro combo y hacer que el café abra con «Qué manguangua» antes de la frase de la leche. Las tres capturas adjuntas muestran el combo básico y dos momentos de la conversación anterior. El coordinador confirmó que «Hay un camino» corresponde al combo avanzado.

## Referencias consultadas

- [ASALE, Diccionario de americanismos: manguangua](https://www.asale.org/damer/manguangua): fuente lexicográfica primaria; confirma la grafía venezolana sin diéresis.
- [hcapriles, Hay Un Camino hilo musical](https://m.soundcloud.com/hcapriles/hay-un-camino-hilo-musical): publicación de la cuenta de campaña, fechada el 14 de octubre de 2011; respalda el lema.
- [Entrevista a Capriles, La Gran Aldea](https://lga.lagranaldea.com/2026/09/13/capriles-yo-llego-a-las-casas-a-tomar-cafe-diosdado-cabello-entraba-con-la-operacion-tun-tun/): entrevista directa localizada y abierta; contexto de las visitas con café y la expresión manguangua.
- [Clip de la leche acaparada](https://www.youtube.com/watch?v=H0GZ92jAwpc): resultado de búsqueda de una republicación, no fuente oficial ni transcripción comprobada. La frase exacta implementada procede de la petición del usuario; no se presenta como cita histórica verificada.

## Cambios

| Lugar | Texto final |
| --- | --- |
| Combo J → K | ¡Qué manguangua, ah! |
| Combo J → J → K | Hay un camino |
| Café, ticks 0–56 | ¡Qué manguangua! |
| Café, ticks 57–107 | Maduro tiene la leche / acaparada |
| Café, ticks 108–179 | y yo se la voy a sacar / de donde sea. |

La barra `/` representa un salto de línea, no texto del juego. Los dos bocadillos de la leche conservan la frase completa pedida. El helper de bocadillos admite líneas explícitas y aumenta su altura; los usos de una sola línea conservan su geometría. Se actualizó la descripción de la definitiva y la descripción fuente de la guía. Los nombres de combos se obtienen de fighters.json.

Se conservaron capriles-v39, las cuatro poses de café, las figuras sentadas, el mobiliario, el sprint, el daño, los requisitos y la duración. Las capturas del usuario ya muestran la gorra tricolor, camisa gris, jeans y zapatos blancos del arte aceptado; no se generó arte adicional para un cambio de textos. El rótulo DEFINITIVA visible en la evidencia pertenece a la revisión global del coordinador.

## Verificación

- `npx tsx --test tests/capriles-dialogue.test.ts tests/character-audits/capriles.test.ts tests/finale-presentation.test.ts tests/finales.test.ts`: **41/41**; salida en [tests.txt](tests.txt).
- `npx tsc --noEmit`: sin errores.
- Los tests de combos usan entradas reales y comprueban nombres, daño y desbloqueos. Los cuatro nuevos casos activan la definitiva desde el motor, recorren los límites 56/57 y 107/108, verifican líneas separadas, daño y salida del final, con Capriles en P1/P2 y movimiento normal/reducido.
- Preview nativo T3: `preview_status` primero y pestaña propia. [browser-review.js](browser-review.js) prepara jugadores y energía, atraviesa la introducción, incrementa la entrada `super` y avanza `stepMatch`; no asigna un estado `finale`. Usa el renderizador y los assets reales en un canvas temporal sobre la página de la guía. Es una fixture del motor/renderizador, no una prueba de los listeners de teclado de Game ni del HUD React.
- Las líneas miden 156, 79, 161 y 103 unidades con la fuente real a 20 px, frente a 252 disponibles: no se comprimen. Bocadillos y textos mantienen su orientación en P2.
- Capturas inspeccionadas: [apertura](cafe-opening.png), [leche](cafe-milk.png), [cierre](cafe-ending.png), [P2 reflejado](cafe-mirrored.png). HP rival: 100 al tick 30, 87.5424 al 70 y 62.6272 al 140.

La guía generada contiene un bundle anterior: el coordinador reconstruirá sus HTML al integrar todos los personajes. Este cambio deja actualizada su fuente `descriptions.json`, sin regenerar todos los paquetes en cada revisión individual.

Revisión independiente del coordinador: se inspeccionó el café en la vista nativa al tick115; los dos personajes conservan su identidad y la frase final queda legible. Las cuatro variantes de diálogo y la integración del rótulo genérico pasan en las pruebas enfocadas.

Root follow-up: actual sprint now waits until physical contact (125-unit contact range;215-unit targeting range retained). Real mirrored inputs hit at tick15 after closing a214-unit gap. Canonical contact captures approved; guard, travel and recovery audits pass.
