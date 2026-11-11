[![Arena Criolla](public/assets/og-arena-criolla.jpg)](https://arenacriolla.com/)

# Arena Criolla

A browser fighting game with 56 characters and 9 stages from Venezuelan culture. Play against the CPU, with two players on one device, or online, using a keyboard, gamepad or touch screen. No install or account needed.

**[Play at arenacriolla.com](https://arenacriolla.com/)**

## Run it locally

Requires [Node.js 24](https://nodejs.org/) or later.

```sh
git clone https://github.com/0bkevin/arena-criolla.git
cd arena-criolla
npm ci
npm run dev
```

Open <http://localhost:5173>. Other devices on your network can join at `http://<your-ip>:5173`.

## Host it

The game is a single server with no database and no API keys:

```sh
docker build -t arena-criolla .
docker run -d -p 5173:5173 --restart unless-stopped arena-criolla
```

The [deployment guide](docs/deployment.md) covers HTTPS with your own domain, configuration, updates, monitoring and Cloudflare Workers.

## How it works

Offline modes run entirely in the browser. Online matches are simulated by the server, which sends the game state to both players. Rooms live in memory, and player progress is stored in the browser. See [architecture](docs/architecture.md).

## Contributing

- [Development](docs/development.md)
- [Testing and CI](docs/testing.md)

## License

[GPL-3.0-only](LICENSE). Third-party sounds and fonts: [ASSET-LICENSES.txt](ASSET-LICENSES.txt).
