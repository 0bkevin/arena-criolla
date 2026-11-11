[![Arena Criolla: personajes venezolanos frente a frente](public/assets/og-arena-criolla.jpg)](https://arenacriolla.com/)

# Arena Criolla

Un juego de pelea donde los mitos, la música, el humor y las figuras de Venezuela se encuentran en la misma arena. Juega desde el navegador, sin instalar nada ni crear una cuenta.

**[Jugar ahora](https://arenacriolla.com/)** · [Desarrollo local](#desarrollo-local) · [Despliegue](docs/deployment.md) · [Licencia](LICENSE)

## Elige a tu pana y pelea

- **56 personajes** con especiales, combos y definitivas propios.
- **9 escenarios** inspirados en Venezuela, de Caracas a Canaima y Los Roques.
- **Tres formas de jugar:** contra la CPU, dos jugadores en el mismo equipo o partidas en línea en salas públicas y privadas.
- **Combate con plataformas:** doble salto, bloqueo y ataques para encontrar tu estilo.
- **Teclado, mando o pantalla táctil.** Los controles se explican dentro del juego.

Para jugar con alguien a distancia, crea una sala y comparte su enlace de invitación. El servidor simula el combate y mantiene la partida sincronizada.

## Desarrollo local

Necesitas **Node.js 24 o posterior** y npm.

```sh
git clone https://github.com/0bkevin/arena-criolla.git
cd arena-criolla
npm ci
npm run dev
```

Abre [localhost:5173](http://localhost:5173). También puedes entrar desde otro dispositivo de la misma red usando la IP de tu equipo. El juego público funciona sin claves de API; las opciones del servidor están en [`.env.example`](.env.example).

## Cómo está construido

React y TypeScript para la interfaz, Canvas 2D para la pelea y Node.js con Express y WebSocket para el servidor. El motor de combate es el mismo en el navegador y en los servidores, y las salas en línea son el mismo código en el servidor Node y en el Worker de Cloudflare que corre en producción.

```text
src/
  app/          Shell de la aplicación, red, progreso y estado del lobby
  components/   Interfaz por área: lobby, combate, ayuda, entrada y piezas comunes
  game/         Renderizado, audio, controles, cámara, assets y coreografías
  styles/       Hojas globales, importadas en orden de cascada
shared/         Lo que ejecutan el navegador y los servidores
  engine/       Motor de combate y definitivas
  roster/       Luchadores y escenarios
  lobby/        Salas, protocolo y bucle autoritativo de partida
server/         Servidor Node: HTTP, WebSocket y entrega de assets
cloudflare/     Worker y Durable Object de producción
scripts/        Herramientas de assets, CI, Cloudflare y rendimiento
public/         Imágenes, sonidos y fuentes
tests/          Pruebas por área (motor, personajes, salas, render…) y fixtures manuales
deploy/         Despliegue propio con contenedores, como referencia
docs/           Guías de desarrollo, pruebas y despliegue
```

## Validar y compilar

```sh
npm test
npm run check:assets
npm run build
npm start
```

Las pruebas se centran en combate, red, almacenamiento, seguridad, controles, recuperación de assets y audio. `check:assets` valida transparencia, ocho siluetas completas y geometría coincidente en los sprites públicos.

La CI solo ejecuta lo que cada cambio puede afectar: los tests que importan los archivos modificados, los tipos, los sprites, la auditoría de dependencias y la imagen Docker cuando corresponde. Producción corre en Cloudflare Workers: la CI compila el Worker y juega una partida contra él antes de aceptar un cambio. Los detalles están en [testing.md](docs/testing.md). `scripts/ci/security-smoke.ts` permite comprobar una instancia local o desplegada.

`npm start` sirve la aplicación compilada. Para configurar el dominio, el contenedor o las imágenes al compartir enlaces, consulta la [guía de despliegue](docs/deployment.md).

## Contribuir

Crea una rama por tarea desde `origin/main`, mantén los cambios acotados y ejecuta las validaciones antes de abrir un PR. La configuración para nuevos hilos de T3 Code está documentada en la [guía de desarrollo](docs/development.md).

## Licencia

Código y materiales originales bajo [GPL-3.0-only](LICENSE). Los sonidos de terceros conservan CC0 y las fuentes, SIL Open Font License. Consulta las atribuciones en [ASSET-LICENSES.txt](ASSET-LICENSES.txt).
