# Gustavo Dudamel · revisión de ataques 21/22

Aprobado independientemente por el principal como personaje21/22. No se regeneraron guía portable, multimedia ni las 52 demos.

## Resultado integrado

**Cadenza expansiva** reemplaza el antiguo reflector: coste 25, preparación 18 ticks, recuperación 48, daño base 12×0.97 antes de armadura, fuerza 6. La batuta prepara y dirige una onda de notas que viaja 7.5 unidades/tick, dura 72 ticks y crece de radio 24 a 64 a razón 0.65/tick. Sólo daña cuando el proyectil alcanza la caja de contacto física. Guardia frontal bloquea, salto/altura permite esquivar, y Carolina puede devolverlo conservando su tipo, radio y daño. Un impacto inmediato a muy corta distancia conserva un estallido musical visible aunque el motor consuma el proyectil en el mismo tick. Sin reflexión propia ni daño melee remoto de la antigua cadenza.

**Orquesta a toda fuerza** conserva captura normal: 3 victorias, 75 energía, startup 9, alcance 245, 180 ticks, tres daños 42/90/138 y liberación normal fuerza 12. Dudamel dirige delante de 18 adultos originales; hay cuerdas, maderas, metales y timbales. Cada gesto emite una onda visible 24 ticks antes del daño; su radio crece de 24 a 70 durante el vuelo. El contacto se calcula contra los píxeles alfa ≥ 100 del battleFrame real del rival, incluyendo tamaños y props; la reacción hurt ocurre después del cuadro de contacto. Cámara, posiciones físicas y reloj de captura no se modifican al renderizar. La orquesta se apoya en WORLD.floor incluso cuando el actor permanece sobre una plataforma. El encabezado propio queda por encima de la orquesta y de ambos cuerpos, limitado al viewport; el rótulo genérico sólo se omite si el módulo pinta correctamente. La guía fuente usa el recorte documental ancho (0, 72, 1080, 568) para conservar todo el grupo, sin alterar la cámara de juego.

La adaptación de captura garantiza esos tres golpes una vez aceptada: las ondas de la definitiva son coreografía sincronizada, no proyectiles físicos reflectables. La orquesta completa es un bitmap estático y Dudamel alterna cuatro gestos pintados; no se simulan individualmente las 18 interpretaciones. Sonidos originales sintetizados una vez por secuencia, sin canción, voz ni grabación comercial. Movimiento reducido conserva las llegadas esenciales del ataque.

En capturas cercanas, Dudamel retrocede sólo en presentación hasta cubrir el déficit de 310 píxeles locales entre actores. Si un borde impide retroceder, el rival completa la separación visual dentro del viewport; ambos vuelven a sus anclas físicas al salir. Escala anatómica constante basada en 528 píxeles de fuente; las alturas 593/507/564 compensan batuta elevada y flexión de rodillas sin agrandar cabezas. anchorX se fija al cuerpo y los zapatos, no al extremo de la batuta.

## Fuentes y arte

Investigación previa e imágenes realmente vistas en [research.md](../../../../assets/source/finales/attack-overhaul/dudamel/research.md): galería oficial LA Phil y Sound/Stage; fotos de gesto con batuta y distribución de orquesta. Canon extraído de main: dudamel-v15, íntegro. Cara, vestuario, proporciones y estilo mandan sobre fotos.

Generación mediante image_gen.imagegen, transparencia verdadera. Raw conductor-v1 y orchestra-v1 archivados y rechazados por contacto/recorte exterior. Conductor-v2 y orchestra-v2 aprobados visualmente por principal como fuentes; esto no equivale a aprobación de la implementación. Prompts completos, fotos, raws y hashes se conservan en assets/source/finales/attack-overhaul/dudamel y provenance.json.

El normalizador estricto rechazó un islote alfa 2 separado en conductor-v2. Las cuatro figuras ya caben íntegras en sus celdas; prepareAttackArt procesó directamente esas celdas con validación de márgenes y conservó el islote alfa 2. La revisión independiente root-conductor-cell-review.json confirma que todos los límites de celdas y exterior tienen como máximo alfa 1; no se recortó anatomía ni se relajó el normalizador global. Sólo se descartaron motas desconectadas alfa 1, según su política existente. Las versiones sobre gris permiten revisar el alfa. Packing conserva proporción; PNG y WebP tienen RGBA idéntico. La orquesta ocupa un frame 1536×961 propio dentro de atlas 1536×1985, sin reducir 18 caras a 512 píxeles.

## Evidencia y validación

- tests/dudamel-overhaul.test.ts: 11 pruebas nuevas de captura/coste/tres daños/release, bloqueo/ausencia/interrupción, última vida, viaje/crecimiento, reflexión de Carolina, serialización, sonido, hashes, escala y preflight.
- tests/character-audits/dudamel.test.ts: 7 auditorías, incluyendo ambos puestos, movimiento/saltos, básicos, guardia frontal/trasera, coste especial, combos y combate CPU determinista completo.
- Se conservaron 3 regresiones genéricas de reflexión reasignándolas a tests/carolina-reflection-regression.test.ts, con ventana propia 4..23/radio 110. También se reasignaron cultura, empowerment, moto y salas online a Carolina. El fixture de moto usa gap 245, mayor que su melee 235 y alcanzable por su reflexión durante la ventana. Conserva todas las etapas, puestos y comprobaciones de identidad/retorno.
- Browser nativo T3: tab_4b_c3cfa641-d7e6-4a79-9606-68ffb03b615c. scripts/dudamel-overhaul-browser-qa.js usa inputs especiales/super reales, motor/render/cámara de producción. 40 casts, 464 muestras: ambos puestos, centro, muy cerca, bordes hacia dentro/fuera, distinta altura/plataformas, guardia, Momoy y Silbón. Las posiciones capturadas permanecen fijas y todas las secuencias liberan control.
- scripts/dudamel-contact-audit.js: 108 comprobaciones contra máscara opaca renderizada del rival, tres pares preimpacto/impacto en 9 escenarios y ambos puestos. Error máximo al llegar 0.40 px; separación mínima en el cuadro previo 2.58 px; ninguna mutación del estado ni cámara.
- 15 capturas nativas guardadas e inspeccionadas: entrada, emisión, impacto, tercer golpe, salida, ambos bordes, plataforma, alto/bajo, especial, movimiento reducido y falta de atlas. Índice native-screenshots.json; copias en screenshots/. browser-evidence.json contiene los resultados.
- Compilación TypeScript, build Vite y git diff --check pasan. Vite emite el aviso habitual de chunk superior a 500 kB.

Suite completa: 1140/1140 pruebas aprobadas (full-suite.log). Tras corregir el encabezado, 45 pruebas focales aprobadas (heading-tests.log) y build completo aprobado (build.log). El fallback de atlas ausente conserva ambas identidades canónicas y omite la orquesta/props antiguos; la simulación sigue funcionando. No representa visualmente la coreografía musical completa sin su recurso opcional.

Revisión principal:29pruebas iniciales y11posteriores al encabezado, tipos estrictos de guía,40casts/464renders,108contactos y208casts adicionales contra52rivales×ambospuestos×suelo/plataformas (624frames de daño). Guía nueva inspeccionada:51/99/147,release189,min60.0568,stock226; especial30,min88.1272. Ver root-guide-evidence.json y root-*.json.
