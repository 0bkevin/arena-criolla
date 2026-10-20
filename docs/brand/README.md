# Arena Criolla · Marca

El logo es un puño que avanza con una estela detrás. Lleva el amarillo de los
botones del juego para que lo reconozcas también en la pestaña del navegador
o en tu móvil.

## Archivos

- `public/assets/arena-logo.svg` y `arena-logo.png`: puño oscuro sobre el
  recuadro amarillo, sin fondo exterior y con las esquinas transparentes.
  El PNG mide 1200 × 1200.
- `public/assets/arena-fist.svg` y `arena-fist.png`: solo el puño oscuro, con
  fondo transparente y un encuadre ajustado. El PNG mide 1200 × 800.
- `public/assets/arena-fist-yellow.svg` y `arena-fist-yellow.png`: el mismo
  puño en amarillo, para usar sobre fondos oscuros.
- `public/assets/arena-mark.svg`: original editable, fondo transparente.
- `public/assets/arena-mark.png`: PNG transparente, 1024 × 1024.
- `public/assets/arena-mark-mono.svg`: versión a un color (`currentColor`).
- `assets/source/arena-strike-concept.png`: concepto original generado con la
  herramienta integrada de imágenes. Se conserva su transparencia original.
- `docs/brand/prompt.json`: prompt exacto, herramienta y procedencia del concepto.
- `public/assets/arena-icon.svg`: icono con el amarillo de los botones.
- `assets/icon.svg`: icono del proyecto, idéntico al icono del juego.
- `public/assets/arena-icon-{32,180,192,512}.png`: favicon, iOS y aplicación.
- `public/assets/arena-icon-maskable-512.png`: fondo completo y marca dentro
  del círculo seguro para los recortes de los lanzadores de Android.

El maestro SVG es la fuente de las exportaciones. Ejecuta `npm run assets:brand`
para regenerarlas con Sharp, ya incluido en el proyecto. El script lee el color
`--coin` de `src/arcade-theme.css`. El nuevo icono sustituye los anteriores del
juego y del proyecto. El favicon SVG incluye una versión en su URL para renovar
la copia del navegador al reemplazar la antigua A.

## Paleta

| Uso     | Color     |
| ------- | --------- |
| Fondo   | `#ffd45a` |
| Símbolo | `#101218` |

El icono con fondo amarillo se usa en la cabecera, el favicon y los accesos de móvil.
El símbolo transparente oscuro se usa sobre fondos claros; la versión monocroma
usa `currentColor` al insertarla en línea. La cabecera conserva Barlow Condensed
en negrita cursiva y su nombre accesible «Arena Criolla, inicio».

La [revisión adversarial](review.md) recoge los hallazgos, la corrección del
exportador y las comprobaciones de los archivos finales.

Brief vigente: «minimal, dynamic, but clean», con libertad para usar un icono
y el amarillo de los botones actuales. Se generó un concepto con la herramienta
integrada de imágenes y se redibujó su silueta en SVG, con relleno plano y sin
texturas. Las exportaciones del juego salen del maestro vectorial, no del bitmap.
