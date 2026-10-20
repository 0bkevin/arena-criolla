import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs/promises";

const ref = "7afaaa41fdbb028eb809cb166d892eabafb947b8";
const modules = {
  assets: "assets.ts",
  finale: "finale-sounds.ts",
  victory: "victory-music.ts",
};
await fs.mkdir("docs/performance/runtime", { recursive: true });
await build({
  stdin: {
    contents: `export * from 'baseline:assets'; export {writeFinaleMusic} from 'baseline:finale'; export {writeVictoryMusic} from 'baseline:victory'; export {writeArcadeMusic,MUSIC_SECONDS} from './src/game/arcade-music';`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  format: "esm",
  target: "es2022",
  minify: true,
  outfile: "docs/performance/runtime/baseline.js",
  plugins: [
    {
      name: "frozen-source",
      setup(build) {
        build.onResolve({ filter: /^baseline:/ }, ({ path }) => ({
          path: path.slice(9),
          namespace: "baseline",
        }));
        build.onLoad(
          { filter: /.*/, namespace: "baseline" },
          ({ path: name }) => ({
            contents: execFileSync(
              "git",
              ["show", `${ref}:src/game/${modules[name]}`],
              { encoding: "utf8" },
            ),
            loader: "ts",
            resolveDir: path.resolve("src/game"),
          }),
        );
      },
    },
  ],
});
