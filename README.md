[![Arena Criolla](public/assets/og-arena-criolla.jpg)](https://arenacriolla.com/)

# Arena Criolla

Juego de pelea en el navegador con personajes, mitos y escenarios de Venezuela. No hay que instalar nada ni crear una cuenta.

**[Jugar en arenacriolla.com](https://arenacriolla.com/)**

## Qué incluye

- 56 personajes, cada uno con especiales, combos y una definitiva.
- 9 escenarios, de Caracas a Canaima y Los Roques.
- Partidas contra la CPU, dos jugadores en el mismo equipo o en línea con salas públicas y privadas.
- Teclado, mando o pantalla táctil. Los controles se explican dentro del juego.

Para jugar en línea con alguien, crea una sala privada y comparte el enlace de invitación.

## Ejecutarlo en tu equipo

Necesitas [Node.js 24](https://nodejs.org/) o posterior.

```sh
git clone https://github.com/0bkevin/arena-criolla.git
cd arena-criolla
npm ci
npm run dev
```

Abre <http://localhost:5173>. Otros dispositivos de tu red pueden entrar con la IP de tu equipo, por ejemplo `http://192.168.1.20:5173`, y jugar en línea entre ellos.

## Alojarlo tú mismo

El juego es un único servidor Node que entrega la página y las partidas en línea. No necesita base de datos ni claves de API. La forma más rápida es Docker:

```sh
docker build -t arena-criolla .
docker run -d -p 5173:5173 --restart unless-stopped arena-criolla
```

También puedes ejecutarlo con Node o en tu propia cuenta de Cloudflare Workers. La [guía de despliegue](docs/deployment.md) explica cada opción, las variables de entorno y cómo ponerlo detrás de un dominio con HTTPS.

## Contribuir

La [guía de desarrollo](docs/development.md) describe la estructura del proyecto, los comandos y cómo se preparan los assets. Las [pruebas y la CI](docs/testing.md) explican qué se valida en cada cambio.

Antes de abrir un PR:

```sh
npm test
npm run build
```

## Licencia

El código y los materiales originales se distribuyen bajo [GPL-3.0-only](LICENSE). Los sonidos de terceros son CC0 y las fuentes usan la SIL Open Font License; las atribuciones están en [ASSET-LICENSES.txt](ASSET-LICENSES.txt).
