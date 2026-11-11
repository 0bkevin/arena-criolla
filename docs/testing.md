# Pruebas y CI

## Comandos

| Comando                                        | Qué comprueba                                                                                                              |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                                     | Todas las pruebas automáticas de `tests/`.                                                                                 |
| `npm run test:ui`                              | Diseño en Chromium con Playwright (`e2e/`). Arranca su propio servidor. La primera vez: `npx playwright install chromium`. |
| `npm run typecheck`                            | Tipos del cliente, `shared/`, el servidor y el Worker, cada uno con sus propios tipos de entorno.                          |
| `npm run check:assets`                         | Transparencia, siluetas completas y geometría de los sprites publicados.                                                   |
| `npm run build`                                | Tipos y compilación del cliente.                                                                                           |
| `node scripts/ci/select-checks.ts origin/main` | Qué ejecutaría la CI para tu rama.                                                                                         |
| `npm run perf:engine` / `npm run perf:network` | Mediciones de rendimiento opcionales.                                                                                      |

Para lo que solo se ve en un navegador real (punteros, foco, audio), usa los [fixtures manuales](../tests/manual/README.md).

## Qué merece una prueba

Escribe una prueba cuando un fallo realista la haría fallar y ese fallo importa: reglas de combate y repetición determinista, estado autoritativo en línea, seguridad y validación de entradas, ciclo de vida de controles y audio, carga y recuperación de assets, entrega del servidor y seguridad del despliegue.

Una prueba de un personaje concreto solo vale para una mecánica que las pruebas del motor no cubren, y debe comprobar comportamiento, no ajustes de balance.

No añadas pruebas que fijen números de balance, repitan la misma regla para cada luchador, inventaríen metadatos o versiones de arte, busquen texto o fragmentos de CSS en el código, o registren evidencia en lugar de comprobarla.

## Pruebas de diseño

`e2e/` abre la aplicación real en Chromium con tamaños de móvil vertical y horizontal, tablet y escritorio. Comprueba lo que notaría un jugador:

- Ningún control ni título se corta en el borde de la pantalla y el botón de inicio no queda tapado.
- Los diálogos caben en pantalla y devuelven el foco al cerrar con Escape.
- La búsqueda del roster funciona y la arena mantiene sus proporciones.
- En móvil vertical aparece el aviso para girar la pantalla.
- Los controles táctiles quedan en pantalla y no se solapan.

No añadas comparaciones de píxeles ni capturas: se rompen con cada cambio de arte. La página recorta el desbordamiento horizontal, así que las pruebas miden elementos, no el ancho de scroll.

## CI

`scripts/ci/select-checks.ts` lee el diff y ejecuta solo lo que puede verse afectado:

- **Pruebas:** un archivo de prueba corre si cambió él o cualquier archivo que importe, directa o indirectamente. Los cambios en `package.json`, el lockfile, `tsconfig.json`, `tests/helpers`, los workflows o el propio selector ejecutan todas.
- **Diseño:** cambios en `src/`, `shared/`, `public/`, `index.html`, la configuración de Vite o `e2e/`.
- **Estáticas:** tipos, formato con Prettier, sprites, `npm audit` (si cambia el lockfile) y las pruebas de `deploy/`.
- **Worker:** compila el Worker y juega una partida en línea contra él con `wrangler dev` cuando cambian el Worker, las salas o el sitio.
- **Imagen:** construye y arranca la imagen Docker cuando cambia algo que incluye; Trivy la escanea si cambian el Dockerfile o el lockfile.

`validate` es el único check obligatorio. Falla si algún job que se ejecutó falló o se canceló; los omitidos no hacían falta.

Cuando `validate` pasa, guarda el árbol de git probado como artefacto `tested-tree-<árbol>` durante 90 días. Cualquier ejecución posterior con el mismo árbol reutiliza ese resultado:

1. **PR a `main`:** ejecuta los checks seleccionados para el diff. Mantén activada la opción "Require branches to be up to date before merging"; así el commit fusionado tiene el mismo árbol que probó el PR.
2. **Push a `main`:** reutiliza el resultado del PR. Solo prueba de nuevo si el árbol nunca se probó.
3. **Push a `cloudflare-prod`:** el despliegue se niega a continuar si el árbol no pasó la CI (ver [deployment.md](deployment.md)).

Una ejecución manual de **Validate Arena Criolla** corre todos los checks.
