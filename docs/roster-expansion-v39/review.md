# Elenco y correcciones de arte v39

Revisión del 18 de octubre de 2026. El elenco conserva sus 46 figuras anteriores y suma cinco: Lorenzo Mendoza, Carolina Herrera, Dayana Mendoza, Simón Bolívar y Édgar Ramírez. Capriles recibe arte ilustrado nuevo y Javier Hala Madrid recibe proporciones nuevas; el total es 51.

## Revisión individual

| Personaje | Identidad visual y corrección | Movimiento propio |
| --- | --- | --- |
| Capriles | Ocho poses nuevas con tinta y sombreado de ilustración, reemplazando el acabado fotográfico. Conserva la gorra tricolor, camisa gris, jeans y tenis de la referencia del usuario. La entrada también se redibujó. | Conserva Sprint tricolor y su entrada de brazos cruzados, ejecutada una sola vez. |
| Javier Hala Madrid | Cabeza menor respecto al torso, brazos y piernas más largos y guardia menos encogida. Conserva copete, orejas, cejas expresivas, sonrisa, camiseta negra y cadena fina. La entrada utiliza el mismo cuerpo nuevo. Se actualizaron los anclajes de manos y la anchura del rig de cabeza. | Conserva Reacción maracucha y sus combos; bloqueo con manos levantadas y entrada de brazos cruzados sin repetición. |
| Lorenzo Mendoza | Rostro maduro, cabello gris/castaño, lentes negros, chemise azul y pantalón oscuro, basados en el retrato oficial de Polar. | Presenta una palma una vez. Pulso polar envía tres estrellas por trayectorias diferentes y ralentiza al rival. |
| Carolina Herrera | Diseñadora madura, cabello corto plateado, camisa blanca y falda oscura; se distingue de su hija. El atuendo se adapta al movimiento del juego. | Acomoda el puño y gira ligeramente. Corte de seda refleja proyectiles durante la anticipación y termina con un arco de alcance medio. |
| Dayana Mendoza | Vestido amarillo y corona inspirados en su imagen oficial de Miss Universe 2008, melena miel y sonrisa amplia. Vestido con abertura para que salto y patada sean legibles. | Un paso y un saludo de reina. Destello de reina produce tres pulsos de alcance creciente; todos respetan la guardia. |
| Simón Bolívar | Rasgos, patillas, bigote y uniforme rojo/oro de la variante de retrato de José Gil de Castro custodiada por MALI. No se usó una reconstrucción facial moderna. | Saludo de campaña y paso firme. Carga libertadora avanza una vez, conecta un solo golpe y frena al acabar. |
| Édgar Ramírez | Rostro, cabello ondulado, barba y camiseta azul del retrato de Cannes, con pantalón oscuro y botas como adaptación de arena. | Esquiva de hombro y guardia. Segunda toma permite una contra frontal durante una ventana limitada y un remate posterior. |

Las biografías y los retratos proceden de [referencias primarias revisadas](research.md). Los ataques y saludos son adaptaciones ficticias. Las semejanzas y las proporciones se juzgaron visualmente; no se afirma una medición biométrica ni una proporción anatómica exacta por algoritmo.

## Convenciones de assets

- Siete atlas de combate nuevos, cada uno con ocho siluetas completas: guardia, bloqueo, dos carreras opuestas, salto recogido, puño, patada e impacto.
- Todas las poses miran a la derecha antes del reflejo del motor. El bloqueo se distingue de la guardia y todas las figuras llegan completas a sus celdas.
- PNG de 2048×1024 en cuatro columnas y dos filas, celdas de 512 píxeles con margen transparente, escala uniforme por personaje y WebP sin pérdida.
- Dos atlas de entrada nuevos para Capriles y Javier. El cronograma compartido utiliza las primeras seis poses para erguirse, cruzar brazos, sostener y soltar una sola vez. Las otras dos poses generadas de salida quedan conservadas en el original.
- El primer borrador de entrada de Capriles se descartó por falta de margen inferior. La pose de sostén de Javier se corrigió para que los brazos permanezcan cruzados durante la pausa.
- Los cinco nuevos especiales tienen efectos visuales y sonidos sintetizados propios. Se mantienen las reacciones genéricas de combate, sin voces ni grabaciones de estas personas.

## Archivos y reproducción

- Originales seleccionados: `assets/source/roster-v39/*-generated.png`.
- Fuentes de combate: `assets/source/{capriles,javier,lorenzo,carolina,dayana,bolivar,edgar}-v39.png`.
- Assets activos: `public/assets/{capriles,javier,lorenzo,carolina,dayana,bolivar,edgar}-v39.webp`.
- Entradas: `assets/source/{capriles,javier}-v39-defiant-entrance.png` y sus WebP en `public/assets/`.
- [Prompts exactos](prompts.json), [procedencia de los archivos](generated-assets.json) y auditorías `*-packing.json` en esta carpeta. Se usó la herramienta integrada `image_gen.imagegen`.
- `node_modules/.bin/tsx scripts/pack-roster-v39.ts` vuelve a empaquetar los nueve originales seleccionados. Acepta IDs para procesar un subconjunto; valida todos los solicitados antes de reemplazar archivos.
- `npm run check:assets` comprueba los 51 atlas de combate y actualiza la geometría que consume el juego. Las pruebas de entradas comprueban además sus fuentes, transparencia y geometría.
- La [galería de desarrollo](preview.html) utiliza los renderizadores reales mediante `scripts/review-roster-v39-browser.js`. Para servirla durante una revisión local con Vite, copiarla temporalmente a `public/__icons-review.html` y abrir esa ruta; retirar la copia antes de compilar. No es una ruta de producción.

## Evidencia

- [Antes y después de Capriles y Javier](comparison.png), comparados a la misma altura con Renny y Vicente.
- [Siete personajes nuevos o corregidos](gallery.png), [todas las poses junto al elenco](all-poses.png) y [Javier contra Capriles en una pelea real](match.png).
- [Resultados del navegador](runtime-qa.json): 112 poses/orientaciones, 154 muestras de presentación completas, 70 muestras de cinemáticas y 70 de celebraciones sin errores de renderizado.
- Los siete se eligieron desde la interfaz, llegaron a la pelea y registraron especial, salto y movimiento. Se verificó el atlas v39 cargado y el especial en el historial real de la simulación, además del consumo de energía.
- `tests/roster-v39.test.ts` aporta 47 pruebas individuales y de habilidades: ambos lados, bloqueo, movimiento, doble salto, energía, combos y combates completos contra CPU normal repetidos de forma determinista.
- Suite completa: **731 aprobadas, 0 fallos**. Validación de assets: **51 pares PNG/WebP aprobados**. Compilación de producción aprobada.

La automatización de navegador usó un viewport de escritorio; no se afirma una prueba en hardware físico de teléfono. El servidor temporal y las pestañas de revisión se cerraron al terminar.
