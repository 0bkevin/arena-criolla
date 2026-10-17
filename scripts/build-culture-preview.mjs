import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const roster = JSON.parse(await readFile("shared/fighters.json", "utf8"));
const fighters = roster.filter((f) => f.sprite.endsWith("-v15"));
const qa = JSON.parse(await readFile("docs/character-sprite-qa.json", "utf8"));
const entries = fighters.map((f) => ({
  ...f,
  image: path.resolve(`public/assets/${f.sprite}.webp`),
  frames: qa.sprites.find((s) => s.id === f.id).files[1].components,
}));
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ],
  );
const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${fighters.length} nuevas caras de Arena Criolla</title><style>
*{box-sizing:border-box}body{margin:0;color:var(--foreground,#eef2fb);background:transparent;font:13px var(--font-sans,system-ui)}.toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 14px}.toolbar label{font-size:12px;color:var(--muted-foreground,#9faabc)}select,button{font:inherit;background:var(--secondary,#1d2b43);color:var(--foreground,#eef2fb);border:1px solid var(--border,#344660);padding:8px 11px;border-radius:7px;cursor:pointer;min-height:36px}button[aria-pressed=true]{background:#ffcf43;color:#162344}.count{margin-left:auto;font-size:11px;color:var(--muted-foreground,#9faabc)}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.card{position:relative;overflow:hidden;min-width:0;border:1px solid var(--border,#344660);border-radius:10px;background:var(--card,#142139);padding:10px 8px;text-align:center}.card:before{content:"";position:absolute;inset:0 0 auto;height:3px;background:linear-gradient(90deg,#ffcf43 33%,#386aed 33% 66%,#ec5360 66%)}.art{display:block;width:100%;height:148px;object-fit:contain;background:radial-gradient(ellipse at 50% 80%,color-mix(in srgb,var(--accent) 15%,transparent),transparent 68%)}h3{font-size:12px;line-height:1.2;min-height:29px;display:flex;align-items:center;justify-content:center;margin:6px 0}.special{color:var(--accent);font-size:10px;line-height:1.3;margin:0;min-height:26px}.role{font-size:8px;letter-spacing:1px;color:var(--muted-foreground,#9faabc);margin:6px 0 0}.notes{margin:13px 0 0;color:var(--muted-foreground,#9faabc);font-size:11px}.asset{display:none}@media(max-width:600px){.grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.art{height:125px}.card{padding:10px 5px}.count{display:none}h3{font-size:11px}.special{font-size:9px}}
</style></head><body><div class="toolbar"><label for="pose">Ver pose</label><select id="pose"><option value="0">En guardia libre</option><option value="1">Bloqueo</option><option value="2">Carrera · paso 1</option><option value="3">Carrera · paso 2</option><option value="4">Salto</option><option value="5">Golpe</option><option value="6">Patada</option><option value="7">Recibir golpe</option></select><button id="animate" aria-pressed="false">▶ Animar</button><span class="count">${fighters.length} nuevos · ${fighters.length * 8} poses · ${roster.length} luchadores en total</span></div><div class="grid">${entries.map((f) => `<article class="card" style="--accent:${f.color}" title="${escape(f.description)}"><img class="asset" id="img-${f.id}" src="${f.image}" alt=""><canvas class="art" id="${f.id}" width="400" height="400" aria-label="${escape(f.name)}"></canvas><h3>${escape(f.name)}</h3><p class="special">${escape(f.special)}</p><p class="role">${escape(f.role)}</p></article>`).join("")}</div><p class="notes">Modelos originales basados en referencias revisadas individualmente. Especiales ficticios, sonidos de combate y reacciones sin palabras. Encuéntralos en «Cultura» dentro del juego.</p><script>
const fighters=${JSON.stringify(entries.map(({ id, frames }) => ({ id, frames })))};let pose=0,animated=false;
function draw(){for(const f of fighters){const img=document.getElementById('img-'+f.id);if(!img.complete||!img.naturalWidth)continue;const canvas=document.getElementById(f.id),ctx=canvas.getContext('2d'),r=f.frames[pose],w=r.maxX-r.minX+1,h=r.maxY-r.minY+1,scale=Math.min(340/(f.frames[0].maxY-f.frames[0].minY+1),375/w);ctx.clearRect(0,0,400,400);ctx.drawImage(img,r.minX,r.minY,w,h,(400-w*scale)/2,375-h*scale,w*scale,h*scale)}}
function update(){const b=document.getElementById('animate');b.setAttribute('aria-pressed',String(animated));b.textContent=animated?'Ⅱ Pausar':'▶ Animar'}
for(const f of fighters)document.getElementById('img-'+f.id).onload=draw;draw();document.getElementById('pose').onchange=e=>{pose=Number(e.target.value);animated=false;update();draw()};document.getElementById('animate').onclick=()=>{animated=!animated;update()};setInterval(()=>{if(animated){pose=(pose+1)%8;document.getElementById('pose').value=String(pose);draw()}},330);window.addEventListener('load',()=>console.log('Culture gallery: '+fighters.length+' fighters, '+fighters.reduce((sum,f)=>sum+f.frames.length,0)+' verified poses.'));
</script></body></html>`;
await writeFile("docs/culture-v15/preview.html", html);
console.log(
  `Galería de ${fighters.length} personajes y ${fighters.length * 8} poses preparada.`,
);
