# María Corina Machado — caravana

Implementación, QA propio y revisión independiente del principal aprobados. Solo personaje15/22. No se han iniciado otros personajes, realizado commits/push ni editado `requirements.json`.

María Corina viaja de pie dentro de la caja trasera de una pickup roja, con una mano en la baranda y otra en el asta. Dos pasajeros van en la cabina y una acompañante en la caja. Una mujer y un hombre corren completos al lado visible. La bandera tiene ocho estrellas, pasa por delante del vehículo y deja libre el rostro. La composición conserva la camisa blanca, jeans, perlas y rostro adulto angular del canon.

## Arte y procedencia

[Investigación](research.md), [prompts](prompts), [hashes](provenance.json), [ensamblado](assembly.json), [metadatos finales](assets.json). Fuentes intactas en `assets/source/finales/attack-overhaul/mcm/`.

Se aceptan `truck-low-grip-raw-v1.png`, `truck-empty-raw-v1.png`, `people-raw-v2.png` y `flag-raw-v1.png`. Todos provienen de imagegen. La pickup final desciende de la composiciónv2: se generó la base completa sin bandera y luego el agarre bajo completo, conservando los ocupantes y el rostro. La bandera es otro raster completo generado, unido por su asta a esa mano. No se borraron zonas de una bandera defectuosa ni se pintaron cuerpos con código.

Los intentos compactosv3–v6 tenían siete estrellas y se rechazaron; no se utilizan. La primerav1 tenía un pasajero demasiado parecido a María Corina. Los originales y prompts rechazados siguen conservados para trazabilidad.

La inspección sobre gris confirmó siluetas completas, neumáticos completos, manos y caras legibles. El RGB coloreado bajo alfa0 es invisible. Antes de normalizar se añadió un margen transparente de40px mediante traslación exacta, sin recortar miembros ni retocar píxeles. [Auditoría inversa](padding-audit.json) reproduce todo el RGBA original, incluido RGB bajo alfa0. El guard general del normalizador permanece intacto. Las cuatro auditorías `*-grid-audit.json` verifican `exactRetainedRgbaRoundtrip`.

`scripts/assemble-mcm-art.ts` copia nueve objetos completos en celdas comunes y ejecuta el empaquetador existente. El atlas final `public/assets/mcm-caravan-attack-v1.webp` es lossless1536×1536. Las alturas de las poses agachadas se basan en sus medidas originales y comparten escala300/530; no se amplían cabezas al agacharse. El tamaño de adultos no cambia según la plataforma. La bandera se limita al espacio libre superior. Los atlas canónicos y entradas de MCM/Nacho/Capriles/Javier no fueron editados en este paso.

## Coreografía y contacto

| Tiempo de captura | Comportamiento                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| 0–15              | Cuerpo canónico se acerca a la pickup vacía.                                                            |
| 16–35             | Pose completa de subida hacia la caja. Peatones aparecen al final para no tapar el rostro con un pie.   |
| 36–53             | Pickup ocupada, bandera y ambos acompañantes a pie. No se dibuja otra María Corina fuera.               |
| 54–95             | Carga acelerada de180 unidades locales; sigue sin daño.                                                 |
| 96                | Un único daño, con frente visible de parrilla/capó o neumático contra un contorno opaco real del rival. |
| 100–131           | Rival reacciona, pequeño retroceso visual.                                                              |
| 132–156           | Pickup retrocede; peatones invierten su orientación.                                                    |
| 148–167           | Pickup vacía y pose completa de desmontaje.                                                             |
| 168–180           | Regresa cuerpo canónico a su punto físico; vehículo desaparece antes de liberar.                        |

Se mide alfa≥40 del `battleFrame` real del rival, incluidos su slot, orientación y altura visible. Se busca una línea horizontal compartida con el contorno opaco del vehículo. Esto evita el falso contacto del rectángulo en Momoy cuando MCM está110 unidades de mundo por encima: allí el neumático delantero toca el sombrero. Si no existe una línea válida, el módulo rehúsa pintar y entra el fallback canónico completo.

La escena usa arena y cámara de producción. Para alojar toda la caravana y reservar su recorrido, los puntos de presentación se desplazan horizontalmente dentro del viewport durante los primeros24ticks y vuelven en los últimos16. Es una decisión visual explícita; las posiciones físicas, cámara y reloj no se mutan al pintar. Ruedas y acompañantes conservan el plano de origen de MCM. En captura aérea ese plano queda suspendido como el propio actor; entre plataformas no se levanta artificialmente la camioneta hasta los pies del rival. En perspectiva, el neumático trasero tiene apoyo dibujado ligeramente más alto que el delantero.

El principal amplió exclusivamente el recorte documental de la guía de MCM a `(0,72,1080,568)`; no cambió la cámara de producción. Las capturas de este dossier son el viewport completo.

Se conservan desbloqueo de3victorias, coste75, startup9, duración180, liberación ordinaria con fuerza12, guardia, interrupción y resolución de stocks. La música/efectos sintéticos del sistema comparten el evento de daño96; no hay voz clonada, canción ni recurso de YouTube.

## Especial

Marcha firme conserva su atlas y salto frontal. Se confirmó daño demasiado temprano con `range180`: a distancia300 dañaba antes del contacto visible. Se añadió `contactRange110` existente en el modelo, conservando180 como alcance de selección, velocidad13 y duración14. No fue necesario cambiar el motor. Distancia140 da un golpe en13;278 da uno en23;279/300/345 fallan en ambos puestos. Los antiguos tests de MCM se ajustaron al nuevo límite y se amplió la cobertura278/279. [Verificación independiente del principal](root-special-mechanics.json).

## Verificación ejecutada

- `npx tsx --test --test-concurrency=2 tests/mcm-overhaul.test.ts tests/character-audits/mcm.test.ts tests/finales.test.ts tests/finale-world.test.ts tests/attack-art*.test.ts`: **55/55**; [log](focused-tests.log). Incluye7tests nuevos y8de auditoría MCM, mecánica de captura, guardia, fallo, interrupción, costes, daño único, stocks/última vida, liberación/control, serialización, preflight completo y procedencia RGBA.
- `npx tsc --noEmit`: pasa.
- `npm run build`: pasa; [log](build.log). Permanece aviso informativo de chunk mayor que500kB.
- `git diff --check`: pasa.
- `npx tsx scripts/audit-mcm-art.ts`: cuatro inversas RGBA exactas, márgenes transparentes y hashes correctos.
- Browser nativo T3, tab propio `tab_41_c3cfa641-d7e6-4a79-9606-68ffb03b615c`, fixture `scripts/mcm-overhaul-browser-qa.js`: **80casos/1070muestras**, inputs reales y renderer/cámara reales. [Mecánica](browser-evidence.json), [rectángulos y pureza de render](browser-render-evidence.json).

El fixture cubre ambos puestos, normal/cerca, alturas diferentes, bordes hacia dentro/fuera, plataformas418→345 y345→418, guardia frontal/trasera, fallo, interrupción, Silbón/Momoy, captura aérea de separación exacta110, lethal/última vida y gaps140/280/300. Cada captura ocupada debe pintar pickup+bandera: no puede pasar ocultando un fallback. Cada render mantiene exactamente estado y cámara. Las posiciones capturadas permanecen fijas; la liberación y el único golpe96 se verifican.

Se guardaron29capturas nativas intactas con rutas y SHA256 en [screenshots.json](screenshots.json), inspeccionadas directamente: entrada, montaje, aproximación,95sin daño,96contacto, reacción, marcha atrás, desmontaje, cuerpo restaurado/liberación, P1/P2, bordes, ambas plataformas en ambos sentidos, altura aérea sobre Momoy, rival alto/bajo, movimiento reducido, falta de atlas y especial antes/durante/fallo. [Contacto normal](screenshots/contact-p1.png), [P2](screenshots/contact-p2.png), [aéreo P1](screenshots/air-small-p1.png), [aéreo P2](screenshots/air-small-p2.png), [plataforma inversa](screenshots/platform-inverse-p2.png).

No se regeneraron HTML portable ni media de la guía completa. La suite global y la regeneración integral quedan para el cierre de los22personajes según el flujo del principal. El principal reprodujo los80casos/1070muestras, inspeccionó las capturas clave y ejecutó35pruebas enfocadas más el chequeo estricto de la guía: todo pasó. [Evidencia independiente](root-guide-evidence.json). No quedan defectos conocidos en los casos revisados.
