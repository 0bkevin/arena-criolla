# Arena Criolla · estética 8-bit

La composición azul noche aprobada conserva su cabecera compacta, portada Renny contra Capriles, selección de luchadores, escenarios y preparación de pelea. El nuevo tema usa Pixelify Sans en nombres/titulares, esquinas escalonadas, sombras sólidas cortas y amarillo, azul y coral. Los inputs y párrafos mantienen una fuente legible.

Los nueve escenarios se generaron con imagegen integrado y se guardaron como variantes v26; cada fondo mide 360×214 y contiene exactamente 32 colores. Los retratos, poses de combate y entradas utilizan un tratamiento de render con paleta compartida de 64 colores y texturas de 144 píxeles de altura corporal. El arte original y la geometría de las poses se conservan. Las cinemáticas y el combate se dibujan en una superficie 540×320 y se amplían sin suavizado; los retratos usan una superficie 200×250.

El micrófono y giro de Óscar, la batuta de Dudamel y los gestos individuales siguen reproduciéndose una vez. No se alteraron los movimientos, las colisiones, las plataformas ni el protocolo multijugador. Los impactos usan ráfagas de bloques, anillos de píxeles y texto Pixelify. El sonido de selección usa ondas cuadradas y los tonos de efectos usan ondas triangulares; las reacciones genéricas existentes se conservan.

Implementación UI por `/root/pixel_arcade_v26`; arte, render e integración por `/root`. Las rutas de assets y el prompt completo están en `artifacts.json` y `prompts.json`. La validación, incluyendo los 41 personajes, está en `qa.json`.
