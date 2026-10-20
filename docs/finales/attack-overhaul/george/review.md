# George Harris — «Se acabó el show»

Estado: implementación, investigación, arte, pruebas y **revisión independiente del principal aprobadas**. Personaje 14 de 22. Solo se trabajó en George. No se actualizaron `requirements.json`, las 52 demos portátiles ni otros personajes; no se hicieron commits o pushes.

George presenta el cierre, se inclina y hace una reverencia completa mientras un telón de terciopelo rojo cae sobre el rival. El borde dorado produce un único golpe, la tela lo cubre y después vuelve a subir. La arena y la cámara de combate permanecen. El rival usa su propio atlas canónico antes de quedar cubierto y reaparece con la misma identidad.

## Referencias y arte

`research.md` documenta la consulta del sitio oficial, el retrato oficial realmente visto, la fotografía de escenario de EL PAÍS realmente vista y las incertidumbres. Se observó el atlas canónico antes de generar. Se conservan cabello castaño peinado hacia atrás, barba recortada, camiseta negra con pequeña estrella dorada, pantalones negros, zapatillas blancas, reloj y un micrófono en la mano. La foto de escenario tiene una camisa con botones; se corrigió esa observación respecto de la metadata antigua, sin cambiar el vestuario canónico.

Se utilizó exclusivamente `image_gen.imagegen` con transparencia. `raw-v1.png` conserva cuatro cuerpos completos (`present`, `incline`, `bow`, `recover`), el telón y el soporte inicial. El primer soporte tenía cables demasiado largos para la plataforma alta; `support-raw-v2.png` contiene una barra nueva con anillas compactas. `prompts/v1.txt` y `support-v2.txt` conservan los prompts completos. `provenance.json` registra hashes de los originales, los prompts, las referencias y los atlas canónicos intactos.

El normalizador conservó RGBA exacto de los componentes completos en ambos originales. El primer atlas retiene 469547 píxeles; `grid-audit.json` y `support-grid-audit.json` documentan la reconstrucción inversa. `assemble-george-art.ts` copia byte a byte las primeras cinco celdas de v1 y sustituye exclusivamente el soporte completo, escalado uniformemente. `assembly.json` prueba que esas cinco celdas no cambiaron. No se recortaron extremidades, pintó anatomía con código ni deformaron caras. `accepted-gray.png` verifica alfa sobre gris; el RGB invisible bajo alfa cero no se trata como fondo opaco.

El atlas público `george-curtain-attack-v1.webp` tiene 1536×1024, seis celdas de 512 y codificación sin pérdida comprobada en `assets.json`. Presentación, inclinación y reverencia usan la misma escala de píxeles de fuente: alturas visibles 506, 470 y 379. La recuperación erguida salió a 463 píxeles y se calibra uniformemente por 506/463 para conservar la altura y tamaño de cabeza al volver a erguirse. Se inspeccionaron esas transiciones en el navegador y el principal aprobó la escala recuperada.

La barra dibujada conserva volumen metálico y anillas; dos líneas tensas la suspenden desde fuera del campo superior de la cámara. Los pliegues, bordado y flecos del telón son pintura generada. La tela completa se traslada detrás de la barra y se oculta por encima de ella; esa máscara corresponde únicamente al funcionamiento del prop, nunca a anatomía. No se añadieron grabaciones, música comercial, YouTube ni voz imitada; se mantiene la síntesis original compartida del perfil `show`.

## Definitiva y continuidad

- Se conservan tres victorias, coste 75, preparación 9, alcance de captura 245 y duración 180 ticks. Guardia frontal, fallo e interrupción de preparación impiden la captura. La guardia trasera respeta las reglas existentes.
- George presenta hasta 35, comienza la inclinación en 36 y mantiene la reverencia entre 60 y 125. La tela empieza a bajar en 60. `damageBeats` contiene únicamente `[96]`.
- En 96 el borde dorado alcanza la parte superior de la **pose canónica realmente dibujada**. Se usa `frames[battleFrame].height / bodyHeight` además de `displayHeight`; esto evita golpear el aire sobre una pose más agachada de Silbón. El rival conserva `stand` en el contacto y cambia a `hurt` cuatro ticks después, cuando la tela ya ha descendido sobre él.
- El telón termina de cubrir al rival en 112, permanece cerrado hasta 139, sube entre 140 y 170 y desaparece por completo antes de la liberación. George se incorpora, saluda y vuelve a presentación. No hay segundo daño al levantar la tela.
- El bocadillo «Se acabó el show» está separado del rótulo genérico «Definitiva». El contador de daño sigue al rival desplazado visualmente, evitando que caiga encima del bocadillo en capturas cercanas al borde.
- Ambos cuerpos conservan sus alturas físicas de plataforma. Una separación horizontal de presentación deja sitio para la tela y se contiene en el viewport, incluidos espejo y bordes. El ajuste entra y sale en 12 ticks; no modifica posiciones físicas ni cámara. El render se verifica como lectura pura de estado y cámara.
- La captura pausa el reloj y la física. En 180 se libera con la fuerza normal 12 y la protección normal de 12 ticks. No se utiliza la expulsión ni la gracia letal de Puma. Los tests verifican control posterior, pérdida única de stock y fin de partida en la última vida.

Contra Zavarce el contacto único resta 42.7992 HP. En la guía de producción, con Capriles como rival, también queda un mínimo de 57.2008 HP: contacto en el cuadro 105/tick 96, liberación en 189 y pérdida de stock por la salida normal de la arena en 225. Los 280 cuadros terminan con 100 HP, una vida y sin captura ni ataque activo. Esa recuperación de HP corresponde a la reaparición; no es daño perdido.

## Especial revisado

«Remate en dos tiempos» conserva su mecánica: coste 25, preparación 14, recuperación 55, dos pulsos en los ticks de ataque 14 y 30, alcance 190 y 280. El segundo puede alcanzar a quien estaba fuera del primero. Se conserva el cuerpo canónico completo con el micrófono y el gesto de la mano libre.

Se corrigieron únicamente sus ondas de presentación: antes se mostraban continuamente como si el primer pulso siguiera activo. Ahora cada réplica tiene una ventana visual de nueve ticks, una pausa entre ellas y el segundo par de ondas 90 unidades más lejos. El daño sigue dependiendo del alcance, orientación, altura y guardia del motor. No se introdujo otra habilidad ni un proyectil.

El navegador comprueba ambos puestos, centro, cercanía, bordes hacia dentro y fuera, altura desigual, plataformas, fallo, guardia frontal y trasera e interrupción. En la muestra normal hay dos impactos: cuadros 14 y 33; el segundo corresponde al tick de ataque 30 después del hit-stop del primer golpe. Guardia frontal, fallo e interrupción producen cero golpes. Las pruebas de alcance también verifican el segundo golpe solo entre 190 y 279 unidades, y fallo a partir de 280.

## Validación y límites

- **56/56 pruebas enfocadas pasan**, incluidas nueve nuevas de George y las auditorías anteriores. Comando: `npx tsx --test --test-concurrency=2 tests/george-overhaul.test.ts tests/character-audits/george.test.ts tests/finales.test.ts tests/finale-world.test.ts tests/attack-art*.test.ts`. Resultado completo: `focused-tests.log`.
- Las nuevas pruebas cubren puertas de acceso, coste, captura, golpe único, congelación de reloj/posiciones, liberación/control, stocks, última vida, JSON determinista, alcance y guardias del especial, interrupción, todas las poses requeridas, dimensiones intrínsecas inválidas, preservación RGBA, escala erguida y geometría real del battle frame/etiquetas.
- **`npm run build` pasa** e incluye `tsc --noEmit`; `build.log` conserva el resultado. Vite conserva su aviso de tamaño de bundle existente. `git diff --check` pasa. No cambió la lógica del motor; la suite completa queda para el cierre global del principal.
- **60 casos y 624 muestras en navegador nativo**, iniciados por entradas reales `special`/`super`, motor, assets, cámara y renderer de producción. `browser-evidence.json` registra los resultados físicos; `render-evidence.json` conserva las geometrías pintadas. Se comprobaron límites horizontales de cuerpos/props en bordes, límites verticales del soporte, posiciones congeladas y ausencia de mutación al renderizar.
- Se guardaron **25 capturas propias**: 24 del arnés más la guía real. Se inspeccionaron entrada, inclinación, precontacto, contacto, cierre, recuperación, rival revelado, liberación, ambos extremos, P2 en plataforma alta, Momoy, Silbón, las dos réplicas del especial, movimiento reducido y atlas ausente. El movimiento reducido mantiene la coreografía esencial para comunicar el golpe.
- Si falta o está corrupto el atlas, el preflight de las seis poses falla antes de pintar. La alternativa muestra los dos cuerpos canónicos con reacción compartida, sin el banquito/monólogo obsoleto. La degradación de carga preserva identidad y combate, aunque no reproduce el telón.
- **Revisión independiente del principal aprobada**: 27 pruebas en su primera revisión y 16 posteriores, tipos estrictos de guía y build comprobados. Inspeccionó arte sobre gris, copia exacta de cinco objetos, escala de recuperación, especial, telón y retirada, plataforma P2, Momoy, Silbón corregido y separación de frase/rótulo en borde cercano. `root-guide-evidence.json` y `screenshots/root-guide-contact.png` conservan su verificación fresca de la guía.

Reproducción del arte:

```sh
npx tsx scripts/normalize-attack-grid.ts docs/finales/attack-overhaul/george/normalize.json
npx tsx scripts/normalize-attack-grid.ts docs/finales/attack-overhaul/george/normalize-support.json
npx tsx scripts/assemble-george-art.ts
npx tsx scripts/prepare-attack-art.ts docs/finales/attack-overhaul/george/pack.json
```

Pestaña nativa del agente: `tab_3z_c3cfa641-d7e6-4a79-9606-68ffb03b615c`. `window.georgeQA.show(key, reduced, missing)` reproduce las muestras; `inspect(key)` devuelve su estado/cámara y `hide()` regresa a la guía. El principal controla el cierre de esta pestaña y el registro de aprobación. No se tocó su pestaña `tab_3d_c3cfa641-d7e6-4a79-9606-68ffb03b615c`.
