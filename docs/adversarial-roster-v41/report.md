# Revisión adversarial interactiva — personajes v41

Fecha: 18 de octubre de 2026. Revisados individualmente: Javier Hala Madrid, Dayana Mendoza, Nacho, Capriles Radonski, Lorenzo Mendoza, Carolina Herrera, Simón Bolívar y Édgar Ramírez.

## Resultado

Se confirmó y corrigió un fallo visual P2 de Bolívar. No quedaron otros fallos confirmados en los casos ejecutados. Esto cubre los recorridos descritos, no una garantía sobre todos los dispositivos o condiciones de Internet.

### P2 — Bolívar se deslizaba con una pose fija durante la carga

- **Confianza:** alta; reproducido con el motor y el renderizador reales.
- **Lugar:** `src/game/renderer.ts:193`, con la técnica definida en `shared/icon-techniques.ts:43`.
- **Secuencia:** iniciar `Carga libertadora`; el motor entra en un dash de 10 ticks, pero el renderizador conserva el cuadro 5 de puñetazo. El personaje se desplaza sin alternar las poses de carrera.
- **Corrección:** incluir `liberator` en la selección de cuadros 2/3 durante el dash; fuera de esa ventana vuelve a la guardia. No se cambiaron daño, energía, velocidad ni duración de la técnica.
- **Regresión:** `tests/adversarial-render-roster-v41.test.ts` falló primero con `got frame 5` y pasó después en ambas orientaciones, además de comprobar inicio, recuperación, bloqueo y daño.
- **Comprobación interactiva:** Bolívar como P2 contra Enrique en Valencia, con el rival controlado por eventos de teclado. [Captura](bolivar-valencia.png) y [grabación de 20 segundos, sin pista de audio](bolivar-charge-review.mp4).

## Peleas en la interfaz

Las acciones pasaron por los componentes reales: selección, nombre, escenario, introducción completa y eventos de teclado. El controlador solo leyó la referencia de estado de React para recoger evidencia; no modificó posiciones, energía, fase ni contadores del motor.

| Personaje revisado | Rival | Escenario | Modo | Lado |
| --- | --- | --- | --- | --- |
| Javier | La Llorona | Salto Ángel | CPU difícil | P1 |
| Dayana | Óscar D'León | Mérida | Dos jugadores local | P2 |
| Nacho | Capriles | Médanos de Coro | CPU suave | P1 |
| Lorenzo | Diablo de los Llanos | Maracaibo | Local con rival activo | P1 |
| Carolina | Pedro Vallenilla | La Guaira | CPU normal | P1 |
| Bolívar | Enrique Rivas | Valencia | Local con rival activo | P2 |
| Édgar | Vicente Zavarce | Los Roques | CPU difícil | P1 |
| Capriles | Doctor Knoche | Altamira | Local con rival activo | P1 |

Cada secuencia válida registró movimiento, salto, acciones ligeras/fuertes recibidas y al menos un especial iniciado, además de posiciones y recursos finitos. Algunas terminaron por eliminación durante la secuencia; las partidas completas y sus repeticiones deterministas se verificaron por separado. La primera secuencia local de Dayana tuvo rival pasivo; las de Lorenzo, Bolívar y Capriles añadieron presión mediante entradas de teclado del segundo jugador.

El controlador reproducible está en `scripts/review-interactive-v41-browser.js`. En un preview de desarrollo propio:

```js
const qa = await import('/scripts/review-interactive-v41-browser.js');
qa.startInteractiveReview({
  fighter: 'bolivar', rival: 'enrique', side: 1,
  stage: 'valencia', mode: 'local', difficulty: 'normal'
});
// Leer window.__run41 después: status, report y assertions.
```

El inicio es asíncrono para respetar el límite de 15 segundos del transporte del navegador y comenzar las acciones inmediatamente después de la introducción. La prueba rechaza un escenario seleccionado incorrectamente. Los JSON `ui-*.json` guardan los resultados aceptados, incluyendo acciones, recursos, posiciones y rutas de assets.

## Multijugador desde dos clientes

- Se creó una sala privada local y se unió un segundo cliente desde la interfaz: Javier contra Dayana en el Poliedro. El visitante no pudo modificar el escenario del anfitrión.
- Ambos enviaron especiales, saltos y ataques. Se comprobó un golpe fuerte de Javier que redujo la vida de Dayana a aproximadamente 87; los dos clientes conservaron el mismo identificador de partida.
- La pelea llegó al resultado. La revancha generó un identificador nuevo y conservó la victoria de Javier (`wins: 1`), coherente con el desbloqueo mostrado.
- En la revancha, Dayana recibió simultáneamente movimiento, salto y especial mediante `PointerEvent` de tipo `touch`, con vista de 844×390. Tras liberar y cancelar los punteros, no quedó ningún botón presionado.
- Al cerrar el cliente visitante, el anfitrión volvió a la sala de espera. Un cliente nuevo entró por el enlace con código, eligió Nacho y comenzó otra pelea. El especial de Nacho llegó al motor y consumió energía.
- La recepción observada de dos entradas especiales fue de aproximadamente 89 y 101 ms. Son muestras de entrada a estado visible en loopback, no un benchmark de Internet. Las capturas de dos pestañas se tomaron en instantes diferentes; sus ticks no deben compararse como capturas simultáneas.

[Evidencia estructurada de red, revancha, reingreso y controles](ui-online.json), [Poliedro](online-poliedro.png), [vista horizontal con controles](online-touch-landscape.png).

## Batería automática adicional

Los tres agentes de revisión independientes usaron Luna con razonamiento alto o extra alto según la tarea. Las pruebas ejercitan código de producción, con estas cantidades explícitas:

- 144 combinaciones de personaje, escenario y lado con rivales de distintos arquetipos y las tres dificultades.
- 16 cruces de dash, 64 casos de dirección de ataque/bloqueo y 48 controles de energía/especial/súper.
- 80 recorridos sobre plataformas móviles y el encadenamiento de pulsos de Dayana a través del hitstop.
- 24 combates completos contra CPU, cada uno repetido y comparado de forma determinista.
- Nueve escenarios por WebSocket real, con los ocho IDs como anfitrión y visitante; dos salas simultáneas, mensajes malformados, entradas antiguas, identificadores de otra partida, desconexión y regreso por código.

Las pruebas de red aceleran explícitamente la fase inicial en su fixture para verificar el transporte; las sesiones interactivas anteriores sí recorrieron las introducciones completas. Detalles: [combate](combat-review.md), [red](online-review.md), [animación](visual-review.md) y [resumen estructurado](summary.json).

## Verificación final y límites

**747/747 pruebas**, incluidos 10 tests nuevos; TypeScript, build de producción y **51/51 pares de atlas** correctos. No se publicaron cambios ni se modificaron cuentas reales: se usaron almacenamiento de navegador privado y una base local temporal para esta sesión. Al terminar, las salas y conexiones de prueba quedaron vacías.

Pendiente de validación externa: hardware táctil físico, redes públicas con pérdida o latencia inyectada y percepción de audio en un dispositivo real. La grabación nativa no contiene pista de audio. Las pruebas no certifican que todos los emparejamientos tengan idénticas probabilidades de ganar.

**RISKIEST LINE:** `src/game/renderer.ts:193`. Esta correspondencia entre habilidad y cuadros es la única modificación del comportamiento de producción de esta revisión; una selección incorrecta puede volver a ocultar visualmente la ventana de carga aunque la física siga funcionando. La regresión comprueba la salida real del renderizador desde estados producidos por el motor.
