import { assetVersions } from "./shared/asset-versions";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { brotliCompress, constants, gzip } from "node:zlib";
import { promisify } from "node:util";
import { defineConfig, type Plugin } from "vite";
import entranceAssets from "./src/entrance-assets.json";

const versions = await assetVersions("public");
await writeFile(
  "shared/asset-versions.json",
  JSON.stringify(versions, null, 2) + "\n",
);
const versionUrl = (url: string) =>
  versions[url] ? `${url}?v=${versions[url]}` : url;

const brotli = promisify(brotliCompress);
const deflate = promisify(gzip);

/** Write .br and .gz copies of text assets for server/precompressed.ts. */
function precompressText(): Plugin {
  let outDir = "dist";
  return {
    name: "precompress-text",
    apply: "build",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      const files = (await readdir(outDir, { recursive: true })).filter(
        (file) => /\.(?:js|mjs|css|svg|json|webmanifest)$/i.test(file),
      );
      await Promise.all(
        files.map(async (file) => {
          const source = await readFile(path.join(outDir, file));
          // Tiny files cost more in headers than compression saves.
          if (source.length < 1024) return;
          const [br, gz] = await Promise.all([
            brotli(source, {
              params: {
                [constants.BROTLI_PARAM_QUALITY]: 11,
                [constants.BROTLI_PARAM_SIZE_HINT]: source.length,
              },
            }),
            deflate(source, { level: 9 }),
          ]);
          await Promise.all([
            br.length < source.length &&
              writeFile(path.join(outDir, file + ".br"), br),
            gz.length < source.length &&
              writeFile(path.join(outDir, file + ".gz"), gz),
          ]);
        }),
      );
    },
  };
}
export default defineConfig({
  plugins: [
    precompressText(),
    {
      name: "version-public-references",
      enforce: "pre",
      transform(code, id) {
        if (!id.endsWith(".css")) return;
        return code.replace(/\/assets\/caracas\.webp/g, versionUrl);
      },
      transformIndexHtml: {
        order: "pre",
        handler(html) {
          return html.replace(/\/fonts\/[\w.-]+\.woff2/g, versionUrl);
        },
      },
    },
    {
      name: "preload-entrance-art",
      transformIndexHtml() {
        return [
          ...Object.values(entranceAssets).map((asset) => ({
            tag: "link",
            attrs: {
              rel: "preload",
              as: "image",
              type: "image/avif",
              href: asset.avif,
              fetchpriority: "high",
            },
            injectTo: "head" as const,
          })),
          {
            tag: "link",
            attrs: {
              rel: "preload",
              as: "image",
              href: versionUrl("/assets/caracas.webp"),
              fetchpriority: "high",
            },
            injectTo: "head" as const,
          },
        ];
      },
    },
  ],
  server: {
    host: "0.0.0.0",
    fs: {
      deny: [
        ".env",
        ".env.*",
        "*.{crt,pem}",
        "**/.git/**",
        "**/data/**",
        "**/*.sqlite*",
      ],
    },
  },
  build: { target: "es2022" },
});
