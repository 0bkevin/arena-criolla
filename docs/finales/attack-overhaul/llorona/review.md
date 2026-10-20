# La Llorona — especial y definitiva

Aprobada independientemente por el principal como personaje22/22. Las dos fuentes raster y la integración fueron revisadas.

## Resultado

- Especial **Marea en pena**: nueva preparación de manos, lanzamiento bajo alineado con la trayectoria física existente, ola turquesa pintada y recuperación completa. La pose baja conserva el tamaño anatómico de la cabeza. El contacto inmediato también muestra la ola aunque el motor consuma el proyectil ese mismo tick.
- Definitiva **Abrazo del inframundo**: llamada triste, atracción ilustrada, portal, rostro aterrador, agarre alto/bajo con ambas manos, descenso conjunto tras el borde, regreso completo y cierre. El oponente conserva su atlas canónico y altura propia.
- Sonido sintetizado original: lamento tonal descendente y golpes acuáticos sincronizados con las fases. Sin grabación, música comercial ni clonación de voz.

## Secuencia y reglas reales

| Tick de captura | Presentación |
|---|---|
| 0–35 | Lamento y aproximación; portal comienza a aparecer en25 |
| 36–59 | Rostro aterrador; primer daño en42 |
| 60–99 | Agarre con manos altas o bajas; segundo daño en90 |
| 100–137 | Ambos cuerpos enteros descienden, progresivamente ocluidos por el portal |
| 138–147 | Ambos dentro del portal; tercer daño en138 |
| 148–167 | Ambos emergen enteros; La Llorona recupera el rostro inicial |
| 168–179 | Se separan a sus pies capturados y se cierra el portal en178 |
| 180 | Liberación física normal y continuación del combate |

Conservados: tres victorias, coste75, startup9, duración180, daño y tres pulsos originales42/90/138, fuerza normal12, bloqueo/counter/evitación antes de captura. No hay ejecución forzada ni delay extra de muerte. Durante captura siguen congelados reloj, posiciones físicas y física. Los cuerpos jamás se ocultan por un estado persistente: el recorte de superficie existe sólo dentro de la llamada del renderer, con save/restore. La ausencia de cualquier pose impide pintar el conjunto y deja visibles los dos cuerpos canónicos, sin la cuna antigua.

El acercamiento y la nivelación de pies son ilustrados: la simulación no se modifica al dibujar. El rival se aproxima al ancla de las manos; el conjunto entra lo necesario en los bordes para contener el portal completo y vuelve a sus anclas antes del release. No se modifica la cámara. El modo de movimiento reducido mantiene los movimientos que explican el ataque, sin añadir oscilaciones decorativas.

## Fuentes y arte

Investigación y límites culturales: [research.md](research.md). No se afirma que el portal sea parte literal de una tradición documentada. El atlas aprobado `llorona-v12` manda sobre las fotografías teatrales mexicanas.

- Raw intactos: `assets/source/finales/attack-overhaul/llorona/poses-raw-v1.png` y `effects-raw-v1.png`.
- Herramienta: `image_gen.imagegen`, transparencia real. Prompts exactos en `prompts/poses-v1.txt` y `prompts/effects-v1.txt`.
- Seis figuras completas y dos efectos. Las poses se normalizaron mediante componentes conectados, con verificación RGBA exacta. Los efectos tienen composición desigual: separación en el gutter vacío x1392, conservando todo el portal y todas las gotas.
- `scripts/prepare-llorona-art.ts` copia directamente filas RGBA al montar el grid. Se corrigió el redondeo de color que provocaba una composición alfa sobre vacío. Prueba específica compara todos los bytes de las ocho celdas antes del escalado.
- Atlas: `public/assets/llorona-underworld-attack-v1.webp`, 1024×2048, WebP lossless. El portal tiene472px de ancho y se presenta aproximadamente340px en las capturas nativas.
- Un factor de píxel fuente para las seis poses evita cabezas gigantes al agacharse. Sólo se escala uniformemente cada imagen completa.
- Auditorías y hashes: `assets.json`, `normalization.json`, `provenance.json`; las revisiones independientes `root-*.json` pertenecen al principal.

## Validación ejecutada

- `npx tsx --test tests/llorona-overhaul.test.ts tests/character-audits/llorona.test.ts`: **24/24**, en `focused-tests.log`. Cubre coste/desbloqueo, golpes, guardia, fallos, interrupción real, atracción de ola, stock restante y última vida, controles tras release, pausa de captura, serialización, fases/oclusión/regreso, plataformas, preflight, audio finito y conservación exacta de fuentes.
- `npx tsx --test tests/attack-art.test.ts tests/attack-art-validation.test.ts tests/finale-presentation.test.ts tests/finale-assets.test.ts tests/finale-identity-refresh.test.ts tests/finale-main-integration.test.ts`: **43/43**, en `integration-tests.log`.
- `npx tsc --noEmit`: aprobado.
- `git diff --check`: aprobado.
- Browser nativo, `scripts/llorona-overhaul-browser-qa.js`: **44 escenarios / 536 muestras**, acciones reales `special/super`, motor, renderer y cámara de producción. Ambos puestos y sentidos, centro/cerca, alturas distintas, bordes hacia fuera/dentro, plataformas, guardia, Silbón/Momoy. Las posiciones capturadas permanecen idénticas y los ataques se liberan.
- **21 capturas nativas** guardadas e inspeccionadas: inicio, apertura, rostro, agarre, descenso, desaparición, retorno, cierre, release, alturas extremas, ambos bordes, P2, dirección inversa, plataforma, especial/contacto inmediato, movimiento reducido y atlas ausente. Ver `native-screenshots.json` y `screenshots/`.
- Tab propio: `tab_4d_c3cfa641-d7e6-4a79-9606-68ffb03b615c`. Fixture disponible como `window.lloronaQA`; no se operó el tab del principal.

No se cambió `shared/engine.ts` ni la mecánica de `undertow`. La suite global y la regeneración del portable/media final quedan coordinadas por el principal después de su revisión22/22. Sólo se actualizó la descripción fuente del especial/final de La Llorona.

Revisión principal:35pruebas iniciales y15posteriores a la copia RGBA, tipos estrictos de guía,44escenarios/536muestras,312capturas adicionales contra52rivales en ambos puestos y tres disposiciones de suelo/plataformas,936renders filtrados con el clip real de producción. El inframundo oculta por completo ambos cuerpos; regreso/cierre/release y posiciones físicas correctos. Guía inspeccionada:51/99/147,min60.3424,release189,stock226;especial32,min88.2496. Véanse root-guide-evidence.json y root-roster-visibility-audit.json.
