# Poliedro de Caracas — revisión individual

Fecha: 2026-10-17. Escenario: `poliedro`, sin plataformas elevadas. Revisión de los cambios locales en `http://localhost:5184/`, pestaña propia de T3 Preview. Esta revisión no certifica el despliegue de esos cambios en producción.

Contraste en el sitio solicitado: `https://arena.kevinbravo.com/`, selección de Poliedro, inicio de partida contra CPU y salto de presentaciones. El combate público carga correctamente y el asset responde HTTP 200; su canvas sigue en `1080×640`, correspondiente a la versión anterior. Captura: `/home/ubuntu/.t3/userdata/browser-artifacts/browser-screenshot-arena-kevinbravo-com-mvcdcugv-856ad6d1.png`.

## Resultado

El suelo ampliado funciona en ambos extremos; salto, recuperación y reaparición después del KO mantienen coordenadas correctas. La partida real contra CPU terminó mostrando ganador y revancha. El escenario conserva legibilidad en escritorio y en horizontal móvil simulado. Se detectó una condición de CPU que usaba los bordes antiguos; fue corregida por el agente principal y comprobada de nuevo.

## Evidencia de física

Mundo revisado: origen `(-180,-140)`, tamaño `1440×800`, suelo de `x=-90` a `1170`, altura `554`, apariciones `330/750`. Las comprobaciones siguientes ejecutaron `createMatch`/`stepMatch` del módulo servido por Vite en el navegador.

| Comprobación | Resultado observado |
| --- | --- |
| Permanecer en el suelo nuevo, `x=-60/1140` | Tras 120 ticks: `y=554`, grounded, dos vidas en ambos casos. |
| Saltar desde ambos extremos nuevos | Pico `y=402.8`; retorna a `554`, grounded y dos vidas. |
| Recuperarse desde fuera de cada borde, `x=-125/1205`, `y=519` | Salto hacia adentro: aterriza en 52 ticks, `x≈105.05/974.95`, dos vidas. |
| KO por izquierda/derecha del mundo, `x=-301/1381` | Pierde exactamente una vida, reaparece en `(330,260)` con invulnerabilidad `110`; 120 ticks después aterriza en `(330,554)`. |
| CPU en suelo nuevo, rival a la misma altura y a 86 unidades | Antes del arreglo salta en `x=-60/1140` por los umbrales antiguos `100/980`; después del arreglo no salta (`jump=0`). |

La CPU llegó al resultado en una partida real con jugador quieto. Antes de corregir los umbrales, simulaciones de CPU contra CPU en las tres dificultades también finalizaron con coordenadas finitas; esas simulaciones no sustituyen una prueba de balance.

`npx tsx --test tests/stages.test.ts tests/viewport.test.ts`: 15 pruebas aprobadas, cero fallos, incluyendo la regresión del reconocimiento del suelo nuevo por la CPU.

## Arte y tamaños de pantalla

- `poliedro.webp` carga con HTTP 200. Los focos y puntos del público se dibujan detrás de los luchadores; su transparencia mantiene visibles siluetas y golpes. El borde violeta del suelo identifica claramente la superficie donde se pelea. No hay plataformas invisibles ni plataformas elevadas previstas en este mapa.
- Escritorio `1280×800`: canvas interno `1440×800`, fondo sin huecos y suelo completo. Captura: `/home/ubuntu/.t3/userdata/browser-artifacts/browser-screenshot-localhost-mvcd9s0e-47ef0bef.png`.
- Horizontal `844×390`, con detección de puntero táctil simulada: canvas `1731×800` ocupa `844×390`, sin desplazamiento horizontal; HUD, suelo y controles visibles. Captura: `/home/ubuntu/.t3/userdata/browser-artifacts/browser-screenshot-localhost-mvcdc0io-702b57b9.png`.
- Vertical `390×844`: aparece «Gira tu teléfono», el reloj se mantiene en `81` y no hay desplazamiento horizontal. Captura: `/home/ubuntu/.t3/userdata/browser-artifacts/browser-screenshot-localhost-mvcdc3w5-c13f8efc.png`.

## Límites y recomendaciones

No quedan defectos bloqueantes propios de Poliedro en las comprobaciones realizadas. La entrada a pantalla completa produjo desconexiones transitorias de T3 Preview (`Preview automation client server-browser disconnected during click.`); al salir de pantalla completa se recuperó la inspección y se completó la comprobación horizontal/vertical. El ensayo táctil es una simulación de navegador, no una validación en hardware móvil.

El ring pequeño representado en el fondo es decorativo y no corresponde a una plataforma física. Si en futuras pruebas jugadores intentan subirse, conviene atenuarlo o separarlo visualmente del plano de combate. El público es visualmente denso, aunque en las capturas el contraste sigue siendo suficiente; no requiere cambiar la geometría ni agregar plataformas.
