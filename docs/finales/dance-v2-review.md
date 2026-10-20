# Corrección del baile de los 46 rivales

El ciclo anterior animaba al rival de Nacho usando sus frames canónicos de combate. La corrección solicitada incorpora una pose de baile dibujada específicamente para cada una de las 46 identidades, con manos abiertas y paso corporal visible. Estos bitmaps reemplazan ese uso de la guardia. Las ocho poses propias del performer Nacho permanecen intactas.

Los [prompts y referencias del baile](dance-v2-prompts.json) usan los mismos grupos de ocho y el mismo orden de `FINALE_ASSET_GROUPS`. La sexta hoja contiene seis identidades y dos variantes adicionales. Los seis PNG originales se conservan; cada hoja completa pasa por el normalizador estricto de ocho figuras del creador. El [pipeline](actor-pipeline.md) explica los límites transparentes, el baseline 482, el WebP RGBA exacto y el ancla de torso que evita desplazar una figura por sus manos.

## Estado del empaquetado

| Grupo | Figuras                                                                | Estado                                                                                                   |
| ----- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1     | Zavarce, Vallenilla, Javier, Capriles, Renny, Gómez, Simón y Conde     | Ocho figuras completas inspeccionadas y empaquetadas; RGBA/alpha exactos.                                |
| 2     | Lovera, Maite, Óscar, Puma, Chataing, Harris, Machado y Alí            | Ocho figuras completas inspeccionadas y empaquetadas; RGBA/alpha exactos.                                |
| 3     | Gualberto, Reynaldo, Dudamel, Danny, Nacho, Sarcos, Yordano y Lila     | Ocho figuras completas inspeccionadas y empaquetadas; RGBA/alpha exactos.                                |
| 4     | Rummy, Chiqui, Norkys, Gabriela, Amanda, Lele, Giuseppe y Silbón       | Ocho figuras completas inspeccionadas y empaquetadas; zapatos canónicos corregidos y RGBA/alpha exactos. |
| 5     | Llorona, Sayona, Lionza, Florentino, Diablo, Knoche, Momoy y Tío Tigre | Ocho figuras completas inspeccionadas y empaquetadas; RGBA/alpha exactos.                                |
| 6     | Tío Conejo, Enrique, Jesús, Carlos, Víctor y Juan, más dos variantes   | Ocho figuras completas inspeccionadas y empaquetadas; RGBA/alpha exactos.                                |

Los mapas publicados están en `dancers` de [finale-actor-assets.json](../../shared/finale-actor-assets.json); los hashes, límites y anclas se registran en [actor-packing.json](actor-packing.json). Cada grupo puede publicarse por selección explícita sin esperar fuentes pendientes, y un error de cualquier figura solicitada impide publicar esa selección. Los nueve pares PNG/WebP anteriores conservan sus hashes aprobados.

Las seis hojas ya están empaquetadas: **46 identidades bailando y dos variantes**. La auditoría completa contiene 15 atlas y 116 figuras, incluidos los nueve atlas anteriores. Root comprobó identidad, vestuario y figuras enteras contra las referencias; el empaquetado confirmó ocho siluetas separadas por hoja, baseline 482, márgenes transparentes y píxeles RGBA/alpha iguales entre PNG y WebP.

En el grupo 4 se repintaron los zapatos de Gabriela como tacones negros. La revisión posterior de V3, al abrir la hoja de combate vigente `gabriela-v15.png`, confirmó que esa decisión fue incorrecta: su calzado canónico son botines plateados cerrados de tacón bajo. El atlas V2 conserva el error y no sirve como referencia de calzado para V3. Se preservan la [primera generación](../../assets/source/finales/finales-dance-v2-4-first-generated.png) y el [prompt de aquella edición](dance-v2-correction-prompt.txt) como historial. La corrección actual y sus fuentes se registran en el [dossier V3](perro-mujeriego-v3/README.md).

La revisión del grupo 5 incluye a las leyendas y al animal antropomorfo. Conservan ropa y accesorios que llevan puestos; instrumentos, bastones y otros objetos sostenidos se retiran deliberadamente para liberar las manos durante el baile. Ese cambio de utilería no cambia la identidad del personaje.

## Movimiento en ejecución

El agente de renderer comprobó y revisó el [vídeo real de Nacho contra Zavarce](videos/nacho-paired-dance-v2.webm). Ambos cuerpos y ambos pares de pies cambian en las **179 transiciones de los 180 ticks** de la escena. Con movimiento reducido, esas cuatro regiones cambian en cero transiciones. El [informe de mediciones](dance-motion-v2-qa.json) registra los resultados. Nacho alterna sus ocho poses pintadas cada 11–12 ticks, y el rig mueve brazos, caderas y pantorrillas sobre las rodillas de ambos bailarines.

Root recorrió además Nacho contra **cada uno de los 46 rivales** en los ticks 12, 60 y 120, alternando el lado del atacante: **138 renderizados sin excepciones**, con entrada `dancers[id]` existente y WebP cargado para todos. El [informe del roster](dance-v2-roster-qa.json) conserva las 46 filas. Ese recorrido incluye personajes con vestidos, leyendas y animales.

La evidencia se distingue con precisión: los seis atlas recibieron inspección visual de identidad, ropa y anatomía; el recorrido de 138 renderizados comprueba cobertura y carga; la secuencia Nacho/Zavarce tiene además vídeo y medición continua del movimiento de ambos cuerpos y pies. No se presenta el recorrido automático como una inspección visual individual de todas las secuencias completas.

Pasaron los 25 tests focalizados de actores, props, escritorio, presentación y recuperación de assets, además de la compilación final. El lote de actores/props pasó también sus ocho pruebas de salidas reales; un segundo pase de los seis atlas de baile reutilizó las seis salidas validadas sin convertirlas otra vez.
