# Auditoría individual: La Guaira — El malecón

Revisión: 2026-10-17. Alcance: escenario `guaira`, código compartido y partida de práctica en https://arena.kevinbravo.com/. No se modificaron arte, audio ni archivos de implementación durante esta auditoría.

## Sitio publicado

- Se eligió «El malecón», se escribió el apodo `QA Guaira` y se inició una pelea contra CPU. El fondo `/assets/guaira.webp` respondió HTTP 200 y se dibujó correctamente; la partida avanzó hasta resultado y permitió revancha.
- El fondo conserva una vista clara del mar, montaña y malecón. Los dos luchadores resultan distinguibles sobre el suelo. La plataforma central se superpone visualmente con el barandal y su paleta turquesa/marrón; cuesta reconocerla como superficie jugable al primer vistazo. Conviene mantener un borde superior claro y separarlo visualmente del barandal al ampliar la escena.
- La geometría publicada usa canvas 1080 × 640. La versión de código inicial tenía piso `y=554`, límites de suelo `x=70…1010` y plataforma central `x=415…665`, `y=380`. El área útil de suelo es 940 unidades: ampliar únicamente el tamaño CSS del canvas no agregaría espacio jugable.
- En 844 × 390, durante la presentación de revancha, el canvas conservó sus 1080 × 640 unidades y ocupó aproximadamente 602 × 356 CSS px, completamente dentro del viewport. `scrollWidth=844`, sin desbordamiento horizontal.
- En 390 × 844, el canvas conservó todas sus proporciones y ocupó aproximadamente 372 × 220 CSS px, sin desbordamiento horizontal. El cliente de revisión reportó `navigator.maxTouchPoints=0`: esto verifica maquetación estrecha de escritorio, no interacción táctil ni bloqueo de orientación de un teléfono real.
- Hubo una desconexión transitoria del cliente de automatización al intentar saltar la presentación; las lecturas y redimensionados posteriores funcionaron en la misma pestaña. No se atribuye esta incidencia a la física del juego.

## Física y acceso en el código inicial

- Plataforma centrada y estática. No hay recorrido móvil que pueda salir de los límites.
- La diferencia piso/plataforma es 174 unidades. Una simulación desde `x=540` con Zavarce alcanzó `y≈402.8` con un salto y volvió al piso: no llega a la plataforma con salto simple.
- Un segundo salto en frame 18 alcanzó `y≈301.64` y aterrizó sobre la plataforma en frame 56; en frame 23 alcanzó `y≈292.24` y aterrizó en frame 62. El acceso mediante doble salto funciona y no requiere una ventana estrecha.
- Suelo y plataforma usan la misma definición de posiciones para simulación y dibujo. La detección de caída permite cinco unidades de tolerancia horizontal; los límites KO están fuera del canvas. La ampliación debe desplazar también esos límites, conservando la posibilidad de recuperar desde un borde.

## Ampliación compartida observada durante la revisión

El cambio del agente principal introduce mundo 1440 × 800 con origen `(-180,-140)`, suelo `x=-90…1170` (1260 unidades, +34 %), conserva `y=554` y ensancha la plataforma central a `x=405…675` (270 unidades). Conserva centro y altura de acceso, así que el doble salto descrito sigue siendo válido; la anchura nueva aporta espacio de desplazamiento sin elevar la plataforma fuera de alcance. Esta observación corresponde a archivos locales en edición, no a un despliegue verificado.

## Verificación

`npx tsx --test tests/stages.test.ts tests/viewport.test.ts`: 11 pruebas aprobadas, 0 fallidas, ejecutadas contra el código inicial antes de la ampliación compartida. Cubren integridad de fondos, física determinista de los nueve escenarios, soporte de plataformas y conservación de proporciones/límites visibles. La simulación de acceso indicada arriba fue una comprobación directa y no añadió pruebas permanentes.

Pendiente de la validación global del agente principal: observar el escenario ampliado en navegador local, confirmar que el arte cubre los nuevos extremos y comprobar visibilidad de plataforma/barandal en teléfono táctil real.
