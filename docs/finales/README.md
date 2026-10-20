# Procedencia y revisión de los finales

La [integración de main del 19 de octubre](main-merge-2026-10-19.md) amplía la cobertura de ejecución a 52 personajes, conserva el lote pintado original de 46 y documenta los seis fallbacks canónicos y las cuatro identidades pintadas anteriores a main.

El elenco actual tiene 52 personajes. El lote inicial de 46 composiciones y sus revisiones visuales se conserva como historial en la [parte 1](visual-review-part1.md) y la [parte 2](visual-review-part2.md). La [revisión actual por personaje](attack-overhaul/requirements.json) registra los cambios posteriores, sus agentes, referencias, fuentes de arte, pruebas y capturas. La [guía de movimientos](moveset-guide/ataques-arena-criolla.html) demuestra los seis movimientos de cada personaje con el motor y el renderizador vigentes.

Las definitivas se ejecutan dentro de la arena existente, conservando fondo, plataformas, cámara y HUD. Las secuencias de captura usan las posiciones del mundo y pausan el resto del combate; su número de impactos depende de la habilidad. Capriles despliega la mesa y dos sillas, y Nacho hace bailar a ambos participantes sobre el suelo existente. Algunas composiciones ajustan la separación visual de cuerpos o ayudantes para que sean legibles cerca del rival o de los bordes; no mueven las posiciones físicas ni la cámara. Conde Bond y El Chunior son transformaciones temporales durante el combate normal. La onda de Maite viaja como proyectil real y solo hace daño al conectar. La interfaz no muestra vídeo ni reproductor de YouTube; Nacho conserva una composición instrumental original a volumen bajo.

La [grabación actual de Nacho y Capriles](videos/nacho-y-capriles-en-arena-2026-10-19.mp4) contiene preparación, activación por los listeners reales de `Game`, final completo y regreso al combate. La captura nativa no incluye audio y conserva la UI anterior a la retirada del reproductor; documenta el montaje en arena, no el estado actual del audio. La [revisión del montaje en arena](in-arena/README.md) documenta la cobertura visual y las comprobaciones de cámara, plataformas y resolución. Las capturas anteriores del [café](screenshots/capriles-cafe.png), el [escritorio](screenshots/giuseppe-hack.png) y los pilotos del baile se conservan como historial del montaje previo.

La coreografía vigente sigue los seis segundos consecutivos 34,1–40,1 del Short aportado por el usuario; ambos participantes ejecutan los mismos ocho gestos sin reflejar al rival. El [dossier V3](perro-mujeriego-v3/README.md) conserva la observación, las referencias canónicas individuales, los prompts y las revisiones del nuevo lote.

El primer cierre cubrió 230 renderizados de las 46 escenas sin excepciones, alternando lado y rival; su compilación pasó. La [revisión del baile v2](dance-v2-review.md) conserva el historial anterior, incluido el error de interpretación del calzado de Gabriela detectado y corregido en V3.

## Imágenes y prompts

Todas las nuevas imágenes se generaron con `image_gen.imagegen`. Los PNG originales se conservan en [assets/source/finales](../../assets/source/finales/); los WebP que carga el juego están en [public/assets](../../public/assets/).

| Recursos                                                              | Prompts y referencias                                                                               | Empaquetado y consumo                                                                                                           |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Seis atlas de props, con un kit por personaje                         | [Prompts de props](asset-prompts.json)                                                              | [Hashes y tamaños](assets.json), [definiciones de los 46 finales](../../shared/finales.ts)                                      |
| Seis atlas con los 46 personajes sentados y dos variantes adicionales | [Prompts de figuras sentadas](seated-prompts.json), [referencias canónicas](seated-references.json) | [Auditoría de actores](actor-packing.json), [manifiesto de actores](../../shared/finale-actor-assets.json)                      |
| Cuatro poses de Capriles tomando café                                 | [Prompt de Capriles](capriles-cafe-prompt.txt)                                                      | [Auditoría de actores](actor-packing.json), `caprilesCafe` en el manifiesto de actores                                          |
| Ocho poses de Nacho bailando y ocho de Giuseppe tecleando             | [Prompts y referencias de performers](performer-prompts.json)                                       | [Auditoría de actores](actor-packing.json), `performers` en el manifiesto de actores                                            |
| Dos sillas, mesa y taza separadas de los actores                      | [Prompt del mobiliario](cafe-furniture-prompt.txt)                                                  | [Fuente, hashes, recortes y ruido descartado](cafe-furniture.json), [manifiesto del café](../../shared/finale-cafe-assets.json) |
| Coreografía real: ocho poses propias por personaje                    | [Prompts y referencias V3](perro-mujeriego-v3/README.md), [contrato de tiempos](../../shared/perro-mujeriego-choreography.json) | [Auditoría de empaquetado V3](perro-mujeriego-v3.json), [manifiesto V3](../../shared/perro-mujeriego-assets.json) |

La corrección posterior del baile añade seis atlas con poses propias para los 46 rivales y dos variantes: [prompts del baile v2](dance-v2-prompts.json), [estado y revisión](dance-v2-review.md). Se publican en `dancers` del manifiesto de actores y comparten la auditoría de hashes de actores.

El cierre v2 comprobó 138 renderizados de Nacho contra los 46 rivales, las seis hojas de figuras y el movimiento continuo de ambos bailarines en el [vídeo real](videos/nacho-paired-dance-v2.webm). Pasaron 25 tests focalizados y la compilación final; la revisión distingue esas comprobaciones de la inspección visual de cada secuencia.

La corrección del puesto de Giuseppe usa una imagen completa de escritorio y portátil: [prompt del escritorio v2](giuseppe-desk-v2-prompt.txt), [fuente y hashes](giuseppe-desk-v2.json), [manifiesto de recorte completo](../../shared/finale-desk-assets.json). Se empaqueta separado de los cuerpos y reemplaza el recorte previo del prop combinado.

El [proceso de actores y mobiliario](actor-pipeline.md) explica el aislamiento, las anclas, el baseline, la escala común de las secuencias y la igualdad RGBA/alpha entre PNG y WebP. Los tests de [actores](../../tests/finale-actors.test.ts) y [props/mobiliario](../../tests/finale-assets.test.ts) comprueban las salidas reales. La [galería de revisión](gallery.html) permite revisar personajes y escenas.

## Audio de Nacho

El usuario proporcionó [este Short de YouTube](https://www.youtube.com/shorts/Td2Zs5kiH0Y) como referencia del baile y pidió después solo audio. El reproductor visible, su componente y sus estilos se retiraron. Actualmente Nacho utiliza una composición original sintetizada a volumen bajo; no se presenta como «Perro Mujeriego». El usuario descartó después incorporar la canción; no hay archivo pendiente. Se conserva la música original del juego.

El [estado de audio actual](audio-only.md) registra las 11 pruebas focalizadas, la compilación y la revisión de escritorio y móvil. Las revisiones anteriores del player se conservan únicamente como historial de una integración retirada.

## Reproducir las comprobaciones

```sh
npx tsx scripts/prepare-finale-actors.ts
npx tsx scripts/prepare-cafe-furniture.ts
npx tsx scripts/prepare-giuseppe-desk.ts
npx tsx scripts/prepare-perro-mujeriego.ts
npx tsx scripts/validate-perro-mujeriego.ts
npx tsx --test tests/finale-actors.test.ts tests/finale-assets.test.ts
npx tsc --noEmit
```

`scripts/prepare-finales.ts` prepara los seis atlas de props y llama también al helper de mobiliario. El helper puede ejecutarse solo para evitar recomprimir esos seis atlas durante un ajuste del café. El PNG original del mobiliario queda intacto; el PNG empaquetado se guarda como `finales-cafe-furniture-packed.png`. Cada objeto conserva todos los píxeles de su componente conectado de alpha mayor que cero, incluido el vapor. Se descartan únicamente componentes aislados de alpha 1, cuantificados en la auditoría; no se repinta ni se redimensiona el mobiliario.

El empaquetador V3 acepta `--only id` repetido para incorporar una tanda independiente. La ejecución sin selección y la auditoría estricta requieren los 46 personajes completos. Esta última comprueba las 368 poses, los hashes de fuentes y salidas, la igualdad RGBA/alpha, el baseline, las anclas al torso y la escala fija de cada secuencia; vuelve a ejecutar el empaquetador para comprobar 46 aciertos de caché sin modificar archivos.
