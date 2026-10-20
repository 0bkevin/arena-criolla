# Preparar personajes de forma privada

Estas herramientas permiten preparar arte e importar borradores al entorno de pruebas. El taller público está desactivado: estos comandos no lo habilitan. La generación se ejecuta por separado del servidor del juego.

## Preparación

Usa Node.js 24 o posterior e instala las dependencias con `npm ci`. Comprueba la sesión del generador en el equipo donde vas a ejecutarlo:

```bash
npm run creator:codex -- doctor
npm run creator:codex -- login  # Si falta iniciar sesión
```

Guarda los trabajos dentro de `data/` o en una carpeta privada fuera del repositorio. `data/` está excluida de Git, Docker y el contenido servido al navegador.

## Generar y revisar

Crea `data/creator-codex/input.json` con la descripción del personaje:

```json
{
  "name": "Pana orbital",
  "description": "Chaqueta blanca, pantalón blanco y botas oscuras. Combate ágil y teatral.",
  "style": "agile",
  "color": "#ee7c34"
}
```

Los estilos admitidos son `agile`, `technical` y `power`. Adjunta entre una y tres fotos JPG, PNG o WebP, de hasta 8 MB y 20 millones de píxeles cada una. Repite `--photo` para añadir referencias.

```bash
npm run creator:codex -- generate \
  --input data/creator-codex/input.json \
  --photo /ruta/privada/retrato.jpg \
  --job data/creator-codex/primer-personaje
```

Cada generación usa un directorio de trabajo nuevo y consume uso de la cuenta autenticada. Revisa `bundle/sprite.png`, `bundle/portrait.webp` y `bundle/character.json`: parecido, ropa, orientación, orden de poses y cuerpos completos. Las comprobaciones automáticas validan transparencia, geometría y combate; la apariencia necesita revisión visual.

Si solo necesitas repetir el empaquetado de una imagen ya generada, este comando reutiliza el trabajo sin pedir una nueva generación:

```bash
npm run creator:codex -- pack --job data/creator-codex/primer-personaje
```

## Importar un borrador

El importador requiere `ARENA_ENVIRONMENT=prod-tst`, una cuenta de dueño que ya exista en la base de pruebas y acceso a su carpeta de datos. Transfiere solo `bundle/`; las fotos y las credenciales del generador permanecen en el equipo de trabajo.

```bash
ARENA_ENVIRONMENT=prod-tst \
ARENA_DATA_DIR=/ruta/privada/prod-tst/creator \
npm run creator:import -- \
  --bundle /ruta/privada/bundle \
  --owner-email owner@example.com
```

La importación valida el paquete y guarda un borrador privado; no crea cuentas ni publica el personaje. Con el taller público desactivado, la interfaz de prueba y publicación tampoco está disponible.

`deploy/codex-operator.Dockerfile`, `deploy/install-codex-operator.sh` y `deploy/arena-codex` permiten ejecutar el generador en un contenedor separado. `npm run test:creator` comprueba el flujo con datos de prueba, sin consumir uso de generación.
