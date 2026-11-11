// Written by scripts/cloudflare/prepare.ts during `npm run cf:build`.
declare module "*/.cloudflare/site.json" {
  const site: { template: string; socialImagePath: string };
  export default site;
}
