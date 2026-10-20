# Finales dentro del combate: presentación y captura

Se comprobó `Game` real con el motor `stepMatch`, las imágenes del juego y Caracas. Los ataques se activaron mediante la tecla I del mapa normal de controles; no se asignó `state.finale`. La fixture temporal únicamente preparaba la pelea con tres victorias y energía completa.

| Vista | Canvas CSS antes/durante/después | Buffer | Resultado |
|---|---|---|---|
| Escritorio 1280×800 | 1224×680, x28/y64 | 1440×800 | HUD 1174×62,5 y ayuda permanecen; cámara constante durante cada final. |
| Móvil horizontal 844×390 | 844×390, x0/y0 | 1731×800 | HUD 716×52 constante; controles táctiles conservan su espacio y pasan de visibles a ocultos y vuelven al terminar. |
| Ventana con teclado 390×844 | 358×198,883, x16/y348,555 | 1440×800 | El reproductor queda debajo del canvas, sin alterar la composición. |

El iframe oficial mide 200×200. En móvil horizontal el panel mide 202×258 y queda en x634/y68; en escritorio se coloca en x1070/y478. Las tomas finales verifican reproducción real de YouTube con volumen 10. Al girar el móvil a vertical, la pantalla de orientación recibe el foco, el ataque y el reloj se detienen y el vídeo indica «Video en pausa»; no aparece desbordamiento horizontal.

Se revisaron fotogramas de las dos grabaciones nativas finales: [Capriles](videos/capriles-en-arena-2026-10-19.mp4), 7,695 s, y [Nacho](videos/nacho-en-arena-2026-10-19.mp4), 10,847 s. Incluyen tres segundos de combate previo, el ataque completo y un segundo de regreso. La arena y el HUD permanecen visibles; los efectos BOOM normales no cubren los cuerpos durante la secuencia. Los eventos de estas dos tomas son `KeyboardEvent` sintéticos enviados a los listeners reales de `Game`, documentados en sus JSON. La grabación nativa contiene vídeo a 2560×1600 y ninguna pista de audio; no se añadió música.

Evidencia: [traza geométrica](in-arena-ui-qa.json), [metadata de Capriles](videos/capriles-en-arena-2026-10-19.json), [metadata de Nacho](videos/nacho-en-arena-2026-10-19.json), [contacto de Capriles](videos/capriles-en-arena-2026-10-19-contact.webp). Las capturas que incluyen fotogramas del Short se conservan localmente bajo `perro-mujeriego-v3/runtime-player/`, según el ignore existente. Las tomas previas al ajuste de efectos quedan solo como diagnósticos en `/tmp/in-arena-diagnostic/` y en sus adjuntos nativos.

Validación de esta presentación: 15/15 tests focalizados (`finale-video-layout`, `match-screen`, `audio`, `asset-recovery`) y `tsc --noEmit` pasan. La revisión posterior del renderer pertenece al pase general de integración.
