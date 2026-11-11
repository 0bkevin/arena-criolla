# Despliegue

Arena Criolla se puede alojar de tres formas. Todas sirven el mismo juego y las mismas partidas en línea:

| Opción                                    | Ideal para                         |
| ----------------------------------------- | ---------------------------------- |
| [Docker](#docker)                         | Un servidor o VPS propio.          |
| [Node.js](#nodejs)                        | Probar sin contenedores.           |
| [Cloudflare Workers](#cloudflare-workers) | Alojarlo sin mantener un servidor. |

No hace falta base de datos ni claves de API. Las salas y partidas viven en memoria: al reiniciar el servidor se cierran las partidas en curso y no se pierde nada más.

## Docker

```sh
docker build -t arena-criolla .
docker run -d --name arena-criolla -p 5173:5173 --restart unless-stopped arena-criolla
```

El juego queda en `http://<tu-servidor>:5173`. La imagen corre sin privilegios y expone `/api/health` para el healthcheck.

## Node.js

Requiere Node.js 24 o posterior.

```sh
npm ci
npm run build
npm start
```

`npm start` sirve la versión compilada en `dist/` en el puerto 5173.

## Variables de entorno

Todas son opcionales. Hay un ejemplo en [`.env.example`](../.env.example).

| Variable            | Uso                                                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`              | Puerto HTTP. Por defecto `5173`.                                                                                                          |
| `ARENA_PUBLIC_URL`  | Origen público, por ejemplo `https://arena.example.com`. Se usa en el canonical, el sitemap y la imagen al compartir enlaces.             |
| `ARENA_TRUST_PROXY` | IP o rangos del proxy, separados por comas. Necesario detrás de un proxy con HTTPS; `loopback,uniquelocal` cubre un proxy local o Docker. |

Con Docker se pasan con `-e`, por ejemplo `-e ARENA_PUBLIC_URL=https://arena.example.com`.

## Dominio y HTTPS

Pon un proxy inverso delante del juego. Debe reenviar las cabeceras `Host` y `X-Forwarded-Proto` y permitir WebSocket en `/ws`.

Con [Caddy](https://caddyserver.com/), que obtiene el certificado solo y ya reenvía WebSocket:

```caddy
arena.example.com {
	encode zstd gzip
	reverse_proxy 127.0.0.1:5173
}
```

En ese caso publica el contenedor solo en loopback y confía en el proxy:

```sh
docker run -d --name arena-criolla --restart unless-stopped \
  -p 127.0.0.1:5173:5173 \
  -e ARENA_PUBLIC_URL=https://arena.example.com \
  -e ARENA_TRUST_PROXY=loopback,uniquelocal \
  arena-criolla
```

Si falta `ARENA_TRUST_PROXY`, la página carga pero las partidas en línea fallan: el servidor ve la conexión como `http` y rechaza el WebSocket que llega desde `https`.

[`deploy/production.compose.yaml`](../deploy/production.compose.yaml) es un ejemplo de Compose más restringido (sistema de archivos de solo lectura, sin capacidades y con límites de memoria y CPU).

## Cloudflare Workers

Las salas en línea corren en un Durable Object, y el plan gratuito es suficiente.

```sh
npm ci
npx wrangler login
npm run cf:build
npx wrangler deploy
```

Wrangler publica el juego en `https://arena-criolla.<tu-subdominio>.workers.dev`. Para usar tu dominio, añádelo como Custom Domain del Worker en el panel de Cloudflare. El nombre del Worker se cambia en [`wrangler.jsonc`](../wrangler.jsonc).

Para probarlo en local con el runtime de Workers: `npm run cf:build && npm run cf:dev`.

## Comprobar una instalación

```sh
node scripts/ci/security-smoke.ts https://arena.example.com/
```

Comprueba HTTP, cabeceras de seguridad y WebSocket, y juega una partida privada temporal con dos invitados. Para un Worker también existe `node scripts/cloudflare/smoke.ts <url>`.

## Imagen al compartir enlaces

La vista previa en redes es `public/assets/og-arena-criolla.jpg` (1200 × 630). Para cambiarla, regenérala y vuelve a desplegar:

```sh
npm run assets:og
npm run build
```

Su URL incluye una huella del archivo, así que cambia sola en cada versión. Las redes guardan su propia caché; para refrescarla usa el [Sharing Debugger de Meta](https://developers.facebook.com/tools/debug/) o el [Post Inspector de LinkedIn](https://www.linkedin.com/post-inspector/).

## Producción de arenacriolla.com

`arenacriolla.com` corre en Cloudflare Workers. El workflow **Deploy Cloudflare** (`.github/workflows/cloudflare.yml`) despliega la rama `cloudflare-prod`:

1. Rechaza el commit si su código no pasó la CI en `main`.
2. Compila con `npm run cf:build` y ejecuta `wrangler deploy`.
3. Juega una partida contra la URL publicada (`vars.CLOUDFLARE_URL`).

Para publicar, empuja a `cloudflare-prod` un commit de `main` con la CI en verde. Para revertir, empuja un commit anterior que también haya pasado la CI.

El workflow necesita los secrets `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` en el entorno `cloudflare`.

### Montaje anterior

Antes de Cloudflare, producción era un contenedor Docker en un servidor propio, actualizado desde la rama `prod` con los workflows **Prepare production promotion** y **Deploy production**. Esos workflows están desactivados y el servidor está detenido. Sus scripts siguen en [`deploy/`](../deploy/) como referencia; `python3 -B deploy/test_install_release.py` los prueba sin Docker.
