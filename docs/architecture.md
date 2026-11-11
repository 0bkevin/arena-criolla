# Architecture

```text
Browser (React + Canvas 2D)
  │  HTTPS: page and assets
  │  WebSocket /ws: online play
  ▼
Server ── Node.js (Express + ws)      self-hosted, Docker or Node
       └─ Cloudflare Worker + Durable Object   arenacriolla.com
           │
           ▼
       shared/lobby: rooms and match loop
       shared/engine: combat rules
```

## Offline and online play

- **CPU and local two-player:** the browser runs the combat engine. The server only delivers the page.
- **Online:** each browser sends its controller input over WebSocket. The server runs the match at 60 steps per second and sends the state to both players 30 times per second. The server is authoritative, so clients cannot change the result.

The engine (`shared/engine`) and the room logic (`shared/lobby`) are the same code in the browser, the Node server and the Cloudflare Durable Object. Each host only adapts its socket type.

## Rooms

- Public rooms appear in the lobby list; private rooms are joined with an invite link or the room code.
- A disconnected player keeps their seat in a waiting room for 5 minutes.
- Rooms idle for an hour are removed. A server holds at most 2,000 rooms.
- Messages are rate-limited per connection, and WebSocket connections from other sites are rejected.

## State and storage

There is no database. Rooms and matches live in the server's memory, so a restart ends every room in progress. Progress and match history are stored in the player's browser (`localStorage`).

Because rooms are in memory, run **one** server instance. Players on different instances cannot see each other's rooms. On Cloudflare, every room lives in a single Durable Object.

## HTTP endpoints

| Path          | Returns                                     |
| ------------- | ------------------------------------------- |
| `/`           | The game.                                   |
| `/ws`         | The online-play WebSocket.                  |
| `/api/health` | `{"status":"ok","rooms":<n>,"players":<n>}` |
| `/api/rooms`  | The public room list.                       |

The page is never cached. JavaScript and CSS bundles have content-hashed names and are cached for a year.
