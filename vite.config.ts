import { defineConfig } from "vite";
export default defineConfig({
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
