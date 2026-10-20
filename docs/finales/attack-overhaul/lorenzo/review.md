# Lorenzo Mendoza — revisión aprobada

Implementación y QA del 19 de octubre de 2026. Aprobado por el coordinador tras revisión independiente. No se inició otro personaje ni se hicieron commits/push.

## Resultado integrado

El especial **Reparto P.A.N.** arroja tres bolsas amarillas de la marca real. Conserva coste25, startup15, recuperación53, velocidad8, abanico vertical±1.6, daño7 antes de multiplicadores, radio16 y ralentización30. El único ajuste físico es el origen del proyectil: offsetX36/offsetY107, medido en la mano compacta. En la primera emisión el motor avanza8px y ya puede conectar a55px. En el caso central pueden conectar dos bolsas: la invulnerabilidad entre impactos existente impide prometer tres daños por haber tres objetos. Guardia, fallo e interrupción siguen sus reglas.

La definitiva **Caravana Polar** conserva la captura normal: tres victorias, coste75, preparación9, duración180, posiciones/reloj congelados, liberación ordinaria de fuerza12; no usa expulsión letal ni cambios de cámara. Hay un único daño en tick96 al llegar el frente opaco del camión al contorno opaco del rival. Los dos camiones acompañantes no causan daños independientes. Se busca una fila compartida de alfa entre vehículo vacío y cuerpo canónico; el jinete queda excluido del contorno de colisión. Para rivales elevados se prioriza una fila8px sobre los pies, evitando colocar la bota trasera encima de la cabeza del jinete. Con rival en plataforma el contacto puede ocurrir en el frente alto/techo junto a sus piernas, no siempre en la parrilla.

Los tres vehículos quedan sobre WORLD.floor. Lorenzo realiza desplazamiento visual desde su altura física al estribo durante12–36, está integrado en el vehículo36–145, desmonta146–170 y retorna a su posición original. La carga acelera54–96, retrocede122–146. El rival se desplaza horizontalmente de forma acotada para acomodar el convoy y vuelve antes de la liberación; su altura física se conserva. Es una puesta en escena arcade explícita, sin mover física ni cámara.

El principal mide500 unidades locales; los acompañantes450, con perspectiva casi frontal para que se distingan **tres cabinas, tres cajas y sus ruedas** sin reducirlos a juguetes. Todos permanecen dentro del canvas. POLAR se pintó por separado en izquierda/derecha y se cancela el espejo global al dibujar cada variante. La bolsa P.A.N. frontal cancela cualquier espejo del proyectil, incluidos los reflejos. La figura de Lorenzo sí cambia de orientación. El rótulo DEFINITIVA se coloca sobre el techo y el rival para no tapar caras.

## Arte, fuentes y conservación

Se empleó image_gen.imagegen integrado, seis llamadas. [research.md](research.md) conserva fuentes oficiales leídas, fotos realmente vistas e incertidumbres. [provenance.json](provenance.json) enumera hashes de raws, prompts y referencias. La foto de camión del usuario y el atlas canónico se vieron antes de generar. Los productos oficiales P.A.N. proporcionaron el diseño real de la bolsa.

- raw-v1: windup, recover y bolsa; su lanzamiento extendido se conserva sin usar.
- raw-v2: camión principal derecho y camiones vacíos; vehículo izquierdo ocupado original conservado sin usar.
- raw-v3: revisión de mirada izquierda. Sólo se usa su celda superior derecha **completa**, mediante copia RGBA exacta, autorizada por principal tras comprobar bordes alfa≤1. No se recortaron miembros ni se injertó la cabeza. Auditoría [v3-cell-audit.json](v3-cell-audit.json) y prueba de igualdad de bytes.
- raw-v4: lanzamiento compacto completo, corrige el fallo a distancia cercana sin cambiar motor.
- raw-v5: ensayo de acompañantes aún demasiado laterales; conservado, no integrado.
- raw-v6: acompañantes casi frontales. Bordes originales sin píxeles alfa≥40; el padding conserva la suavidad residual.

El script scripts/prepare-lorenzo-overhaul.ts aplica el normalizador existente sin debilitar validadores, copia figuras completas, y empaqueta10poses en2560×1024, celdas512 y WebP lossless exactRGBA. [assets.json](assets.json) conserva geometría y hashes. [atlas-on-gray.png](atlas-on-gray.png) fue inspeccionado sobre gris: transparencia real, sin fondos opacos ni cortes de anatomía. Las alturas comunes de fuente mantienen la escala de cara; no se normaliza cada postura agachada a una altura arbitraria. El montaje usa anclas específicas derecha48/izquierda137, estribo83 sobre piso.

Sonido sintetizado original: motor en aceleración54–96, golpe96 y descenso122, calculado una sola vez en el búfer de la secuencia. Sin canción comercial, vídeo ni voz clonada.

## Verificación

- npx tsx --test tests/lorenzo-overhaul.test.ts tests/roster-v39.test.ts tests/finale-main-integration.test.ts tests/attack-art-validation.test.ts tests/audio.test.ts: **71/71**. Log [tests.txt](tests.txt). Cobertura de coste, desbloqueo, guardia, fallo, interrupción, daño único, stocks/última vida, freeze, control tras salida, serialización de captura/proyectiles, preflight de cada pose y hashesRGBA.
- npm run build: pasó TypeScript y Vite; sólo advertencia habitual de chunkJS>500kB.
- git diff --check: pasó.
- Tras el último ajuste visual de plataformas: **8/8 pruebas enfocadas de Lorenzo**, nueva matriz completa64/924 y nuevo build; log [final-focused.txt](final-focused.txt) y [build.txt](build.txt).
- Motor compartido sin cambios para Lorenzo; la suite global queda a cargo del principal al terminar22.

Browser nativo T3, tab **tab_46_c3cfa641-d7e6-4a79-9606-68ffb03b615c**. Script [lorenzo-overhaul-browser-qa.js](../../../../scripts/lorenzo-overhaul-browser-qa.js) inicia todos los casos con inputs reales; no asigna una finale manual. **64casos/924renders/1638dibujos de vehículos**, sin fallos. [browser-evidence.json](browser-evidence.json) y [render-summary.json](render-summary.json). Prueba ambos puestos, centro/cerca, borde exterior/interior/cerca del borde, alturas distintas, plataformas en ambas orientaciones, rival alto/bajo, guardia frontal/trasera, fallo, interrupción, muerte y última vida.

Cada render verifica estado/cámara inmutables; cada captura conserva reloj y posiciones; todos los vehículos de la matriz quedan dentro del canvas. Extremos observados x6.04..1273.96 en1280px. Todo dibujo de marca tiene transformación horizontal positiva; no se deduce legibilidad sólo de facing. Durante36–145 hay exactamente tres vehículos y sólo un Lorenzo.

Se guardaron **29capturas nativas** con preview_snapshot(save:true) y se inspeccionaron entrada,35→36,145→146, regreso, liberación, impactoP1/P2, bordes, plataformas, alto/bajo, especialP1/P2, movimiento reducido y atlas ausente. [screenshots.json](screenshots.json) conserva paths nativos y geometría; [contact-sheet-0.png](contact-sheet-0.png), [contact-sheet-1.png](contact-sheet-1.png), [contact-sheet-2.png](contact-sheet-2.png) y [contact-sheet-3.png](contact-sheet-3.png) facilitan revisión. El fallback mantiene las identidades canónicas y elimina las estrellas antiguas; la ausencia del atlas deja el proyectil como bolsa neutra sin marca.

## Límites y decisiones

La foto del usuario fija la decoración del camión; no se afirma que ese modelo sea la flota actual. El informe oficial visto contextualiza distribución y muestra una rueda de prensa, no se atribuye a esa foto el vehículo. La pose al estribo y el convoy son ficción solicitada. Los acompañantes casi frontales se desplazan junto a una vista lateral del principal: perspectiva arcade para legibilidad en una arena2D.

En capturas muy cercanas o contra un borde el desplazamiento visual para alojar tres camiones es considerable, pero acotado por el viewport; no altera el alcance, la física ni el resultado. En plataformas se mantienen las alturas y los camiones siguen en piso; el frente alto puede tocar piernas. El movimiento reducido conserva los desplazamientos necesarios para que la carga y el montaje se entiendan.

Se actualizaron fuente de guía y descripciones. No se regeneraron HTML portable, medios ni las52demos, y no se tocó el tab del principal.

Revisión del coordinador: 39 comprobaciones enfocadas iniciales, ocho posteriores al contacto final, tipado estricto de guía y diff-check pasan. Se reprodujeron64casos/924muestras y208contactos (52rivales×2puestos×suelo/plataformas; sólofotograma de contacto). Se inspeccionaron marcas, montaje/salida, cuatro plataformas, bordes, Momoy/reducido y fallback. La guía usa únicamente un recorte documental más amplio(0,72,1080,568), con los tres camiones y el rival completos. Final: un contacto105/tick96,min60.3424HP,liberación189,pérdida de vida226; especial: contactos32/47,min86.2912HP. Evidencia: root-guide-evidence.json.
