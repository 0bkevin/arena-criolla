# Actores sentados y poses de los especiales

Actualización de identidades de main: [dossier y prompts](main-identity-refresh/README.md). La hoja opcional `finales-seated-main-v1-generated.png` contiene cuatro invitados actuales en 2 × 2; se publica en su propio atlas, sustituyendo únicamente las entradas de Capriles, Nacho, Javier y Knoche. No altera los píxeles de los seis grupos sentados anteriores. Sus fallbacks de baile reutilizan la tercera pose de las ocho ilustradas actuales, cuya dependencia queda registrada por hash. Primero se preparan esos cuatro bailarines y luego los actores. El lote publicado tiene 16 atlas y 120 figuras, incluidos los originales conservados.

Ejecutar desde la raíz del proyecto, cuando estén listos los quince PNG originales:

```sh
npx tsx scripts/prepare-finale-actors.ts
npx tsx --test tests/finale-actors.test.ts
```

Un grupo nuevo de baile puede prepararse sin esperar a las demás imágenes ni reprocesar los nueve atlas previos:

```sh
npx tsx scripts/prepare-finale-actors.ts --only finales-dance-v2-1
npx tsx scripts/prepare-finale-actors.ts --only finales-dance-v2-2,finales-dance-v2-3
```

La selección es explícita: si falta uno de los originales solicitados, o una figura no pasa la validación, el proceso falla antes de publicar esa selección. No omite imágenes dañadas ni publica entradas para grupos todavía ausentes. El modo sin `--only` exige las quince fuentes completas.

Entradas conservadas sin modificaciones:

- `assets/source/finales/finales-seated-v1-{1..6}-generated.png`: ocho figuras completas y separadas por hoja, en cuatro columnas y dos filas. El orden corresponde a `FINALE_ASSET_GROUPS`; la sexta hoja lleva seis personajes y dos poses alternativas que también se validan.
- `assets/source/finales/finales-capriles-cafe-generated.png`: cuatro poses completas y separadas, en dos columnas y dos filas.
- `assets/source/finales/finales-nacho-dance-generated.png`: ocho poses de baile de Nacho, en cuatro columnas y dos filas.
- `assets/source/finales/finales-giuseppe-hack-generated.png`: ocho poses de Giuseppe tecleando, en cuatro columnas y dos filas.
- `assets/source/finales/finales-dance-v2-{1..6}-generated.png`: ocho figuras completas de baile por hoja, con la misma agrupación y orden de personajes que las hojas sentadas. La sexta hoja también contiene dos variantes adicionales. Estos bitmaps corrigen el uso anterior de frames de guardia para los rivales de Nacho.

Las catorce hojas de ocho figuras pasan por `normalizeGeneratedAtlas()`, el normalizador existente del creador. La hoja de cuatro poses usa el mismo criterio de componentes conectados y bordes transparentes en un helper parametrizado por filas y columnas. No se modifica el comportamiento del normalizador de producción. Una pose ausente, pegada a otra, fragmentada, duplicada o recortada provoca un error; no se repintan manos, caras o extremidades.

La normalización conserva una escala común dentro de cada hoja. Después se elimina solamente el margen transparente y se traslada cada figura completa a su celda de 512 × 512: el último píxel con alpha mayor que cero termina en la línea 482. Las hojas de ocho figuras finales miden 2048 × 1024; las cuatro poses de café, 1024 × 1024. El lote completo valida 116 figuras: 46 sentados, 46 bailando, cuatro variantes adicionales, cuatro poses de café y 16 poses de los performers de baile/hack. La introducción del baile no modifica los PNG/WebP ni las anclas ya aprobadas de los nueve atlas anteriores.

La geometría usa los límites reales del alpha, con coordenadas absolutas de atlas. Cada personaje sentado o bailarín tiene su propio `bodyHeight`, medido desde el píxel más alto hasta el más bajo de su figura. Las secuencias de una misma persona (café y los performers Nacho/Giuseppe) conservan el `bodyHeight` de su primera pose en todos los frames; los recortes siguen variando con cada gesto para evitar cambios de escala al doblarse. En los nueve atlas anteriores, `anchorX` conserva el centro horizontal ponderado por alpha de los píxeles opacos (alpha ≥ 200) en el 24 % superior, relativo al margen izquierdo del recorte: las rodillas adelantadas no desplazan así la cabeza. En los seis atlas nuevos de bailarines se usa el torso: la mediana de las medianas horizontales por fila, entre el 45 % y el 65 % de la altura visible, también con alpha ≥ 200. Las manos elevadas y un brazo extendido en unas pocas filas no arrastran esta ancla. Un test con brazos a izquierda/derecha, reflejo y traslación comprueba la estabilidad. Estas mediciones comprueban geometría; la semejanza con las referencias del personaje exige revisión visual.

Se guardan el PNG normalizado en `assets/source/finales/`, el WebP con `lossless: true, exact: true` en `public/assets/` y el manifiesto de consumo en `shared/finale-actor-assets.json`: `seated` para los 46 rivales, `dancers` para las 46 poses de baile, `caprilesCafe` para sus cuatro poses, y `performers.nacho`/`performers.giuseppe` para sus ocho poses especiales. La auditoría `docs/finales/actor-packing.json` registra hashes de entradas, salidas, RGBA y alpha, además de las ocho/cuatro geometrías. PNG y WebP deben decodificar a los mismos píxeles RGBA, incluidos todos los bordes de alpha.

El proceso lee todas las entradas seleccionadas y valida todos sus resultados antes de reemplazar salidas. Una ejecución parcial conserva las demás entradas publicadas del manifiesto y de la auditoría; tampoco vuelve a escribir sus PNG/WebP. La caché exige coincidencia del hash de entrada, del script, del normalizador, de la versión de Sharp y de ambos archivos de salida. Cada atlas conserva su propia huella de procesamiento: añadir un grupo nuevo no atribuye una huella nueva a salidas anteriores sin procesarlas. Una hoja intacta no se vuelve a convertir; una salida alterada invalida únicamente su hoja. Los tests verifican los 46 IDs en ambos mapas, las cuatro poses adicionales, anclas, baselines, alpha/RGBA, originales, selección parcial, errores y caché.

El mobiliario del café se produce y empaqueta como props en un atlas separado de los actores. Mesa, respaldos, asientos y tazas requieren capas de profundidad propias para colocar las figuras entre la silla y el borde de la mesa. Ese atlas no añade componentes a las 116 poses corporales ni debe incrustarse en sus recortes; su alineación se revisa en escena después de la aprobación de identidad y anatomía de los personajes.

El helper `scripts/prepare-cafe-furniture.ts` se puede ejecutar solo y también forma parte de `scripts/prepare-finales.ts`. Aísla las cuatro figuras conectando todos sus píxeles de alpha mayor que cero; sus centros, medidos con el núcleo de alpha ≥ 40, determinan el cuadrante de cada objeto. Así conserva la mesa completa aunque cruce una línea de la cuadrícula original y mantiene el vapor tenue de la taza. Traslada los componentes completos a celdas con al menos 16 píxeles transparentes de margen, sin cambiar su escala ni sus colores. Solo permite descartar ruido desconectado con alpha 1 y registra su cantidad. El original permanece intacto; `finales-cafe-furniture-packed.png`, su WebP sin pérdida y `shared/finale-cafe-assets.json` contienen los objetos separados con sus límites reales. `docs/finales/cafe-furniture.json` guarda hashes de fuente, PNG, WebP, RGBA y alpha, además de los recortes de origen y destino. El test reconstruye el atlas desde los componentes originales y exige igualdad exacta para detectar recortes, repintado o pérdida de bordes.
