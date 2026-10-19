# Melanio Escobar — incorporación v44

El usuario confirmó que el personaje solicitado es Melanio Escobar (@melaniobar), el periodista venezolano. Se incorpora como el luchador 52 de Cultura, con arte original que conserva la estética ilustrada del elenco.

## Identidad y arte

Se inspeccionaron cinco fotografías y miniaturas publicadas por organizaciones o productores de entrevistas. La [investigación citada](../research/escobar-identity-v44.md) distingue las imágenes observadas de los movimientos propuestos para el juego. No se completó la reproducción de los videos: el proveedor bloqueó el acceso. Las miniaturas se trataron como imágenes, sin atribuirles movimientos observados.

La referencia de Concordia fija la gorra negra hacia atrás y el polo negro con ribetes claros. Chiste Interno y VENtv ayudan a contrastar rostro ovalado, nariz redondeada con aro pequeño, lentes rectangulares grandes, bigote y barba corta. Se preservan la rosa del cuello y los tatuajes de brazos y manos. Pantalón y calzado completan el atuendo como decisiones de arte.

La herramienta incorporada `image_gen` produjo primero un master de identidad y después ocho poses, usando el master y sus propias fotos como referencias. No se aportó el rostro de otro luchador al generador. Los [prompts completos y la procedencia](prompts.json) se conservan junto al [informe visual independiente](visual-review.md).

- Master: `assets/source/melanio-v44/identity-master.png`.
- Hoja generada: `assets/source/melanio-v44/combat-generated.png`.
- Atlas normalizado: `assets/source/melanio-v44.png`.
- Runtime: `public/assets/melanio-v44.webp`, WebP sin pérdidas.
- [Vista interactiva de las ocho poses](preview.html).

El [empaquetador](../../scripts/pack-melanio-v44.ts) reutiliza el validador del proyecto: separa y escala figuras completas, sin reconstruir facciones. El resultado es 2048×1024, con ocho celdas de 512 px y márgenes visibles de al menos 31 px. Las poses miran a la derecha en origen; el motor las refleja para P2. La herida conserva la mirada a la derecha y retrocede hacia la izquierda. Las carreras alternan brazos y piernas. El WebP conserva exactamente el alfa y todos los píxeles visibles del PNG.

Limitación visual menor: la sonrisa ilustrada es algo más amplia y regular que en las fotografías. El revisor no encontró un bloqueo de parecido, proporción o estilo.

## Personalidad y combate

«Asiente y abre la señal» es una presentación de una sola ejecución: movimiento de cabeza y brazo, un acento de emisión y vuelta a guardia. La selección usa una versión más suave y se detiene. La victoria tiene un gesto propio y se estabiliza a los 3,5 segundos. No se afirma que estas acciones sean rituales reales de Melanio.

El especial **Señal libre** cuesta 25 de energía. Su preparación de 21 ticks a 60 Hz permite interrumpirlo; emite un único proyectil ondulante de 8 de daño base. Invierte la velocidad al cumplir 24 ticks de vida y desaparece como máximo a los 58. El alcance práctico es de unas 220 unidades contra un rival inmóvil, por lo que requiere acercarse. La CPU usa la distancia real de los proyectiles de retorno. Una flecha sigue la velocidad del pulso y el color cambia de cian a dorado al regresar.

Los tres combos son **Micrófono abierto**, **Frecuencia punk** y **Red en marcha**. Respetan los desbloqueos y el coste de la definitiva del motor existente. Se añadieron efectos de emisión originales; los golpes y las reacciones no verbales usan el sistema genérico del juego. No se añaden grabaciones ni imitaciones de su voz.

## Validación

- `npm test`: **798/798** pruebas correctas, sin omitidas. Incluye energía insuficiente, preparación interrumpida, bloqueo, inversión real de velocidad, caducidad, combos y definitiva en ambos lados; CPU determinista sobre las plataformas móviles de Los Roques.
- La matriz WebSocket incluye a Melanio al crear, unirse, elegir e iniciar salas en los nueve escenarios; verifica la recepción del especial en ambos clientes. El motor y el protocolo no requirieron cambios.
- `npm run check:assets`: **52/52** pares activos PNG/WebP correctos.
- `npm run build -- --outDir /dev/shm/arena-melanio-v44-dist --emptyOutDir`: TypeScript y build correctos. Se utilizó una carpeta temporal para la salida de compilación.
- Renderizadores reales en navegador: **16** muestras de combate, **22** presentaciones, **10** cinemáticas y **10** celebraciones sin errores; todas las muestras de cuerpo completo quedaron dentro del lienzo.
- Pelea interactiva contra Javier/CPU normal en Altamira y contra Dayana con rival local activo en Los Roques, usando selección y entradas normales de teclado. En ambos lados se recibieron movimientos, saltos, golpes y especial con estado finito.
- Navegador a **844×390** con capacidades táctiles simuladas: Melanio contra Renny en La Guaira. El lienzo ocupó exactamente el viewport; los diez controles de 48×48 px quedaron dentro, sin overflow. Entradas de puntero recibidas: dos saltos, golpe ligero, fuerte, esquiva y especial; se observó el proyectil. Esto no sustituye una prueba sobre hardware móvil físico.
- [Evidencia estructurada](runtime-qa.json), [captura del combate móvil](mobile-fight.png) y [revisión adversarial](adversarial-review.md). Sus dos observaciones sobre legibilidad del retorno y texto de presentación quedaron resueltas.

Se cerraron la pestaña de prueba y el servidor temporal del puerto 5193 al terminar. Las fotos de investigación permanecen fuera de los assets publicados; sus fuentes siguen enlazadas en la investigación.
