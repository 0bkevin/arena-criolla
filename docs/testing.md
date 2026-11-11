# Pruebas y CI

```sh
npm test               # pruebas automáticas
npm run test:ui        # diseño en Chromium; antes: npx playwright install chromium
npm run typecheck
npm run check:assets   # sprites publicados
node scripts/ci/select-checks.ts origin/main   # qué ejecutaría la CI
```

Lo que solo se puede comprobar en un navegador real está en los [fixtures manuales](../tests/manual/README.md).

## Qué probar

Prueba lo que rompería el juego: reglas de combate, estado en línea, seguridad, controles, audio, carga de assets y despliegue. Una prueba de un personaje solo vale para una mecánica que no cubren las pruebas del motor.

No pruebes números de balance, la misma regla para cada luchador, metadatos de arte ni texto o CSS del código. En `e2e/` no uses comparaciones de capturas.

## CI

La CI solo ejecuta los checks afectados por el diff: pruebas que importan los archivos cambiados, diseño, tipos, formato, sprites, auditoría de dependencias, el Worker y la imagen Docker.

`validate` es el único check obligatorio. Al pasar, guarda el árbol de git probado y no vuelve a probar ese mismo árbol en `main` ni en `cloudflare-prod`. Mantén activado "Require branches to be up to date before merging" en `main`.
