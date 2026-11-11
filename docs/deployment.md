# Despliegue

Las partidas viven en memoria: reiniciar el servidor cierra las que estén en curso.

## Docker

```sh
docker build -t arena-criolla .
docker run -d -p 5173:5173 --restart unless-stopped arena-criolla
```

## Node.js

Requiere Node.js 24 o posterior.

```sh
npm ci
npm run build
npm start
```

## Variables de entorno

Todas son opcionales.

| Variable            | Uso                                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------- |
| `PORT`              | Puerto HTTP. Por defecto `5173`.                                                                                |
| `ARENA_PUBLIC_URL`  | Origen público, por ejemplo `https://arena.example.com`. Se usa en el canonical, el sitemap y la imagen social. |
| `ARENA_TRUST_PROXY` | Proxies de confianza, separados por comas. Obligatorio detrás de un proxy con HTTPS.                            |

## Dominio y HTTPS

Pon un proxy inverso delante que reenvíe `Host`, `X-Forwarded-Proto` y WebSocket en `/ws`. Con [Caddy](https://caddyserver.com/):

```caddy
arena.example.com {
	reverse_proxy 127.0.0.1:5173
}
```

```sh
docker run -d --restart unless-stopped \
  -p 127.0.0.1:5173:5173 \
  -e ARENA_PUBLIC_URL=https://arena.example.com \
  -e ARENA_TRUST_PROXY=loopback,uniquelocal \
  arena-criolla
```

Sin `ARENA_TRUST_PROXY`, la página carga pero las partidas en línea fallan.

## Cloudflare Workers

Funciona en el plan gratuito.

```sh
npm ci
npx wrangler login
npm run cf:build
npx wrangler deploy
```

Para usar tu dominio, añádelo como Custom Domain del Worker en Cloudflare.

## Comprobar una instalación

```sh
node scripts/ci/security-smoke.ts https://arena.example.com/
```

Comprueba HTTP y WebSocket y juega una partida privada con dos invitados.

## Producción de arenacriolla.com

El workflow **Deploy Cloudflare** despliega la rama `cloudflare-prod`, solo si su código ya pasó la CI en `main`. Para publicar o revertir, empuja a `cloudflare-prod` un commit de `main` en verde.

Necesita los secrets `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` en el entorno `cloudflare`.

`deploy/` y los workflows **Deploy production** y **Prepare production promotion** son del montaje anterior con Docker y están retirados.
