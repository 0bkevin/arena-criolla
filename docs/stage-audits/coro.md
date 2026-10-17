# Auditoría individual: Médanos de Coro

Fecha: 2026-10-17. Alcance: únicamente Coro, sobre la ampliación local del escenario. No se modificaron archivos de implementación.

Resultado: las comprobaciones ejecutadas pasan. El suelo ampliado es continuo, ambas plataformas siguen siendo accesibles y la tarima móvil transporta al luchador durante su ciclo completo sin perder el soporte.

## Versión y geometría

Se inspeccionó una partida local real de dos jugadores en `http://localhost:5184/`, abierta con T3 Preview en una pestaña propia: `tab_q_07e54779-9ab2-4979-8a15-674c4eff160a`. El canvas medido mediante DOM es 1440 × 800. Esta auditoría comprueba los cambios locales; no da por desplegada esta geometría en `https://arena.kevinbravo.com/`.

- Mundo: origen (−180, −140), dimensiones 1440 × 800.
- Suelo: x = −90…1170, y = 554, ancho 1260.
- Plataforma fija: x = 65…265, y = 425, ancho 200.
- Tarima móvil: x base 571, y = 385, ancho 194, movimiento horizontal ±148, período 480 ticks (8 segundos de simulación).
- Extremos de la tarima: borde izquierdo x = 423…719; borde derecho x = 617…913. Todo su recorrido permanece dentro del suelo y del encuadre.

El rango encontrado en `shared/stages.json` al ejecutar la auditoría es **148**, aunque el encargo de revisión mencionaba 149. Las cifras y pruebas de este documento corresponden al valor real 148. La diferencia no bloquea el escenario; cualquier cambio posterior debe volver a ejecutar las comprobaciones de acceso y soporte.

## Evidencia de física

Se ejecutó el motor compartido real mediante `node --import tsx --input-type=module`, con aserciones de `node:assert/strict`, importando `createMatch`, `emptyInput`, `stepMatch`, `WORLD`, `platformsAtTick` y el catálogo completo de luchadores.

1. **Transporte durante dos ciclos:** 960 ticks sobre el centro de la tarima móvil, sin entradas de movimiento. El pasajero conservó `grounded = true`, `supportPlatform = 1`, y = 385 y dos vidas. La deriva máxima respecto al centro fue 1.08 × 10⁻¹² unidades, redondeo numérico despreciable.
2. **Acceso desde ambos lados:** 656 casos: 41 luchadores × 2 plataformas × 2 lados × 4 fases iniciales (ticks 0, 120, 240 y 360). Se empezó 75 unidades fuera del lateral de la plataforma y se dirigió al personaje hacia su centro, con saltos en los frames 0 y 20. Todos aterrizaron en el soporte correcto antes de 150 ticks.
3. **Salto sencillo a la plataforma fija:** 82 casos adicionales: los 41 luchadores desde ambos lados, con el mismo punto de partida y un solo impulso. Todos alcanzaron la plataforma fija. La tarima está 169 unidades sobre el suelo y utiliza el doble salto; el salto sencillo del motor alcanza aproximadamente 151.2 unidades.
4. **Soltar la tarima al saltar:** en las cuatro fases, el salto eliminó inmediatamente el soporte y el estado de suelo. Durante los diez ticks siguientes el personaje mantuvo su posición horizontal sin seguir arrastrado por la tarima.
5. **Descender atravesando:** ocho casos, ambas plataformas en cuatro fases, con una pulsación de abajo de un tick. Tras 80 ticks adicionales, todos quedaron sobre el suelo y = 554, `supportPlatform = −1` y dos vidas, sin reengancharse a la plataforma superior.
6. **Continuidad del piso:** 127 posiciones entre x = −90 y x = 1170, separadas diez unidades. Después de 120 ticks, cada una conservó soporte en y = 554 y dos vidas. También se comprobaron por separado x = −89 y x = 1169.
7. **KO horizontal simétrico:** las posiciones exactas x = −300 y x = 1380 no quitaron una vida. Avanzar una unidad hacia fuera, hasta x = −301 y x = 1381, produjo una sola pérdida de vida en ambos lados. Las dos distancias al centro x = 540 son iguales.

## Navegador y apariencia

En escritorio 1280 × 800 se inició Coro desde el selector, se verificaron la presentación y la cuenta regresiva y se enviaron entradas reales de teclado a ambos jugadores. Desde las posiciones iniciales (330, 554) y (750, 554), A y flecha derecha los llevaron a (−12.05, 554) y (1062.57, 554), ambos apoyados y con dos vidas. Una segunda pulsación los dejó en x = −71.49 y x = 1116.88, dentro de las zonas laterales ampliadas y sin perder soporte.

La captura muestra el fondo de dunas cubriendo el encuadre, las dos plataformas distinguibles, el suelo completo y sus dos bordes. Los jugadores en los laterales permanecen visibles. No se observó hueco de fondo, deformación de los luchadores ni desbordamiento horizontal: `document.documentElement.scrollWidth = innerWidth = 1280`.

Captura local real guardada con T3 Preview después del movimiento hacia los laterales:

`/home/ubuntu/.t3/userdata/browser-artifacts/browser-screenshot-localhost-mvcdb7cx-83d4ba78.png`

Una actualización del servidor de desarrollo recargó la primera partida. Posteriormente el navegador informó `Preview automation client server-browser disconnected during click.` y `No preview automation host is available for evaluate in environment ...`. Se recuperó con `preview_status` y `preview_open` sobre la misma pestaña; la partida y las entradas de teclado funcionaron después. Estos incidentes del entorno no se contabilizan como defectos de Coro.

## Recomendaciones y límites

Conservar el doble salto y la trayectoria compartida entre colisión y dibujo: permiten acceder a la tarima alta con todos los luchadores probados. No hay una corrección específica de Coro necesaria para aceptar la ampliación revisada.

La comprobación visual corresponde a escritorio 1280 × 800. Las 656 rutas y los dos ciclos se ejecutaron en el motor, no como sesiones manuales de navegador. No se certifican aquí pantallas táctiles, audio, ranking, cuentas ni sincronización entre clientes.
