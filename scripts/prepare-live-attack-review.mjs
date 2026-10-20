import fs from 'node:fs/promises';
const source = await fs.readFile('docs/finales/moveset-guide/template.html','utf8');
const fonts = `@font-face{font-family:'DM Sans';font-weight:400;src:url(/fonts/dm-sans-400.ttf)}@font-face{font-family:'DM Sans';font-weight:700;src:url(/fonts/dm-sans-700.ttf)}@font-face{font-family:'Barlow Condensed';font-weight:800;src:url(/fonts/barlow-800.ttf)}body{max-width:1050px;margin:24px auto;padding:0 16px}`;
const html = source.replace('__FONTS__',fonts)
 .replace('__POSTER__','/docs/finales/moveset-guide/media/poster.webp')
 .replace(/  <script id="guide-images"[\s\S]*?<\/body>/,'  <script type="module" src="/docs/finales/moveset-guide/guide.ts"></script>\n</body>');
await fs.writeFile('docs/finales/attack-overhaul/review.html',html);
console.log('Live engine/renderer review: http://localhost:5184/docs/finales/attack-overhaul/review.html');
