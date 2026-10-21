# Arena Criolla

Juego de pelea en español con 54 personajes, nueve escenarios, partidas contra CPU, dos jugadores locales y salas públicas o privadas por WebSocket. Incluye plataformas, doble salto, bloqueo, combos, especiales y definitivas propias de cada personaje.

## Desarrollo

Requiere Node.js 24 o posterior.

```sh
npm ci
npm run dev
```

Abre `http://localhost:5173`. El servidor escucha en todas las interfaces; otros dispositivos de la misma red pueden entrar usando la IP del equipo. Elige personaje y escenario y comienza la pelea; los jugadores reciben una etiqueta automática, sin escribir un apodo. Los controles de teclado, mando y pantalla táctil se explican dentro del juego.

## Compilación y producción

```sh
npm run build
npm start
```

`PORT` cambia el puerto y `.env.example` documenta las opciones de configuración. El servidor entrega la aplicación compilada y simula las partidas en línea. La configuración de contenedores, proxy y copias de seguridad está en `deploy/`.

El contenedor de producción conserva solo la aplicación, los assets públicos y las dependencias necesarias. Los datos privados del creador se guardan en el volumen configurado con `ARENA_DATA_DIR`; las credenciales y los archivos `.env` quedan fuera del repositorio.

La imagen para compartir se sirve como JPEG de 1200 × 630. Su URL incluye una huella del archivo que cambia automáticamente al desplegar una imagen nueva; Open Graph, Twitter y los datos estructurados usan la misma URL. Después de regenerarla con `npm run assets:og`, vuelve a compilar y desplegar para publicar la nueva versión. Las peticiones a versiones retiradas se redirigen temporalmente a la imagen actual.

Después de desplegar, comprueba `https://arenacriolla.com/` y la dirección exacta compartida con [Sharing Debugger de Meta](https://developers.facebook.com/tools/debug/) y [Post Inspector de LinkedIn](https://www.linkedin.com/post-inspector/). Cada plataforma conserva su propia caché; borrar o reemplazar el archivo del servidor no elimina las copias de las redes ni garantiza que cambien las publicaciones existentes. En X y otras aplicaciones, compartir una URL con un parámetro nuevo, como `?preview=2`, puede provocar una consulta nueva, pero depende de cómo normalicen y almacenen el enlace. El canonical del sitio permanece sin parámetros.

## Assets y calidad

- `public/`: imágenes, audio, fuentes y archivos web utilizados por el juego.
- `shared/`: personajes, escenarios, movimientos, geometría de sprites y manifiestos de animación y compresión.
- `src/` y `server/`: interfaz, renderizado, audio, simulación y servidor.
- `tests/`: pruebas de combate, renderizado, red, almacenamiento, seguridad y preparación de assets.

Los ataques usan los escenarios de la pelea. Capriles y sus invitados tienen poses sentadas; Nacho y su rival bailan con poses propias. La música se sintetiza localmente y no incorpora reproductores ni grabaciones de YouTube.

La entrega de imágenes utiliza variantes más pequeñas con píxeles y metadatos idénticos. Los originales públicos siguen disponibles como fallback. Los workers preparan música y recortes de sprites sin bloquear la interfaz, con el mismo algoritmo local como recuperación.

Los informes, capturas, vídeos, referencias y generaciones intermedias se retiraron del árbol de trabajo. El juego no necesita descargarlos ni reconstruir sus imágenes para compilar. Los metadatos compactos de `shared/` son datos de ejecución, no informes generados durante el build.

## Validación

```sh
npm test
npm run check:assets
npm run build
```

`check:assets` comprueba directamente las 54 imágenes públicas: transparencia, ocho siluetas completas y geometría coincidente. Las pruebas también verifican los frames de ataques, actores, muebles y bailarines, y comparan los píxeles y metadatos de todas las variantes comprimidas con sus originales públicos.

La CI comprueba dependencias, pruebas, assets, compilación, vulnerabilidades de la imagen y el arranque HTTP/WebSocket. `scripts/security-smoke.mjs` permite comprobar una instancia local o desplegada.

## Creador privado

El taller público está desactivado; las partidas y los personajes publicados funcionan sin cuenta. Los módulos conservados del creador se prueban de forma aislada. La generación privada y la importación del operador se documentan en [creator-codex.md](docs/creator-codex.md) y [codex-operator-oracle.md](docs/codex-operator-oracle.md).

## Licencia

El código y los materiales originales se distribuyen bajo [GPL-3.0-only](LICENSE). Los sonidos de terceros conservan CC0 y las fuentes SIL Open Font License; consulta [ASSET-LICENSES.txt](ASSET-LICENSES.txt).
