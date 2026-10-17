# Revisión independiente: Los Roques

Fecha: 2026-10-17. Alcance: geometría ampliada, balsa, accesibilidad de plataformas, límites y presentación de Los Roques. No se modificaron archivos de implementación.

Resultado: sin bloqueo de navegación ni fallo de soporte en la ampliación. El personaje más lento alcanza las tres plataformas desde el piso y cruza entre las laterales y la balsa usando el doble salto. La separación requiere más atención que antes con un salto simple.

## Versiones y evidencia

- Sitio público inspeccionado: `https://arena.kevinbravo.com/`, seleccionando Los Roques e iniciando una partida contra CPU. El canvas público de combate mide 1080 × 640, correspondiente a la versión anterior. Se distingue de la versión local para no atribuirle cambios todavía sin publicar.
- Versión local: `http://localhost:5184/`, pestaña propia del browser compartido `tab_s_07e54779-9ab2-4979-8a15-674c4eff160a`. Selección de Los Roques, introducción y partida real contra CPU; canvas de 1440 × 800 confirmado por DOM.
- Vista determinista adicional con el `renderMatch` y los assets reales del proyecto: tick 75, luchadores sobre el muelle izquierdo y la balsa en su extremo bajo. Captura de escritorio 1280 × 800: `/home/ubuntu/.t3/userdata/browser-artifacts/browser-screenshot-localhost-mvcdag1k-dac126c7.png`. Se usó una capa temporal en la pestaña para inmovilizar la escena, sin cambiar archivos ni publicar nada.
- `npx tsx --test tests/stages.test.ts`: 12 pruebas aprobadas, ninguna fallida. Incluyen suelo ampliado, recuperación de CPU, ciclo de plataformas, transporte, saltos, bajadas, aterrizajes y física determinista.
- Simulación específica con `createMatch`, `emptyInput`, `stepMatch` y `platformsAtTick`, sin cambiar constantes. Se usó Gómez, velocidad 3.5, la menor del catálogo; el rival permaneció apartado y quieto. El guion y su salida estuvieron en `/tmp/roques-audit.ts` y `/tmp/roques-audit-result.json`.

## Geometría comprobada

Mundo: x = −180…1260, y = −140…660, tamaño 1440 × 800. Piso: x = −90…1170, y = 554, ancho 1260.

- Muelle izquierdo: x = 114…308, y = 410, ancho 194.
- Muelle derecho: x = 772…966, y = 410, ancho 194.
- Balsa: x = 459…621, ancho 162; y base = 445, oscilación vertical ±18, período 300 ticks.
- La balsa se mantiene entre y = 427 y y = 463; hay 151 unidades horizontales de separación respecto a cada lateral. Todas las plataformas permanecen dentro del nuevo piso.

El renderer consulta las mismas posiciones `platformsAtTick` que el motor. El borde brillante marca la superficie sólida y los flotadores se dibujan bajo la balsa.

## Recorridos y física

1. **Balsa completa con ocupante:** 600 pasos, dos ciclos. Se mantuvieron `grounded = true`, `supportPlatform = 2` y las dos vidas. Rango observado y = 427…463; diferencia máxima entre los pies y la balsa: cero.
2. **Saltar, bajar y aterrizar:** las tres acciones se comprobaron en ticks iniciales 0, 75, 150 y 225. Saltar libera el soporte; después de 11 pasos el luchador queda sobre la balsa, sin arrastre. Una pulsación de bajar de un paso permite llegar al piso y = 554, soporte −1, sin reenganche. Caer desde ocho unidades sobre la balsa recupera soporte 2. Ninguna acción perdió vidas.
3. **Piso a plataformas:** un salto vertical desde el centro de cada destino basta. Los laterales reciben al luchador tras 30 pasos; la balsa, iniciada en tick 0, tras 39. Las tres recuperan el soporte correcto.
4. **Cruces laterales ↔ balsa:** cuatro recorridos, cada uno probado en cuatro fases de la oscilación. Con doble salto, segundo impulso en el paso 22 y dirección hacia el centro del destino, los 16 casos aterrizaron correctamente. Se inició desde ocho unidades dentro del borde de salida y sin velocidad inicial. Aterrizajes entre 71 y 78 pasos; dos vidas preservadas.
5. **Salto simple desde reposo:** con ese mismo inicio y Gómez, solamente 2 de los 16 cruces aterrizaron sobre el destino; los restantes aterrizaron en el piso. No son caídas mortales ni bloqueos: desde el piso las tres plataformas siguen siendo accesibles y el doble salto funciona. No se afirma que un salto con velocidad previa o dash tenga el mismo alcance.
6. **Extremos del piso:** x = −88 y x = 1168 mantuvieron piso, y = 554 y dos vidas durante 120 pasos cada uno.
7. **KO y reaparición:** se comprobaron por separado x = −301, x = 1381 y y = 801. Cada caso quitó exactamente una vida y reapareció en x = 330, y = 260. No se observó soporte invisible ni posición no finita.

## Presentación y límites

La vista local muestra el mar, los muelles laterales, la balsa, sus flotadores y el piso ampliado completos, con fondo cubriendo todo el canvas. Los dos muelles y la balsa se distinguen de los veleros decorativos; el piso ofrece espacio adicional a ambos lados. No se observó recorte horizontal ni hueco del fondo en el escritorio revisado.

Recomendación de diseño: mantener la oscilación ±18. Si se busca que todos los personajes crucen con un solo salto desde reposo, habría que acercar las plataformas; la versión revisada exige doble salto a Gómez en buena parte de esos cruces. La geometría actual conserva un recorrido válido y simétrico sin imponer ese requisito de facilidad.

La revisión visual se limita a escritorio 1280 × 800. No certifica todos los móviles, la percepción de audio, el multijugador ni el ranking.
