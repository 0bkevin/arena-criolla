# El Puma — ¡Agárrense de las manos!

Estado: implementación, verificación del agente y aprobación independiente del principal completadas. Personaje 12 de 22.

La definitiva invoca cuatro bailarines adultos que se toman de las manos y rodean al rival. Cuatro dibujos completos cambian su posición en la ronda cada nueve cuadros, manteniendo cuerpos erguidos, rostros visibles y el orden de los trajes. El cuerpo canónico del rival permanece dentro de la abertura central y acusa los tres golpes. El Puma prepara el remate desde el cuadro 158; al terminar la captura, el rival sale impulsado por la física normal hasta cruzar los límites de la arena y perder una vida. La reaparición o el resultado de la última vida ocurren después de ese vuelo.

## Arte y referencias

Se inspeccionaron el atlas canónico `puma-v3.png` y la fotografía del concierto publicada por [Canarias Ahora](https://www.eldiario.es/canariasahora/cultura/puma-regresa-canarias-cinco-anos-despues-ultima-actuacion_1_12127812.html), que muestra al cantante extendiendo la mano. [TVN](https://www.tvn.cl/programas/buenos-dias-a-todos/espectaculos-y-tv/un-icono-que-estara-el-olmue-2024-conversamos-con-el-puma-rodriguez) y [Univision](https://www.univision.com/shows/despierta-america/emocionado-el-creador-de-la-nueva-version-de-agarrense-de-las-manos-charlo-con-el-idolo-de-sus-papas-el-puma-video) aportan contexto del artista y su asociación con el tema. `research.md` distingue la fotografía realmente consultada del enlace de TVN que devolvió 403. La ronda y la catapulta son coreografía ficticia del juego, no una recreación histórica. Se conserva su rostro maduro, cabello plateado, chaqueta oscura y calzado canónico.

Los tres originales intactos de `image_gen.imagegen` están en `assets/source/finales/attack-overhaul/puma/raw-v1.png`, `raw-v2.png` y `raw-v3.png`; los tres prompts y sus hashes se conservan en este dossier. v1 se descartó por una abertura central insuficiente y márgenes. v2 aporta las dos poses del cantante y las fases A/C. La revisión independiente detectó que los vestidos de las fases B/D invertían el orden de la ronda: v3 pidió al generador intercambiar únicamente rojo y dorado en esas fases. Se incorporaron las dos celdas completas corregidas; las otras cuatro celdas siguen siendo RGBA idénticas a v2. No se repintó anatomía ni se recortaron siluetas para hacerlas pasar.

Las dos normalizaciones trasladan componentes enteros y pasan la prueba inversa RGBA. `assembly.json` registra la procedencia y hash de cada celda. El atlas publicado, `puma-handchain-attack-v1.webp`, mide 1536×1024, con seis celdas de 512 y codificación sin pérdida. `assets.json` conserva la verificación de alfa/RGBA de la publicación. `accepted-gray.png` muestra el resultado sobre gris; los colores bajo alfa cero no se interpretaron como un fondo opaco. `provenance.json` verifica también que los atlas canónicos de combate y entrada permanecen intactos.

El cantante usa altura 305 y la ronda 275. Nunca se gira el bitmap: las cuatro fases mantienen todas las cabezas arriba. La ronda completa se pinta delante del cuerpo rival; su abertura transparente conserva el rostro del rival y evita cortar rostros o manos de los bailarines. Con movimiento reducido se mantiene la fase A, con la misma mecánica.

En capturas muy próximas se permite un paso horizontal de presentación: el cantante retrocede hasta alcanzar una separación local de 335, limitado por el intervalo visible común de sus dos poses. La ronda y el rival se desplazan juntos hacia el interior cuando el borde lo exige. El ajuste entra y sale durante 12 cuadros; el rival compensa además 40 unidades locales de inclinación de su pose canónica. En el cuadro 180 vuelve exactamente a su ancla física antes del lanzamiento. Cada grupo mantiene la altura de apoyo de su propio jugador, incluso en plataformas distintas. Estos ajustes no modifican posiciones físicas, cámara ni escenario; se documentan porque la separación visual durante la captura no equivale a desplazamiento del motor.

## Captura, expulsión y resolución

Se mantienen tres victorias, 75 de energía, nueve cuadros de preparación, contacto cercano de 245 y captura de 180 cuadros. Los impactos ocurren en 42/90/138. Contra Zavarce restan 14.7424 HP cada uno, 44.2272 en total. El rival puede evitar el inicio con guardia frontal, distancia, espalda o interrupción. Durante la captura se pausan física y reloj y se descartan las entradas; al liberar vuelve el combate normal.

`FinaleDefinition.release` configura el remate de manera reutilizable. Puma usa fuerza 34; las demás capturas mantienen el valor anterior 12. El impulso se aplica una sola vez con `launchTarget`, seguido por gravedad y movimiento reales. Contra Zavarce desde el centro, el ensayo libera en 189 con vx 50.7080533 y vy −22.1; cruza el límite y pierde una vida en 203. Los casos de borde exterior y captura cercana hacia dentro resuelven en 194 y 212 respectivamente. No se adjudica una pérdida de vida por el mero fin de la animación.

Si los golpes dejan HP cero, `knockoutDelay` conserva hasta 90 cuadros de vuelo antes del límite de emergencia. Cruzar los límites físicos resuelve inmediatamente una sola vida. Durante ese intervalo el derrotado no puede moverse por entradas, atacar, bloquear ni recibir daño/recompensas duplicadas. La pérdida de vida limpia el campo; JSON conserva el vuelo y su repetición determinista. La resolución por tiempo y el resultado de partida esperan la resolución pendiente; el vuelo usa ticks normales de combate. Se protege también el caso donde una caja Cashea real ya lanzada mata al Puma durante el vuelo letal del rival: con ambos en su última vida el resultado es empate, sin ganador con HP cero, vuelo congelado ni stocks negativos.

El sonido mantiene la síntesis original existente del perfil musical. No se incorporaron grabaciones, melodía comercial, YouTube ni imitación de voz. El rótulo de combate es «Definitiva»; la frase aparece como diálogo.

El especial «Rugido del Puma» se verificó sin cambiarlo: preparación de 16 cuadros, contacto frontal único, 25 de energía y 18.2784 de daño contra Zavarce. Guardia y fallo conservan cero daño. Es un ataque de alcance frontal, no un proyectil libre. Su pose canónica y efecto siguen siendo coherentes.

## Evidencia y comprobaciones

- Suite completa del motor: **1056/1056**, 86.5 s, en `full-tests.log`. Se ejecutó después de cerrar la mecánica, incluido el empate durante vuelo letal. Después solo cambiaron presentación, arte y pruebas: se sustituyó el caso sintético por la caja Cashea creada con entrada real en ambos puestos y se añadió la prueba de ensamblado exacto.
- Comprobación final: **72/72** enfocadas, en `focused-tests.log`; `npx tsc --noEmit` y `git diff --check` pasan. Incluye arte, normalización, etiquetas, definitivas, auditoría del personaje, viewport y las nueve pruebas nuevas de Puma.
- `tests/puma-overhaul.test.ts` cubre ambos jugadores, centro y ambos extremos, tres rivales con resistencias diferentes, HP 1/100 y una/dos vidas; daño, coste, reloj, liberación, retorno del control, límites reales, última vida, guardia, fallos, interrupción, serialización, vencimiento del plazo, reinicio y empate con proyectil real. También comprueba la fuerza anterior de otras capturas, todas las poses obligatorias y procedencia exacta.
- `scripts/puma-overhaul-browser-qa.js` ejecuta **40 casos y 570 muestras** con entradas reales `super`/`special`; no crea `finaleState`. Incluye P1/P2, normal, cercanía, alturas diferentes, ambos sentidos de los extremos, captura cercana al borde, plataformas de Valencia, guardia, fallo, HP letal y última vida. Física y render usan módulos de producción; se comprueba que render no modifica estado ni cámara.
- `browser-evidence.json` conserva mecánica y tiempos; `render-evidence.json`, 24 composiciones seleccionadas. Hay **27 capturas nativas** en `screenshots/`, incluidas tres de la guía. Se inspeccionaron la hoja de contacto, las cuatro fases, rostro central, extremos, plataformas, remate, vuelo, reaparición, especial, movimiento reducido y falta de atlas.
- Si falta cualquiera de las seis poses, el preflight devuelve el cuerpo canónico visible, reacción y anillo antes de pintar arte parcial; no revive el micrófono decorativo anterior.
- La guía fuente muestra tres contactos reales en 51/99/147, liberación en 189 y pérdida de vida en 202. `guide-evidence.json` registra mínimo 55.7728 HP y final 100 HP con una vida restante: es una reaparición, no un ataque fallido. Sus 280 cuadros alcanzan para ver el resultado. No se regeneraron HTML portátil ni medios.

Reproducción del arte:

```sh
npx tsx scripts/normalize-attack-grid.ts docs/finales/attack-overhaul/puma/normalize.json
npx tsx scripts/normalize-attack-grid.ts docs/finales/attack-overhaul/puma/normalize-v3.json
npx tsx scripts/assemble-puma-art.ts
npx tsx scripts/prepare-attack-art.ts docs/finales/attack-overhaul/puma/pack.json
```

Se usó la pestaña nativa `tab_3w_c3cfa641-d7e6-4a79-9606-68ffb03b615c`, cerrada tras la aprobación. `window.pumaQA.show(key)` reproduce las muestras de `window.pumaQA.keys`; `hide()` vuelve a la guía. La revisión principal ya confirmó el orden corregido A→B→C→D, las cuatro caras, la composición de la guía y el empate Cashea con entradas reales. La aprobación final tras la simplificación de capas está registrada debajo. No hubo commits ni pushes.

Aprobación final del principal: arte ensamblado y orden A/B/C/D revisados, capas finales B/D y guía con frase completa aprobadas, extremo cercano y vuelo real inspeccionados. Pasaron20 pruebas independientes tras la última simplificación, compilación y tipos estrictos de la guía. La prueba independiente con Puma/Pedro a1HP y1vida, especial Cashea real antes de captura, terminó en empate en206 sin stocks negativos. Fuente final validada; Chataing puede comenzar.
