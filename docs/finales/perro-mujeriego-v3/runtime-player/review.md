# Player oficial junto a la escena real

Se montó el componente real `Game` con Nacho y Capriles en una definitiva, usando el renderer, los estilos del juego y el componente real `NachoFinaleClip`. La vista quedó en el corazón para revisar las manos elevadas. Se utilizó un snapshot remoto fijo para que la escena no terminara durante la medición; el vídeo oficial se reprodujo a través de su iframe habitual.

Las capturas que incluyen fotogramas del player son evidencia local del workspace, excluida de publicación junto con las referencias del Short. Este informe y las [mediciones de geometría](geometry.json) permiten repetir la comprobación.

Antes del ajuste, el player de 202×258 px cubría al rival en horizontal y era más alto que toda la arena en el ancho de 390 px. En modo táctil, los botones de combate también se superponían a los controles de YouTube. Se guardaron las capturas [horizontal antes](landscape-touch-before.png) y [vertical antes](portrait-before.png).

El dock se activa únicamente durante la definitiva de Nacho. En horizontal reserva una columna de 202 px; en el ancho estrecho vertical coloca el player debajo del canvas. El iframe conserva 200×200 px y sus controles oficiales completos. Los controles de combate se retiran durante la escena y vuelven después.

| Vista | Canvas CSS | Player CSS | Solapamiento |
| --- | --- | --- | --- |
| 844×390, táctil | 610×322 | 202×258 | 0 px² |
| 390×844, responsive sin táctil | 342×202,66 | 202×258 | 0 px² |
| 1280×800, escritorio | 1018×680 | 202×258 | 0 px² |

Las capturas posteriores son [horizontal táctil](landscape-touch-after.png), [vertical responsive](portrait-after.png) y [escritorio](desktop-after.png). Ambos bailarines permanecen completos, incluidas manos y pies. El caso vertical sin táctil comprueba el apilado responsive; el modo táctil vertical del juego mantiene su aviso existente para girar el teléfono.

También se comprobó un caption con botón adicional de 44 px: el player alcanzó 310 px de altura y cabía en la arena horizontal de 314 px sin salir del viewport. Al retirar la definitiva se recuperaron los diez botones táctiles y el buffer normal de la arena, sin dock ni iframe; se guardó la [captura de controles restaurados](touch-controls-restored.png). La definitiva de Capriles recuperó igualmente el ancho normal y no reservó espacio para vídeo.

Las pruebas de presentación, audio y recuperación de assets pasan (18/18), junto con TypeScript.
