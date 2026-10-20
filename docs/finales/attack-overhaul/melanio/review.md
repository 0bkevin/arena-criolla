# Melanio Escobar — entrega 17/22

Implementación terminada el 19 de octubre de 2026 en el checkout compartido. Definitiva «Quedó grabado»: graba al rival, lo aturde visualmente con un flash local y conecta un único golpe físico con el mismo teléfono. El especial conserva su mecánica y recibe poses completas y un pulso legible. El agente principal completó la revisión independiente y aprobó el personaje17/22.

## Identidad y arte

Se inspeccionaron el retrato de Concordia, su perfil y la entrevista de Access Now antes de generar. [research.md](research.md) registra URLs, qué se vio y qué es adaptación ficticia. Mandan la cara y proporciones de `melanio-v44`: gorra atrás, lentes, bigote/barba corta, tatuajes, polo negro con ribete, pantalón oscuro y calzado negro. El canon original permanece intacto.

El atlas nuevo `public/assets/melanio-phone-signal-attack-v1.webp` contiene ocho poses/objetos. [provenance.json](provenance.json) conserva hashes de originales, referencias, prompts y canon. Los cinco raws de imagegen permanecen en `assets/source/finales/attack-overhaul/melanio/`, incluidos los rechazos.

| Fuente | Uso integrado |
| --- | --- |
| raw-v1 | record, windup, strike-low y recover |
| raw-v2-special | signal-windup y pulso signal |
| raw-v4-high | strike-high, teléfono en el mismo brazo de la anticipación |
| raw-v5-release | signal-release con palma baja alineada al origen físico |

Se rechazaron las poses que cambiaban el teléfono de brazo y las emisiones con la mano demasiado alta. La regeneración fue de figuras completas, sin injertar brazos ni espejar celdas para reparar anatomía. El raw v1 se rodeó de transparencia; `padding-audit.json` verifica que conserva todos sus píxeles. Los cuatro `*-grid-audit.json` verifican traslaciones RGBA exactas. `scripts/pack-melanio-overhaul.ts`, las configuraciones de normalización y `assembly.json` documentan el empaquetado de objetos completos.

La escala se calibró uniformemente por cabeza y hombros entre generaciones, conservando la menor altura de la pose agachada. Las escalas de fuente son 1, .44, .65 y .378; nunca se estiraron miembros ni se amplió la cabeza para igualar el alto de una pose baja. El teléfono está pintado una sola vez en cada figura, integrado en su mano.

## Comportamiento integrado

`src/game/finales/melanio.ts` concentra poses, contacto, flash y presentación del especial. Registro, renderer, fallback, sonidos sintéticos y descripciones solo incorporan las rutas de Melanio. No se modificó el motor compartido ni otro personaje.

La captura conserva tres victorias, coste de 75 de energía, anticipación de nueve ticks, duración de 180 y fuerza ordinaria de liberación 12. Reloj y posiciones físicas permanecen congelados durante la captura. Hay grabación en 18–65, flash en 66–75 y estrellas locales hasta 113; esas fases no quitan vida. El único daño ocurre en 114. La cifra sigue la corona real presentada del rival y REC se lee correctamente en P2.

El golpe alto o bajo usa el contorno opaco del frame canónico real del oponente, con el borde expuesto del teléfono llegando a él. En navegador, una fila sin superficie válida rechaza la composición en lugar de inventar un contacto. El ajuste visual entre actores está acotado por el viewport; el rival conserva su identidad canónica. En plataformas de distinta altura se traslada la figura completa con un salto explícito y sombra de origen. El retorno aéreo empieza inmediatamente después de 114 y termina en 168 sobre la plataforma original; la acomodación de entrada/salida acaba antes de 180. No cambia la física ni la cámara al dibujar.

El flash es un único desvanecimiento local, sin destello a pantalla completa. Reduced motion baja su opacidad y deja las estrellas estáticas. La precarga exige todas las poses necesarias; si falta arte, se ven ambos actores canónicos y no reaparece el micrófono antiguo. Los sonidos son síntesis breve asociada a eventos de grabación, flash y contacto.

El especial mantiene salida en 21, pose de emisión hasta 28 y recuperación canónica desde 29. La palma coincide con el pulso físico en el primer frame de salida, sin desplazar el collider. El pulso generado sigue posición, onda y dirección reales; la vuelta añade un halo cálido. Si no conecta en la ida, puede conectar al volver; desaparece al primer impacto. La descripción fuente expresa esta condición, sin prometer dos golpes ni regreso después de impactar.

## Verificación

`tests/melanio-overhaul.test.ts` añade ocho pruebas centradas en daño único, input real, gates/coste, guardia/fallo/interrupción, ambos puestos, adversarios altos/bajos, liberación y control, stocks/última vida, serialización, ausencia de daño en grabación/flash, preflight/fallback, emisión/recuperación y preservación exacta del arte.

```sh
npx tsx --test --test-concurrency=2 tests/melanio-overhaul.test.ts tests/melanio-v44.test.ts tests/melanio-render-v45.test.ts tests/melanio-adversarial-v45.test.ts tests/finales.test.ts tests/attack-art.test.ts
npx tsc --noEmit
git diff --check
npm run build
```

Resultado: **52/52 pruebas**, tipos, diff-check y build correctos. Logs: `focused-tests.log`, `types.log`, `diff-check.log` y `build.log`. Vite emitió el aviso de tamaño del bundle principal (>500 kB); la compilación terminó con éxito. Se preservaron las expectativas legacy v44/v45. La suite global queda para el cierre conjunto, conforme al brief; no se cambió el motor.

`scripts/melanio-overhaul-browser-qa.js` ejecutó **64 escenarios y 814 muestras de render** con inputs special/super y motor, renderer y cámara de producción. Cobertura: ambos puestos, centro, cerca, distancia desigual, bordes hacia fuera/dentro, cerca del borde, ambas alturas de plataforma, guardia frontal/trasera, fallo, interrupción, Momoy, Silbón, daño letal y última vida. Comprueba inmovilidad física durante captura, coste, contacto único, retorno al control, límites de imagen y ausencia de mutación al renderizar. La última ejecución incluye el retorno aéreo sin pausa. Resultados en `browser-evidence.json` y `render-evidence.json`.

Se guardaron e inspeccionaron 30 capturas nativas del QA: entrada, grabación, flash, anticipación, contacto, retorno, liberación, P2, ambos bordes, Momoy/Silbón, plataformas, reduced motion, falta de atlas y especial antes/durante/después de emitir y al volver. [screenshots.json](screenshots.json) conserva las rutas originales y medidas; `screenshots/` guarda copias. Además, [guide-evidence.json](guide-evidence.json) y `screenshots/guide-contact.png` registran la guía real: contacto en índice 123/tick de captura 114, HP mínimo 59.2, liberación en 189 y ring-out ordinario posterior en 226. No es expulsión letal especial.

El agente principal reprodujo por separado los 64 escenarios/814 muestras y revisó contacto, P2, especial, alturas y retorno. Su `root-contour-audit.json` comprueba **52/52 puntos sobre alfa ≥100 en sprites canónicos**: es una auditoría geométrica de superficies, no 52 combates adicionales. También informó pruebas focales y guía estricta correctas. Esta entrega conserva su evidencia sin sustituirla por la propia.

Tab de trabajo: `tab_43_c3cfa641-d7e6-4a79-9606-68ffb03b615c`, `http://localhost:5184/docs/finales/attack-overhaul/review.html?melanio=stable`. El tab protegido del principal no se tocó. Ledger, guía portable/media y los demás personajes quedan en manos del principal; no se inició Dayana, ni se hicieron commits o push.
