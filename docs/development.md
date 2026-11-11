# Desarrollo con T3 Code

Los nuevos hilos de este proyecto deben usar un **worktree** con **`origin/main` como rama base**. Así cada tarea parte de la rama principal remota.

La configuración se guarda en T3 Code y en los metadatos locales de Git; clonar este repositorio no aplica estas preferencias automáticamente.

## Configuración

- En las preferencias del entorno de T3 Code, activa **New worktrees start from origin** (`newWorktreesStartFromOrigin: true`).
- En el proyecto Arena Criolla, selecciona **worktree** como entorno predeterminado de los nuevos hilos (`defaultThreadEnvMode: worktree`).
- Comprueba que la rama predeterminada del remoto sea `main` y que la referencia local `origin/HEAD` apunte a `origin/main`.

Para actualizar las referencias y configurar ese último punto en otro clon:

```sh
git fetch origin
git remote set-head origin main
git symbolic-ref --short refs/remotes/origin/HEAD
# origin/main
```

Antes de iniciar una tarea, revisa que el selector de rama base del nuevo hilo muestre `origin/main`. Los hilos ya creados conservan su rama y su entorno.

## Validación

Desde la raíz del repositorio:

```sh
npm test
npm run check:assets
npm run build
```

Los assets publicados están incluidos en `public/`; no hace falta regenerarlos para compilar. Las recompresiones sin pérdida (`npm run assets:audit:lossless` y `npx tsx scripts/assets/apply-lossless-assets.ts`) sustituyen el archivo en su misma ruta y conservan píxeles y metadatos exactos; `server/asset-variants.json` queda reservado para variantes de otro formato (por ejemplo AVIF) con el original como fallback. Los workers preparan música y recortes de sprites sin bloquear la interfaz y cuentan con recuperación local.

Las tarjetas del roster dibujan un busto recortado (`public/assets/bust-*.webp`, descrito en `src/game/assets/manifests/portrait-busts.json`) en vez de descargar la hoja completa del luchador. Si cambias una hoja de sprites o su pose de combate, regenera los bustos con `npm run assets:busts`; `tests/assets/portrait-busts.test.ts` falla mientras estén desactualizados.

Las hojas de ataques y de actores de las definitivas se preparan desde arte fuente local, que vive en `assets/source/` y no se publica en el repositorio:

- `npm run assets:attack-grid -- ruta/config.json` reparte en celdas exactas una hoja de ataques generada.
- `npm run assets:attack-art -- ruta/config.json` empaqueta esas celdas en `public/assets` y actualiza `src/game/assets/manifests/attack-assets.json`.
- `npm run assets:finale-actors [-- --only atlas]` prepara los actores sentados y de café de las definitivas y su manifiesto.
- `npm run assets:perro-mujeriego [-- --only id]` prepara los bailarines de Perro Mujeriego y su manifiesto.

Después, `npm run check:assets` y las pruebas de `tests/assets/` confirman que el arte publicado y sus manifiestos coinciden.

Consulta [tests/manual/README.md](../tests/manual/README.md) para las comprobaciones de interfaz en navegador.

Las vistas previas de escenarios (`public/assets/stage-thumb-*.webp`) se generan a partir de los fondos completos con `npm run assets:stage-thumbs`; el manifiesto `src/game/assets/manifests/stage-thumbnails.json` y `tests/assets/stage-thumbnails.test.ts` detectan cambios pendientes. `npm run assets:stage-thumbs -- --check` verifica su vigencia sin escribir archivos.
