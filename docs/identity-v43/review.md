# Javier v43 — referencia escogida por el usuario

El usuario indicó que Javier seguía sin parecerse y aportó una fotografía concreta. Esta imagen sustituye la apariencia con barba de v40/v42: el objetivo ahora es su rostro afeitado, copete alto peinado hacia atrás, orejas visibles, sonrisa muy amplia con dientes, cejas elevadas en el centro y arrugas de expresión. Se conserva la camiseta azul marino de la foto. La fecha de esta fotografía no se presume reciente.

## Producción y parecido

Se creó primero una figura individual de alta resolución a partir de la foto del usuario. Las poses se generaron en pares para conservar el rostro, sin aportar como referencia el atlas con la cara rechazada. La herramienta incorporada de imágenes produjo el master y las poses. Los prompts finales están en `selected-prompts.json`, la procedencia en `generated-assets.json` y la pose alternativa de carrera en `gait-review.json`.

El revisor independiente comprobó cada rostro de combate y cada pose de entrada contra la foto. Encontró una mejora de identidad reconocible por la cara, sin depender del nombre o del vestuario. Los últimos atlas conservan la misma cara, sin barba ni regresión al rostro anterior. Es una interpretación ilustrada, no una reproducción exacta. La mandíbula sigue ligeramente más afinada y la sonrisa algo menos ancha que en la foto.

Las dos fases iniciales de carrera repetían la misma pierna y brazo adelantados. Se descartó esa combinación y se generó una pose individual con alternancia real. El cuerpo completo se escala de forma uniforme; no se recorta, reconstruye ni transforma la cabeza por separado. La revisión estática no detecta una desproporción importante entre ambas fases; el torso de la segunda se ve algo más estrecho por el giro lateral.

La guardia se corrigió para mirar hacia el rival. La pose herida está dibujada mirando a la izquierda, por lo que `frameFacing[7] = -1` la refleja correctamente. El renderizador real confirma que la cabeza se inclina alejándose del rival tanto para P1 como para P2. El resto de las poses de combate usa orientación de origen +1.

## Assets integrados

- `assets/source/identity-v43/user-reference.png`: foto escogida por el usuario.
- `assets/source/identity-v43/javier-classic-master.png`: figura guía.
- `assets/source/javier-v43.png` y `public/assets/javier-v43.webp`: ocho poses de combate.
- `assets/source/javier-v43-defiant-entrance.png` y `public/assets/javier-v43-defiant-entrance.webp`: entrada dedicada; el juego utiliza sus primeras seis poses. Las últimas dos celdas de almacenamiento contienen las carreras para mantener el formato de ocho siluetas y no se reproducen en la entrada.
- `scripts/pack-identity-v43.ts`: extracción por alfa, composición de figuras completas y validación previa de ambos atlas; WebP sin pérdidas.

Los márgenes de las imágenes originales son menores que los solicitados en los prompts. Todas las figuras están completas; el normalizador añade el espacio necesario en las celdas finales. La revisión del alfa y de los renderizadores confirma que no hay recortes. Los halos que algunos visores muestran corresponden a RGB oculto en píxeles de alfa cero, no a un fondo visible dentro del juego.

Solo cambian el sprite y la descripción del registro de Javier; sus estadísticas, ataques y habilidades se conservan. Nacho continúa con sus assets v42.

## Validación

- 51/51 pares PNG/WebP activos válidos, con ocho siluetas y alfa coherente.
- 747/747 pruebas automatizadas correctas. Se actualizaron las expectativas antiguas que suponían que las ocho imágenes de Javier tenían orientación de origen +1.
- TypeScript y compilación de producción correctos. La salida de compilación se guardó temporalmente en `/dev/shm/arena-faces-v43-dist` por falta de espacio en el disco; permanece el aviso previo sobre tamaño del bundle.
- Navegador con renderizadores reales: 16/16 muestras de combate, 22/22 de presentación, 10 cinemáticas y 10 celebraciones sin errores ni recortes.
- Pelea interactiva local Javier contra Nacho en Altamira, con rival activo: movimiento, saltos, bloqueo, ataques ligeros/fuertes y especial recibidos; cuatro golpes de Javier y estado finito. Los dos nuevos atlas de Javier se descargaron durante la sesión. Ver `runtime-qa.json`, `ui-match.json`, `fight.png` y `cinematic.png`.
- Se cerraron las pestañas y el servidor temporal de pruebas en el puerto 5193.
