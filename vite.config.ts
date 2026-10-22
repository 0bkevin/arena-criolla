import { defineConfig } from "vite";
import entranceAssets from "./src/entrance-assets.json";
export default defineConfig({
  plugins: [
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
              href: "/assets/caracas.webp",
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
