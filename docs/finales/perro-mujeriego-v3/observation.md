# Perro Mujeriego: observación y plan de poses

Fuente exacta del usuario: [Short de Nacho Td2Zs5kiH0Y](https://www.youtube.com/shorts/Td2Zs5kiH0Y). Se observó el mismo vídeo en su [página de reproducción](https://www.youtube.com/watch?v=Td2Zs5kiH0Y), en la pestaña T3 propia `tab_2c_c3cfa641-d7e6-4a79-9606-68ffb03b615c`. El elemento de vídeo informa 50,521 segundos. Cada captura se obtuvo pausando, buscando el segundo indicado y comprobando `currentTime`, `paused: true` y `readyState: 4`; no se extrajo ni descargó la grabación.

## Fragmento continuo aprobado

El comienzo contiene preparación de cámara e introducción. En 29–31 segundos concluye la explicación y anuncia la pasada con música. El fragmento **34,1–40,1 segundos** conserva seis segundos consecutivos de esa pasada: ocultar la cara con rebote de rodillas, patitas a ambos lados y corazón con las manos. Tres segundos no contienen esa frase completa. No se juntan movimientos separados del tutorial para fingir que ocurrieron seguidos.

| Frame | Segundo original | Tick a 60 Hz | Gesto observado                                                                                            |
| ----- | ---------------- | ------------ | ---------------------------------------------------------------------------------------------------------- |
| 0     | 34,1             | 0            | Dos palmas verticales cubren la cara; rodillas abiertas y flexionadas, pies más próximos que las rodillas. |
| 1     | 35,1             | 60           | Mantiene las manos delante de la cara y cambia el apoyo del rebote; levanta ligeramente un talón.          |
| 2     | 35,8             | 102          | Patitas hacia derecha de pantalla; torso inclinado a ese lado y pierna contraria abierta.                  |
| 3     | 36,5             | 144          | Patitas hacia izquierda de pantalla; cambia el apoyo y mantiene las rodillas blandas.                      |
| 4     | 37,2             | 186          | Patitas vuelven al centro/derecha, cabeza inclinada y otro apoyo de cadera.                                |
| 5     | 37,8             | 222          | Un brazo barre diagonalmente por delante de la parte alta de la cara; el otro queda en cintura.            |
| 6     | 38,6             | 270          | Sube ambos brazos abiertos sobre la cabeza, preparando el gesto siguiente; acerca los pies.                |
| 7     | 39,4             | 318          | Forma un corazón con pulgares e índices encima de la frente; pies juntos y pequeño rebote.                 |

Las capturas completas y sus tiempos están en [capture-index.json](capture-index.json); el [contacto de ocho poses](../../../assets/source/finales/perro-mujeriego-v3/references/choreography-34-40-contact.png) conserva únicamente el área visible del vídeo para usarla como referencia de movimiento. Izquierda/derecha significa posición en pantalla. Ambos participantes deben seguir esa orientación; invertir horizontalmente solo al rival cambiaría las manos y los pasos observados.

## Producción aprobada

Se prepararon y aprobaron **ocho poses pintadas por cada una de las 46 identidades**, incluido Nacho: 368 figuras. La misma secuencia de Nacho también sirve cuando él es rival. Cada PNG tiene cuatro columnas y dos filas, en el orden de la tabla. Cuatro poses más una deformación genérica perderían el ocultamiento real de la cara, las patitas articuladas y el corazón de los dedos.

La referencia canónica conserva identidad, estilo, ropa, zapatos, pelo, joyas y proporciones. La captura del vídeo aporta exclusivamente la postura y el apoyo del cuerpo: el gorro, la ropa y la habitación del tutorial no se trasladan al personaje del juego. Se dibujó de frente, con un giro pequeño solo cuando ayude a conservar el rostro. Las manos cubren intencionalmente la cara en las dos primeras poses; esa oclusión no autoriza rediseñar la cara en las restantes. El corazón es el espacio entre los dedos, sin iconos añadidos. Ninguna pose debe conservar la guardia de combate.

Originales nuevos: `assets/source/finales/perro-mujeriego-v3/{id}-generated.png`. Referencias canónicas y sus hashes: [canonical-references.json](canonical-references.json). Tiempos para empaquetado e integración: [choreography.json](choreography.json). Esta tarea produce únicamente arte y su documentación; el empaquetado y el montaje corresponden a otros agentes.

El contrato aprobado inicia el clip en **34,1 segundos** y dura 360 ticks, hasta **40,1 segundos**. Los ticks de la tabla derivan exactamente de cada captura menos 34,1; no hay desfase de 0,1 segundos. El nombre abreviado del contacto `choreography-34-40-contact.png` se mantiene para conservar las referencias de generación.

Las capturas, el contacto del vídeo y las comparaciones que contienen imágenes del Short son material de investigación local del workspace y no se publican en el repositorio. Un clon público puede reproducir la observación con el URL y los segundos de la tabla; no necesita esas capturas para cargar los sprites originales del juego.
