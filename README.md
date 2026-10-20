# Arena Criolla

Una pelea entre panas, con personajes y escenarios de Venezuela. Arena Criolla es un juego de combate para el navegador: elige entre 52 luchadores, desde Simón Díaz y Maite Delgado hasta El Silbón y La Sayona, y pelea en nueve escenarios inspirados en lugares como Caracas, Los Roques y el Salto Ángel.

Puedes jugar contra la computadora, compartir teclado o mandos con un pana, o invitar a alguien a una sala en línea. El juego está en español y puedes entrar sin crear una cuenta.

[Jugar Arena Criolla](https://arena.kevinbravo.com/)

## Tu primera pelea

1. Escribe tu apodo y elige un personaje. Puedes buscarlo por nombre o explorar las colecciones.
2. Escoge un escenario y un modo de juego.
3. Entra a la arena. Combina golpes, bloqueos y especiales; usa el doble salto para moverte entre plataformas y volver al suelo cuando te empujen.

Cada jugador tiene dos vidas y la pelea dura 90 segundos. Pierdes una vida si se agota tu salud o caes fuera del escenario. Cuanto más daño recibes, más lejos te empujan los golpes. Gana quien deje al rival sin vidas; si termina el tiempo, se comparan las vidas y la salud restantes.

Cada personaje tiene su propio especial. Usarlo cuesta 25 de energía, que recuperas al golpear y recibir golpes. El progreso se guarda en ese navegador, por personaje: empiezas con el combo ligero → fuerte, desbloqueas ligero → ligero → fuerte con una victoria y la definitiva con tres victorias. La definitiva necesita 75 de energía.

## Modos de juego

- **Pelea rápida:** enfréntate a la CPU en dificultad fácil, normal o difícil.
- **Con un pana:** dos jugadores en el mismo equipo, con teclado o dos mandos.
- **En línea:** crea una sala pública o privada y comparte la invitación. Cuando ambos marquen «Estoy listo», comienza la pelea. Cada persona usa los controles del jugador 1 en su dispositivo.

## Controles

| Acción                  | Jugador 1 / en línea | Jugador 2 local |
| ----------------------- | -------------------- | --------------- |
| Moverse                 | A / D                | ← / →           |
| Saltar / doble salto    | W                    | ↑               |
| Bajar de una plataforma | S                    | ↓               |
| Golpe ligero            | J                    | 1               |
| Golpe fuerte            | K                    | 2               |
| Especial                | L                    | 3               |
| Bloquear                | Mantener U           | Mantener 0      |
| Esquivar                | Shift izquierdo      | Enter           |
| Definitiva              | I                    | 5               |
| Pausa / menú            | Esc                  | Esc             |

Los números del jugador 2 funcionan en la fila superior y en el teclado numérico; en este último, el punto decimal también permite esquivar. En línea, el menú permite salir de la pelea, pero no detiene la partida.

En móvil aparecen controles táctiles. Gira el teléfono para jugar en horizontal. También puedes usar mandos estándar: stick o cruceta para moverte, A para saltar, X para golpe ligero, B para golpe fuerte, Y para especial, LB para bloquear, RB para esquivar y RT para la definitiva.

## Ejecutarlo en tu equipo

Necesitas Node.js 24 o posterior y npm. El repositorio incluye las imágenes, los sonidos y las fuentes necesarios para jugar.

```bash
git clone https://github.com/0bkevin/arena-criolla.git
cd arena-criolla
npm ci
npm run dev
```

Abre [localhost:5173](http://localhost:5173). Para jugar desde otro dispositivo conectado a la misma red, abre `http://IP-DEL-EQUIPO:5173`. Todos deben conectarse al mismo servidor para compartir salas.

Puedes configurar el puerto y otras opciones copiando `.env.example` a `.env`. Para jugar localmente no necesitas claves de API. El taller público de creación de personajes está desactivado; las herramientas privadas de arte tienen su [propia guía](docs/creator-codex.md).

## Desarrollo

El cliente usa React, TypeScript y Canvas; el servidor usa Node.js, Express y WebSocket. Las reglas de combate son compartidas por las partidas locales y el servidor.

- `src/`: interfaz, controles, dibujo y sonido.
- `shared/`: motor de combate, personajes, escenarios y geometría de los sprites.
- `server/`: servidor HTTP, salas y partidas en línea.
- `public/`: archivos que carga el navegador.
- `assets/`: originales del arte activo y procedencia del audio.
- `tests/`: pruebas del combate, controles, servidor y herramientas.
- `scripts/` y `deploy/`: preparación de assets, comprobaciones y despliegue.

```bash
npm test                  # Pruebas del juego y del servidor
npm run check:assets      # Valida los atlas y actualiza su geometría en shared/
npm run build             # Comprueba TypeScript y compila el cliente
```

`npm run assets` convierte los PNG activos de `assets/source/` a WebP. Si cambias un atlas de personaje, ejecuta después `npm run check:assets` para actualizar sus coordenadas. `npm run assets:og` regenera la imagen para compartir enlaces. Las comprobaciones de rendimiento están en `npm run perf:engine` y `npm run perf:network`; esta última levanta un servidor temporal en tu equipo.

Para comprobar el navegador, ejecuta `npm run dev` y pega en su consola el contenido de `scripts/performance-browser.js`: mide el dibujo de todos los luchadores durante la entrada, la pelea y la victoria. `scripts/pvp-visibility-regression.js` se ejecuta durante una pelea en línea de prueba y comprueba que ocultar la pestaña libera el bloqueo de un mando simulado. Ambos devuelven los resultados en la consola.

## Publicarlo en un servidor

```bash
npm ci
npm run build
npm start
```

`PORT` vale `5173` por defecto. Configura `ARENA_PUBLIC_URL` con el origen público, por ejemplo `https://arena.example`. El servidor ofrece el cliente, las API y `/ws` desde el mismo origen; el alojamiento debe admitir un proceso Node persistente y conexiones WebSocket. Detrás de HTTPS se usa WSS automáticamente.

También puedes ejecutarlo con Docker:

```bash
docker build -t arena-criolla .
docker run --rm -p 5173:5173 -v arena-data:/app/data arena-criolla
```

En `deploy/` están las configuraciones de producción y pruebas, el proxy Caddy y las copias de seguridad. Para el despliegue existente, `production.compose.yaml` lee la configuración de `/etc/arena-criolla/server.env`; `ARENA_IMAGE` selecciona la imagen y `ARENA_DATA_PATH` la carpeta persistente. Los archivos de Compose publican el puerto en la interfaz local para usarlo detrás del proxy. Configura `ARENA_TRUST_PROXY` según tu red si adaptas el despliegue.

Antes de arrancar con Compose, crea la carpeta de datos del host con dueño `1000:1000` y permisos `700`: el contenedor usa ese usuario y necesita escribir SQLite incluso con el taller desactivado. En producción corresponde a `ARENA_DATA_PATH` (por defecto `/workspace/arena-criolla-production/data`); en pruebas, a `/var/lib/arena-criolla-prod-tst`.

Las salas viven en memoria: reiniciar el servidor cierra las partidas. Ejecuta una sola instancia del servidor. Conserva el volumen de datos y respáldalo si utilizas las herramientas de personajes; el script de copias de seguridad y su temporizador están en `deploy/`.

El [mantenimiento pendiente del alojamiento existente](deploy/maintenance.md) conserva las tareas del proxy compartido y del sistema que requieren coordinación con los otros servicios.

## Licencias

El código y los materiales originales se distribuyen bajo [GPL-3.0-only](LICENSE). Los sonidos de terceros conservan CC0 y las fuentes, SIL Open Font License. Las atribuciones están en [ASSET-LICENSES.txt](ASSET-LICENSES.txt).

Los personajes, poderes y combates son interpretaciones ficticias para el juego. Los sonidos de combate son reacciones genéricas, sin grabaciones de las voces de las personas representadas.
