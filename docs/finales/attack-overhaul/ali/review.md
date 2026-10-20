# Alí Primera — cuatro, onda y coro

Personaje 16/22. Implementación, QA y revisión independiente del principal aprobados. No se modificó el ledger ni se regeneraron la guía portable o sus medios. Solo se trabajó Alí; el atlas canónico general permanece intacto.

## Resultado visible

- Cuatro venezolano pequeño de **cuatro cuerdas y cuatro clavijas**, integrado en cuatro cuerpos completos: preparación, alzada, rasgueo y acento final. Mano izquierda en mástil y derecha sobre boca/golpeador; no se superpone un instrumento a la guitarra anterior.
- La onda sale del instrumento, alcanza al rival en el primer impacto y lo eleva. Seis adultos originales distintos aparecen detrás, cantando en dos filas, y la envolvente crece hasta el tercer impacto. Las caras quedan visibles, sin nuevo escenario.
- El rival usa su atlas canónico directamente, con escala uniforme, durante elevación, daño y regreso. Corona y torso se calculan con el **frame visible real**, no solo con displayHeight. Momoy y Silbón conservan identidad y proporciones.
- Alí conserva sus pies en su altura física. El coro se ancla a `WORLD.floor` incluso cuando el actor está sobre una plataforma; la fila delantera tiene 8 unidades locales de profundidad y la trasera 115. El coro no inventa una plataforma nueva.
- La separación horizontal de presentación se introduce y retira en 12 ticks; encaja la formación completa en el viewport transformado. Reserva 510 unidades locales detrás de Alí para el coro y 430 delante; procura 340 entre los actores. No cambia posiciones físicas, cámara ni escala de cuerpos. Los indicadores de daño siguen al rival presentado y a su corona elevada, incluidos P2 y close-edge.
- Movimiento reducido conserva las acciones semánticas y los impactos; fija la fase decorativa de hebras/aros y suprime los pequeños pulsos de boca.

Vista final de guía: [guide-final-147.png](screenshots/guide-final-147.png). Captura P2/borde corregida: [final-p2-close-edge-138-v2.png](screenshots/final-p2-close-edge-138-v2.png). Plataformas: [actor abajo](screenshots/final-p1-platform-138-v2.png), [actor arriba/P2](screenshots/final-p2-platform-inverse-138-v2.png).

## Referencias y decisiones

[research.md](research.md) contiene URLs, observaciones reales y límites. Se inspeccionaron antes de generar el atlas `ali-v15.png`, dos fotografías históricas publicadas de Alí cantando con **guitarra** y una fotografía del cuatro de la colección propia del Museo El Granero. TuCuatro aportó la estructura de cuatro cuerdas, golpeador y ejecución de pie. El Ministerio de Cultura contextualiza el canto colectivo; su imagen se identificó como cartel, no foto de Alí.

El cuatro es una decisión ficticia explícitamente solicitada para el juego. No se afirma que el instrumento de las fotografías sea un cuatro. Manda el canon para cara, pelo rizado largo, barba canosa, camisa clara de rayas, jeans y botas. El coro es original y adulto; no reproduce personas específicas, consignas ni niños.

## Assets y procedencia

Herramienta: `image_gen.imagegen`, raster transparente real. Fuente de trabajo: `assets/source/finales/attack-overhaul/ali/`.

| Archivo | Estado |
| --- | --- |
| `actor-raw-v1.png` | Aceptado, cuatro poses completas |
| `choir-raw-v1.png` | Conservado, rechazado por silueta conectada a alfa 1 del borde exterior |
| `choir-raw-v2.png` | Aceptado, seis adultos con margen regenerado |
| `actor-prompt-v1.txt` | Prompt exacto; referencias de canon, fotografía e instrumento |
| `choir-prompt-v1.txt`, `choir-prompt-v2.txt` | Prompt inicial y corrección exclusiva de margen |
| `actor-grid.png`, `choir-grid.png` | Siluetas enteras normalizadas por traslación exacta RGBA |
| `accepted-grid.png` | Ensamble de diez figuras completas sin resampling intermedio |
| `ali-cuatro-choir-attack-v1-packed.png` | Atlas PNG de 2560×1024 |
| `public/assets/ali-cuatro-choir-attack-v1.webp` | Runtime WebP lossless, roundtrip RGBA exacto |

Reproducción: `npx tsx scripts/normalize-attack-grid.ts assets/source/finales/attack-overhaul/ali/actor-grid-config.json`, análogo `choir-grid-config.json`, y `npx tsx scripts/assemble-ali-art.ts`.

[provenance.json](provenance.json) guarda hashes de todos los raws, prompts, referencias y canon. [actor-grid-audit.json](actor-grid-audit.json), [choir-grid-audit.json](choir-grid-audit.json), [assembly.json](assembly.json) y [assets.json](assets.json) prueban preservación. El packing conserva cuerpo entero, alfa y escala uniforme; las alturas fuente 601/599/597/589 corrigen el encaje de cada pose para evitar agrandar la cabeza al inclinarse. No se pintó anatomía con código, no se cortaron miembros ni se taparon defectos.

Se inspeccionó el resultado sobre gris: [actor](actor-on-gray.jpg), [cuatro ampliado](cuatro-detail.jpg), [coro aceptado](choir-v2-on-gray.jpg). [alpha-audit.json](alpha-audit.json) distingue RGB invisible bajo alfa 0 y ruido aislado alfa 1; ningún píxel opaco toca el borde de los raws. El normalizador descarta exclusivamente componentes desconectados de alfa 1 y mantiene exactos todos los píxeles retenidos. La primera lámina del coro se regeneró al fallar esa separación; no se arregló recortando.

## Comportamiento del motor

No cambió la mecánica ni se editó `shared/engine.ts`.

- **Especial:** 25 de energía. Startup 12, emisiones en ticks activos 12/24/36, tres ondas `strum` de suelo (`groundOnly`), velocidad 8.5 y daño base 7.28. El gesto de bajada coincide con cada emisión; los seis ticks anteriores preparan el brazo. Las pausas de impacto del motor pueden retrasar el número de llamada de simulación sin desincronizar `attackTick`. Guardia frontal bloquea; salto esquiva. La auditoría previa comprueba ambos puestos, guardia posterior, alcance y costes insuficientes.
- **Definitiva:** 3 victorias, 75 de energía, captura al tick 9, duración 180 ticks. Tres daños iguales en 42/90/138. Primer ascenso tras 42, segundo aumento tras 90, máxima envolvente en 138; desciende entre 148 y 174 antes de devolver el control. El reloj y las posiciones físicas se congelan durante captura. Una definitiva cuenta como un hit del contador aunque tenga tres divisiones de daño.
- **Daño medido:** contra Zavarce pasa 100→86.0192→72.0384→58.0576. Depende de defensas del rival; Silbón/Momoy no tienen el mismo total. Se mantienen los gates, guardia, fallo fuera de alcance, interrupción de startup y reglas de última vida.
- **Release:** conserva fuerza ordinaria 12, invulnerabilidad 12 y reglas comunes de stocks. No se usa la expulsión 34 / retardo 90 de Puma. La fuerza normal sí puede sacar al rival de la arena según su posición: el ejemplo de guía pierde una vida después del release por el borde, no por daño extra programado.
- **Fallback:** preflight de las diez poses antes de pintar la definitiva y de las cuatro poses antes del especial. Atlas ausente/incompleto vuelve al cuerpo canónico visible y ondas básicas; la definitiva evita expresamente la rama antigua que añadía una guitarra gigante duplicada. El canon general lleva su guitarra original: reaparece en locomoción y tras release, y también en fallback degradado. Este trabajo sustituye el instrumento solo durante los dos ataques solicitados.

`src/game/finale-sounds.ts` compone cuatro notas reentrantes y seis voces sintetizadas sin palabras, grabaciones, canciones ni imitación de voz. El score se usa mediante el disparo de audio existente al iniciar la definitiva, nunca por render. [original-score.wav](original-score.wav) conserva una exportación estéreo 24 kHz / 3 s; pico 0.340786, determinista, finito y sin clipping. La validación del audio fue numérica; no se afirma una auditoría auditiva.

La guía explica instrumento, costes y momentos en `descriptions.json`. El principal amplió exclusivamente el post-recorte de la definitiva de Alí a `(100,177,880,880*410/780)`, dentro del canvas 1080×640; conserva escala legible y todos los zapatos/faldas. No cambió la cámara del juego. [root-guide-evidence.json](root-guide-evidence.json) contiene su contraste independiente de especial/definitiva.

## Verificación reproducible

- `npx tsx --test tests/ali-overhaul.test.ts tests/character-audits/ali.test.ts`: **15/15**, [tests.log](tests.log). Captura/costes/3beats, reloj/posiciones, release/control, gates/guardia/fallo/interrupción, última vida/stock, emisión-gesto, preflight de todas las poses, serialización determinista, preservación/hashes y score.
- `npx tsc --noEmit`: pasó después de las correcciones finales.
- `git diff --check`: pasó.
- `npm run build`: **pasó**; único aviso de Vite por chunk mayor de 500 kB. Resultado en [build.log](build.log).
- Browser T3 nativo propio: `tab_42_c3cfa641-d7e6-4a79-9606-68ffb03b615c`, Vite 5184, `/docs/finales/attack-overhaul/review.html`. No se tocó la pestaña del principal. Fixture `scripts/ali-overhaul-browser-qa.js`: **80 casos / 1130 muestras**, motor+renderer+cámara reales, cada secuencia comienza incrementando `actions.special`/`actions.super`; no fabrica `state.finale`.
- Escenarios, en ambos puestos y con ambos ataques: centro, muy cerca, desigualdad vertical, borde hacia fuera, borde hacia dentro, close-edge, plataformas y alturas invertidas, guardia, fallo, Silbón, Momoy, actor en aire sobre Momoy, daño letal, última vida, interrupción, guardia posterior y distancias 140/280/300. Guarda coste/HP/hits/emisiones/captura/release. Afirma no mutación de estado/cámara, posiciones de captura congeladas, figuras enteras dentro del viewport, escalaXY canónica uniforme y texto de daño encima del rival presentado.
- [browser-evidence.json](browser-evidence.json) exporta los 80 resultados y 1130 mediciones reales. [screenshots.json](screenshots.json) registra las capturas nativas y rutas de origen; los archivos `-v2` reflejan la corrección final del indicador de daño. Se inspeccionaron entrada,42/90/138, cierre 178 / release 189, ambos bordes, P2, plataformas, Momoy/Silbón, especial, reduced-motion y falta de atlas. Las capturas previas se conservan para comparar.
- El principal reprodujo 80/1130, pruebas enfocadas adicionales y compilación estricta de guía; confirmó la corrección de etiqueta, suelo, caras, escalas y fallback. El principal completó el cierre y aprobó el personaje16/22.

No hubo cambio de motor; no se repitió toda la suite global. La suite completa y regeneración portable permanecen para el cierre de los 22 personajes según el brief. No se tocó otro personaje ni se creó commit/push.
