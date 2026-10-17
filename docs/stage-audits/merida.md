# Revisión independiente: Teleférico de Mérida

Fecha: 2026-10-17. Alcance: geometría ampliada, física y presentación de Mérida. No se modificaron archivos de implementación.

Resultado: no encontré un bloqueo en el escenario ampliado. Los balcones siguen siendo accesibles, la cabina permite cruzar entre ambos y transporta al luchador durante su recorrido completo.

## Versión y evidencia

- Sitio público inspeccionado: `https://arena.kevinbravo.com/`. La partida pública creó un canvas de 1080 × 640, correspondiente a la versión anterior; no se usó como prueba de la ampliación.
- Versión local inspeccionada en el browser compartido, pestaña propia `tab_p_07e54779-9ab2-4979-8a15-674c4eff160a`: `http://localhost:5184/`. Partida real en Mérida, introducción, cuenta regresiva, CPU, pausa y continuación. Canvas de 1440 × 800 confirmado mediante DOM; viewport de 1280 × 800; sin desbordamiento horizontal ni overlay de error de Vite en la verificación final.
- `npx tsx --test tests/stages.test.ts`: 8 pruebas aprobadas, ninguna fallida. Incluyen transporte horizontal, desacoplamiento al saltar, aterrizaje, hitstop y física determinista.
- Simulaciones adicionales ejecutadas directamente con `createMatch`, `emptyInput`, `stepMatch` y `platformsAtTick`, usando Gómez (velocidad 3.5, la menor del catálogo) y un rival quieto apartado. No se alteraron los valores del motor.

El primer intento local coincidió con un reinicio del servidor y produjo `net::ERR_CONNECTION_REFUSED` y `504 (Outdated Request)`. Tras reiniciar el servidor sin watcher y recargar, la partida y las comprobaciones visuales funcionaron. Ese intento no se contabiliza como un fallo del escenario.

## Geometría verificada

El mundo ocupa x = −180…1260, y = −140…660. El piso está en y = 554, con superficie jugable x = −90…1170: 1260 unidades de ancho.

- Balcón izquierdo: x = 72…277, y = 420, ancho 205.
- Balcón derecho: x = 804…1009, y = 420, ancho 205.
- Techo de la cabina: y = 365, ancho 194, x base 443, movimiento horizontal ±160 y período de 600 ticks.
- Recorrido de la cabina: borde izquierdo x = 283…603; centro x = 380…700. En sus extremos queda a 6 unidades del balcón izquierdo y 7 del derecho; no los atraviesa. La diferencia de altura es 55 unidades.

La cabina y los balcones quedan dentro de los límites de suelo durante todo el ciclo. El dibujo y la colisión consultan `platformsAtTick`, por lo que no hay una segunda trayectoria visual independiente del motor.

## Pruebas de recorrido

1. **Transporte completo:** 1200 pasos, equivalentes a dos ciclos completos de la cabina. El luchador mantuvo `grounded = true`, `supportPlatform = 2`, y = 365 y sus dos vidas. El error máximo respecto al centro de la cabina fue 5.12 × 10⁻¹³ unidades, correspondiente al redondeo de coma flotante.
2. **Saltar desde la cabina:** probado empezando en ticks 0, 150, 300 y 450. El salto libera el soporte; después de 11 pasos y = 258.52, `supportPlatform = null`, y no continúa el arrastre horizontal.
3. **Bajar desde la cabina:** pulsación de bajar de un paso en esas mismas cuatro fases. En todas aterrizó en el suelo, y = 554 y `supportPlatform = −1`, tras 26 pasos adicionales; sin reengancharse a la cabina ni perder vidas.
4. **Suelo a balcones:** ambos balcones accesibles con un solo salto vertical desde su centro. Aterrizaje en 33 pasos, altura máxima del salto y = 402.8, soporte correcto 0 o 1.
5. **Balcón izquierdo a cabina y regreso:** empezando cerca de la aproximación izquierda, tick 450, con salto único y dirección hacia el centro del destino. Aterrizaje en la cabina en 44 pasos; regreso al balcón en 53 pasos.
6. **Balcón derecho a cabina y regreso:** mismo recorrido reflejado empezando en tick 150. Aterrizajes en 44 y 53 pasos, respectivamente. Ambos sentidos preservaron dos vidas. Estas pruebas verifican cruces cuando la cabina está próxima; no implican que cualquier salto iniciado en cualquier fase deba alcanzar una cabina que se aleja.
7. **Límites ampliados:** posiciones x = −88 y x = 1168 mantienen soporte en el suelo. Una caída deliberada desde fuera del borde derecho termina en pérdida de una vida y reaparición, sin posición no finita ni soporte invisible.

## Presentación y recomendaciones

En las capturas locales se ven completos el fondo de montañas, la terminal, ambos balcones, la cabina y el nuevo piso ancho. Las superficies nevadas tienen un borde claro frente al fondo; el cuerpo de la cabina cuelga por debajo del techo que funciona como plataforma. Las cabinas pequeñas del fondo quedan en la zona alta y se distinguen de la cabina jugable. No observé huecos de fondo ni recorte de las plataformas en el viewport de escritorio revisado.

Conservar el recorrido ±160: mantiene la cercanía de la cabina a ambos balcones con el espacio ampliado y permite el cruce incluso con el personaje más lento. La temporización sigue formando parte del recorrido. No hay corrección adicional de Mérida que bloquee esta ampliación.

Límites de esta revisión: la inspección visual se hizo en escritorio 1280 × 800; no certifica todos los tamaños de móvil. La auditoría de audio, el multijugador y el ranking pertenecen a sus revisiones correspondientes y no se dan por aprobados aquí.
