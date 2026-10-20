# Finales dentro de la arena

La versión del 19 de octubre de 2026 dibuja los 46 ataques finales después del escenario y sus plataformas, usando la cámara normal del combate. Las posiciones de captura de los jugadores anclan los cuerpos, los muebles y los vehículos; el arte conserva una escala uniforme. Desaparecen los fondos de sustitución, las tarimas y los cambios de tamaño del canvas. El HUD y los indicadores de salud siguen visibles durante el daño.

Capriles despliega sus dos sillas, la mesa y la taza en el lugar del combate. Los actores se separan suavemente para dejar espacio al mobiliario y vuelven al punto de captura al terminar. Nacho y su rival bailan en el suelo existente con las ocho poses de la coreografía. La interfaz actual no contiene reproductor ni vídeo de YouTube; suena una composición original a volumen bajo. El usuario descartó incorporar la canción. Las condiciones de desbloqueo, el bloqueo previo, la duración y los tres pulsos de daño conservan las reglas del motor.

## Registro visual del montaje en arena

[Nacho y Capriles en combate](../videos/nacho-y-capriles-en-arena-2026-10-19.mp4), 18,47 segundos, 1280×800 y 30 fps. Une las dos tomas nativas del componente `Game` con el motor `stepMatch`. Cada toma muestra tres segundos de preparación, el ataque completo y un segundo de regreso; el súper entra por los listeners normales con eventos de teclado sintéticos, sin asignar el estado de la secuencia.

La captura nativa no tiene pista de audio y corresponde a la UI anterior a la retirada del player. La reproducción de YouTube al 10 % fue una comprobación histórica de esa integración, hoy retirada. La [metadata del montaje](../videos/nacho-y-capriles-en-arena-2026-10-19.json) enlaza las trazas individuales, sus tamaños y el hash del MP4. La [revisión de UI](../in-arena-ui-review.md) y su [traza geométrica](../in-arena-ui-qa.json) documentan históricamente la cámara, el canvas, el HUD, el antiguo iframe y los controles en escritorio y móvil, incluida la pausa al girar el dispositivo. El [estado de audio actual](../audio-only.md) registra la eliminación del iframe y la comprobación posterior sin solicitudes a YouTube.

## Cobertura visual

El primer pase abarca 138 renderizados reales: tres momentos por cada uno de los 46 atacantes y un rival rotativo, de modo que también aparecen los 46 personajes afectados. Se alterna el lado del atacante con posiciones de captura x435/x625 sobre Caracas. Se inspeccionaron los 46 contactos. La franja superior del escenario tiene el mismo hash en las 138 capturas, sin fondos cinematográficos que la sustituyan.

La [configuración](2026-10-19-initial/setup.json), la [evidencia de captura](2026-10-19-initial/capture-evidence.json), los [contactos individuales](2026-10-19-initial/contacts/) y las [seis láminas](2026-10-19-initial/boards/) conservan ese pase inicial. Las capturas PNG completas permanecen locales y están excluidas de Git; los contactos WebP sirven para la revisión del repositorio.

El pase encontró y corrigió cinco composiciones: Carlos y Juan mantienen los pasajeros junto al combate con un movimiento acotado; las figuras de Carlos se apoyan en el coche; las tarjetas de Vallenilla quedan debajo de las caras; el gabinete de Knoche y el televisor de Renny bajan y reducen su tamaño. También se retiraron las explosiones normales que tapaban caras durante los pulsos y el límite de escala del baile heredado del encuadre anterior. Los rótulos de daño siguen el ancla del rival; no extrapolan la coordenada del montaje anterior de los vehículos.

La [tanda de confirmación](2026-10-19-final/setup.json) vuelve a capturar tres momentos de esos cinco personajes, Capriles y Nacho contra el Silbón, con 21 imágenes sin errores de carga. Se inspeccionaron los ajustes de caras, asientos y visibilidad. Dos capturas adicionales en el tick 144 comprueban el rótulo de daño de Carlos y Juan después de corregir su ancla. Las grabaciones reales de Capriles y Nacho confirman también la continuidad del escenario antes, durante y después de los ataques.

## Comprobaciones automáticas

- La suite completa aprobó 778 tests antes de la tanda final de colocación.
- Histórico del montaje visual: después de esos ajustes pasaron 25 tests focalizados de presentación, mundo, pantalla y el player entonces vigente, junto con TypeScript y la compilación. La retirada posterior del player aprobó sus 11 tests focalizados y `npm run build`; véase el [estado de audio](../audio-only.md).
- La regresión del mundo recorre 1.656 secuencias completas: 46 personajes, nueve escenarios, ambos jugadores y ambas direcciones, además de plataformas móviles, capturas aéreas y alturas diferentes.
- Otras 828 comprobaciones de render verifican las imágenes y las superficies del escenario bajo la cámara normal. La regresión de los dos vehículos inspecciona la posición de ambos pasajeros durante todos los ticks de la secuencia.
- El detector de diseño no encontró incidencias mecánicas en los archivos de presentación modificados; `git diff --check` pasa.

La cobertura exhaustiva de combinaciones es automática. La inspección de imágenes corresponde al escenario Caracas, complementada con la revisión real de UI y las dos grabaciones de combate.
