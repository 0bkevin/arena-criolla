# Caracas · Altamira al atardecer

Revisión individual: 17 de octubre de 2026. Alcance: fondo, espacio de combate, plataformas, límites y presentación responsive. Sin cambios de arte, audio, partidas en línea ni ranking.

## Sitio publicado

- Se inició una pelea rápida contra CPU en https://arena.kevinbravo.com, con Altamira seleccionado. Fondo y personajes cargaron; no aparecieron errores de consola o de carga de sus recursos. El obelisco, el Ávila y la plaza se reconocen con claridad. Los personajes se distinguen del fondo cálido.
- En ventana de 1280 × 800, durante el combate el canvas publicado de 1080 × 640 se mostró en aproximadamente 907 × 536 píxeles CSS. El suelo jugable actual mide 940 unidades, entre x=70 y x=1010. Hay margen para ampliar el combate y reducir la sensación de encierro.
- Las dos plataformas grises coinciden visualmente con la balaustrada del fondo: su borde superior es poco evidente, especialmente al reducir el tamaño del juego. Recomendación concreta: marcar el borde con el color cálido del escenario.
- Se comprobó el layout táctil en una ventana de 844 × 390, emulando `navigator.maxTouchPoints=5` en una pestaña propia. El canvas se expandió a 1385 × 640 y ocupó la ventana completa, sin desbordamiento horizontal. En 390 × 844 apareció «Gira tu teléfono». Esto verifica el layout emulado; no sustituye una prueba física de pantalla táctil o de orientación.
- La automatización perdió conexión una vez al cambiar el tamaño de la ventana; `preview_status` confirmó la reconexión y la revisión continuó. Se cerró exclusivamente la pestaña propia al terminar.

## Código y ampliación local

- Antes de la ampliación, los balcones estaban en x=210 y x=705, y=392, con ancho 170. Tras la ampliación compartida observada en este checkout, están en x=149 y x=753, y=392, con ancho 184. El suelo ahora mide 1260 unidades, entre x=-90 y x=1170: 34 % más ancho. El mundo visible es 1440 × 800 con origen (-180,-140).
- La altura de las plataformas se conserva: 162 unidades sobre el suelo. La física actual alcanza 151,2 unidades de altura con un salto simple; por tanto ambos balcones requieren doble salto. Se verificó por simulación que se alcanza y se aterriza sobre cada balcón con el segundo salto a los 20 ticks. Esta condición ya existía antes de ampliar; conservar las alturas evita empeorarla.
- Los balcones ampliados permanecen dentro del suelo y del mundo visible. El hueco central aumenta de 325 a 420 unidades; sigue siendo transitable mediante el suelo continuo y no obliga a saltar entre balcones.
- El renderer local ya incorpora el borde superior de color solicitado por esta auditoría. La cobertura del fondo usa las proporciones naturales de la imagen, sin estirar los personajes. En viewport táctil 844 × 390, los límites calculados son x=-325,5, y=-140, ancho=1731 y alto=800; contienen todo el escenario.

## Verificación y límite

`npx tsx --test tests/stages.test.ts tests/viewport.test.ts`: 11 pruebas aprobadas, antes y después de la ampliación compartida. Incluyen física finita y determinista de los nueve escenarios y conservación del mundo completo en distintas proporciones de ventana. Se añadieron comprobaciones ad hoc, sin modificar pruebas comunes, para el alcance de ambos balcones con doble salto.

La inspección visual corresponde al sitio publicado con geometría anterior. La ampliación y el nuevo contraste se verificaron en código y simulación local; esta auditoría no afirma que ya estén desplegados en producción.
