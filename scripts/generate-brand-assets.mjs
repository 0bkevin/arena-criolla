import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// Keep the transparent master editable; every browser/app export comes from it.
const directory = new URL("../public/assets/", import.meta.url);
const master = await readFile(new URL("arena-mark.svg", directory), "utf8");
// Read the live button accent so exports stay aligned with the interface.
const theme = await readFile(
  new URL("../src/arcade-theme.css", import.meta.url),
  "utf8",
);
const buttonYellow = theme.match(/--coin:\s*(#[\da-f]{6})\s*;/i)?.[1];
if (!buttonYellow)
  throw new Error("The arcade theme must define --coin as a hex color.");
const artwork = master.match(/<g id="brand-mark">[\s\S]*?<\/g>/)?.[0];
if (!artwork) throw new Error('The SVG master must contain g id="brand-mark".');
const descriptionElement = master.match(/<desc>[\s\S]*?<\/desc>/)?.[0] ?? "";
const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><title>Arena Criolla</title>${descriptionElement}<rect width="64" height="64" rx="16" fill="${buttonYellow}"/>${artwork}</svg>\n`;
// The full-bleed maskable export keeps the entire mark inside the safe circle.
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><title>Arena Criolla</title>${descriptionElement}<rect width="64" height="64" fill="${buttonYellow}"/><g transform="translate(11.52 11.52) scale(.64)">${artwork}</g></svg>`;
// Full-size yellow badge with transparent corners and no outer background.
const logo = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 64 64"><title>Arena Criolla</title>${descriptionElement}<rect width="64" height="64" rx="16" fill="${buttonYellow}"/>${artwork}</svg>\n`;

await writeFile(new URL("arena-icon.svg", directory), icon);
// The repository/project icon uses the same approved artwork as the game.
await writeFile(new URL("../assets/icon.svg", import.meta.url), icon);
await writeFile(new URL("arena-logo.svg", directory), logo);
for (const [name, source, size] of [
  ["arena-icon-32.png", icon, 32],
  ["arena-icon-180.png", icon, 180],
  ["arena-icon-192.png", icon, 192],
  ["arena-icon-512.png", icon, 512],
  ["arena-icon-maskable-512.png", maskable, 512],
]) {
  await sharp(Buffer.from(source))
    .resize(size, size)
    .png()
    .toFile(fileURLToPath(new URL(name, directory)));
}
console.log("Exported Arena Criolla browser/app icons and social-cover logo.");
