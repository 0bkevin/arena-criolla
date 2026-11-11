# Desarrollo

```sh
npm ci
npm run dev     # http://localhost:5173
npm run build   # tipos y compilación en dist/
npm start       # sirve dist/
npm run format
```

## Estructura

El motor de combate y las salas están en `shared/` y se ejecutan igual en el navegador, en el servidor Node y en el Worker de Cloudflare.

```text
src/          Cliente React: interfaz, renderizado en Canvas, audio y controles
shared/       Motor de combate, roster y salas en línea
server/       Servidor Node (Express y WebSocket)
cloudflare/   Worker y Durable Object
public/       Imágenes, sonidos y fuentes
scripts/      Herramientas de assets, CI y Cloudflare
tests/        Pruebas automáticas y fixtures manuales
e2e/          Pruebas de diseño con Playwright
```

## Assets

Los assets de `public/` ya están generados. Si cambias su origen, regenéralos:

| Si cambias…                              | Ejecuta                       |
| ---------------------------------------- | ----------------------------- |
| Una hoja de sprites o su pose de combate | `npm run assets:busts`        |
| Un fondo de escenario                    | `npm run assets:stage-thumbs` |
| La imagen social                         | `npm run assets:og`           |

Las hojas de ataques y los actores de las definitivas se generan desde `assets/source/`, que no está en el repositorio, con `assets:attack-grid`, `assets:attack-art`, `assets:finale-actors` y `assets:perro-mujeriego`.

Después, ejecuta `npm run check:assets` y `npm test`.

## T3 Code

Los hilos nuevos deben usar un worktree desde `origin/main`:

- En el entorno, activa **New worktrees start from origin**.
- En el proyecto, elige **worktree** como entorno predeterminado.
- Ejecuta `git remote set-head origin main`.
