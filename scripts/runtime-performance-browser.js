// Load with import() on the local Vite fixture after build-runtime-baseline.mjs.
const baseline = await import("/docs/performance/runtime/baseline.js");
const current = await import("/src/game/assets.ts");
const { BUILT_IN_FIGHTERS } = await import("/shared/content.ts");
const { finaleById } = await import("/shared/finales.ts");
const { victoryById } = await import("/src/game/victory.ts");
const { synthesizeScore } = await import("/src/game/music-preparation.ts");
const report = { sprites: [], audio: [], timings: [], errors: [] };
const hash = async (data) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", data))]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
const same = (a, b) =>
  a.length === b.length && a.every((value, i) => value === b[i]);
const canvas = () => {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  return c.getContext("2d", { willReadFrequently: true });
};
const left = canvas(),
  right = canvas();

async function sprite(id) {
  const before = await baseline.loadSprite(id, { entrance: false });
  const after = await current.loadSprite(id, { entrance: false });
  for (const key of [
    "frames",
    "portraitCenters",
    "baseline",
    "bodyHeight",
    "frameFacing",
    "battleFrame",
    "cellWidth",
    "cellHeight",
  ])
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key]))
      throw Error(`${id}: ${key}`);
  let comparisons = 0;
  const hashes = [];
  for (let frame = 0; frame < 8; frame++) {
    const a = before.frameTextures?.[frame],
      b = after.frameTextures?.[frame];
    if (!!a !== !!b) throw Error(`${id}: isolation ${frame}`);
    if (a) {
      const ap = a.getContext("2d").getImageData(0, 0, a.width, a.height).data;
      const bp = b.getContext("2d").getImageData(0, 0, b.width, b.height).data;
      if (!same(ap, bp)) throw Error(`${id}: isolated RGBA ${frame}`);
      comparisons++;
    }
    for (const facing of [-1, 1]) {
      left.clearRect(0, 0, 512, 512);
      right.clearRect(0, 0, 512, 512);
      baseline.drawSprite(left, before, frame, 256, 460, 360, facing);
      current.drawSprite(right, after, frame, 256, 460, 360, facing);
      const ap = left.getImageData(0, 0, 512, 512).data;
      const bp = right.getImageData(0, 0, 512, 512).data;
      if (!same(ap, bp)) throw Error(`${id}: rendered RGBA ${frame}/${facing}`);
      comparisons++;
      hashes.push(await hash(bp));
    }
  }
  const row = {
    id,
    comparisons,
    portraitCenters: after.portraitCenters,
    hashes,
    differingChannels: 0,
  };
  report.sprites.push(row);
  return { id, comparisons };
}

let serial = 0;
const worker = new Worker(
  new URL("/src/game/music.worker.ts", location.origin),
  { type: "module" },
);
const jobs = new Map();
worker.onmessage = ({ data }) => {
  const job = jobs.get(data.id);
  jobs.delete(data.id);
  data.error ? job.reject(Error("synthesis failed")) : job.resolve(data.result);
};
worker.onerror = (e) => {
  for (const job of jobs.values()) job.reject(Error(e.message));
  jobs.clear();
};
const inWorker = (input) =>
  new Promise((resolve, reject) => {
    const id = ++serial;
    jobs.set(id, { resolve, reject });
    worker.postMessage({ id, input });
  });
async function audio(fighter, sampleRate) {
  const requests =
    fighter === "ambience"
      ? [
          {
            kind: "ambience",
            sampleRate,
            length: Math.round(sampleRate * baseline.MUSIC_SECONDS),
          },
        ]
      : [
          {
            kind: "victory",
            fighter,
            style: fighter === "draw" ? "strings" : victoryById(fighter).music,
            sampleRate,
            length: Math.ceil(sampleRate * 3.5),
          },
          ...(finaleById(fighter)
            ? [
                {
                  kind: "finale",
                  fighter,
                  profile: finaleById(fighter),
                  sampleRate,
                  length: Math.ceil(
                    (sampleRate * finaleById(fighter).duration) / 60,
                  ),
                },
              ]
            : []),
        ];
  for (const request of requests) {
    const a = new Float32Array(request.length),
      b = new Float32Array(request.length);
    if (request.kind === "ambience")
      baseline.writeArcadeMusic(a, b, sampleRate);
    else if (request.kind === "finale")
      baseline.writeFinaleMusic(a, b, sampleRate, fighter);
    else baseline.writeVictoryMusic(a, b, sampleRate, fighter);
    const result = await inWorker(request);
    // Uint8 comparison also catches signed zero and any last-bit differences.
    for (const [before, after] of [
      [a, result.left],
      [b, result.right],
    ])
      if (!same(new Uint8Array(before.buffer), new Uint8Array(after.buffer)))
        throw Error(`${fighter}: PCM ${request.kind}/${sampleRate}`);
    report.audio.push({
      fighter,
      sampleRate,
      kind: request.kind,
      frames: request.length,
      leftSha256: await hash(result.left),
      rightSha256: await hash(result.right),
      differingBytes: 0,
    });
  }
  return { fighter, sampleRate };
}

async function timing(useWorker) {
  let last = performance.now(),
    maxGap = 0,
    pulses = 0;
  const timer = setInterval(() => {
    const now = performance.now();
    maxGap = Math.max(maxGap, now - last);
    last = now;
    pulses++;
  }, 4);
  await new Promise((resolve) => setTimeout(resolve, 20));
  const start = performance.now();
  const request = {
    kind: "ambience",
    sampleRate: 48000,
    length: Math.round(48000 * baseline.MUSIC_SECONDS),
  };
  if (useWorker) await inWorker(request);
  else synthesizeScore(request);
  const elapsedMs = performance.now() - start;
  await new Promise((resolve) => setTimeout(resolve, 20));
  clearInterval(timer);
  const row = { useWorker, elapsedMs, maxGap, pulses };
  report.timings.push(row);
  return row;
}

globalThis.runtimeAudit = {
  report,
  sprite,
  audio,
  timing,
  ids: BUILT_IN_FIGHTERS.map((x) => x.id),
};
