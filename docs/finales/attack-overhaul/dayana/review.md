# Dayana Mendoza — Volea vinotinto

Implementación aprobada por el coordinador, personaje 18/22. Dayana Mendoza conserva el canon `dayana-v40`; no se sustituye por Deyna Castellanos. El fútbol es una adaptación ficticia solicitada, no una afirmación biográfica.

## Comportamiento integrado

**Especial — Remate vinotinto.** Cuesta 25 de energía y funciona con cero victorias. Preparación con una pelota redonda, contacto compacto de bota y recuperación. En el tick 21 el motor emite un único proyectil `corona` —se mantiene el identificador interno para compatibilidad—, radio 13, origen x48/y16 relativo al jugador, velocidad 8 y vida 65. El primer estado visible después de emitirse está x56 desde el jugador, porque el motor ya avanzó el balón 8. La imagen está centrada en el collider real. No hay homing, retorno, crecimiento ni pulsos radiales. Daño base 15 multiplicado por los modificadores compartidos; puede bloquearse, fallar, interrumpirse antes de lanzamiento o pasar por debajo de un rival elevado. El balón previo desaparece al emitir el físico; nunca se dibujan ambos.

**Definitiva — Volea vinotinto.** Requiere tres victorias y 75 de energía. Conserva captura 9, duración 180, congelación de física/reloj y liberación ordinaria fuerza 12, sin expulsión letal especial. Dos futbolistas adultas originales aparecen detrás de Dayana. Las tres preparan la patada y lanzan **tres balones simultáneamente en 66**. Sus arcos y velocidades visuales difieren por distancia/altura, pero **los tres llegan juntos en 100, con un solo impacto colectivo de daño**. No son tres lanzamientos escalonados ni tres beats de daño. La superficie de contacto se mide en la fila opaca del atlas canónico del rival, sin cambiar su identidad. Después recuperan el equilibrio, las ayudantes desaparecen antes del cierre y vuelve el control normal.

Las compañeras pisan el suelo real de la arena incluso si Dayana está en una plataforma; Dayana conserva sus propios pies y altura. Se permite una separación horizontal visual acotada para dejar 320 unidades locales hasta el rival y espacio detrás para el equipo; clamping por el viewport real mantiene completas las figuras en ambos sentidos. La separación entra/sale en 12 ticks. No se modifica cámara ni estado al dibujar. Los dos apoyos de la recuperación de Dayana rodean su ancla central; la última corrección de ancla(.49) alinea cara/cadera al regresar al canon.

## Arte, referencias y trazabilidad

[research.md](research.md) describe las fuentes primarias y las fotografías efectivamente vistas: galería propia de Dayana, producto oficial adidas y técnica de patada de FIFA Training Centre. El atlas canónico manda sobre las fotos. Equipo adulto original: una compañera con moño y otra con coleta, distinguibles entre sí y de Dayana. No audio comercial, grabaciones ni voz clonada; los golpes sintéticos se programan una sola vez en el audio, nunca desde render.

- `assets/source/finales/attack-overhaul/dayana/raw-v1.png`: preparación/continuación/recuperación/bola; se usan preparación, recuperación y bola. La pierna extendida se conserva como raw, pero no se usa como contacto.
- `raw-v2.png`: contacto compacto de Dayana aceptado.
- `raw-v3.png`: primera lámina del equipo conservada; no se usa por unión de alfa tenue entre filas.
- `raw-v4.png`: seis poses completas del equipo aceptadas, filas claramente separadas.
- `prompt-v1.txt` a `prompt-v4.txt`: prompts exactos del generador integrado `image_gen.imagegen`.
- [provenance.json](provenance.json): hashes de raws/prompts/referencias, fuentes de generación y archivos finales.
- [assets.json](assets.json), [assembly.json](assembly.json), [pack.json](pack.json): dimensiones, anclas, alfa, packing y hashes lossless. Atlas final: `public/assets/dayana-football-attack-v1.webp`, 2560×1024, diez celdas.

El RGB marrón bajo alfa 0 no es un fondo visible. Se comprobó sobre gris. El normalizador compartido procesa v1/v2 tras añadir 32 px transparentes, sin tocar los raws. Las seis celdas v4 ya contienen figuras completas; tienen ruido alfa 1 en bordes y una isla alfa 2 separada que el normalizador estricto rechaza. Se preservan **todos sus bytes RGBA** mediante copia de filas a celdas nuevas, sin resampling, pintura, máscaras ni corte de anatomía. Una prueba de hashes verifica el roundtrip de cada celda completa, incluido el RGB invisible. `prepare-attack-art` hace el packing uniforme habitual y conserva PNG/WebP con RGBA idéntico; únicamente elimina el ruido alfa 1 desconectado que su política compartida ya permite. No se ha debilitado ningún guard del normalizador.

La escala se calcula desde alturas del cuerpo en píxeles de fuente: referencia 516, contacto 1309×.4, recuperación 487×1.12 y equipo×1.1. Esto corrige las diferencias de escala entre generaciones sin deformar cabezas o cuerpos. Anclas de contacto/preparación medidas en los pies; recuperación de Dayana centrada entre sus dos apoyos.

## Verificación y evidencia

- `npx tsx --test tests/dayana-overhaul.test.ts tests/roster-v39.test.ts tests/adversarial-roster-v41.test.ts`: **68/68**; [tests.log](tests.log). Ocho pruebas nuevas: impactos/captura/costes/gates/guardia/fallo/interrupción/última vida/liberación/control, serialización y roundtrip real de archivos. Se actualizaron las dos expectativas heredadas que describían los pulsos retirados, conservando su cobertura de hits e hitstop.
- `npx tsc --noEmit`: pasa. `git diff --check`: pasa.
- `npm run build`: pasa; [build.log](build.log). Único aviso de Vite: tamaño del bundle principal superior a 500 kB.
- `scripts/dayana-overhaul-browser-qa.js`: **64 casos /762 muestras** mediante acciones reales `special`/`super`, motor/render/cámara de producción. Ambos puestos; centro, cerca 55, bordes dentro/fuera, plataformas altas/bajas, Momoy/Silbón, guardia, fallo, interrupción, stocks y última vida. Comprueba que render no muta estado/cámara, que la física capturada no cambia, coste, número de impactos y figuras completas en bordes. [browser-evidence.json](browser-evidence.json) conserva la ejecución del agente anterior al ajuste final de ancla de recuperación.
- El coordinador repitió **64/762 tras el ancla final**, ocho pruebas propias y tipado estricto de guía: [root-guide-evidence.json](root-guide-evidence.json). También auditó **104/104 contactos** (52 rivales×2puestos, no 104 timelines visuales): [root-roster-contact-audit.json](root-roster-contact-audit.json).
- Tab propio: `tab_44_c3cfa641-d7e6-4a79-9606-68ffb03b615c`. Tab propio cerrado al finalizar; tab del coordinador 3d protegido. [screenshots.json](screenshots.json) registra 27 screenshots nativas guardadas y revisadas; son anteriores únicamente a la corrección final del ancla de recuperación. Las capturas `screenshots/final-guide-recover.png` y `screenshots/final-guide-impact.png` muestran la fuente final después de ese ajuste. Se revisaron contacto, ambos bordes, P2, plataformas, entrada/cierre/liberación, rival bajo/alto, reducido y falta de atlas. Los archivos del coordinador documentan su revisión final independiente.

La guía fuente se probó con `arenaMoveGuide`: un impacto colectivo en el frame 109(tick 100), mínimo 60.9136 HP y liberación 189. En esa demostración concreta el rival pierde una vida posteriormente al salir por el borde(frame 227); es el resultado físico de la liberación ordinaria, no una expulsión forzada. El especial golpea una vez(frame 37), mínimo 85.618 HP, y conserva las dos vidas. El recorte existente muestra completos equipo, balones y rival; no se cambió la cámara ni el crop de guía.

## Límites explícitos y alcance

La definitiva sigue siendo una captura coreografiada: sus tres balones son objetos renderizados sincronizados con el beat100, no proyectiles independientes esquivables durante la captura. El especial sí usa proyectil físico bloqueable. Si falta una celda o el atlas completo, se conservan ambos cuerpos canónicos y se omite el equipo de la definitiva; el especial expone un marcador redondo en el collider cuando necesita fallback. No reaparecen coronas ni el cuadrado de señal anterior.

No se ha actualizado la guía portable/media; el coordinador integra ese entregable al terminar 22. No commits, push, worktree nuevo ni modificación del motor compartido. Revisión independiente aprobada: 38 comprobaciones enfocadas iniciales, ocho posteriores al ancla final, tipado estricto de la guía, reproducción de 64 casos/762 muestras y contacto de los 52 rivales en ambos puestos. Evidencia en `root-guide-evidence.json`.
