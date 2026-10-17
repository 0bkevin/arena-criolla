import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(".");
const fighters = JSON.parse(await readFile("shared/fighters.json", "utf8"));
const manifest = JSON.parse(
  await readFile("docs/character-manifest.json", "utf8"),
);
const qa = JSON.parse(await readFile("docs/character-sprite-qa.json", "utf8"));
const knownCrops = {
  zavarce: [140, 132, 350, 470],
  vallenilla: [390, 95, 485, 615],
  javier: [998, 48, 772, 1009],
  gomez: [420, 0, 550, 650],
  simon: [565, 210, 300, 385],
  emilio: [376, 20, 375, 600],
  maite: [358, 0, 384, 520],
  chataing: [649, 46, 341, 529],
  george: [500, 302, 125, 185],
  mcm: [186, 38, 253, 366],
};
const escaped = (value = "") =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
await mkdir("docs/character-previews", { recursive: true });
const data = [];
for (const fighter of fighters) {
  const character = manifest.characters[fighter.id];
  const checked = qa.sprites.find((sprite) => sprite.id === fighter.id);
  if (!checked)
    throw new Error(`Falta verificación del atlas de ${fighter.id}`);
  const photo = path.join(
    root,
    "docs/character-previews",
    `${fighter.id}-reference.webp`,
  );
  const reference = character.portraitReference;
  if (!reference && fighter.category !== "folklore")
    throw new Error(`Falta retrato real de ${fighter.id}`);
  let image = reference ? sharp(path.join(root, reference)) : null;
  if (image && knownCrops[fighter.id]) {
    const [left, top, width, height] = knownCrops[fighter.id];
    image = image.extract({ left, top, width, height });
  }
  if (image)
    await image
      .resize(300, 350, { fit: "cover", position: "attention" })
      .webp({ quality: 86 })
      .toFile(photo);
  const source =
    character.photos?.find((candidate) => candidate.file === reference)?.url ||
    character.sources.find((candidate) =>
      /retrato|foto|biograf|portrait|oficial|commons/i.test(candidate.title),
    )?.url ||
    character.sources[0]?.url;
  data.push({
    ...fighter,
    photo: reference ? photo : null,
    referenceUrl: source,
    character,
    image: path.join(root, "public/assets", `${fighter.sprite}.webp`),
    frames: checked.files[1].components,
  });
}
const cards = data
  .map(
    (
      f,
      index,
    ) => `<article class="fighter" data-name="${escaped(f.name.toLowerCase())}" style="--accent:${f.color}">
  <header><span>${String(index + 1).padStart(2, "0")}</span><h3>${escaped(f.name)}</h3><small>${escaped(f.role)}</small></header>
  <div class="comparison" ${f.photo ? "" : 'style="grid-template-columns:1fr"'}>${f.photo ? `<figure><img src="${f.photo}" alt="Fotografía real de ${escaped(f.name)}"><figcaption><a href="${escaped(f.referenceUrl)}" target="_blank">Referencia real ↗</a></figcaption></figure>` : ""}<figure><canvas id="sprite-${f.id}" width="280" height="310" aria-label="Modelo de ${escaped(f.name)}"></canvas><figcaption>${f.photo ? "Modelo del juego · 8 poses" : `<a href="${escaped(f.referenceUrl)}" target="_blank">Interpretación del folklore · Fuente cultural ↗</a>`}</figcaption></figure></div>
  <p class="traits">${escaped((f.character.distinctiveTraits || []).slice(0, 2).join(" "))}</p>
  <p class="move">✦ ${escaped(f.special)} <span>${escaped(f.combos[2])}</span></p>
</article>`,
  )
  .join("\n");
const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Arena Criolla · Elenco y referencias</title><style>
*{box-sizing:border-box}body{margin:0;background:#101218;color:#eeeef2;font:14px system-ui,sans-serif}main{max-width:1400px;margin:auto;padding:30px}header.page{display:flex;justify-content:space-between;gap:20px;align-items:flex-end;margin-bottom:20px}.eyebrow{color:#dfff7b;letter-spacing:3px;font-size:10px}h1{margin:8px 0;font-size:clamp(25px,5vw,45px);letter-spacing:-1.5px}header.page p{margin:0;color:#9a9ca9;font-size:12px}.status{background:#1b2317;color:#dfff7b;border:1px solid #414b30;border-radius:7px;padding:10px;white-space:nowrap;font-size:11px}.toolbar{display:flex;justify-content:space-between;gap:12px;margin:18px 0}.toolbar input{width:240px;border:1px solid #353743;border-radius:6px;background:#191c24;color:#fff;padding:10px;font:inherit}.toolbar button{border:1px solid #393b47;border-radius:6px;background:#20242d;color:#b6b9c8;padding:9px 13px;cursor:pointer}.toolbar button.active{color:#dfff7b;border-color:#7c9252}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.fighter{border:1px solid #323541;border-radius:10px;background:#181b23;overflow:hidden}.fighter>header{display:flex;align-items:center;gap:10px;padding:14px;border-bottom:1px solid #292d39}.fighter h3{font-size:16px;letter-spacing:-.3px;margin:0;flex:1}.fighter header span{font-size:10px;color:var(--accent)}.fighter small{font-size:8px;color:#a4a7b8}.comparison{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px;background:radial-gradient(ellipse at 80% 60%,color-mix(in srgb,var(--accent) 14%,transparent),transparent 70%)}figure{margin:0;min-width:0}figure img,figure canvas{width:100%;height:180px;object-fit:cover;object-position:top;border-radius:5px;background:#11141a}figure canvas{background:transparent}figcaption{text-align:center;font-size:8px;color:#888f9e;margin-top:5px}a{color:inherit;text-decoration:none}a:hover{text-decoration:underline}.traits{padding:0 14px;color:#a5a9b8;font-size:10px;line-height:1.5;min-height:45px}.move{padding:0 14px;color:var(--accent);font-size:11px}.move span{display:block;color:#7c8394;font-size:9px;margin:4px 0}.voices{padding:12px 14px;border-top:1px solid #2b2f3d;background:#14171e}summary{cursor:pointer;font-size:10px;color:#c6d997}audio{width:100%;height:30px;margin-top:8px}.voices p{font-size:11px;margin:8px 0;color:#d8dbe5}.voices a{font-size:9px;color:#848c9c}.voices details+details{margin-top:10px}.silent{font-size:10px;color:#9e91b6}footer{color:#83899b;font-size:10px;margin-top:24px;line-height:1.7}.hidden{display:none}@media(min-width:1100px){.grid{grid-template-columns:repeat(5,minmax(0,1fr))}.fighter>header{flex-wrap:wrap}.fighter small{width:100%}.comparison{padding:10px 7px;gap:5px}figure img,figure canvas{height:140px}.traits{min-height:70px}}@media(max-width:650px){main{padding:18px}.grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}header.page{display:block}.status{display:inline-block;margin-top:12px}.fighter h3{font-size:12px}.fighter small{display:none}figure img,figure canvas{height:120px}.traits{display:none}.toolbar{flex-wrap:wrap}.toolbar input{width:100%}.voices{padding:10px}}
</style></head><body><main><header class="page"><div><span class="eyebrow">ARENA CRIOLLA · ELENCO V12</span><h1>${data.length} personajes en la arena.</h1><p>15 figuras de la cultura y 10 personajes del folklore.</p></div><span class="status">${data.length} personajes · 8 poses cada uno</span></header><div class="toolbar"><input id="search" placeholder="Buscar personaje…" aria-label="Buscar personaje"><div><button class="active" data-mode="face">Ver rostro</button> <button data-mode="full">Ver cuerpo</button> <button id="animate">Animar poses</button></div></div><section class="grid">${cards}</section><footer>Fotografías enlazadas a sus fuentes. Ilustraciones realizadas con image_gen: retratos de figuras reales y adaptaciones originales del folklore. El combate utiliza impactos y reacciones breves de esfuerzo y dolor. Sin diálogos ni grabaciones de los personajes reales.</footer></main><script>
const fighters=${JSON.stringify(data.map(({ id, image, frames }) => ({ id, image, frames })))};
let mode='face',animated=false,pose=0;
const images=new Map();const heads=new Map();
function headCenter(img,frame){const w=frame.maxX-frame.minX+1,h=Math.max(1,Math.ceil((frame.maxY-frame.minY+1)*.24)),c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,frame.minX,frame.minY,w,h,0,0,w,h);const rgba=ctx.getImageData(0,0,w,h).data;let sum=0,weight=0;for(let p=0;p<w*h;p++){const alpha=rgba[p*4+3];if(alpha>=40){sum+=(p%w)*alpha;weight+=alpha}}return frame.minX+(weight?sum/weight:w/2)}
function draw(f){const img=images.get(f.id);if(!img?.complete)return;const c=document.getElementById('sprite-'+f.id),ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);const frame=f.frames[animated?pose:0],w=frame.maxX-frame.minX+1,h=frame.maxY-frame.minY+1;let x=frame.minX,y=frame.minY,sw=w,sh=h;if(mode==='face'){sh=Math.min(h,h*.45);sw=Math.min(w,sh*.9);const center=heads.get(f.id)??frame.minX+w/2;x=Math.max(frame.minX,Math.min(frame.maxX-sw+1,center-sw/2));}const scale=Math.min((c.width-20)/sw,(c.height-12)/sh);ctx.drawImage(img,x,y,sw,sh,(c.width-sw*scale)/2,c.height-sh*scale,sw*scale,sh*scale);}
for(const f of fighters){const img=new Image();images.set(f.id,img);img.onload=()=>{heads.set(f.id,headCenter(img,f.frames[0]));draw(f)};img.src=f.image;}
document.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>{mode=button.dataset.mode;document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b===button));fighters.forEach(draw)});
document.getElementById('animate').onclick=(event)=>{animated=!animated;event.target.classList.toggle('active',animated);if(animated){mode='full';document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode==='full'));}pose=0;fighters.forEach(draw)};setInterval(()=>{if(animated){pose=(pose+1)%8;fighters.forEach(draw)}},260);
document.getElementById('search').oninput=(event)=>{const query=event.target.value.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase();document.querySelectorAll('.fighter').forEach(card=>card.classList.toggle('hidden',!card.dataset.name.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').includes(query)))};
</script></body></html>`;
await writeFile("docs/character-preview.html", html);
console.log(
  `${data.length} character comparisons prepared without real-person audio.`,
);
