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

Los assets publicados están incluidos en `public/`; no hace falta regenerarlos para compilar. Las variantes comprimidas conservan los píxeles y metadatos de los originales, que siguen disponibles como fallback. Los workers preparan música y recortes de sprites sin bloquear la interfaz y cuentan con recuperación local.

Los módulos privados del creador conservan sus pruebas aisladas. Consulta [creator-codex.md](creator-codex.md) para ese flujo y [tests/browser/README.md](../tests/browser/README.md) para las comprobaciones de interfaz en navegador.
