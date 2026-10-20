import fs from "node:fs/promises";
import { createHash } from "node:crypto";

const base = "docs/performance/lossless-assets";
const read = async (name) =>
  JSON.parse(await fs.readFile(`${base}/${name}.json`, "utf8"));
const [audit, avif, published, native, quality, verification, fighters] =
  await Promise.all([
    read("per-asset-audit"),
    read("avif-audit"),
    read("published-variants"),
    read("native-final-loading"),
    read("native-codec-proof"),
    read("verification"),
    fs.readFile("shared/fighters.json", "utf8").then(JSON.parse),
  ]);
const median = (values) =>
  values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)];
const names = new Map(fighters.map((f) => [f.id, f.name]));
function aggregate(rows) {
  if (
    !rows.length ||
    rows.some(
      (r) => r.bytes !== rows[0].bytes || r.requests !== rows[0].requests,
    )
  )
    throw Error("Incomplete/inconsistent benchmark");
  return {
    repeats: rows.length,
    bytes: rows[0].bytes,
    requests: rows[0].requests,
    coldMs: median(rows.map((r) => r.coldMs)),
    warmMs: median(rows.map((r) => r.warmMs)),
  };
}
const pairKeys = [
  ...new Set(
    native.rows
      .filter((r) => r.label === "final-baseline")
      .map((r) => r.pair.join("/")),
  ),
];
const pairs = pairKeys.map((key) => {
  const before = aggregate(
    native.rows.filter(
      (r) => r.pair.join("/") === key && r.label === "final-baseline",
    ),
  );
  const after = aggregate(
    native.rows.filter(
      (r) => r.pair.join("/") === key && r.label === "final-optimized",
    ),
  );
  return {
    pair: key,
    name: key
      .split("/")
      .map((id) => names.get(id))
      .join(" / "),
    before,
    after,
    savedBytes: before.bytes - after.bytes,
    savedPercent: 100 * (1 - after.bytes / before.bytes),
  };
});
const throttledBefore = aggregate(
  native.rows.filter((r) => r.label === "throttled-baseline"),
);
const throttledAfter = aggregate(
  native.rows.filter((r) => r.label === "throttled-optimized"),
);
const selected = new Map(published.selections.map((r) => [r.file, r]));
const avifs = new Map(avif.assets.map((r) => [r.file, r]));
const assets = audit.assets.map((row) => {
  const selection = selected.get(row.file),
    candidate = avifs.get(row.file);
  const variants = selection?.variants ?? [];
  const deliveredBytes = selection?.deliveredBytes ?? row.originalBytes;
  return {
    file: row.file.replace(/^public\//, ""),
    type: row.extension.slice(1).toUpperCase(),
    originalBytes: row.originalBytes,
    sameFormatExactBytes: row.tested ? row.selectedBytes : null,
    exactAvifBytes: candidate?.bestExactBytes ?? null,
    deliveredBytes,
    savedBytes: row.originalBytes - deliveredBytes,
    savedPercent: 100 * (1 - deliveredBytes / row.originalBytes),
    deployed: variants.length > 0,
    deliveredFormats: variants.length
      ? [
          ...new Set(
            variants.map((v) => v.file.split(".").at(-1).toUpperCase()),
          ),
        ].join(" + ")
      : row.extension.slice(1).toUpperCase(),
    width: row.width ?? null,
    height: row.height ?? null,
    sourceSha256: row.sourceSha256,
    rgbaSha256: row.rgbaSha256 ?? null,
    gzipBytes: row.gzipBytes,
    brotliBytes: row.brotliBytes,
    decision: variants.length
      ? "Smaller verified derivative; original fallback retained"
      : row.tested
        ? "Retain original; no exact candidate saves both 4 KiB and 1%"
        : "Retain original; gzip/Brotli byte round trips verified, no media re-encoding",
  };
});
const summary = {
  schema: 1,
  createdAtUtc: new Date().toISOString(),
  scope:
    "All 246 original public files after merging origin/main ad8398068. Generated derivatives are verified separately. Inventory totals are not initial-download totals. Measurements cover match image loading, not page startup or real-world mobile devices.",
  policy:
    "Exact current decoded straight RGBA, including invisible RGB, dimensions and color/orientation semantics. No resize, near-lossless, palette reduction or lossy re-encoding. Existing main AVIF entrance assets/background remain unchanged and are not reclassified as lossless.",
  audit: audit.summary,
  avif: avif.summary,
  published: published.summary,
  throttled: {
    pair: "llorona/dudamel",
    aggregateBitsPerSecond: 5000000,
    responseDelayMs: 80,
    before: throttledBefore,
    after: throttledAfter,
    savedMs: throttledBefore.coldMs - throttledAfter.coldMs,
    savedPercent: 100 * (1 - throttledAfter.coldMs / throttledBefore.coldMs),
  },
  pairs,
  quality: {
    originalFilesUnchanged: verification.originalFilesUnchanged,
    publishedVariants: quality.rows.length,
    differingNativePixelChannels: quality.rows.reduce(
      (n, r) => n + r.differingChannels,
      0,
    ),
    renderProof: verification.loadingProof,
  },
  assets,
};
await fs.writeFile(
  `${base}/summary.json`,
  JSON.stringify(summary, null, 2) + "\n",
);
const columns = [
  "file",
  "type",
  "originalBytes",
  "sameFormatExactBytes",
  "exactAvifBytes",
  "deliveredBytes",
  "savedBytes",
  "savedPercent",
  "deployed",
  "deliveredFormats",
  "width",
  "height",
  "sourceSha256",
  "rgbaSha256",
  "gzipBytes",
  "brotliBytes",
  "decision",
];
const csv =
  [columns, ...assets.map((row) => columns.map((key) => row[key]))]
    .map((row) =>
      row
        .map((v) => '"' + String(v ?? "").replaceAll('"', '""') + '"')
        .join(","),
    )
    .join("\n") + "\n";
await fs.writeFile(`${base}/per-asset-results.csv`, csv);
const data = JSON.stringify(summary).replaceAll("<", "\\u003c");
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Asset quality and loading audit</title>
<style>
:root{color-scheme:light dark}*{box-sizing:border-box}html,body{margin:0;background:transparent;color:var(--foreground,#20232a);font:14px/1.55 var(--font-sans,system-ui,sans-serif)}h1{font-size:27px;line-height:1.2;letter-spacing:-.7px;margin:0 0 10px}h2{font-size:18px;margin:27px 0 10px}p{margin:7px 0;color:var(--muted-foreground,#666)}strong{color:var(--foreground,#20232a)}.kicker{text-transform:uppercase;letter-spacing:1.5px;font-size:10px;font-weight:700;color:var(--muted-foreground,#666);margin-bottom:7px}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:20px 0}.stat{padding:16px;border-radius:var(--radius,10px);background:var(--muted,#f2f3f5)}.value{font-size:26px;font-weight:750;letter-spacing:-.7px;line-height:1.2}.label{font-size:12px;color:var(--muted-foreground,#666);margin-top:5px}.speed{padding:18px;border:1px solid var(--border,#ddd);border-radius:var(--radius,10px)}.speedline{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;font-size:18px}.speedline b{font-size:31px;letter-spacing:-1px}.small{font-size:12px}.bars{display:grid;gap:13px;margin:14px 0}.bar-head{display:flex;justify-content:space-between;gap:15px;font-size:12px;margin-bottom:4px}.bar-head span:first-child{font-weight:600}.track{height:8px;background:var(--muted,#e6e8ec);border-radius:4px;overflow:hidden}.fill{height:100%;background:var(--chart-1,#6473d5);border-radius:4px}.controls{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:12px 0}input,select,button{font:inherit;color:inherit;background:var(--card,#fff);border:1px solid var(--border,#ccc);border-radius:7px;padding:8px 10px}input{flex:1;min-width:170px}button{cursor:pointer}input:focus-visible,select:focus-visible,button:focus-visible,summary:focus-visible{outline:2px solid var(--ring,#6876dc);outline-offset:2px}.scroll{overflow:auto;max-height:400px;border-block:1px solid var(--border,#ddd)}table{border-collapse:collapse;width:100%;font-size:12px;font-variant-numeric:tabular-nums}th{position:sticky;top:0;background:var(--background,#fff);text-align:right;color:var(--muted-foreground,#666);font-size:10px;text-transform:uppercase;letter-spacing:.5px;padding:11px 8px;border-bottom:1px solid var(--border,#ddd);white-space:nowrap}th:first-child,td:first-child{text-align:left}td{padding:10px 8px;text-align:right;border-bottom:1px solid var(--border,#eee);vertical-align:top;white-space:nowrap}.file{white-space:normal;min-width:205px;max-width:270px;overflow-wrap:anywhere;font-size:11px}.file small{display:block;color:var(--muted-foreground,#666);font:10px/1.4 var(--font-sans,system-ui)}.saved{font-weight:650}.badge{font-size:9px;letter-spacing:.4px;font-weight:700;color:var(--chart-1,#6473d5)}details{margin-top:15px}summary{cursor:pointer;font-weight:600}ul{padding-left:19px;color:var(--muted-foreground,#666)}li{margin:6px 0}.foot{font-size:11px;margin-top:18px}code{font:11px var(--font-mono,monospace)}@media(max-width:450px){h1{font-size:23px}.stats{gap:7px}.stat{padding:12px}.value{font-size:22px}.label{font-size:10px}.speedline b{font-size:27px}}
</style></head><body>
<div class="kicker">Arena Criolla · measured after merging main</div><h1>Faster loading. The same artwork.</h1>
<p>Load only the animation assets a fight needs, then serve smaller files when every pixel is preserved.</p>
<div class="stats"><div class="stat"><div class="value">246</div><div class="label">original files audited</div></div><div class="stat"><div class="value">39</div><div class="label">images with smaller variants</div></div><div class="stat"><div class="value">0</div><div class="label">changed pixel channels</div></div></div>
<div class="speed"><div class="kicker">Cold image loading · shared 5 Mbps · 80 ms response delay</div><div class="speedline"><span>Before <b id="before"></b></span><span aria-hidden="true">→</span><span>After <b id="after"></b></span></div><p id="speed-copy"></p><p class="small">La Llorona / Gustavo Dudamel · median of 3 runs per version in native Chromium. Both retain main’s existing AVIF background. Measures the match image loader; excludes page startup, scripts and device throttling. These are controlled measurements, not field data.</p></div>
<h2>Less to download for each fight</h2><p class="small">Actual image response bytes, including lossless delivery. Three cold runs for each of these six pairs. A full warm loader-cache call took 0–0.2 ms.</p><div class="bars" id="pairs"></div>
<details><summary>Quality checks and format choices</summary><ul>
<li>All 218 source images tested as exact-quality AVIF. At the tested settings, only the social preview PNG became smaller. Converting the full image inventory to AVIF would increase it from 140.7 MB to 211.9 MB.</li>
<li>40 published variants for 39 source images: smaller WebP files, one AVIF social preview and its PNG fallback. Practical threshold: at least 4 KiB and 1% saved. Compression saves 1.09 MB across the selected inventory; a player downloads only the assets their session needs.</li>
<li>Exact straight RGBA checks include RGB under fully transparent pixels, dimensions and color/orientation semantics. Native browser checks compare all pixels of every derivative. Originals are retained and automatically used if a derivative is missing, stale or corrupt.</li>
<li>Every-frame image provenance checked across 312 attack demos / 48,544 rendered frames, plus 3,300 complete 1080 × 640 RGBA comparisons. Target fixtures test rendering with substituted identities and mirrored capture snapshots; they do not replay combat physics for every opponent.</li>
<li>Audio, fonts, SVG and text stay byte-identical. Gzip/Brotli round trips were tested; production already has zstd/gzip through Caddy. Existing entrance AVIFs and the separately published offline guide remain unchanged.</li>
<li>The AVIF social preview decodes more slowly locally (110 ms versus 24 ms median) but saves 736 KB over its PNG source. It is outside gameplay. Local loopback loader times were mixed; the measured network saving comes from fewer bytes, not a claim of faster rendering.</li>
</ul></details>
<h2>Every asset, individually</h2><p class="small">Compare exact candidates and the deployed choice. Sizes are file bytes before HTTP compression; the selected format is conditional on browser support.</p>
<div class="controls"><input id="search" type="search" aria-label="Search assets" placeholder="Search character, file or format…"><select id="filter" aria-label="Filter results"><option value="all">All 246 files</option><option value="deployed">39 optimized sources</option><option value="unchanged">Retained originals</option></select><button id="csv" type="button">Export CSV</button></div><p id="count" class="small" role="status" aria-live="polite"></p>
<div class="scroll" role="region" aria-label="Asset compression results" tabindex="0"><table><thead><tr><th scope="col">Asset / choice</th><th scope="col">Original</th><th scope="col">Exact same format</th><th scope="col">Exact AVIF</th><th scope="col">Delivered</th><th scope="col">Saved</th></tr></thead><tbody id="rows"></tbody></table></div>
<p class="foot">No resizing, quantization, near-lossless conversion or lossy re-encoding in this change. Original source inventory: 141.2 MB, not a single-user download. All original file hashes verified against the merged branch. Reproducible JSON, CSV, verification and benchmark tooling are preserved beside this report.</p>
<script>const data=${data};
const fmt=n=>n==null?'—':n>=1e6?(n/1e6).toFixed(2)+' MB':n>=1000?(n/1000).toFixed(1)+' KB':n+' B';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
document.querySelector('#before').textContent=(data.throttled.before.coldMs/1000).toFixed(1)+'s';document.querySelector('#after').textContent=(data.throttled.after.coldMs/1000).toFixed(1)+'s';
document.querySelector('#speed-copy').innerHTML='<strong>'+data.throttled.savedPercent.toFixed(1)+'% less waiting</strong> · '+fmt(data.throttled.before.bytes)+' → '+fmt(data.throttled.after.bytes)+' · 12 → 8 image requests';
document.querySelector('#pairs').innerHTML=data.pairs.map(p=>'<div><div class="bar-head"><span>'+esc(p.name)+'</span><span>'+fmt(p.before.bytes)+' → '+fmt(p.after.bytes)+' · '+p.savedPercent.toFixed(1)+'% less</span></div><div class="track"><div class="fill" style="width:'+(100*p.after.bytes/p.before.bytes)+'%"></div></div></div>').join('');
function render(){const query=document.querySelector('#search').value.toLowerCase(),filter=document.querySelector('#filter').value;const rows=data.assets.filter(r=>(r.file+' '+r.deliveredFormats).toLowerCase().includes(query)&&(filter==='all'||(filter==='deployed'?r.deployed:!r.deployed))).toSorted((a,b)=>b.savedBytes-a.savedBytes||a.file.localeCompare(b.file));document.querySelector('#count').textContent=rows.length+' of '+data.assets.length+' files';document.querySelector('#rows').innerHTML=rows.map(r=>'<tr><td class="file" title="'+esc(r.decision)+'">'+esc(r.file)+'<small>'+(r.width?r.width+' × '+r.height+' · ':'')+esc(r.deliveredFormats)+' '+(r.deployed?'<span class="badge">OPTIMIZED</span>':'· retained')+'</small></td><td>'+fmt(r.originalBytes)+'</td><td>'+fmt(r.sameFormatExactBytes)+'</td><td>'+fmt(r.exactAvifBytes)+'</td><td>'+fmt(r.deliveredBytes)+'</td><td class="saved">'+(r.savedBytes?fmt(r.savedBytes)+'<br><small>'+r.savedPercent.toFixed(1)+'%</small>':'—')+'</td></tr>').join('');}
document.querySelector('#search').addEventListener('input',render);document.querySelector('#filter').addEventListener('change',render);render();
document.querySelector('#csv').onclick=()=>{const keys=Object.keys(data.assets[0]);const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';const csv=[keys,...data.assets.map(r=>keys.map(k=>r[k]))].map(row=>row.map(quote).join(',')).join('\\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='per-asset-results.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
console.log('Asset audit ready',{assets:data.assets.length,pairs:data.pairs.length,variants:data.quality.publishedVariants,pixelDifferences:data.quality.differingNativePixelChannels});
</script></body></html>`;
await fs.writeFile(`${base}/index.html`, html);
const files = [
  "per-asset-audit.json",
  "avif-audit.json",
  "published-variants.json",
  "native-codec-proof.json",
  "native-final-loading.json",
  "loading-visual-proof.json",
  "verification.json",
  "production-delivery-proof.json",
  "validation.json",
];
const inputs = Object.fromEntries(
  await Promise.all(
    files.map(async (file) => [
      file,
      createHash("sha256")
        .update(await fs.readFile(`${base}/${file}`))
        .digest("hex"),
    ]),
  ),
);
await fs.writeFile(
  `${base}/report-inputs.json`,
  JSON.stringify(inputs, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    assets: assets.length,
    pairs: pairs.length,
    throttleSavedMs: summary.throttled.savedMs,
    throttleSavedPercent: summary.throttled.savedPercent,
  }),
);
