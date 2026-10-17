# Auditoría individual: Canaima — Salto Ángel

Revisión: 2026-10-17. Alcance: exclusivamente `canaima`, producción en https://arena.kevinbravo.com/ y geometría ampliada local. Esta auditoría no modifica archivos de implementación.

## Sitio publicado

- Se eligió «Salto Ángel» y se inició una partida contra CPU en una pestaña propia del navegador T3. Se observaron presentación, combate, resultado y revancha. `/assets/canaima.webp` respondió HTTP 200 y no hubo errores de consola durante esa sesión de producción.
- Se inspeccionó una captura real del escenario durante la cuenta regresiva: tepuy, cascada, vegetación y cielo se dibujan correctamente; tres plataformas con borde verde y el piso quedan distinguibles del fondo. La niebla es tenue y permanece detrás de los luchadores.
- El canvas publicado mide 1080 × 640. Esta inspección corresponde a la versión anterior, no acredita un despliegue de la ampliación.

## Geometría ampliada y acceso

- Mundo local: 1440 × 800, origen `(-180,-140)`, piso `y=554`, suelo `x=-90…1170`: 1260 unidades útiles frente a las 940 anteriores, aproximadamente 34 % más.
- Rocas laterales: `x=83…283` y `x=797…997`, ambas a `y=405`, anchura 200. Están 149 unidades sobre el piso y son alcanzables con un salto.
- Plataforma central: `x=448…632`, anchura 184. Se mueve verticalmente entre `y=336` y `y=424`, con período de 360 ticks. El máximo desnivel desde el piso es 218 unidades; el doble salto conserva el acceso durante todo el recorrido.
- Los huecos laterales/centro son de 165 unidades. Las rutas en ambos sentidos funcionan con todos los luchadores incorporados; la ampliación no exige cambiar altura de salto ni velocidad.
- El dibujo y la simulación llaman a `platformsAtTick`, calculado por tick de partida y redondeado a milésimas. El movimiento no depende del reloj del navegador. La repetición de cada posición a `tick+360` se comprobó durante un ciclo completo.

## Verificación ejecutada

- `npx tsx --test tests/stages.test.ts`: 8 pruebas aprobadas, 0 fallidas. Incluye 720 ticks con un luchador sobre la plataforma móvil de Canaima: conserva soporte, altura exacta y velocidad vertical cero durante dos ciclos; también comprueba descenso atravesando plataforma, aterrizaje desde arriba y física determinista.
- Simulación directa contra el motor local: 984 aterrizajes desde el piso, correspondientes a 41 luchadores × 8 fases de movimiento × 3 plataformas. Los 656 accesos laterales usaron un salto; los 328 centrales, doble salto. Todos aterrizaron en la plataforma prevista y conservaron dos vidas.
- Otra simulación directa: 1312 traslados lateral→centro y centro→lateral, con los mismos 41 luchadores y 8 fases; todos aterrizaron en el destino sin perder vidas.
- Descenso desde la plataforma central en 8 fases: una pulsación breve de bajar termina en el piso, sin volver a adherirse a la plataforma ni perder vidas.
- Recuperación desde ambos bordes nuevos: partiendo 12 unidades fuera del suelo y 12 por debajo del piso, moverse hacia dentro y usar doble salto permite volver a una superficie sin perder vidas.
- Estas simulaciones fueron comprobaciones temporales mediante `tsx`; no añadieron pruebas permanentes ni alteraron estado de producción.

## Límite de la revisión visual local

Se intentó abrir el servidor compartido de desarrollo en puerto 5184. La primera navegación obtuvo HTML, pero `@vite/client` devolvió `net::ERR_CONNECTION_REFUSED` y `main.tsx` respondió `504 (Outdated Request)`. El segundo intento devolvió `Navigation to http://localhost:5184/?stage-audit=canaima failed: ERR_CONNECTION_REFUSED`. Por tanto, queda pendiente inspeccionar visualmente la ampliación local y sus nuevos extremos cuando el servidor esté disponible. La física ampliada descrita arriba sí fue ejecutada y aprobada.

No se identificaron bloqueos de física específicos de Canaima. Conviene conservar el borde claro de las plataformas y comprobar el recorte del tepuy/cascada al desplegar el nuevo encuadre; el renderer usa cobertura proporcional del fondo, sin estirar luchadores.
