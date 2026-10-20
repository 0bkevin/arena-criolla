# Integración de main — 19 de octubre de 2026

Se incorporó `origin/main` (`da8b0a373ab494d8261d71a4fc27f7db1c9b2299`) a `t3/desbloquear-ataque-especial` mediante el merge `cd5389686ff7e658d3d14450b14c2c1cf57b1b19`. El trabajo previo de finales se restauró como cambios sin commit.

La copia recuperable anterior al merge es `refs/backups/finales-before-main-20261019`, que apunta al stash `96cc00195536653562343a53480d7ec4f3a76ecb`. El HEAD original era `7521335db5cce4a536b1ae162608d5544a166f2d`. Se conservaron los 681 archivos modificados o nuevos del inventario previo; no hubo colisiones entre archivos entrantes de main y archivos originalmente ignorados. La copia incluye fuentes, atlas, manifiestos, scripts, tests y grabaciones. Los archivos privados e ignorados permanecieron fuera del stash.

## Comportamiento integrado

El roster tiene 52 personajes. Todos tienen una definitiva con tres victorias y 75 de energía, además del bloqueo de tres victorias del especial de motos de Vicente. Se conservan las técnicas, las nuevas identidades y los controles de main, junto con los finales dentro de la arena, el café, el escritorio y la coreografía de Nacho. El único conflicto textual apareció al restaurar `src/mobile-game.css`: se conservaron tanto los estilos de pausa y legibilidad de main como la reserva de espacio del control táctil durante los finales.

Lorenzo, Carolina, Dayana, Bolívar, Édgar y Melanio tienen perfiles de final y objetos dibujados con geometría. Sus actores utilizan sus sprites canónicos actuales, también cuando son invitados al café o al baile de Nacho. El invitado al baile sigue el reloj compartido mediante poses de su atlas de combate; no dispone todavía de los ocho gestos pintados exclusivos del lote original. No se generó arte durante el merge.

Los 46 juegos de props y actores pintados originales se conservaron con sus fuentes y hashes. La auditoría estricta de baile exige ahora los 52 personajes actuales, de modo que rechaza correctamente el lote real de 46 como incompleto para el roster ampliado. Los tests de píxeles y procedencia siguen cubriendo todos los recursos pintados existentes; los tests de integración cubren explícitamente los seis fallbacks y la simulación completa de los 52 personajes.

## Límites de las identidades pintadas

**Actualización posterior al merge:** las cuatro identidades de la tabla ya se renovaron en sus poses pintadas de café y baile. Véanse [fuentes, prompts y validación](main-identity-refresh/README.md). El texto siguiente documenta el estado al terminar el merge, anterior a esa nueva generación.

Las referencias de los actores pintados son anteriores a cuatro actualizaciones de main. No se modificaron sus PNG, WebP, geometrías ni documentos de procedencia para aparentar una nueva generación.

| Personaje | Referencia anterior del actor pintado | Sprite canónico actual |
| --- | --- | --- |
| Knoche | `knoche-v12` | `knoche-v46` |
| Javier | `javier-v2` | `javier-v43` |
| Nacho | `nacho-v15` | `nacho-v42` |
| Capriles | `capriles-v22` | `capriles-v39` |

La selección, el combate normal y las entradas conservan las identidades actuales de main. Sus representaciones pintadas en los finales conservan las referencias anteriores indicadas en [seated-references.json](seated-references.json) y en los dossiers de performers y baile.

Nacho conserva únicamente la música original sintetizada del juego a volumen bajo. No se incorporó ninguna canción, iframe ni reproductor/API de YouTube. `package.json` conserva los scripts de finales y las dependencias coinciden con el lockfile, sin actualizaciones de paquetes.

## Validación

Pasaron los 73 tests focalizados de finales, fuentes y píxeles, audio, controles, seguridad y salas, y los dos tests adicionales de integración de main. La suite completa pasó con **869 tests**, sin fallos, omisiones ni cancelaciones:

```sh
npx tsx --test --test-concurrency=2 tests/*.test.ts tests/character-audits/*.test.ts
npm run build
git diff --check
```

La compilación TypeScript y de producción pasó. Vite conserva su aviso de tamaño del bundle superior a 500 kB. No quedan entradas sin resolver ni estado de merge, y el índice está vacío: el trabajo previo y las adaptaciones de integración permanecen sin commit. Los registros de esta ejecución están en `/tmp/vepol-merge-full.log`, `/tmp/vepol-merge-focused.log` y `/tmp/vepol-merge-build-final.log`; el inventario, el patch original y la comprobación de restauración están en `/tmp/vepol-main-merge-20261019T100241Z/`.
