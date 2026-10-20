# Bolívar 20/22 — revisión de implementación

Estado: aprobado por el principal como personaje 20/22. Fuente y atlas congelados.

El especial **Sable libertador** desenvaina una sola espada, ejecuta corte horizontal, corte descendente y estocada, y vuelve a la vaina. Cuesta 25 de energía una vez; tres pulsos en ticks de ataque 14/26/38, daño base 6 por pulso, alcance fijo 110 y tolerancia vertical 40. Los primeros golpes empujan 0.6, el tercero 6. No hay dash, invulnerabilidad artificial ni crecimiento de alcance. Guardia frontal, distancia, desnivel e interrupción siguen las reglas compartidas. Los ticks de reloj pueden incluir hitstop: en la prueba local los impactos aparecieron en frames 14/29/44.

La definitiva conserva 3 victorias, 75 de energía, captura en 9, duración 180 y expulsión normal 12. Bolívar monta un caballo castaño y seis adultos llaneros distintos cargan detrás en dos filas de tres. Daño único en 96; retroceso 122–146; desmontaje y regreso 146–170; retirada visual antes de 180. No utiliza la expulsión especial del Puma. El montaje/desmontaje desplaza la figura canónica completa hasta la montura mediante un arco acotado; la figura montada la sustituye sin duplicación. Los apoyos mantienen una pose propia de galope cada uno, y el comandante alterna dos fases.

**Contacto:** se examina la envolvente opaca del caballo a todas las alturas compartidas con la silueta canónica rival. La máscara excluye cabeza, manos y espada del jinete: zona inferior y frente del hocico/cuello. Se elige el primer contacto del conjunto de filas, no una fila favorable que deje otra pezuña atravesando el cuerpo. La otra fase de galope recibe una compensación horizontal acotada si su contorno se adelanta. La trayectoria usa los límites de la cámara real; medidos en 1280×760, el avance neto de la formación es 33–68 píxeles según el tamaño rival, con ambos sentidos, bordes y plataformas incluidos.

La caballería queda en el suelo. En capturas elevadas ambos cuerpos completos bajan visualmente al carril y vuelven a sus superficies capturadas; la fila posterior tiene 24 píxeles locales de profundidad de pista. La simulación, las plataformas, el reloj y la cámara no se mutan en render. La guía sólo ensancha el recorte documental de Bolívar. Sin atlas válido completo se ven ambos personajes canónicos y se omiten los viejos arcos tricolor. El rótulo de la definitiva está por encima del jinete, fuera de las caras.

## Arte y procedencia

Ver `research.md`, `provenance.json`, `assembly.json`, `pack.json`. Herramienta: `image_gen.imagegen` integrada con transparencia real. Prompts exactos `assets/source/finales/attack-overhaul/bolivar/prompt-v1.txt` a `prompt-v5.txt`; originales raw-v1…v5 intactos. v1 cuatro figuras con sable; v2 comandante en tres fases y caballo sin jinete; v4 cuatro llaneros; v5 dos llaneros. v3 rechazado porque seis figuras se conectaban entre sí. Atlas final: `public/assets/bolivar-llaneros-attack-v1.webp`, 14 poses, 3584×1024, WebP lossless con alfa; PNG de preparación y hashes preservados. Canon sin cambios.

Todas las figuras se trasladaron completas, sin pintura anatómica, borrado de miembros o edición de caras. Se comprobó alfa sobre gris. Excepción local v4 aprobada por el principal: una isla de 16 píxeles alfa2 a 2px del contorno superior izquierdo, 44px del siguiente. Se conserva con la misma traslación RGBA que su propietario. `v4-soft-audit.json` demuestra roundtrip exacto; `root-soft-island-review.json` recoge revisión independiente. El normalizador compartido continúa estricto.

Escala común en píxeles de fuente para todas las poses de Bolívar, ajustada por altura core sin estirar. v5 se compensa por su resolución para concordar cabezas/caballos con v4; no se usa el extremo de la lanza como referencia anatómica.

## Verificación

- `tests/bolivar-overhaul.test.ts`: 6 pruebas que cubren pulsos/coste, rango/defensas/interrupción, congelación/captura/serialización/release/control, bloqueos por victorias/energía y muerte al salir, preflight de 14 poses y hashes/RGBA.
- 60/60 pruebas enfocadas de Bolívar y regresiones de roster/render; 19/19 con engine compartido. Tres expectativas antiguas ajustadas al reemplazo real del dash por sable; no se eliminaron aserciones de conexión, guardia, movimiento normal, recuperación ni stun.
- `scripts/bolivar-overhaul-browser-qa.js`: 64 escenarios con inputs reales, 1020 renders comprobados, P1/P2, centro, muy cerca, ambos bordes, plataformas altas/bajas, rival alto/bajo, guardia/fallo/interrupción, stock final. Ver `browser-evidence.json` y `native-screenshots.json`.
- `scripts/bolivar-contact-audit.js`: 144 replay de capas opacas reales (18 escenarios × 8 instantes), incluyendo ambas fases de galope y tick95 previo al impacto. Ninguna penetración previa; contacto96 a 0–1px. Rival íntegro con márgenes de al menos28px. Ver `contact-alpha-audit.json`.
- 33 capturas nativas de entrada, montaje, galope, impacto, vuelta, desmontaje, cierre, release, P2/bordes/plataformas/alto/bajo, tres golpes de sable, movimiento reducido y atlas ausente. Inspección visual registrada en las seis hojas de contacto. `travel-audit.json` registra 16 trayectorias con avance positivo de 33.36–67.97px; las capturas platform-low invierten el sentido de aproximación.
- TypeScript y `git diff --check` pasan. La primera suite completa detectó sólo una colocación legacy a120px para el especial que ahora alcanza110; se corrigió esa fixture a80 manteniendo el requisito de conexión. Suite completa final: **1127/1127 PASS**, 86.2s, en `full-tests-final.log`.
- Revisión independiente del principal aprobada: 28 pruebas enfocadas de packing/normalizador/rótulos, tipos estrictos de guía, 64 escenarios/1020 renders, 208 lanzamientos reales contra los 52 rivales en P1/P2 y suelo/plataformas, y reproducción de los 144 controles de capas sin penetración previa. Inspeccionó las tres poses de sable, borde P2, montaje y regreso a plataforma, movimiento reducido, fallback y guía amplia. Evidencia `root-*` preservada.

Tab nativo propio: `tab_49_c3cfa641-d7e6-4a79-9606-68ffb03b615c`. No se tocó tab_3d, no se regeneró portable/media, ni se inició otro personaje. Sin commits ni push.
