# Desarrollo

## Puesta en marcha

Requiere Node.js 24 o posterior.

```sh
npm ci
npm run dev
```

`npm run dev` arranca el servidor en <http://localhost:5173> con recarga en caliente del cliente y reinicio del servidor al guardar.

## Estructura

La interfaz usa React y TypeScript, la pelea se dibuja en Canvas 2D y el servidor es Node.js con Express y WebSocket. El motor de combate y la lógica de salas están en `shared/` y se ejecutan igual en el navegador, en el servidor Node y en el Worker de Cloudflare.

```text
src/
  app/          Shell de la aplicación, red, progreso y estado del lobby
  components/   Interfaz: lobby, combate, ayuda y piezas comunes
  game/         Renderizado, audio, controles, cámara, assets y coreografías
  styles/       Hojas de estilo globales
shared/         Código común del navegador y los servidores
  engine/       Motor de combate y definitivas
  roster/       Luchadores y escenarios
  lobby/        Salas, protocolo y bucle autoritativo de partida
server/         Servidor Node: HTTP, WebSocket y entrega de assets
cloudflare/     Worker y Durable Object
public/         Imágenes, sonidos y fuentes publicados
scripts/        Herramientas de assets, CI, Cloudflare y rendimiento
tests/          Pruebas automáticas y fixtures manuales
e2e/            Pruebas de diseño con Playwright
deploy/         Scripts del despliegue Docker anterior
```

## Comandos

| Comando                | Qué hace                                                      |
| ---------------------- | ------------------------------------------------------------- |
| `npm run dev`          | Servidor de desarrollo.                                       |
| `npm test`             | Todas las pruebas automáticas.                                |
| `npm run test:ui`      | Pruebas de diseño en Chromium (ver [testing.md](testing.md)). |
| `npm run typecheck`    | Comprobación de tipos.                                        |
| `npm run format`       | Formatea con Prettier.                                        |
| `npm run check:assets` | Valida los sprites publicados.                                |
| `npm run build`        | Tipos y compilación del cliente en `dist/`.                   |
| `npm start`            | Sirve la compilación de `dist/`.                              |

Antes de abrir un PR ejecuta al menos `npm test` y `npm run build`.

## Assets

Los assets publicados ya están en `public/`; no hace falta regenerarlos para compilar. Regenera solo lo que dependa de un archivo que cambiaste:

| Si cambias…                              | Ejecuta                       |
| ---------------------------------------- | ----------------------------- |
| Una hoja de sprites o su pose de combate | `npm run assets:busts`        |
| Un fondo de escenario                    | `npm run assets:stage-thumbs` |
| La imagen para compartir enlaces         | `npm run assets:og`           |

Las pruebas de `tests/assets/` fallan si los bustos o las miniaturas de escenarios están desactualizados. `npm run assets:stage-thumbs -- --check` lo comprueba sin escribir archivos.

Las hojas de ataques y los actores de las definitivas se generan desde arte fuente en `assets/source/`, que no está en el repositorio:

- `npm run assets:attack-grid -- ruta/config.json` recorta una hoja de ataques en celdas exactas.
- `npm run assets:attack-art -- ruta/config.json` empaqueta esas celdas en `public/assets` y actualiza su manifiesto.
- `npm run assets:finale-actors` y `npm run assets:perro-mujeriego` preparan los actores de las definitivas. Aceptan `-- --only <id>` para procesar uno solo.

Termina siempre con `npm run check:assets` y `npm test`.

Para recomprimir imágenes sin pérdida, `npm run assets:audit:lossless` informa del ahorro y `npx tsx scripts/assets/apply-lossless-assets.ts` lo aplica en la misma ruta. Las variantes en otro formato, como AVIF, se registran en `server/asset-variants.json` y conservan el original como alternativa.

## Trabajar con T3 Code

Cada hilo nuevo debe usar un worktree que parta de `origin/main`:

- En las preferencias del entorno, activa **New worktrees start from origin**.
- En el proyecto, elige **worktree** como entorno predeterminado de los hilos nuevos.
- Comprueba que `origin/HEAD` apunte a `origin/main`:

  ```sh
  git fetch origin
  git remote set-head origin main
  git symbolic-ref --short refs/remotes/origin/HEAD   # origin/main
  ```

Estas preferencias se guardan en T3 Code y en Git local, no en el repositorio, así que hay que configurarlas en cada clon.
