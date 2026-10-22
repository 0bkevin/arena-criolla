# Despliegue

## Servidor

Requiere Node.js 24 o posterior. Desde la raíz del repositorio:

```sh
npm ci
npm run build
npm start
```

El servidor entrega la aplicación compilada y simula las partidas en línea. `PORT` cambia el puerto; las demás opciones están en [`.env.example`](../.env.example). En producción, configura `ARENA_PUBLIC_URL` con el origen público y `ARENA_TRUST_PROXY` según el proxy utilizado.

La configuración de Docker Compose, proxy y copias de seguridad está en [`deploy/`](../deploy/). El contenedor conserva la aplicación, los assets públicos y las dependencias necesarias. Los datos privados del creador se guardan en el volumen configurado con `ARENA_DATA_DIR`; las credenciales y los archivos `.env` quedan fuera del repositorio.

Para comprobar una instancia desplegada:

```sh
node scripts/security-smoke.mjs https://arenacriolla.com/
```

Esta comprobación valida HTTP y WebSocket y crea una partida privada temporal con dos invitados.

## Imagen al compartir enlaces

La imagen social se sirve como JPEG de 1200 × 630. Su URL incluye una huella del archivo que cambia automáticamente al desplegar una imagen nueva; Open Graph, Twitter y los datos estructurados usan la misma URL.

```sh
npm run assets:og
npm run build
```

Después, despliega la nueva compilación. Las peticiones a versiones retiradas se redirigen temporalmente a la imagen actual.

Comprueba el sitio y la dirección exacta compartida con [Sharing Debugger de Meta](https://developers.facebook.com/tools/debug/) y [Post Inspector de LinkedIn](https://www.linkedin.com/post-inspector/). Cada plataforma conserva su propia caché; reemplazar el archivo del servidor no elimina sus copias ni garantiza que cambien las publicaciones existentes.

En X y otras aplicaciones, compartir una URL con un parámetro nuevo, como `?preview=2`, puede provocar una consulta nueva, pero depende de cómo almacenen el enlace. El canonical del sitio permanece sin parámetros.
