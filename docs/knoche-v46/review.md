# Doctor Knoche — corrección de parecido v46

Se reemplaza la interpretación de anciano calvo con lentes, barba blanca larga y abrigo morado por un personaje basado en las tres fotografías históricas aportadas por el usuario. El nuevo rostro conserva la frente alta, el cabello corto hacia atrás, la nariz prominente, el bigote y la barba de mentón puntiaguda. El vestuario reproduce la silueta del traje con chaleco, camisa de cuello alto y corbatín. Mantiene la ilustración entintada y el sombreado del elenco.

La [investigación visual](research.md) distingue lo observado de las decisiones artísticas: las imágenes originales no establecen colores exactos y la tercera es una colorización editorial. El pequeño frasco verde sigue como elemento ficticio del combate. Un [revisor independiente](visual-review.md) aprobó el parecido y las ocho poses; señaló que el rostro y el cabello son algo más llenos que en el retrato original.

## Assets e integración

La herramienta incorporada `image_gen.imagegen` produjo un master de identidad y una hoja de combate. Se corrigió mediante la misma herramienta el segundo paso de carrera, que inicialmente repetía la zancada del primero. El resultado alterna una zancada extendida y una fase de rodilla alta. Los [prompts completos](prompts.json) conservan referencias, decisiones y salidas originales, incluyendo el primer intento rechazado. No se copiaron fondos, marcas de agua ni fotografías a los assets publicados.

- Master: `assets/source/knoche-v46/identity-master.png`.
- Hoja generada: `assets/source/knoche-v46/combat-generated.png`.
- Atlas activo: `assets/source/knoche-v46.png`, 2048×1024, ocho poses completas.
- Runtime: `public/assets/knoche-v46.webp`, 746.010 bytes, sin pérdidas.
- [Empaquetador reproducible](../../scripts/pack-knoche-v46.ts), [auditoría de empaquetado](packing.json) y [checksums e igualdad de píxeles](checksums.json).
- [Comparación y visor de las ocho poses](preview.html).

El empaquetador aísla, desplaza y escala figuras completas; no reconstruye facciones ni pega fragmentos de rostros. El PNG y el WebP tienen alfa idéntico y cero diferencias de RGB en píxeles visibles. Todas las poses miran a la derecha en origen; el renderizador refleja el conjunto para P2. La pose de daño retrocede conservando la mirada hacia el oponente.

El registro compartido y la geometría usada por selección, retratos, combate, cinemática y victoria apuntan a v46. Se recalibraron cuello, hombros, manos y protección rígida del frasco para el cuerpo nuevo. La presentación observa el bolsillo y vuelve a guardia una sola vez, sin acomodarse lentes. Se retiró un destello que permanecía en la antigua posición del frasco. El historial visual v12 se conserva como registro anterior y queda sustituido por esta revisión.

## Validación

- `npm run check:assets`: **52/52** pares PNG/WebP activos; ocho figuras separadas, transparentes y completas por personaje. Knoche tiene 79,24 % de píxeles completamente transparentes y conserva margen en cada celda.
- `npm test`: **813/813** pruebas correctas, sin omitidas. Incluye las **nueve** pruebas individuales de Knoche: movimiento y doble salto, ambas orientaciones, golpes y bloqueo, coste y arco del elixir, ralentización y caducidad, combos, definitiva, bloqueo de acciones durante el inicio y pelea completa determinista contra CPU.
- Una prueba antigua exigía que todos los personajes de Leyendas mantuvieran para siempre un nombre de sprite terminado en `v12`. Se actualizó para comprobar que cada personaje conserva sus tres combos y archivos PNG/WebP existentes, permitiendo revisiones visuales como esta.
- TypeScript, build de producción y `git diff --check` correctos. El build mantiene el aviso previo sobre el tamaño del paquete JavaScript.
- [Renderizadores reales en navegador](../../scripts/review-knoche-v46-browser.js): **16** poses de combate y **22** muestras de presentación completas dentro del lienzo, más **10** cinemáticas y **10** celebraciones renderizadas sin errores. Se inspeccionó visualmente el [acercamiento de Knoche contra Renny](intro-closeup.png); esa captura es una auditoría del renderizador con un estado de prueba.
- Peleas mediante selección y eventos ordinarios de teclado, con lectura del estado sin inyectar posiciones o energía: Knoche/P1 contra Javier/CPU normal en Altamira y Knoche/P2 contra Renny/local con rival activo en Los Roques. En ambos casos se recibieron desplazamientos, saltos y ataques, se ejecutó el especial, se conectaron golpes y el estado se mantuvo finito. Las entradas en recuperación pueden no iniciar un golpe, como corresponde al motor existente.
- Tras la segunda pelea se inspeccionó la vista horizontal a **844×390** con capacidades táctiles simuladas: el lienzo ocupó exactamente el viewport, sin overflow, y Knoche se dibujó completo mirando hacia la izquierda. La [captura móvil](mobile-fight.png) es una prueba de navegador, no hardware físico.
- [Evidencia estructurada](runtime-qa.json), con muestras de render, dos combates y dimensiones de la vista horizontal.

Se cerraron el servidor temporal del puerto 5193 y la pestaña de prueba al terminar. Las mecánicas, estadísticas, combos y sonidos de Knoche conservan su comportamiento previo.
