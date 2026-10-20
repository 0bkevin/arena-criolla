# Luis Chataing — micrófono con cable y «¡Vamos a comerciales!»

Estado: investigación, arte, integración, pruebas y revisión independiente del principal **aprobadas**. Personaje 13 de 22. No se inició George. No se hicieron commits, pushes, resets ni reconstrucciones del HTML portátil.

El especial lanza el mismo micrófono oscuro que Chataing sostiene en la mano. La preparación muestra su rejilla redonda y el cable; al soltarlo cambia a un cuerpo completo sin otro micrófono. El cable une la mano con el conector del mango, y la rejilla ocupa el punto físico del proyectil. Chataing lo recoge tras golpear, ser bloqueado, ser desviado o alcanzar su extensión. La definitiva congela el cuerpo canónico del rival dentro de una televisión local, la rompe con **un único microfonazo** y devuelve a ambos al combate. Se mantienen escenario, cámara, identidad canónica y rótulos genéricos.

## Referencias y arte

`research.md` conserva los enlaces de la entrevista de El Diario del 3 de marzo de 2022, sus dos fotografías de escenario inspeccionadas y el contexto de Diario Libre. El micrófono visible tiene rejilla metálica redonda, mango oscuro y cable; no se atribuye marca o modelo. Se inspeccionó también el atlas canónico antes de generar: gafas negras rectangulares, cabello levantado con canas en las sienes, barba corta, blazer carbón, camiseta negra, jeans oscuros y zapatillas negras con suela blanca. El látigo y la televisión son ficción de combate solicitada por el usuario.

Se utilizó únicamente `image_gen.imagegen`, con transparencia y referencias vistas. Los dos PNG originales están intactos en `assets/source/finales/attack-overhaul/chataing/raw-v1.png` y `raw-v2.png`; `prompts/v1.txt` y `v2.txt` conservan las instrucciones exactas. v1 tenía una silueta demasiado próxima al borde exterior y el normalizador la rechazó. v2 deja espacio para cuatro cuerpos completos y dos objetos independientes. La aparente textura oscura del fondo está bajo alfa cero; `accepted-gray.png` muestra el resultado aplanado sobre gris para diagnóstico.

Las seis poses son `windup`, `cast`, `reel`, `recover`, `microphone` y `screen`. Solo preparación y recuperación contienen un micrófono en la mano; lanzamiento y recogida tienen manos que sostienen el cable. La TV tiene una abertura central realmente transparente y ningún rival dibujado en el bitmap. La normalización trasladó componentes completos sin cortar anatomía: **444362 píxeles retenidos conservan RGBA exacto** en la prueba inversa. Solo se descartaron 4023 píxeles alfa1 desconectados. Se conserva además el pequeño componente alfa2 de la TV. El atlas público `chataing-wired-microphone-attack-v1.webp` mide1536×1024 y se codificó sin pérdida; `assets.json` registra la prueba de RGBA y alfa. `provenance.json` vincula originales, fotografías, prompts y los atlas canónicos intactos.

Las poses usan una escala común de los píxeles del original; la altura de cuerpo se corrige por la flexión de rodillas, con menos de0.2% de diferencia debida al redondeo del empaquetado. La cabeza del micrófono se orienta hacia el rival y el cable se conecta a su enchufe, sin giro de trompo ni halo espectral. No se incorporan grabaciones, YouTube, música comercial o voces imitadas. Se mantiene la síntesis original existente del perfil de espectáculo.

## Especial y continuidad física

- Coste25, preparación11 y recuperación65 ticks. Se conserva el nombre «Micrófono de vuelta».
- Un único proyectil viaja a10 unidades/tick, desde el gesto de salida a75 unidades hacia delante y108 por encima de los pies. El primer punto simulado queda a85. Su radio de contacto es12; solo hay daño cuando el punto alcanza el volumen rival. Contra Zavarce resta **11.628HP**, una vez.
- Si no toca, llega a305 unidades del origen en su edad23 y comienza el retorno en24. El retorno viaja a18 hacia la mano de recogida, que sigue la posición y altura reales del dueño. Se recoge antes de atravesarlo; el límite de vida75 impide estados permanentes. Cerca de los límites del mundo se recoge antes de salir de ellos.
- Contacto o guardia consume la capacidad de golpear, pero conserva el objeto y el cable durante el regreso. Una vez conectado no puede dañar de nuevo. La guardia trasera conserva las reglas normales de dirección.
- La reflexión de Carolina desvía el micrófono hacia su dueño original. No cambia `owner`, no deja el cable unido a otra persona y no produce daño reflejado. Un objeto atado no puede convertirse en un proyectil libre del defensor. La prueba usa la entrada real del especial de Carolina.
- Mientras el micrófono está fuera no puede iniciarse otro ataque. Una interrupción posterior a la emisión inicia una recogida sin daño adicional; una interrupción durante la preparación no emite nada. La pérdida de vida del dueño limpia su cable, y una captura cinematográfica recoge los objetos sujetos antes de tomar control de la escena.
- Se toma una instantánea de interrupción antes de resolver proyectiles. Así dos Chataing que lanzan simultáneamente tienen el mismo resultado y una sola cabeza por dueño, sin ventaja por el orden P1/P2.

En navegador, el golpe ocurre en11 desde55 unidades, en18 desde180 y en23 entre plataformas diferentes. Guardia, fallo, reflexión e interrupción inicial producen cero impactos. Los casos de salto, interrupción por una moto real ya emitida, captura del lanzador y dos Chataing simultáneos completan el regreso y la recuperación. No se modificaron las reglas de los demás proyectiles de vuelta.

## Pantalla, golpe y liberación

Se mantienen tres victorias, coste75, preparación9, alcance de captura245 y duración180. La física, los proyectiles y el reloj quedan pausados durante la captura. `damageBeats` contiene exclusivamente `[114]`: contra Zavarce, el microfonazo resta **39.372HP** de una vez. La rejilla llega a la pantalla en ese mismo cuadro, aparece la fractura y las cuatro partes del marco se separan. Son máscaras de una rotura natural sobre el prop completo; no se corta ni sustituye la anatomía del rival.

El rival se dibuja a partir de su atlas canónico dentro de la abertura con una pose fija hasta el golpe. Conserva su cara, atuendo y proporciones; se verificaron Vicente, Capriles, Momoy de140 y Silbón de198 unidades de altura. El fondo azul y las líneas de barrido cubren toda la abertura, extendiéndose ligeramente bajo el marco opaco para evitar franjas de arena sin tinte.

La televisión mantiene su escala y apoya las patas en la plataforma del rival. El cuerpo congelado sube101 unidades locales dentro de la pantalla durante12 cuadros; después de la rotura baja durante30 cuadros. Cerca de otro personaje se separa visualmente la composición, y junto a los extremos se contiene el marco completo. El ajuste horizontal entra y sale en12 cuadros. En una plataforma muy alta se permite una pequeña corrección vertical para mantener el borde superior de la TV dentro del viewport. Son desplazamientos de presentación: el render no cambia posiciones físicas, cámara, altura de plataforma ni daño. El rival vuelve a su ancla antes de la liberación.

En180 termina la captura y se aplica la fuerza normal12. No se hereda la fuerza34 ni la gracia letal90 de Puma. Se libera el control, se resuelven las vidas una sola vez y no queda nadie oculto, congelado o invulnerable indefinidamente. Un rival a1HP conserva su stock hasta la salida y después pierde exactamente una vida. La TV y sus fragmentos ya desaparecieron cuando vuelve el combate.

La frase aparece como diálogo sobre el presentador y queda dentro del viewport y del recorte de la guía. El rótulo de combate sigue siendo «Definitiva». En la guía real: **un golpe en el cuadro123**, correspondiente al tick114 de la captura; liberación en189; pérdida de vida por el lanzamiento normal en227; final de280 cuadros sin `finale`, con100HP y una vida restante. Es una reaparición, no daño perdido. Se actualizaron únicamente las descripciones fuente de la guía.

## Carga fallida y comprobaciones

Cada módulo valida juntas todas sus poses necesarias y las dimensiones intrínsecas antes de dibujar. El especial exige cinco poses; la definitiva, seis. Con un atlas ausente, corrupto o incompleto se conserva el cuerpo canónico visible. Todas las poses canónicas de Chataing ya sostienen un micrófono: por decisión explícita de la revisión principal, el fallback conserva ese único micrófono y muestra un pequeño punto/anillo neutro con cable en la posición física del proyectil. No añade una segunda silueta de micrófono ni recupera el gráfico fantasmal antiguo. Esta degradación de carga comunica la colisión, pero no reproduce la coreografía completa. La definitiva sin atlas utiliza los cuerpos canónicos y la reacción compartida.

- **1067/1067** pruebas de la suite completa final,86.8s: `full-tests-final.log` y copia `full-tests.log`. La primera ejecución dio1066/1067 y está conservada en `full-tests-first.log`. Su único fallo era una expectativa anterior de recorrido libre después del regreso; se sustituyó por una prueba de fallo que verifica salida, pico, giro, acercamiento y recogida real.
- **55/55** pruebas enfocadas en `focused-tests.log`, TypeScript y `git diff --check` pasan. Las nuevas pruebas cubren contacto, bloqueo, retorno, dueño saltando, serialización, ataques duplicados, reflexión, doble Chataing, captura, pérdida de vida, las puertas de definitiva, interrupción, daño único, liberación, vidas, todas las poses y procedencia.
- `scripts/chataing-overhaul-browser-qa.js`: **58 casos y890 muestras**, con entradas reales `special`/`super` y motor, render y assets de producción. Incluye P1/P2, cercanía, ambos sentidos de borde, plataformas y alturas distintas, guardia, fallo, salto, reflexión, interrupción antes/después de emitir, captura del lanzador, doble Chataing, HP letal y última vida. El render no modifica estado ni cámara.
- Auditoría nativa adicional: **862 comprobaciones de número de micrófonos y848 comprobaciones de límites de cuerpos/TV, cero errores**, guardadas en `native-audit.json`. Durante vuelo hay exactamente una cabeza por dueño y un cuerpo sin micrófono dibujado en la mano. Todas las poses examinadas quedan completas dentro del canvas.
- `browser-evidence.json`, `render-evidence.json` y `guide-evidence.json` registran mecánica, geometría y guía. Se guardaron28 capturas del arnés y dos propias de la guía, además de la captura independiente del principal. Se inspeccionaron la hoja de contacto, preparación, salida, contacto, retorno, reflejo, los dos extremos, plataforma alta, rivales pequeños/altos, rotura, recuperación, movimiento reducido y fallback.
- **Revisión independiente del principal aprobada**:22 pruebas finales, compilación y tipos estrictos de la guía pasan. Revisó arte sobre gris, TV corregida, frase completa en la guía fresca, contacto único, P2/plataforma, borde cercano, caras/proporciones de los rivales, retorno tras fallo y reflexión. `root-guide-evidence.json` y `screenshots/root-guide-final-70.png` conservan su evidencia.

Reproducción del arte:

```sh
npx tsx scripts/normalize-attack-grid.ts docs/finales/attack-overhaul/chataing/normalize.json
npx tsx scripts/prepare-attack-art.ts docs/finales/attack-overhaul/chataing/pack.json
```

Pestaña nativa del agente: `tab_3x_c3cfa641-d7e6-4a79-9606-68ffb03b615c`, todavía abierta para el principal. `window.chataingQA.show(key)` reproduce sus muestras; `hide()` vuelve a la guía. No se tocó la pestaña3d del principal. El principal actualiza el registro de aprobación y decide el cierre de pestaña y el comienzo del personaje siguiente.
