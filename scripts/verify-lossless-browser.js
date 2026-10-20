// Run in the native browser on the benchmark server; compare its real color and
// alpha pipeline at native dimensions. Sharp separately verifies straight RGBA,
// including RGB that canvas necessarily discards beneath fully transparent pixels.
(() => {
  const result = {
    createdAtUtc: new Date().toISOString(),
    userAgent: navigator.userAgent,
    scope:
      "All published variants; full native-size sRGB canvas RGBA, plus three independent HTMLImageElement decode timings per format. No resize. Browser canvas uses premultiplied alpha; straight RGBA is separately proven by the codec audit.",
    complete: false,
    rows: [],
    errors: [],
  };
  globalThis.losslessBrowserProof = result;
  const digest = async (bytes) =>
    Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      (n) => n.toString(16).padStart(2, "0"),
    ).join("");
  async function decode(bytes) {
    const url = URL.createObjectURL(new Blob([bytes]));
    const image = new Image(),
      started = performance.now();
    try {
      image.src = url;
      await image.decode();
      return { image, ms: performance.now() - started };
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  function pixels(image) {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d", {
      willReadFrequently: true,
      colorSpace: "srgb",
    });
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    canvas.width = canvas.height = 1;
    return data;
  }
  async function run() {
    const response = await fetch("/shared/asset-variants.json");
    if (!response.ok) throw Error("Missing variant manifest");
    const manifest = await response.json();
    for (const entry of Object.values(manifest.assets)) {
      const originalBytes = await (
        await fetch((globalThis.losslessOriginalPrefix ?? "/") + entry.source)
      ).arrayBuffer();
      if ((await digest(originalBytes)) !== entry.sourceSha256)
        throw Error("Source hash changed: " + entry.source);
      for (const variant of entry.variants) {
        const variantBytes = await (
          await fetch("/" + variant.file)
        ).arrayBuffer();
        if ((await digest(variantBytes)) !== variant.sha256)
          throw Error("Variant hash changed: " + variant.file);
        const originalMs = [],
          variantMs = [];
        let before, after;
        for (let repeat = 0; repeat < 3; repeat++) {
          const first = repeat % 2 ? variantBytes : originalBytes,
            second = repeat % 2 ? originalBytes : variantBytes;
          const a = await decode(first),
            b = await decode(second);
          const original = repeat % 2 ? b : a,
            converted = repeat % 2 ? a : b;
          originalMs.push(original.ms);
          variantMs.push(converted.ms);
          if (repeat === 0) {
            before = original.image;
            after = converted.image;
          }
        }
        if (
          before.naturalWidth !== after.naturalWidth ||
          before.naturalHeight !== after.naturalHeight
        )
          throw Error("Dimensions differ");
        const a = pixels(before),
          b = pixels(after);
        let differingChannels = 0,
          maxDelta = 0;
        for (let i = 0; i < a.length; i++)
          if (a[i] !== b[i]) {
            differingChannels++;
            maxDelta = Math.max(maxDelta, Math.abs(a[i] - b[i]));
          }
        const row = {
          source: entry.source,
          variant: variant.file,
          width: before.naturalWidth,
          height: before.naturalHeight,
          originalBytes: originalBytes.byteLength,
          variantBytes: variantBytes.byteLength,
          differingChannels,
          maxDelta,
          canvasSha256: await digest(a.buffer),
          originalDecodeMs: originalMs,
          variantDecodeMs: variantMs,
        };
        result.rows.push(row);
        if (differingChannels) result.errors.push(row);
        before.src = after.src = "";
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    result.complete = true;
  }
  result.finished = run().catch((error) => {
    result.errors.push(String(error));
    result.complete = true;
  });
  result.download = () => {
    const { finished, download, ...report } = result;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2) + "\n"], {
        type: "application/json",
      }),
    );
    a.download = "native-codec-proof.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
})();
