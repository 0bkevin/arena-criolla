import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
const fighters = JSON.parse(
  await readFile("shared/fighters.json", "utf8"),
).filter((f) => f.category === "folklore");
const qa = JSON.parse(await readFile("docs/character-sprite-qa.json", "utf8"));
const entries = fighters.map((f) => ({
  ...f,
  image: path.resolve("public/assets/" + f.sprite + ".webp"),
  frames: qa.sprites.find((s) => s.id === f.id).files[1].components,
}));
const escape = (s) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Arena Criolla · New folklore fighters</title><style>
*{box-sizing:border-box}html,body{margin:0;background:transparent;color:var(--foreground,#eee);font:13px var(--font-sans,system-ui)}.controls{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px}.controls label{color:var(--muted-foreground,#aaa);font-size:12px}.controls select,.controls button{background:var(--secondary,#242833);color:var(--foreground,#eee);border:1px solid var(--border,#444);border-radius:6px;padding:8px 12px;min-height:36px;font:inherit;cursor:pointer}.controls button[aria-pressed=true]{background:#ffdd70;color:#14284c}.controls span{margin-left:auto;font-size:11px;color:var(--muted-foreground,#aaa)}.grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px}.fighter{min-width:0;overflow:hidden;border:1px solid var(--border,#444);border-radius:var(--radius,10px);background:var(--card,#172136);padding:16px 7px 12px;position:relative;text-align:center}.fighter:before{content:"";position:absolute;top:0;left:0;right:0;height:3px;background:var(--color)}canvas{display:block;width:100%;height:150px;object-fit:contain;background:radial-gradient(ellipse at 50% 80%,color-mix(in srgb,var(--color) 18%,transparent),transparent 68%)}h3{font-size:12px;line-height:1.25;margin:8px 0 5px;min-height:30px;display:flex;align-items:center;justify-content:center}.move{font-size:10px;color:var(--muted-foreground,#aaa);margin:0;line-height:1.3;min-height:26px}.footnote{font-size:11px;color:var(--muted-foreground,#aaa);margin:12px 0 0}.hidden{display:none}@media(max-width:540px){.grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.fighter{padding:16px 5px 10px}canvas{height:125px}.controls span{display:none}h3{font-size:11px}.move{font-size:9px}}@media(prefers-reduced-motion:reduce){.controls button{transition:none}}
</style></head><body><div class="controls"><label for="pose">Preview pose</label><select id="pose"><option value="0">Idle</option><option value="1">Guard</option><option value="2">Run · left</option><option value="3">Run · right</option><option value="4">Jump</option><option value="5">Punch</option><option value="6">Kick</option><option value="7">Hurt</option></select><button id="animate" aria-pressed="false">▶ Animate</button><span>Original sprites · 8 poses each</span></div><div class="grid">${entries.map((f) => `<article class="fighter" style="--color:${f.color}"><img class="hidden" id="img-${f.id}" src="${f.image}" alt=""><canvas id="${f.id}" width="440" height="420" aria-label="${escape(f.name)} sprite"></canvas><h3>${escape(f.name)}</h3><p class="move">${escape(f.special)}</p></article>`).join("")}</div><p class="footnote">Original arcade interpretations of Venezuelan legends and stories. Select “Leyendas” in the game to play them.</p><script>
const fighters=${JSON.stringify(entries.map(({ id, frames, displayHeight }) => ({ id, frames, displayHeight })))};
let pose=0,animated=false;
function draw(){for(const f of fighters){const img=document.getElementById('img-'+f.id);if(!img.complete||!img.naturalWidth)continue;const c=document.getElementById(f.id),ctx=c.getContext('2d'),r=f.frames[pose],w=r.maxX-r.minX+1,h=r.maxY-r.minY+1,scale=330*(f.displayHeight/177)/(f.frames[0].maxY-f.frames[0].minY+1);ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(img,r.minX,r.minY,w,h,(c.width-w*scale)/2,380-h*scale,w*scale,h*scale)}}
for(const f of fighters){document.getElementById('img-'+f.id).onload=draw;}draw();
document.getElementById('pose').onchange=e=>{pose=Number(e.target.value);animated=false;update();draw()};
function update(){const b=document.getElementById('animate');b.setAttribute('aria-pressed',String(animated));b.textContent=animated?'Ⅱ Pause':'▶ Animate'}
document.getElementById('animate').onclick=()=>{animated=!animated;update()};setInterval(()=>{if(animated){pose=(pose+1)%8;document.getElementById('pose').value=String(pose);draw()}},300);
window.addEventListener('load',()=>console.log('Folklore gallery: '+fighters.length+' original fighters, '+fighters.reduce((sum,f)=>sum+f.frames.length,0)+' verified poses.'));
</script></body></html>`;
await writeFile("docs/folklore-v12/preview.html", html);
console.log("Ten-fighter interactive gallery saved.");
