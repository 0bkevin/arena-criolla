# Development

```sh
npm ci
npm run dev     # http://localhost:5173, reloads on save
npm run build   # type check and build into dist/
npm start       # serve dist/
npm run format  # Prettier
```

## Project layout

```text
src/          React client: UI, Canvas rendering, audio and controls
shared/       Combat engine, roster and online rooms (browser and servers)
server/       Node server (Express and WebSocket)
cloudflare/   Worker and Durable Object
public/       Images, sounds and fonts
scripts/      Asset, CI and Cloudflare tools
tests/        Automated tests and manual browser fixtures
e2e/          Playwright layout tests
```

See [architecture](architecture.md) for how these fit together.

## Assets

The assets in `public/` are already generated. Regenerate them only when you change their source:

| If you change…                    | Run                           |
| --------------------------------- | ----------------------------- |
| A sprite sheet or its combat pose | `npm run assets:busts`        |
| A stage background                | `npm run assets:stage-thumbs` |
| The social preview image          | `npm run assets:og`           |

Attack sheets and super-move actors are built from `assets/source/`, which is not in the repository, with `assets:attack-grid`, `assets:attack-art`, `assets:finale-actors` and `assets:perro-mujeriego`.

Then run `npm run check:assets` and `npm test`.

## T3 Code

New threads should use a worktree based on `origin/main`:

- In the environment settings, enable **New worktrees start from origin**.
- In the project, set **worktree** as the default thread environment.
- Run `git remote set-head origin main`.
