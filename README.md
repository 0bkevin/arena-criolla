[![Arena Criolla](public/assets/og-arena-criolla.jpg)](https://arenacriolla.com/)

# Arena Criolla

Juego de pelea en el navegador con 56 personajes y 9 escenarios de Venezuela. Se juega contra la CPU, con dos jugadores en el mismo equipo o en línea, con teclado, mando o pantalla táctil.

**[Jugar en arenacriolla.com](https://arenacriolla.com/)**

## Ejecutarlo en local

Requiere [Node.js 24](https://nodejs.org/) o posterior.

```sh
git clone https://github.com/0bkevin/arena-criolla.git
cd arena-criolla
npm ci
npm run dev
```

Abre <http://localhost:5173>.

## Alojarlo

No necesita base de datos ni claves de API.

```sh
docker build -t arena-criolla .
docker run -d -p 5173:5173 --restart unless-stopped arena-criolla
```

Para usar un dominio con HTTPS, Node sin Docker o Cloudflare Workers, consulta la [guía de despliegue](docs/deployment.md).

## Contribuir

- [Desarrollo](docs/development.md)
- [Pruebas y CI](docs/testing.md)

## Licencia

[GPL-3.0-only](LICENSE). Sonidos y fuentes de terceros: [ASSET-LICENSES.txt](ASSET-LICENSES.txt).
