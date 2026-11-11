# Deployment

Run a single instance: rooms live in memory, and a restart ends the matches in progress. See [architecture](architecture.md).

## Docker

```sh
docker build -t arena-criolla .
docker run -d --name arena-criolla -p 5173:5173 --restart unless-stopped arena-criolla
```

The image runs as a non-root user and has a built-in health check.

## Node.js

Requires Node.js 24 or later.

```sh
npm ci
npm run build
npm start
```

`npm start` serves the build in `dist/`. Use a process manager such as systemd to keep it running.

## Configuration

All variables are optional. With Docker, pass them with `-e NAME=value`.

| Variable            | Purpose                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `PORT`              | HTTP port. Default `5173`.                                                                                               |
| `ARENA_PUBLIC_URL`  | Public origin, such as `https://arena.example.com`. Used for the canonical URL, sitemap and social preview.              |
| `ARENA_TRUST_PROXY` | Comma-separated trusted proxies. Required behind an HTTPS proxy; `loopback,uniquelocal` covers a proxy on the same host. |

## Domain and HTTPS

Put a reverse proxy in front of the game. It must forward the `Host` and `X-Forwarded-Proto` headers and WebSocket upgrades on `/ws`. [Caddy](https://caddyserver.com/) does all of this and gets the certificate automatically:

```caddy
arena.example.com {
	reverse_proxy 127.0.0.1:5173
}
```

Then publish the container only on loopback and trust the proxy:

```sh
docker run -d --name arena-criolla --restart unless-stopped \
  -p 127.0.0.1:5173:5173 \
  -e ARENA_PUBLIC_URL=https://arena.example.com \
  -e ARENA_TRUST_PROXY=loopback,uniquelocal \
  arena-criolla
```

Without `ARENA_TRUST_PROXY`, the page loads but online matches fail: the server sees the connection as `http` and rejects the WebSocket from the `https` page.

For a hardened setup (read-only filesystem, dropped capabilities, resource limits), see [`deploy/production.compose.yaml`](../deploy/production.compose.yaml).

## Operating it

| Task   | Docker                                                           | Node.js                                        |
| ------ | ---------------------------------------------------------------- | ---------------------------------------------- |
| Update | `git pull`, `docker build`, then remove and re-run the container | `git pull`, `npm ci`, `npm run build`, restart |
| Logs   | `docker logs -f arena-criolla`                                   | Your process manager's logs                    |
| Health | `docker ps` shows `healthy`, or request `/api/health`            | Request `/api/health`                          |

Updating restarts the server and ends matches in progress, so update when few players are online. `/api/health` also reports the current number of rooms and players.

To check a deployment end to end:

```sh
node scripts/ci/security-smoke.ts https://arena.example.com/
```

It checks HTTP, the security headers and WebSocket, and plays a private match between two temporary guests.

## Cloudflare Workers

Runs on the Workers Free plan. Rooms run in a Durable Object.

```sh
npm ci
npx wrangler login
npm run cf:build
npx wrangler deploy
```

The game is published at `https://arena-criolla.<your-subdomain>.workers.dev`. To use your own domain, add it as a Custom Domain on the Worker in the Cloudflare dashboard.

- **Update:** run `npm run cf:build` and `npx wrangler deploy` again.
- **Logs:** `npx wrangler tail`, or the Worker's Observability tab in the dashboard.
- **Test locally:** `npm run cf:build && npm run cf:dev`.

## arenacriolla.com

Production runs on Cloudflare Workers. The **Deploy Cloudflare** workflow (`.github/workflows/cloudflare.yml`) deploys the `cloudflare-prod` branch:

1. It refuses any commit whose code did not pass CI on `main`.
2. It builds and runs `wrangler deploy`.
3. It plays a match against the live site.

To release or roll back, push a commit from a green `main` to `cloudflare-prod`. The workflow needs the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets in the `cloudflare` environment and the `CLOUDFLARE_URL` variable.

The `deploy/` scripts and the **Deploy production** and **Prepare production promotion** workflows belong to the previous Docker server and are retired.
