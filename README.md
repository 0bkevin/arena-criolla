# Arena Criolla

## Licencia y distribución

El código y los materiales originales del proyecto se distribuyen bajo **GPL-3.0-only**; el texto completo está en [LICENSE](LICENSE). Los sonidos de terceros conservan CC0 y las fuentes conservan SIL Open Font License; consulta [ASSET-LICENSES.txt](ASSET-LICENSES.txt).

El repositorio incluye los assets necesarios para jugar en `public/`, los PNG editables en `assets/source/` y los originales generados necesarios para los scripts de preparación. No hace falta descargar assets desde Google Drive. Los paquetes grandes opcionales se pueden distribuir como archivos de una GitHub Release.

Las fotografías, entrevistas y otros medios descargados para investigación, las voces retiradas y las miniaturas de referencia quedan fuera de esta publicación. Los informes históricos conservan sus enlaces y rutas de investigación; esas rutas locales pueden no existir en un clon público. Los secretos y los datos privados del taller tampoco se distribuyen.

Juego de pelea en español con 41 personajes. Conserva estas 15 figuras venezolanas: Vicente Zavarce, Pedro Vallenilla, Javier Hala Madrid, Capriles Radonski, Renny Ottolina, Juan Vicente Gómez, Simón Díaz, Er Conde del Guácharo, Emilio Lovera, Maite Delgado, Óscar D’León, El Puma, Luis Chataing, George Harris y María Corina Machado. Se suman Alí Primera, Gualberto Ibarreto, Reynaldo Armas, Gustavo Dudamel, Danny Ocean, Nacho, Daniel Sarcos, Yordano, Lila Morillo, Rummy Olivo, Chiquinquirá Delgado, Norkys Batista, Gabriela Spanic, Amanda Gutiérrez, Lele Pons y Giuseppe Gangi. También están El Silbón, La Llorona, La Sayona, María Lionza, Florentino, El Diablo de los Llanos, Doctor Knoche, El Momoy, Tío Tigre y Tío Conejo. Combina vida, bloqueo y combos con plataformas, doble salto, empujones y eliminación por caída.

## Jugar y desarrollar

Requiere Node.js 24 o posterior (SQLite integrado).

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`. El servidor escucha en todas las interfaces: para jugar desde otro dispositivo de la misma red, abre `http://IP-DEL-EQUIPO:5173`. Escribe un apodo, elige un personaje y un escenario.

- **Pelea rápida:** juega contra CPU en tres dificultades.
- **Con un pana:** dos jugadores en el mismo teclado o con dos mandos.
- **En línea:** crea una sala pública o privada, comparte la invitación y ambos marcan «Estoy listo». Cada persona usa los controles del jugador 1 en su dispositivo.

Las salas y las partidas en red funcionan en el servidor Node por WebSocket, sin cuentas. Para que personas de distintas redes entren con una URL pública, hay que desplegar este servidor; el proyecto todavía no está publicado en Internet.

## Crear tu propio luchador

`/create` abre el taller. Crear cuenta o entrar requiere solo nombre, correo y contraseña; jugar, usar salas y elegir personajes publicados sigue abierto a invitados.

Para activar la generación, copia `.env.example` a `.env` y configura `OPENAI_API_KEY` **solo en el servidor**. Reinicia `npm run dev`. Los modelos se pueden configurar con `OPENAI_DESIGN_MODEL` y `OPENAI_IMAGE_MODEL`; por defecto usa `gpt-4.1-mini` para el diseño y `gpt-image-2` para el atlas. Requiere acceso a esos modelos en tu cuenta de API. Sin clave, el taller muestra su estado de disponibilidad y no acepta trabajos de generación.

1. Sube entre una y tres fotos JPG, PNG o WebP (máximo 8 MB cada una).
2. Escribe un nombre y una descripción corta (10–240 caracteres); elige Ágil, Técnico o Potente y un color.
3. La creación continúa en el servidor aunque cierres la página. Puedes volver para ver el progreso.
4. Prueba tu borrador contra la CPU, con sus combos desbloqueados para la prueba, y pulsa **Publicar** para añadirlo a la colección **Panas** de todos los jugadores.
5. Administra tus creaciones desde **Mis luchadores**: probar, publicar, continuar un trabajo fallido o eliminarlo.

El grafo real de LangGraph vive en `server/creator/pipeline.ts`:

```mermaid
flowchart LR
  Fotos[Fotos y descripción] --> Diseño[Diseño con referencias]
  Diseño --> Dibujo[Atlas de ocho poses]
  Dibujo --> Ajuste[Validación y ajuste de sprites]
  Ajuste --> Combate[Prueba de combate en ambos lados]
  Combate --> Borrador[Guardar borrador privado]
  Borrador --> Prueba[Probar en la arena]
  Prueba --> Publicar[Publicar para todos]
```

La IA define apariencia, saludo y nombres de movimientos. La física utiliza tres recetas existentes y equilibradas; no ejecuta código generado. El atlas debe tener transparencia, ocho poses completas, márgenes y orientación hacia la derecha. Un atlas inválido queda como trabajo fallido y puede volver a dibujarse al continuar. El diseño y los archivos ya completados se reutilizan. Tras un reinicio, los trabajos interrumpidos esperan que su dueño pulse **Continuar**, para evitar repetir automáticamente una petición de imagen con costo. No genera voces: mantiene las reacciones genéricas y efectos de combate del juego.

SQLite guarda cuentas, sesiones, propiedad, estados y definiciones. `ARENA_DATA_DIR` (por defecto `data/creator/`) contiene `arena.sqlite`, fotos privadas en `uploads/`, atlas y `character.json` por luchador en `characters/`, y el catálogo `community.json`. Esta carpeta está excluida de Git y del contexto Docker. Debe ser persistente y escribible; respalda la base y los archivos juntos. Las fotos solo las puede leer su dueño, también durante el desarrollo: el servidor bloquea las URLs directas de archivos privados. La carpeta de datos debe estar fuera de `public/` y `dist/`. Al eliminar un borrador se eliminan sus archivos; al retirar uno publicado desaparece del selector y se borran sus fotos, conservando el arte publicado para las peleas ya iniciadas.

Las contraseñas usan scrypt con sal individual y las sesiones usan cookies HttpOnly. El servidor comprueba propiedad en cada acción y limita creaciones a doce visibles y una activa por usuario. Es una implementación de un solo proceso: no incluye verificación por correo, recuperación de contraseña ni un servicio distribuido de trabajos.

El taller ejecuta dos generaciones a la vez y admite hasta doce trabajos entre ejecución, cola y subidas reservadas. Solo permite dos subidas simultáneas y reserva el cupo antes de leer archivos en memoria. Las peticiones que exceden capacidad reciben 503 con `Retry-After`; los límites diarios responden 429. Una subida tiene 30 segundos para completar su cuerpo y cada trabajo tiene un plazo total de 300 segundos. Los límites son configurables mediante `ARENA_CREATOR_CONCURRENCY`, `ARENA_CREATOR_CAPACITY`, `ARENA_CREATOR_UPLOADS`, `ARENA_CREATOR_UPLOAD_TIMEOUT_MS` y `ARENA_CREATOR_JOB_TIMEOUT_MS`, con valores enteros y unidades en milisegundos para los plazos.

SQLite conserva una cuota móvil de 24 horas: cincuenta intentos globales y seis por usuario por defecto (`ARENA_CREATOR_DAILY_ATTEMPTS` y `ARENA_CREATOR_USER_DAILY_ATTEMPTS`). Incluye reintentos y no se reinicia al eliminar personajes o reiniciar Node. La reserva y la escritura del trabajo son una transacción. Son límites de intentos, no un presupuesto monetario ni protección completa contra cuentas abusivas. No añadas réplicas: la cola y los cupos de ejecución/subida son locales al proceso.

Si falla también la escritura que registra un error de generación, el taller se detiene sin cerrar las partidas. `/api/creator/capabilities` pasa a indicar que no está disponible. Corrige el almacenamiento y reinicia el proceso para recuperarlo; supervisa ese endpoint y los registros además de `/api/health`, que indica disponibilidad de la arena. Una imagen completamente guardada se reutiliza aunque falle el registro de su ruta en SQLite. Un timeout no puede demostrar si el proveedor cobró una petición interrumpida, y el usuario decide si continúa.

`npm run test:creator` comprueba el grafo real con un proveedor determinista de prueba, autenticación, privacidad, reinicios, sprites y publicación por WebSocket. Estas pruebas no llaman a la API de generación ni validan la semejanza de una imagen producida por el modelo real.

`npm run test:adversarial` añade sobrecarga, peticiones simultáneas, entradas inválidas, errores de SQLite, resultados tardíos, recuperación de imágenes, coherencia del catálogo, aislamiento de salas y el adaptador OpenAI contra un servidor HTTP local. Los informes independientes de Luna con razonamiento extra alto están en `docs/adversarial-v31/`. El workflow `.github/workflows/ci.yml` ejecuta pruebas, validación de assets, compilación y un arranque HTTP del contenedor; no prueba cuentas reales de OpenAI, dispositivos físicos ni escalado distribuido.

Limitación pendiente de retención: retirar un personaje publicado elimina sus fotos y lo oculta de la selección, pero conserva su arte generado y permite descargarlo por su URL anterior indefinidamente. No existe todavía una purga de esos archivos. Supervisa el crecimiento del volumen y respalda la base y los archivos juntos; la cuota diaria limita el ritmo de creación, no el almacenamiento acumulado.

## Controles

| Acción              | Jugador 1 / en línea | Jugador 2 local |
| ------------------- | -------------------- | --------------- |
| Mover               | A / D                | ← / →           |
| Doble salto         | W                    | ↑               |
| Bajar de plataforma | S                    | ↓               |
| Golpe ligero        | J                    | 1               |
| Golpe fuerte        | K                    | 2               |
| Especial            | L                    | 3               |
| Bloquear            | Mantener U           | Mantener 0      |
| Esquivar            | Shift izquierdo      | Enter           |
| Definitiva          | I                    | 5               |
| Pausa / menú        | Esc                  | Esc             |

En móvil aparecen botones táctiles. También hay controles de mando estándar: stick, A, B, X, Y, LB, RB y RT. Los números del jugador 2 funcionan en la fila superior y en el teclado numérico.

Cada pelea tiene dos vidas por jugador y 90 segundos. El daño aumenta el empuje. Un especial cuesta 25 de energía; golpear y recibir golpes recarga la barra. Los combos se desbloquean por personaje: J → K desde el inicio, J → J → K con una victoria, definitiva I con tres victorias y 75 de energía. La secuencia se completa en 2,5 segundos, dejando terminar la recuperación de cada ataque.

El progreso se guarda en `localStorage`, en el navegador usado. No es una clasificación global ni una identidad verificada. El ranking global se deja pendiente. Las victorias de la CPU no desbloquean combos para el jugador.

## Producción

```bash
npm run build
npm start
```

`PORT` configura el puerto (5173 por defecto). Cliente, `/api/health`, `/api/rooms` y `/ws` se sirven desde el mismo origen. El alojamiento debe admitir un proceso Node persistente y conexiones WebSocket; un alojamiento exclusivamente estático no sirve las salas. Con HTTPS, el cliente usa automáticamente WSS.

También se incluye un Dockerfile:

```bash
docker build -t arena-criolla .
docker run --rm -p 5173:5173 --env-file .env -v arena-data:/app/data arena-criolla
```

Las salas viven en memoria, expiran por inactividad y se eliminan al quedar vacías. Reiniciar el servidor cierra las partidas existentes. Esta versión usa un único proceso; persiste cuentas y personajes en SQLite; no incluye ranking, espectadores, emparejamiento competitivo, rollback ni escalado entre instancias. La simulación de combate corre en el servidor a 60 Hz y envía estados a 30 Hz. Los resultados y movimientos se resuelven allí; los desbloqueos iniciales proceden del progreso local de cada invitado y no se consideran verificables para un futuro ranking.

Cada input identifica su partida: un paquete atrasado o la limpieza de controles de una pelea anterior no afectan la revancha. Si pasan un segundo sin inputs, el servidor suelta las direcciones, el bloqueo y la bajada, conservando los contadores de acciones. Admite ráfagas acotadas de hasta 360 mensajes por segundo; un exceso sostenido cierra la conexión con código 1008 en lugar de descartar silenciosamente la liberación de un control.

El cliente envía ping/pong de aplicación cada dos segundos. Tras ocho segundos sin respuesta, comprobados cada dos segundos mientras el navegador ejecuta sus temporizadores, retira la conexión y reintenta con espera creciente y variación aleatoria hasta diez segundos. No espera al cierre de un socket bloqueado; también retira conexiones cuya cola de salida supera 64 KiB. Al volver de una suspensión del navegador, prueba el enlace de nuevo antes de declararlo perdido. Reconectar permite volver a entrar en la sala; no reanuda el combate cancelado. Cliente y servidor deben actualizarse juntos porque el protocolo de inputs incluye el identificador de partida.

El resultado online se guarda al recibir el estado final, sin depender de un frame de dibujo, y se cuenta una sola vez por partida durante la sesión. La escritura lee el progreso local más reciente para conservar resultados guardados antes por otras pestañas; si el almacenamiento falla, la sesión sigue acumulando progreso en memoria. Esto sigue siendo progreso de navegador, sin sincronización por cuenta ni una transacción distribuida entre pestañas que escriban exactamente al mismo tiempo.

`npm exec -- tsx scripts/qa-network-benchmark.ts` mide localmente el eco autoritativo con 100 ms artificiales por dirección y la cadencia de cien salas con doscientas conexiones. Las fixtures `tests/browser/network*.html` se ejecutan con el servidor de desarrollo y T3 Preview. `scripts/qa-network-proxy.ts` permite cortar tráfico TCP local sin propagar FIN para verificar fallos de enlace silenciosos; no debe usarse como proxy de producción.

## Revisión individual del elenco v28

Se asignó un agente independiente a cada uno de los 41 luchadores existentes. Cada revisión conserva un informe y un archivo de pruebas propios en `docs/character-audits-v28/` y `tests/character-audits/`: caminar, saltar, golpes, especial frente a guardias, combos, ambas posiciones, una pelea completa contra CPU con reproducción determinista, ocho sprites y presentaciones en el navegador nativo.

La integración corrigió embestidas que atravesaban al rival sin pegar, frenado de avances, golpes terrestres sin contacto con el suelo, diferencias de empuje y ventanas de contraataque entre jugadores, las cuatro pisadas de Rummy, la emisión terrestre de María Lionza, el origen del doble de Gabriela y el alcance usado por la CPU para proyectiles que regresan. También aisló píxeles ajenos en recortes superpuestos, mejoró las poses de especiales, añadió el cuatro visible de Simón y retiró el libro flotante de Amanda. Óscar conserva su entrada aprobada v25 y Dudamel la v24; las entradas y gestos de selección siguen terminando una sola vez en guardia.

`npm run test:characters` ejecuta estas revisiones. Los informes originales registran lo observado durante cada auditoría; el índice `docs/character-audits-v28/index.json` registra las resoluciones centrales y la verificación final. Son comprobaciones funcionales y visuales del juego, no un estudio de balance competitivo ni una nueva verificación de la biografía de cada figura.

## Arte y assets

Las ilustraciones se generan con la herramienta integrada `image_gen.imagegen` a partir de fotografías reales para las figuras históricas y actuales, y de referencias culturales para las diez adaptaciones del folklore. Los quince personajes anteriores tienen investigación de un agente GPT-6-Luna con razonamiento alto; la sustitución actual asignó un agente a Vicente Zavarce y otro a Pedro Vallenilla. Cada dossier documenta identidad, ropa, gestos, fotos, clips, fuentes y límites de verificación. El elenco activo y sus atributos están en `shared/fighters.json`.

Los 41 atlas incluyen ocho poses cada uno: reposo, bloqueo, dos de carrera, salto, puño, patada y daño, 328 poses en total. El juego carga WebP con transparencia y geometría validada para alinear los pies y evitar recortar extremidades. Vicente Zavarce y Pedro Vallenilla usan atlas v5 nuevos basados en sus propias fotos. Javier conserva su atlas v2 revisado; los otros doce personajes usan atlas v3. Hay nueve escenarios: Altamira, La Guaira, Valencia, Salto Ángel, puente de Maracaibo, teleférico de Mérida, Médanos de Coro, Los Roques y Poliedro de Caracas. Los seis nuevos fondos usan pixel art a 540×320 y WebP sin pérdida. Los movimientos, las plataformas y el combate son ficción de juego.

El botón «Ver los 9 escenarios» abre el catálogo. Cinco escenarios nuevos tienen una plataforma móvil: la cabina de Mérida se desplaza lateralmente, el elevador del puente y la roca de Canaima suben y bajan, la tarima de Coro se desliza y la balsa de Los Roques se mece. Los jugadores viajan con ellas, pueden saltar o bajar pulsando S. El Poliedro ofrece un combate a ras del suelo. Cabinas, barcos, aves, niebla, nieve, arena y focos se animan en el fondo. La posición física de las plataformas se calcula a partir del tick compartido por cliente y servidor.

Los originales generados de los escenarios están en `assets/references/stages-v4/`, las versiones para el juego en `assets/source/` y `public/assets/`, y los prompts y fuentes en `docs/stage-prompts-v4.json` y `docs/stage-art-v4.json`.

- Referencias reales: `assets/references/`.
- Atlas PNG: `assets/source/`; WebP del juego: `public/assets/`.
- Investigación y prompts actuales: `docs/characters-v3/` y `docs/characters-v5/`.
- Manifiesto de identidad: `docs/character-manifest.json`.
- Comparación de fotos y modelos: `docs/character-preview.html`.
- Validación de transparencia y ocho poses: `docs/character-sprite-qa.json`.
- Comprobación actual en navegador, combate, audio y salas: `docs/character-runtime-qa-v5.json`.
- Registro de los 15 agentes Luna con razonamiento alto: `docs/character-agents-v5.json`.
- Procedencia, tiempos y SHA-256 de cada audio: `docs/audio-provenance.json`.
- Archivo histórico de las voces retiradas: `assets/archive/v8-original-voices/` y `assets/archive/v2-voices/`, fuera del contenido servido por el juego.
- Galería animada de los seis escenarios nuevos y muestras de golpes: `docs/stages-preview-v4.html`.
- Comprobación de escenarios, plataformas, catálogo, sonido y combate: `docs/stage-runtime-qa-v4.json`.

`npm run assets` prepara únicamente los atlas y escenarios activos. `npm run check:assets` comprueba ocho siluetas completas, cuatro por fila, transparencia, bordes y paridad PNG/WebP. Para validar un personaje durante su preparación: `node scripts/validate-character-assets.mjs --sprite simon-v3`.

Vicente ejecuta una embestida de reparto rápida con «Entrega exprés»; Pedro lanza tres tarjetas separadas con «Tres cuotas». Ambos conservan combos y desbloqueos propios. John Acquaviva y Kilómetro están retirados del elenco y sus archivos servidos se conservaron en `assets/archive/v5-retired/`.

Los especiales tienen reglas diferentes: dos pulsos de Renny, pisada terrestre de Gómez, abanico de notas de Simón, embestida del Conde, golpe en dos tiempos de Emilio, foco de Maite, giro aéreo de Óscar, cono de empuje del Puma, señal de regreso de Chataing, remate con pausa de George y avance con salto de María Corina. Estas reglas se comparten entre partidas locales y servidor.

## Sonido de combate

Los 41 personajes están sin diálogos ni grabaciones de las personas reales. La selección, los especiales y las victorias ya no reproducen sus frases. Los audios anteriores y su investigación se conservan en `assets/archive/v8-original-voices/` y no se incluyen en la aplicación publicada.

El combate usa 18 reacciones genéricas y breves de esfuerzo y dolor: tres variantes al saltar, atacar y recibir daño, con dos bancos de intérpretes ajenos a las personas del elenco. Proceden de [qubodup](https://opengameart.org/content/15-vocal-male-strainhurtpainjump-sounds) y [cicifyre](https://opengameart.org/content/female-rpg-voice-starter-pack), publicados como CC0. Se incluyen únicamente vocalizaciones no verbales. Los archivos locales `public/audio/arcade/` pesan unos 90 KB en total y se precargan al preparar una pelea.

Las reacciones siguen los eventos reales del motor en partidas locales y multijugador: esfuerzo para quien salta o ataca, dolor para quien recibe daño. Cada jugador tiene su canal y límite de frecuencia; el dolor tiene prioridad sobre su esfuerzo. Los bloqueos mantienen su efecto metálico sin grito de dolor. Las reacciones tienen posición estéreo, volumen ajustado y variantes sin repetición inmediata. Se cancelan al pausar, silenciar o salir, y se descartan las descargas tardías para evitar sonidos fuera de tiempo. El botón de sonido controla todos los efectos y guarda la preferencia.

Golpes, bloqueos, barridos, saltos, aterrizajes, victorias y efectos propios de cada especial se generan con Web Audio. No se baja su volumen para reproducir una frase. Las fuentes, licencias, archivos originales seleccionados, duraciones y SHA-256 están en `docs/audio-provenance.json`. Para preparar los MP3 desde los originales preservados: `python3 scripts/prepare-reaction-audio.py --ffmpeg /ruta/a/ffmpeg`.

Los impactos combinan un golpe grave, cuerpo y un chasquido corto, con más peso en ataques fuertes y definitivas. El audio de golpes y bloqueos se sitúa a izquierda o derecha según la posición en la arena. Hay barridos al lanzar un ataque, sonido al aterrizar y ambiente suave propio del escenario. Chispas, explosiones dibujadas, ondas, trazos de puño y patada y sacudida de cámara acompañan los golpes. La pausa de impacto dura entre tres y siete fotogramas, mantiene inmóviles las plataformas y deja avanzar el reloj. El ambiente se detiene al salir de la partida y se silencia durante la pausa.

## Verificación

Las grabaciones históricas `docs/videos/vicente-vs-pedro-v7.mp4` y `docs/videos/simon-vs-conde-merida-v4.mp4` conservan el audio de sus versiones anteriores; no representan el sonido actual. En la grabación v4, Simón y el Conde pelean en Mérida. El audio se capturó directamente de la mezcla Web Audio durante la partida e incluye golpes, bloqueos, ambiente y el fragmento original de Simón que se reprodujo. El JSON contiguo documenta la captura, la sincronización y la procedencia. Las muestras separadas de golpe ligero, fuerte y bloqueo están en `docs/sfx-preview/`.

La demostración anterior se conserva en `docs/videos/maite-vs-george-v3.mp4`. Esa versión mezclaba los recortes originales en los tiempos observados, sin los efectos procedurales.

```bash
npm test
npm run check:assets
npm run build
```

Las pruebas cubren daño, bloqueo, doble salto, caídas, proyectiles, los 41 especiales, desbloqueos, desempate y determinismo. También verifican notas en abanico, retorno de señal, evasión de la pisada con salto, segundo golpe y archivos de audio con procedencia. La integración abre clientes WebSocket reales y comprueba creación, invitación, capacidad, permisos de escenario, inicio sincronizado, movimientos, validación de entradas, resultado, revancha, desconexión y salas privadas.

Las pruebas incluyen las dieciséis incorporaciones culturales v15, devolución de proyectiles, contraataques, trampas, crecimiento de burbujas, pasos de baile y su sincronización en salas. También cubren los diez luchadores del folklore, sus habilidades, y los especiales de Vicente y Pedro, la aceptación de Vicente y Pedro en salas y el rechazo de John y Kilómetro, los nueve escenarios, la posición determinista de las plataformas, aterrizaje sobre cada plataforma móvil, transporte horizontal y vertical, salto, descenso y pausa de impacto. El catálogo se comprobó a 390 px sin desbordamiento; los seis fondos nuevos se cargan y animan. Las capturas de audio verifican señal en los impactos, silencio al desactivar el sonido y margen en la salida final. En navegador se cargaron las ocho poses de cada personaje. La verificación v8 comprobó Vicente–Pedro en local y Maite–Pedro en una sala privada real, las reacciones de salto, ataque y daño de ambos bancos, bloqueos sin grito de dolor, pausa, silencio, reactivación y salida. Se cargaron los 18 MP3 genéricos con HTTP 200 y no se solicitó ninguna grabación original. El informe está en `docs/audio-runtime-qa-v8.json`.

## Interfaz arcade

Las entradas v24 se reproducen una sola vez. Los 41 personajes hacen una única acción característica, sin alternar repetidamente las poses o los brazos, y quedan en guardia. El gesto de selección también termina y permanece quieto; la vista de prueba solo se reinicia al pulsar «Reproducir entradas» o cambiar de personaje. Óscar usa la entrada v25: saca el micrófono, canta de forma teatral y completa una sola vuelta de salsa con vistas de frente, perfil y espalda; Dudamel abre ambos brazos, levanta la batuta y marca un solo golpe de dirección. Ambos tienen atlas específicos de doce poses, generados con `image_gen`, separados del arte de combate. Los assets, prompts y preparación están en `docs/entrances-v24/`; el visor es `preview.html`. Las 74 pruebas incluyen que la selección no se reinicie y que cada gesto tenga una sola preparación y un solo cierre.

Las entradas v23 tienen coreografías corporales individuales para los 41 personajes: cabeza, torso, brazos y ropa se animan con acentos propios. Cada actor dispone de tres segundos de pantalla, con 2,8 segundos de gesto, y vuelve a su guardia mirando al rival antes del conteo. La selección reproduce una versión más suave del mismo movimiento. Rostros, sombreros e instrumentos pintados se protegen de deformaciones; ocho personajes con gestos amplios tienen un encuadre específico. La revisión independiente de identidad, las ocho poses por personaje y los gestos observados o adaptados se documentan en `docs/entrances-v23/character-review.json`.

`docs/entrances-v23/preview.html` permite reproducir las nuevas entradas de cualquier pareja con el renderizador real. `runtime-qa.json` recoge los controles de renderizado, encuadre, guardia y movimiento reducido de los 41; `final-visual-review.json` registra las 164 muestras inspeccionadas individualmente por el agente independiente. `dudamel-oscar.mp4` muestra las dos entradas y el paso al combate en una partida local real. Las 71 pruebas actuales incluyen movimiento corporal visible, orientación de la malla y rigidez de instrumentos, además de las pruebas existentes de combate, salas y presentaciones.

Capriles v22 corrige el parecido facial desde fotografías nítidas frontal, oblicua y lateral. Las ocho poses parten de un retrato grande con anatomía menos caricaturizada; dos hojas de cuatro poses se aíslan por silueta y se empaquetan a 3072×1536. `docs/characters-v22` contiene las referencias documentadas, prompts finales, comparación visual y validación. El atlas se conserva en WebP sin pérdida para mantener el detalle del rostro.

Capriles v21 adopta la referencia casual del usuario: gorra tricolor con estrellas, camisa gris de mangas recogidas, jeans y tenis blancos, sin lentes. Sus ocho poses se usan en portada, selección, cinemática y combate. El dossier `docs/characters-v21/capriles.json` separa esa elección visual de los videos de septiembre de 2026, con fechas y fotogramas inspeccionados; el post oficial del 24 de septiembre muestra gorra gris, chemise y lentes. La hoja PNG y su WebP sin pérdida conservan el mismo alfa y las ocho direcciones auditadas.

La entrada v20 usa una cinemática con pantalla dividida y primeros planos de ambos rivales. Cada personaje ejecuta su gesto en su propio panel y el encuadre sigue la cabeza por pose, respetando su orientación y sus accesorios. Los fondos son luces de color y detalles arcade; el escenario y las barras de vida aparecen al terminar la cinemática, con la cuenta regresiva. El control para saltarla queda en la barra superior para que no tape las caras. La cámara sigue los saltos y respeta movimiento reducido. Se reutilizan las referencias y coreografías individuales v19 para los 41 personajes.

La revisión v19 añade una presentación de bienvenida y un gesto de selección individuales para los 41 luchadores. Las referencias y la auditoría de las ocho poses de cada atlas están en `docs/entrances-v19/research.json` (103 fuentes). Las fichas distinguen los gestos observados de las adaptaciones arcade; las leyendas se apoyan en sus relatos tradicionales. Las coreografías reutilizan las poses existentes con movimientos, accesorios y efectos propios, definidos en `shared/presentations.json`.

En v19 cada luchador presentaba durante un máximo de 2,2 segundos y terminaba en su guardia mirando al oponente. Después comienza la cuenta de 3, 2, 1 y «¡DALE!». «Saltar presentaciones», Espacio o esquivar permiten pasar al conteo; en línea, cualquiera de los dos jugadores puede saltar para ambos. La simulación consume los ataques pulsados durante la introducción y conserva los 90 segundos y la salud. Se corrigió la orientación de las poses invertidas de Emilio Lovera y George Harris, incluyendo salto e inactividad. Los sonidos de entrada y de conteo son sintetizados; se mantienen los efectos y reacciones genéricas, sin grabaciones de las personas reales.

En selección solo animan las dos figuras elegidas; sus gestos se repiten con una pausa y se detienen al salir de pantalla o al ocultar la pestaña. Movimiento reducido muestra la guardia sin desplazamientos ni efectos. `docs/entrances-v19/preview.html` permite revisar los 41 personajes, las dos orientaciones, las coreografías y sus fuentes usando el renderizador real; abrirla con el servidor de desarrollo. Las pruebas de entrada, bloqueo de acciones, salto y orientación están en `tests/presentation.test.ts`; las comprobaciones de navegador se documentan en `docs/entrances-v19/runtime-qa.json`.

La interfaz actual v18 recupera la composición azul nocturna de la captura v13: portada de Renny contra Capriles, títulos condensados, figuras a los lados de la colección, placas inclinadas, vidas decorativas y botón amarillo con relieve. El escenario seleccionado aparece como fondo del gabinete. Se conserva el elenco actual de 41 personajes, incluyendo Giuseppe, con las colecciones Todos (41), Cultura (31) y Leyendas (10), y páginas de diez personajes.

Los nueve escenarios vuelven a estar visibles en una franja. Elegir una miniatura cambia el fondo y el escenario de la pelea; las flechas, Home, End y Enter permiten recorrerlos con teclado. El anfitrión sincroniza el escenario con su invitado, que lo ve bloqueado. La preparación recupera los botones Suave, Normal y Candela, junto al apodo y «¡A DARLE!». En móvil, la colección usa tres columnas, la franja de escenarios se desplaza horizontalmente y «Preparar» lleva hasta los ajustes. Se conservan búsqueda, filtros, azar, movimientos, logros y salas anónimas, y se respeta movimiento reducido.

`docs/ui-qa-v18.json` recoge la revisión en navegador integrado y las comprobaciones finales con Chromium aislado tras perderse la conexión del navegador integrado. Se verificaron ocho tamaños entre 320 y 1440 px sin desbordamiento ni nombres recortados; el inicio queda visible en 1024×800, 1280×800 y 1440×900. Se comprobaron CPU, dos jugadores locales y una sala privada con dos clientes, incluyendo sincronización y bloqueo del escenario. La compilación pasa. Las capturas están en `docs/screenshots/restored-night-arcade-desktop-v18.png`, `docs/screenshots/restored-night-arcade-mobile-v18.png` y `docs/screenshots/restored-night-arcade-prepare-v18.png`.

La revisión v17 usaba fondo claro, márgenes más amplios, ocho tarjetas por página y una tarjeta de escenario que abría el catálogo con «Cambiar». Su comprobación está en `docs/ui-qa-v17.json` y sus capturas en `docs/screenshots/airy-arcade-*-v17.png`.

La revisión v16 usaba la dirección «Festival arcade», con fondo de puntos, diez tarjetas por página, nueve postales de escenarios a la vista y botones con relieve. Su comprobación está en `docs/ui-qa-v16.json` y sus capturas en `docs/screenshots/festival-arcade-*-v16.png`.

La revisión v13 utilizaba Barlow Condensed en los títulos y un gabinete azul nocturno. `docs/ui-qa-v13.json` documenta sus tamaños de pantalla, búsqueda, paginación, selección, teclado, mapa móvil, CPU, dos jugadores y creación/salida de una sala privada. Las capturas v13 están en `docs/screenshots/night-arcade-desktop-v13.png` y `docs/screenshots/night-arcade-mobile-v13.png`.

La revisión v14 reforzó los colores amarillo, azul y rojo en la cabecera, la portada, los modos y los marcos. CPU usa amarillo, local azul y salas rojo. Recuperó el cuatro y el turpial bajo las ocho estrellas, la arepa y el araguaney en la selección y el cuatro en la preparación. Los patrones SVG de flores de araguaney y cuatro cuerdas son dibujos originales decorativos, sin atribución a un tejido tradicional. Se comprobaron nueve tamaños entre 320 y 1440 px, contraste de los modos, fondos de escenarios, identificadores SVG únicos y acceso móvil a los ajustes; la compilación y el formato pasan. El informe está en `docs/ui-qa-v14.json` y las capturas de esa revisión en `docs/screenshots/venezuela-desktop-v14.png` y `docs/screenshots/venezuela-mobile-v14.png`.

Las revisiones anteriores se conservan para comparación: `docs/ui-qa-v9.json` documenta 11 tamaños y 15 comprobaciones de flujos; sus capturas están en `docs/screenshots/arcade-desktop-v9.png` y `docs/screenshots/arcade-mobile-v9.png`.

La identidad venezolana v10 añade azul nocturno, franjas amarillo/azul/rojo, ocho estrellas y ornamentos SVG originales de arepa, cuatro, turpial y araguaney. Los modos seleccionados usan amarillo para CPU, azul para local y coral para salas; P1 y el rival conservan sus colores menta/coral. Los adornos no son controles y están ocultos para lectores de pantalla. Se comprobó la selección en siete anchuras de 320 a 1440 px, sin desbordamientos ni nombres recortados; el inicio permanece visible a 1024×800 y 1280×800. Las 28 pruebas y la compilación pasan. `docs/ui-qa-v10.json` y las capturas `docs/screenshots/arcade-venezuela-desktop-v10.png` y `docs/screenshots/arcade-venezuela-mobile-v10.png` documentan esta revisión.

La revisión v11 hace protagonista al tricolor en la composición completa. Se verificaron diez tamaños de pantalla de 320 a 1440 px sin desbordamiento ni nombres recortados; selección de rival, fondos compartidos, inicio con CPU y dos jugadores, ventana de salas, mapa móvil y acceso a la preparación. En 1280×800 se ven los 15 personajes, los nueve escenarios y el botón de jugar. Los detalles están en `docs/ui-qa-v11.json`; las capturas de esa revisión son `docs/screenshots/arcade-tricolor-desktop-v11.png` y `docs/screenshots/arcade-tricolor-mobile-v11.png`.

## Elenco de leyendas v12

Los diez luchadores nuevos usan atlas originales v12 generados con la herramienta integrada `image_gen.imagegen`. Las fuentes culturales y las diferencias respecto de la tradición se documentan en `docs/folklore-v12/research.json`; prompts y archivos generados están en `docs/folklore-v12/`. La Llorona también pertenece al folklore de otros países latinoamericanos. Knoche es un personaje histórico de Galipán, incluido aquí por su presencia en el imaginario local. Vestuario y poderes son interpretaciones arcade.

En la revisión v12, el selector tenía las colecciones Todos (25), Cultura (15) y Leyendas (10), búsqueda y páginas de diez personajes. Todas las figuras funcionan en local, CPU y salas anónimas. Los especiales tienen efectos visuales y sonidos propios, sin voces reales ni diálogos:

| Luchador                | Especial           | Comportamiento                                                       |
| ----------------------- | ------------------ | -------------------------------------------------------------------- |
| El Silbón               | Silbido errante    | Ondula y acelera hasta un límite.                                    |
| La Llorona              | Marea en pena      | Atrae al rival si no bloquea.                                        |
| La Sayona               | Paso espectral     | Desplazamiento instantáneo corto y golpe.                            |
| María Lionza            | Danta de Sorte     | Espíritu terrestre pesado; se evita saltando.                        |
| Florentino              | Copla certera      | Nota que sigue la altura del rival.                                  |
| El Diablo de los Llanos | Fogonazo del llano | Fuego en parábola con explosión al caer.                             |
| Doctor Knoche           | Frasco de Galipán  | Ralentización temporal; bloquear la evita.                           |
| El Momoy                | Raíces del páramo  | Atrapa los pies; saltar rompe las raíces tras recuperarse del golpe. |
| Tío Tigre               | Salto de tigre     | Salto ofensivo con dos zarpazos y frenado.                           |
| Tío Conejo              | Brinco tramposo    | Salto hacia atrás y zanahoria con un rebote.                         |

Las alteraciones de velocidad, raíces, proyectiles y plataformas se calculan en la simulación compartida. Sus combinaciones se comprueban en `tests/folklore.test.ts`, incluyendo bloqueo, escape, daño único y consistencia tras serialización de red.

La verificación de esa revisión está en `docs/character-runtime-qa-v12.json`. Se comprobaron CPU (El Silbón contra La Llorona), local (Tío Tigre contra Tío Conejo), y una sala anónima de Knoche contra Momoy con ralentización sincronizada en ambos clientes. El selector funciona entre 320 y 1440 px; el progreso y las preferencias existentes se conservaron. La galería interactiva de las 80 poses nuevas está en `docs/folklore-v12/preview.html`; las capturas de selección y combate están en `docs/screenshots/folklore-*-v12.png`.

## Cultura y farándula v15

Dieciséis figuras nuevas elevan el elenco a 41: 31 en Cultura y diez en Leyendas. Cada una tiene una revisión individual de identidad, trayectoria y fotografía inspeccionada en `docs/culture-v15/characters/`. Las fuentes y decisiones de vestuario están en `docs/culture-v15/research.json`; se distinguen los rasgos observados de las adaptaciones de combate. Los retratos de referencia se conservan fuera de los assets públicos.

Los dieciséis atlas transparentes originales, de ocho poses cada uno, se generaron con `image_gen.imagegen` a partir del retrato de cada persona y una referencia del estilo existente. Los prompts y archivos producidos están en `docs/culture-v15/`. PNG y WebP tienen ocho siluetas completas y límites idénticos; `npm run check:assets` valida los 41 personajes. La galería interactiva de las 128 poses nuevas es `docs/culture-v15/preview.html`, regenerable con `node scripts/build-culture-preview.mjs`.

| Personaje            | Especial                  | Comportamiento                                                  |
| -------------------- | ------------------------- | --------------------------------------------------------------- |
| Alí Primera          | Rasgueo del pueblo        | Tres ondas rasantes separadas; saltar las evita.                |
| Gualberto Ibarreto   | Tremolo oriental          | Dos notas se separan y vuelven.                                 |
| Reynaldo Armas       | Lazo sabanero             | Atrae y ralentiza brevemente; bloquear lo evita.                |
| Gustavo Dudamel      | Cadenza de rebote         | Devuelve proyectiles frontales durante un compás defensivo.     |
| Danny Ocean          | Onda Reflexa              | Burbuja lenta que crece hasta un límite.                        |
| Nacho                | Paso sincopado            | Avance, retroceso y remate hacia delante.                       |
| Daniel Sarcos        | Premio sensacional        | Premio que rebota dos veces y explota al terminar.              |
| Yordano              | Manantial en tres tiempos | Tres gotas en parábolas a distinto tiempo.                      |
| Lila Morillo         | Abanico del cocotero      | Cinco hojas de luz cubren trayectorias distintas.               |
| Rummy Olivo          | Zapateo llanero           | Cuatro pisadas con avance y empuje final.                       |
| Chiquinquirá Delgado | Pasarela relámpago        | Avance muy rápido con frenado corto.                            |
| Norkys Batista       | Pivote de escena          | Salto hacia atrás con dos golpes circulares.                    |
| Gabriela Spanic      | Doble de novela           | Segundo golpe desde una silueta detrás del rival.               |
| Amanda Gutiérrez     | Telón de respuesta        | Contraataque a un golpe frontal durante una ventana breve.      |
| Lele Pons            | Broma resbalosa           | Cáscara que se planta y se activa tras una demora.              |
| Giuseppe Gangi       | Ráfaga de datos           | Tres paquetes digitales que oscilan y aceleran hasta un límite. |

Cada incorporación tiene tres nombres de combo y un efecto sonoro procedural propio, sin voces reales, imitaciones ni fragmentos de canciones. Conservan las reacciones genéricas de salto, esfuerzo y dolor. La lógica nueva vive en `shared/culture-techniques.ts` y el motor compartido; los efectos están en `src/game/culture-renderer.ts` y `src/game/culture-sounds.ts`. La CPU detecta amenazas para usar la batuta o el contraataque.

Las 63 pruebas cubren los especiales nuevos, sus formas de bloqueo o evasión, la física finita de los 41 luchadores y el determinismo tras serialización. Una prueba con dos clientes WebSocket reales comprueba que ambos reciben el mismo estado cuando Dudamel devuelve la trampa lanzada por Lele. No se requiere login.

La comprobación actual del catálogo de 41 está en `docs/culture-v15/runtime-qa.json`: selección de las dieciséis figuras, búsqueda sin acentos, ocho tamaños de pantalla, carga de 41 sprites, renderizado de especiales, Giuseppe en local y sincronización por WebSocket. Las capturas de selección y combate están en `docs/screenshots/culture-*-v15.png`.

## Móvil horizontal v30

La pelea utiliza toda la pantalla disponible en teléfonos y tablets táctiles. Los diez controles tienen iconos, nombres y objetivos de al menos 44 px; permiten mover, bajar de plataformas, saltar, esquivar, bloquear y combinar ataques con varios dedos. Pausar, girar, cambiar de aplicación o perder la captura libera los controles. Los ordenadores con pantalla táctil y ratón conservan la vista de teclado.

Al iniciar se solicita pantalla completa y orientación horizontal cuando el navegador lo permite. Si no permite bloquear la orientación, basta girar el dispositivo: CPU y local esperan en vertical; en línea, la pelea continúa y se indica en pantalla. La pantalla completa incluye los controles y la ayuda. El manifest declara la preferencia horizontal para los navegadores que la respeten al lanzar la aplicación.

Se comprobaron toques reales del navegador mediante emulación móvil de Chromium, una sala privada con dos clientes WebSocket, las diez acciones, cancelación de gestos, rotación, pausa, ayuda, pantalla completa, resultado y revancha. No se usó un teléfono físico. La evidencia está en [docs/mobile-v30](docs/mobile-v30/); `tests/controls.test.ts` y `tests/mobile.test.ts` comprueban fuentes simultáneas y las alternativas de orientación.

La revisión v32 extiende el escenario hasta los cuatro bordes del teléfono, sin marco ni una fila reservada para la barra superior. Vida, reloj y controles flotan sobre la escena; ayuda y pantalla completa aparecen al pausar. El canvas adapta su proporción al dispositivo y amplía el paisaje, conservando la arena completa y las proporciones de los luchadores. Los controles respetan las zonas seguras de la pantalla y mantienen un tamaño mínimo de 44 px. El manifest solicita modo de pantalla completa al instalar la aplicación donde esté disponible. Las comprobaciones de viewport, rotación y entrada sintética están en `docs/mobile-v32/`; `tests/viewport.test.ts` verifica el encuadre sin recortar plataformas ni deformar personajes.

La revisión v33 amplía los botones de combate y las utilidades móviles a un mínimo de 48 píxeles CSS, con 8 px entre controles y feedback que conserva el área táctil. Cada dedo mantiene una entrada independiente; las direcciones permiten deslizar y reentrar sin levantarlo. Soltar fuera del botón, cancelar, perder foco o desmontar la vista libera las entradas incluso si falla la captura del puntero. Enter/Espacio y los clics de tecnologías de asistencia también activan los controles sin duplicar ataques. La investigación, fuentes, captura y 27 comprobaciones independientes del componente están en [docs/mobile-controls-v33](docs/mobile-controls-v33/README.md); la suite completa pasa 545 pruebas. La comprobación del navegador usa eventos sintéticos y no sustituye una prueba en un teléfono físico.
