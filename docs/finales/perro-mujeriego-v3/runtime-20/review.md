# Veinte identidades en el renderer real

Se capturaron 320 imágenes del canvas de la galería con `renderMatch` y `drawFinale`: veinte rivales, ocho tiempos y los dos slots de jugador. Cada contacto contiene primero Nacho como jugador 1 y después como jugador 2. El montaje mantiene a los dos participantes de frente, en la misma orientación de manos y pasos.

Los tiempos revisados son 0, 60, 102, 144, 186, 222, 270 y 318: cara cubierta, segundo apoyo, patitas derecha/izquierda/centro, barrido, brazos arriba y corazón. La [traza de carga y recortes](capture-evidence.json) registra los archivos V3 reales, ocho frames por rival, sus anclas y los límites dentro de la textura normalizada. Todos los archivos estuvieron disponibles y ninguna figura salió del buffer. Nacho reutiliza sus texturas ya verificadas desde caché en su propio contacto; esto explica los cero recortes nuevos en esa última entrada.

Se inspeccionaron los veinte contactos completos. Vestido, boa y zapatos de [Maite](maite-both-slots.png) permanecen unidos y legibles en las ocho poses. Los sombreros de [Simón](simon-both-slots.png), [Conde](conde-both-slots.png) y [Gualberto](gualberto-both-slots.png) quedan completos, sin desplazar el ancla del torso hacia las manos. [Óscar](oscar-both-slots.png) y [Puma](puma-both-slots.png) conservan sus caras, trajes y zapatos. No se observaron recortes de manos/pies, solapamientos entre bailarines ni saltos del centro del cuerpo en los ocho tiempos de estos veinte rivales.

Los otros contactos corresponden a Zavarce, Vallenilla, Javier, Capriles, Renny, Gómez, Emilio, Chataing, María Corina, Alí, Reynaldo, Dudamel, Danny y Nacho. El nombre del archivo de cada contacto es `{id}-both-slots.png`. Esta revisión cubre esas veinte identidades y no presupone la aprobación de los atlas posteriores.

La captura utilizó una segunda instancia temporal de Vite con HMR desactivado, para que el empaquetado de los demás atlas no reiniciase el estado de la revisión. El código y los archivos gráficos fueron los del proyecto, sin sustitutos de los personajes.
