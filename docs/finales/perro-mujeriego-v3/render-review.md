# Revisión del montaje de la coreografía

El renderer sigue el tramo continuo de 34,1–40,1 segundos del vídeo aportado por el usuario. Ambos participantes usan la misma orientación frontal y los ocho tiempos de `shared/perro-mujeriego-choreography.json`: 0, 60, 102, 144, 186, 222, 270 y 318, dentro de una definitiva de 360 ticks.

La primera comprobación usa **Nacho contra Nacho**, porque es el primer atlas V3 empaquetado. Esta captura no acredita todavía los otros 45 atlas. El manifiesto selecciona automáticamente las ocho figuras propias de cada rival cuando su archivo está disponible.

Se revisaron cara cubierta, patitas a la derecha e izquierda, barrido, brazos arriba y corazón. Las manos, los brazos y la cara conservan los píxeles originales; solo los apoyos inferiores reciben una flexión suave. La escala se calcula una vez para las ocho poses y para los dos participantes, por lo que las manos elevadas no causan cambios de tamaño ni pisan el rótulo del paso. Una transición breve termina en cada tiempo marcado, sin repetir la secuencia completa.

La [grabación del piloto](../videos/nacho-paired-perro-mujeriego-v3-pilot.webm) muestra el ciclo completo de ambos participantes, del tick 0 al 359. Es evidencia visual sin audio; la reproducción del fragmento musical oficial se comprueba por separado en el componente del juego.

La [segunda grabación, Nacho contra Capriles](../videos/nacho-capriles-perro-mujeriego-v3.webm), confirma dos identidades distintas con sus propios ocho dibujos V3. Se capturó directamente del canvas durante 6,3 segundos y llegó al tick 359, con 207 frames renderizados y 196 ticks distintos. Esta prueba no acredita los atlas que todavía no se hayan empaquetado.

El encuadre usa una sola escala uniforme y centra la escena completa de 1080×640. El fondo cubre todo el viewport. Se verificó el caso 844×390 en el navegador: [captura del encuadre móvil](../screenshots/nacho-capriles-v3-mobile-contain.png). Las figuras mantienen su proporción y las manos alzadas permanecen dentro de la escena. La prueba de transformación cubre además 1080×640, 1280×720 y 390×844.

La galería conserva la pausa al solicitar `renderAt(340)` y usa la duración del perfil, no un límite fijo de tres segundos. La pérdida de vida se dibuja en los tiempos del perfil: 84, 180 y 276 para Nacho. Las pruebas focalizadas de presentación y audio pasan (14/14), junto con la comprobación de tipos.

La [revisión final de los 46 personajes](runtime-46/review.md) completa las comprobaciones del piloto: 368 poses V3 y 736 capturas reales, con los ocho tiempos y ambos slots por identidad. La traza y el índice de contactos están enlazados desde ese informe. El [player oficial junto al Game real](runtime-player/review.md) también quedó verificado en tres tamaños, con dock independiente y controles táctiles restaurados al terminar.
