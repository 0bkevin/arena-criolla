# Revisión visual y cobertura de los finales: parte 2

Fecha: 18 de octubre de 2026.

Esta revisión registra el primer cierre del montaje. Una corrección posterior del usuario exige poses de baile propias para los 46 rivales de Nacho, en lugar de animar sus frames de combate. Su estado y revisión se siguen en [baile v2](dance-v2-review.md); la descripción inicial de la fila de Nacho debe leerse con esa corrección.

Esta nota distingue la inspección visual comunicada por el agente principal (`root`), la auditoría estática de rutas, actores y efectos en `src/game/finale-renderer.ts` y el recorrido de renderizado real de las 46 escenas. La lectura de código y la ausencia de excepciones comprueban cobertura y comportamiento previsto; no equivalen a haber observado cada frame de las 46 secuencias completas en el navegador.

## Inspección visual realizada por root

Root comparó las hojas sentadas 4, 5 y 6 con las referencias canónicas, además de revisar las secuencias especiales de Capriles, Nacho y Giuseppe. Aprobó identidad, estilo gráfico, poses completas y ausencia de recortes en los siguientes assets:

| Hoja                                  | Figuras revisadas                                                                | Resultado comunicado por root                                             |
| ------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `finales-seated-v1-4-generated.png`   | Rummy, Chiqui, Norkys, Gabriela, Amanda, Lele, Giuseppe y Silbón                 | Ocho identidades conservadas; estilo y poses sentadas aprobados.          |
| `finales-seated-v1-5-generated.png`   | Llorona, Sayona, Lionza, Florentino, Diablo, Knoche, Momoy y Tío Tigre           | Ocho identidades conservadas; figuras completas y sin recortes.           |
| `finales-seated-v1-6-generated.png`   | Tío Conejo, Enrique, Jesús, Carlos, Víctor y Juan, con dos variantes adicionales | Seis identidades del roster aprobadas; hoja completa de ocho componentes. |
| `finales-capriles-cafe-generated.png` | Cuatro poses de Capriles con café                                                | Identidad, estilo y cuatro poses completas aprobados.                     |
| `finales-nacho-dance-generated.png`   | Ocho poses de baile de Nacho                                                     | Identidad, estilo y secuencia de ocho poses aprobados.                    |
| `finales-giuseppe-hack-generated.png` | Ocho poses de Giuseppe tecleando                                                 | Identidad, estilo y secuencia de ocho poses aprobados.                    |

La revisión de las hojas 1–3 está registrada en `visual-review-part1.md`. Ambas partes cubren las **46 identidades sentadas**. La identidad y anatomía de las figuras se revisaron por separado de la composición de sillas, mesa, manos y tazas.

Root y el agente de renderer aprobaron después el montaje real de café: Capriles contra Zavarce en tick 90 y contra Nacho en tick 83. Las dos sillas aparecen completas detrás de ambos actores, la mesa completa queda delante y la taza conserva su vapor. No hay asientos partidos, bordes de recorte ni fragmentos de muebles por delante de las figuras. Las sillas respetan la proporción del bitmap, la mesa conserva su pedestal completo y los muebles se apoyan sobre la misma línea. El test del renderer exige exactamente cuatro recortes de mobiliario y el orden sillas → actores → mesa/taza. La [captura del café](screenshots/capriles-cafe.png) documenta el montaje aprobado.

Root también aprobó y capturó las escenas de Nacho y Giuseppe. Además recorrió los 46 atacantes alternando lado y rival en los ticks 0, 42, 90, 138 y 179: **230 renderizados sin excepciones y con todos los assets listos**. La compilación final pasó. Este recorrido verifica que todas las rutas se pueden dibujar; la auditoría de la tabla siguiente explica su contenido y sus diferencias.

El empaquetado real de los nueve atlas pasó además la validación de 68 componentes: 46 sentados, dos variantes, cuatro poses de café y 16 poses de baile/hack. Se comprobaron baseline 482, límites transparentes, anclas de cabeza y igualdad RGBA/alpha entre PNG y WebP. Las secuencias de una misma persona conservan una altura de referencia común para que los gestos no produzcan zoom.

## Auditoría de cobertura del renderer

Cada fila del roster tiene definición de final, un kit de props propio y una ruta de composición. El personaje afectado se obtiene de `state.players[finale.target]`: mantiene su identidad en el asiento, el baile, el vehículo o la reacción al golpe. Los tres drenajes actualizan los PV visibles y producen su aviso de daño. La auditoría cubre las 46 rutas siguientes:

| Personaje               | Puesta en escena y diferencia visible                                                       | Participación del rival                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Vicente Zavarce         | Siete motos orbitan y cierran la entrega con un cohete.                                     | Queda en el centro de la entrega y retrocede en los impactos.                                                 |
| Pedro Vallenilla        | Tres tarjetas numeradas y un recibo creciente en la caja de cuotas.                         | Recibe los tres pulsos y cambia a retroceso al conectar cada uno.                                             |
| Javier Hala Madrid      | Portería con red, balón en arco y chilena.                                                  | Ocupa la portería con movimiento corporal.                                                                    |
| Capriles                | Mesa, dos sillas, café, conversación por etapas y cuatro poses propias.                     | Cualquiera de las 46 identidades usa su bitmap sentado; responde con bocadillos y pierde PV.                  |
| Renny Ottolina          | Televisor de época con imagen del conductor y cambios de cámara.                            | Mira el programa desde su silla.                                                                              |
| Juan Vicente Gómez      | Despacho, papeles y tres sellos de recepción/revisión/cierre.                               | Permanece frente al despacho y retrocede con los sellos.                                                      |
| Simón Díaz              | Cuatro, tonada visual y tres caballitos que atraviesan la escena.                           | Recibe los acentos y retrocede con cada impacto.                                                              |
| Er Conde del Guácharo   | Telones, guácharo de utilería, micrófono y carcajadas alrededor del remate.                 | Participa frente al comediante y retrocede con los remates.                                                   |
| Emilio Lovera           | Máscaras, cambios de personaje y un autobús que entra al cierre.                            | Recibe la secuencia de remates en escena.                                                                     |
| Maite Delgado           | Gala, corona y destellos de escenario.                                                      | Posa y reacciona a los pulsos de la presentación.                                                             |
| Óscar D’León            | Contrabajo, pista de salsa y desplazamiento de mayor amplitud.                              | Baila junto a Óscar siguiendo la rueda.                                                                       |
| El Puma                 | Prop de concierto y ondas de voz.                                                           | Recibe las ondas y retrocede al compás de los impactos.                                                       |
| Luis Chataing           | Mesa de entrevista, dos sillas, medidores de audio y repreguntas.                           | Permanece sentado como invitado de la entrevista.                                                             |
| George Harris           | Banquito de comedia, primera fila, pausa y carcajadas crecientes.                           | Usa su pose sentada frente al monólogo.                                                                       |
| María Corina Machado    | Caravana, vehículo, tarima y tres cintas tricolor.                                          | Viaja colocado sobre la caravana y reacciona corporalmente.                                                   |
| Alí Primera             | Guitarra, prop de recital y ondas de eco.                                                   | Recibe los acentos del canto y retrocede.                                                                     |
| Gualberto Ibarreto      | Instrumento oriental, tremolo y ondas musicales.                                            | Recibe los pulsos y retrocede con cada impacto.                                                               |
| Reynaldo Armas          | Caballo dorado, lazo y anillos que cierran al objetivo.                                     | Queda dentro del lazo luminoso en reacción corporal.                                                          |
| Gustavo Dudamel         | Batuta móvil, atril, pentagrama y notas de fortissimo.                                      | Reacciona a los tres acentos de dirección.                                                                    |
| Danny Ocean             | Corazón de neón y ondas de marea alrededor de ambos.                                        | Recibe los pulsos de la marea y retrocede.                                                                    |
| Nacho                   | Ocho poses propias, pista, hombros/cadera, giro y remate de baile.                          | Usa sus propios frames canónicos y flexión corporal para seguir la misma frase, incluido el cambio de pierna. |
| Daniel Sarcos           | Podio de ganador y tres cajas que revelan sorpresas.                                        | Sube al podio y participa con pose de actuación.                                                              |
| Yordano                 | Piano/manantial y tres corrientes de agua diferenciadas por el acento.                      | Recibe las oleadas y retrocede en los pulsos.                                                                 |
| Lila Morillo            | Cocotero y cocos de utilería sobre la pista.                                                | Baila junto a Lila.                                                                                           |
| Rummy Olivo             | Arpa, flores de sabana, tempo de joropo y zapateo más marcado.                              | Zapatea junto a Rummy, con elevación y pasos propios.                                                         |
| Chiquinquirá Delgado    | Pasarela en perspectiva y cámaras con aros de flash.                                        | Camina y gira a su lado con movimiento de baile.                                                              |
| Norkys Batista          | Foco, libreto y tres tomas de una audición.                                                 | Ocupa la escena y reacciona al cambio de toma.                                                                |
| Gabriela Spanic         | Dos espejos con proyecciones opuestas y una tercera figura central.                         | Queda frente al doble juego de espejos y retrocede con el desenlace.                                          |
| Amanda Gutiérrez        | Telones más amplios y monólogo gestual.                                                     | Participa frente al último acto y retrocede en los impactos.                                                  |
| Lele Pons               | Teléfono, marco de directo, comentarios y reacciones que ascienden.                         | Queda encuadrado en la grabación y reacciona a la broma.                                                      |
| Giuseppe Gangi          | Ocho poses propias de teclado, portátil, terminal en perspectiva y paquetes hacia la barra. | Mantiene su identidad, recibe la conexión de energía y retrocede al drenar vida.                              |
| El Silbón               | Saco, huesos que orbitan y anillos del silbido.                                             | Queda rodeado por los huesos y retrocede con los pulsos.                                                      |
| La Llorona              | Corriente, cuna espectral y gotas que descienden sobre el objetivo.                         | Queda dentro de la crecida y reacciona a los impactos.                                                        |
| La Sayona               | Dos apariciones translúcidas a los lados y un círculo de velas.                             | Queda entre las apariciones y retrocede con los pulsos.                                                       |
| María Lionza            | Danta de jade, hojas que orbitan y corona de Sorte.                                         | Queda enmarcado por la aparición de la montaña y reacciona a los pulsos.                                      |
| Florentino              | Arpa/cuatro, tiras de copla y llamada/respuesta del contrapunteo.                           | Se sienta enfrente para recibir las respuestas.                                                               |
| El Diablo de los Llanos | Arpa de brasas, círculo de fuego y cambio al amanecer.                                      | Permanece dentro del círculo y retrocede con los acentos.                                                     |
| Doctor Knoche           | Gabinete, tres frascos y niebla ascendente de laboratorio ficticio.                         | Recibe la fórmula teatral y reacciona a los pulsos.                                                           |
| El Momoy                | Laguna, hongos, raíces y anillos de agua en torno al objetivo.                              | Permanece dentro de la laguna y reacciona a los impactos.                                                     |
| Tío Tigre               | Peñasco y tres zarpazos que se encienden por acento.                                        | Recibe los zarpazos y retrocede.                                                                              |
| Tío Conejo              | Zanahoria, cuerda y una trampa que se abre a mitad de escena.                               | Cambia su posición vertical hacia la trampa y reacciona al golpe.                                             |
| Enrique Rivas           | Libro contable, calculadora y etapas de débito/balance/cierre.                              | Recibe los tres descuentos y retrocede.                                                                       |
| Jesús Castillo          | Dos carteras conectadas y monedas que recorren un arco de remesa.                           | Recibe la transferencia de energía y retrocede con los pulsos.                                                |
| Carlos García Ottati    | Auto en movimiento, cambios de marcha y líneas de aceleración.                              | Usa su bitmap sentado dentro del vehículo y se desplaza con él.                                               |
| Víctor Cárdenas         | Tarjeta y tres diagonales Slash que se activan por acento.                                  | Recibe los cortes de la interfaz y retrocede.                                                                 |
| Juan José Pocaterra     | Autobús en ruta, mapa con nodos y tres paradas.                                             | Usa su bitmap sentado dentro del autobús y viaja con la ruta.                                                 |

## Resultado y límites

No se encontró una identidad del roster sin escena, sin prop propio o sin participación del rival. Los tres ejemplos concretos del usuario tienen tratamiento específico: café sentado para cualquier rival, baile compartido de Nacho y hack ficticio de Giuseppe con pérdida visible de vida.

Hay infraestructura compartida por familias. En particular, Puma, Alí y Gualberto comparten la estructura de ondas musicales y retroceso, con props e instrumentos diferentes; no tienen tres coreografías corporales enteramente distintas. Del mismo modo, varios finales sobrenaturales comparten la reacción de impacto mientras cambian la aparición y los efectos que rodean al objetivo. Esta reutilización no se debe describir como 46 secuencias de animación independientes dibujadas frame a frame: son 46 composiciones con recursos propios, variantes por personaje y reacciones de su rival.

El montaje del mobiliario del café queda aprobado en el juego y documentado en su captura. La reproducción del Short de Nacho depende del player de YouTube; un bloqueo de la plataforma muestra su estado y enlace de recuperación, sin presentar la música original de respaldo como la canción solicitada.
