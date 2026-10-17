import {build} from "vite";
import {readFile,writeFile} from "node:fs/promises";
import path from "node:path";
const stages=JSON.parse(await readFile("shared/stages.json","utf8")).filter(s=>s.artStyle==="pixel");
const compiled=await build({configFile:false,logLevel:"silent",build:{write:false,minify:true,lib:{entry:"scripts/stage-preview-entry.ts",name:"StagePreview",formats:["iife"]}}});
const bundle=(Array.isArray(compiled)?compiled[0]:compiled).output.find(o=>o.type==="chunk").code;
const sounds=await Promise.all(["light","heavy","block"].map(async id=>({id,src:"data:audio/mp3;base64,"+(await readFile(`docs/sfx-preview/${id}.mp3`)).toString("base64")})));
const esc=s=>String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll('"',"&quot;");
const html=`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
:root{--radius:10px;--foreground:#e5e7ec;--muted-foreground:#969eb0;--card:#1a1d25;--border:#353b49;--font-sans:system-ui,sans-serif}
html,body{background:transparent;margin:0;font-family:var(--font-sans);color:var(--foreground)}*{box-sizing:border-box}
.counts{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px;font-size:11px;color:var(--muted-foreground)}
.counts span{padding:5px 8px;border:1px solid var(--border);border-radius:5px}
.toolbar{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin:0 0 14px}
button{font:600 11px var(--font-sans);color:var(--foreground);background:var(--card);border:1px solid var(--border);border-radius:5px;padding:9px 10px;cursor:pointer}
button:hover,button.active{border-color:#a5bd5c;background:#90ad3120}button:focus-visible{outline:2px solid #bbdc76;outline-offset:2px}
.toolbar .pause{margin-left:auto}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
article{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:16px;min-width:0}
canvas{display:block;width:100%;height:auto;aspect-ratio:27/16;image-rendering:pixelated;border-radius:5px;background:#151923}
h3{font-size:17px;line-height:1.2;margin:13px 0 5px;font-weight:760;letter-spacing:-.3px}.location{font-size:9px;letter-spacing:.7px;color:var(--muted-foreground)}
p{font-size:11px;line-height:1.6;color:var(--muted-foreground);margin:9px 0 0}.tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:11px}
.tags span{font-size:9px;border:1px solid var(--border);border-radius:4px;padding:4px 6px}
.note{font-size:10px;margin-top:13px;line-height:1.6}.status{font-size:10px;color:var(--muted-foreground);margin:0 0 12px}
@media(max-width:420px){.grid{gap:9px}article{padding:16px}h3{font-size:14px}.toolbar .pause{margin-left:0}.location{font-size:8px}p{font-size:10px}}
</style></head><body>
<div class="counts"><span>9 escenarios</span><span>6 fondos nuevos en pixel art</span><span>5 plataformas móviles</span></div>
<div class="toolbar"><button data-sound="light">✦ Golpe ligero</button><button data-sound="heavy">⚡ Golpe fuerte</button><button data-sound="block">◈ Bloqueo</button><button class="pause" id="pause">Pausar animaciones</button></div>
<div class="status" id="status" aria-live="polite">Prueba los sonidos y los destellos de impacto.</div>
<section class="grid">${stages.map(s=>`<article><canvas id="scene-${s.id}" width="1080" height="640" aria-label="Escenario animado ${esc(s.name)}"></canvas><img hidden id="bg-${s.id}" src="${path.resolve("public/assets",s.id+".webp")}" alt=""><h3>${esc(s.name)}</h3><div class="location">${esc(s.location)}</div><p>${esc(s.description)}</p><div class="tags"><span>${s.platforms.length?s.platforms.length+" plataformas":"A ras del suelo"}</span>${s.platforms.some(p=>p.motion)?'<span>Plataforma móvil</span>':''}</div></article>`).join("")}</section>
<p class="note">Las plataformas y los elementos animados se muestran con el mismo dibujo del juego. Sonidos capturados de su salida de audio. Elige el escenario dentro de «Ver los 9 escenarios» para jugar.</p>
<script>${bundle}
const stages=${JSON.stringify(stages)},sounds=new Map(${JSON.stringify(sounds)}.map(s=>[s.id,new Audio(s.src)]));
let playing=true,tick=150,last=performance.now(),impact=null;
document.getElementById('pause').onclick=()=>{playing=!playing;document.getElementById('pause').textContent=playing?'Pausar animaciones':'Reanudar animaciones'};
document.querySelectorAll('[data-sound]').forEach(button=>button.onclick=()=>{
 for(const audio of sounds.values()){audio.pause();audio.currentTime=0}
 const id=button.dataset.sound;
 sounds.get(id).play().catch(()=>{document.getElementById('status').textContent='Pulsa un sonido para escucharlo.'});
 impact={id,started:performance.now()};
 document.getElementById('status').textContent={light:'Impacto ligero: chasquido y chispas.',heavy:'Impacto fuerte: golpe grave, explosión y onda.',block:'Bloqueo: golpe metálico y destello azul.'}[id];
});
function animate(now){
 if(playing)tick+=Math.min(80,now-last)*.06;last=now;
 for(const stage of stages){
  const img=document.getElementById('bg-'+stage.id);if(!img.complete||!img.naturalWidth)continue;
  const canvas=document.getElementById('scene-'+stage.id),ctx=canvas.getContext('2d');
  StagePreview.drawStage(ctx,stage,img,Math.floor(tick));
  if(impact){const age=Math.floor((now-impact.started)/16.6667);if(age<26)StagePreview.drawImpact(ctx,{id:4,x:540,y:410,life:26-age,duration:26,kind:impact.id==='block'?'block':'hit',impact:impact.id==='heavy'?'heavy':'light',strength:impact.id==='heavy'?1.35:.85,direction:1,color:impact.id==='block'?'#9edaff':'#ffc57f'})}
 }
 requestAnimationFrame(animate);
}
Promise.all(stages.map(s=>{const i=document.getElementById('bg-'+s.id);return i.complete?Promise.resolve():new Promise(r=>i.onload=r)})).then(()=>{window.__StagePreviewReady=true;requestAnimationFrame(animate)});
</script></body></html>`;
await writeFile("docs/stages-preview-v4.html",html);
console.log(`Galería: ${stages.length} escenarios animados y ${sounds.length} sonidos; ${html.length} caracteres.`);
