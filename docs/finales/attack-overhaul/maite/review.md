# Maite Delgado — ¡Buenas noches, Poliedro!

Implementación, investigación, pruebas, revisión visual y aprobación independiente del principal completadas. Personaje 10 de 22. El HTML portátil se reconstruirá al terminar los 22 personajes.

Maite toma aire, levanta el micrófono y grita **«¡BUENAS NOOOCHES, POLIEDRO DE CARACAS!»**. Una onda sonora creciente sale de la boca y cruza la arena; solo daña al tocar al rival. El título sobre el personaje sigue siendo **Definitiva**. La frase se muestra completa en un cuadro separado y el rival conserva su cuerpo canónico. Maite baja el micrófono y vuelve a su postura normal. No se cambia el escenario ni la cámara del combate.

## Arte y fuentes

`research.md` documenta la gala de Miss Venezuela 2022, el saludo, el traje naranja de Ángel Sánchez y el retrato editorial. Se inspeccionaron esas fotografías y el atlas canónico antes de generar. El saludo amplificado y su efecto de combate son ficción original.

`greeting-v5-raw.png` es la generación aceptada. Conserva la cara adulta, el cabello rubio, vestido, guantes, micrófono y capa de plumas. Las cuatro poses son completas; la falda cubre naturalmente parte de las piernas. Se conservan intactas las cinco generaciones y sus prompts. v1/v2/v4 tenían margen superior insuficiente; v3 pasó la normalización, pero la capa horizontal resultó demasiado ancha junto al borde. v5 mantiene una capa vertical compacta. Un intento de v4 devolvió un rechazo de moderación de salida sin archivo; el reintento de ilustración produjo el original conservado.

La normalización traslada figuras enteras: **381337 píxeles retenidos conservan RGBA exacto**, con reconstrucción inversa probada; solo se omiten 6532 píxeles alfa1 completamente desconectados. No se repinta anatomía ni se recorta una silueta para arreglarla. `assets.json` prueba el empaquetado WebP sin pérdidas y `provenance.json` vincula originales, referencias, prompts, arte canónico y capturas. `accepted-gray.png` permite comprobar el alfa sobre gris: el fondo coloreado de la herramienta está bajo alfa cero.

La onda utiliza tres arcos concéntricos dibujados por el juego; su tamaño crece con el radio real del proyectil. Siempre se dibuja aunque falle la carga del atlas. Las cuatro poses se validan juntas antes de pintar; si falta una pose o la imagen es inválida, se usa el cuerpo canónico. El sonido nuevo es un barrido resonante sintetizado localmente, una sola vez al emitir la onda. No incorpora ni imita la voz real, ni añade canciones, grabaciones o videos. No incorpora grabaciones de voz de Maite.

## Mecánica

`FinaleDefinition.mode` admite ahora `projectile`, además de `capture` y `transformation`. La configuración reutilizable contiene velocidad, vida, radio y crecimiento, desplazamiento de salida y fuerza. `Projectile.impact` conserva la categoría `super` para daño, bloqueo y reflexión; los proyectiles anteriores siguen usando `special` por defecto.

- Tres victorias y 75 de energía; el coste se cobra una vez, también al fallar o ser interrumpida.
- Preparación de 9 ticks. La onda sale con velocidad12, vida55, radio20 que crece0.7/tick hasta52; sale a38 unidades hacia delante y154 por encima de los pies. No persigue al rival ni atraviesa distancias instantáneamente.
- Una sola colisión aplica `(28 × daño_del_personaje +12) × armadura_del_rival`. Contra Zavarce: **39.0864** de daño; no hay daño remoto programado ni captura.
- La guardia frontal consume la onda sin daño; la guardia trasera permite impacto. Invulnerabilidad, contraataques y reflexión conservan las reglas compartidas. El doble salto puede evitarla; el movimiento modifica el instante de contacto. Como los otros proyectiles no gravitatorios, no choca contra plataformas.
- La pose dura84 ticks activos y conserva la recuperación. Los 7 cuadros de pausa por impacto hacen que termine en el cuadro91 del ensayo; bloqueo en86, fallo en84. El reloj y la física siguen activos salvo esa pausa normal de impacto. La onda emitida existe independientemente del estado posterior del ataque.
- El retroceso puede expulsar al rival de la plataforma. En los casos normales y hacia fuera del borde, el rival puede reaparecer con100HP y una vida menos; no es curación ni daño perdido. `browser-evidence.json` distingue impacto, recuperación y vidas.

El CPU difícil considera la distancia de la onda; la guía, el detalle del personaje y las pruebas compartidas reconocen el modo nuevo. Las transformaciones de Conde y Emilio y las capturas restantes conservan sus reglas.

## Contención y guía

Se usa un intervalo horizontal común a las cuatro poses para mantener toda la capa visible junto a los bordes y durante la sacudida del impacto. Es una corrección exclusivamente visual, con un desplazamiento máximo medido de **23.5752 unidades de mundo** en los188 cuadros muestreados. No cambia las posiciones físicas, el origen de la onda, el blanco ni la cámara; los tests y el arnés comprueban que dibujar no modifica esos estados. Las poses no cambian de escala para ocultar recortes.

El cuadro de texto se limita al viewport completo. La guía tenía además un recorte posterior demasiado estrecho, que ocultaba la primera línea aun cuando el render completo era correcto. Para definitivas de proyectil, su recorte de presentación ahora muestra más del mismo render, conservando la proporción y la cámara del juego. `screenshots/guide-wave.png` confirma frase completa y trayectoria en la guía real. La demostración arranca a430 unidades y usa184 cuadros de entradas reales, incluida la recuperación; el mínimo de vida es60.9136 y la expulsión posterior deja1 vida.

## Pruebas y evidencia

- **70/70 pruebas enfocadas**: Maite, procedencia, preflight, normalización, auditoría de personaje, definitivas, mundo y presentación. Incluyen daño y demora reales, ambas posiciones y orientaciones, distancia55/180/430/650, fallo900, guardia, invulnerabilidad, doble salto, movimiento, caída, interrupción, multiplicador capturado al disparar, reflexión real por Carolina, CPU y recuperación.
- **984/984 pruebas completas**,45.7 segundos, después de integrar la mecánica y corregir una aserción nueva que suponía erróneamente que un ID0 no era válido. Después se añadió una prueba de procedencia que pasa dentro de las70 enfocadas. Logs conservados.
- TypeScript y `git diff --check` pasan.
- **18 casos de navegador** mediante entradas reales, motor, render y recursos de producción. P1/P2: normal, cercano, ambos sentidos de borde, guardia, fallo, doble salto y especial. El daño a430 ocurre en cuadro36; a55 en9; en borde a120 en12. Guardia/fallo/doble salto producen0 impactos. El coste inicial queda en25 para la definitiva y75 para el especial.
- **26 capturas**:25 del arnés más la guía real. Se inspeccionaron atlas sobre gris, secuencia, dos orientaciones, bordes, movimiento reducido y fallback. `render-evidence.json` registra recortes, límites completos de texto y desplazamiento visual; todos los cuadros de texto permanecen dentro del canvas.

El especial **Luz de escenario** mantiene el gesto canónico y el foco que marca el punto de impacto. Las capturas de ambos lados confirman daño15.3408 en cuadro15, una sola aplicación y bloqueo frontal. Sus activos son coherentes con su función, por lo que no se sustituyeron.

Aprobación del agente principal: inspección independiente del arte final v5 sobre gris, captura normal P1 y de borde P2, y guía recién cargada en el cuadro23. Frase completa, pose y capa contenidas, onda y contraste aprobados. La guía registra un impacto real en el cuadro36, mínimo60.9136HP y expulsión posterior con1vida, sin captura. Pasaron20 pruebas independientes, compilación y TypeScript estricto de la guía. El encuadre posterior de la guía ya muestra ambas líneas. Óscar puede comenzar.
