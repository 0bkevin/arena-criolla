// Inject into the static production-loader harness. Each cold run creates a fresh
// real loader and unique asset URLs; warm timing uses that loader's real cache.
// Loopback timings are not device/slow-network field measurements.
(() => {
  const pairs = [
    ["llorona", "dudamel"],
    ["capriles", "nacho"],
    ["zavarce", "vallenilla"],
    ["juan", "dudamel"],
    ["lorenzo", "dayana"],
    ["conde", "emilio"],
  ];
  const results = [];
  async function runPair({
    runtime = "baseline-runtime.js",
    pair = 0,
    repeat = 0,
    label = "baseline",
    prefix = "",
  } = {}) {
    const fighters = pairs[pair],
      token = `${label}-${pair}-${repeat}-${Date.now()}`;
    const script = document.createElement("script");
    script.src = `${runtime}?run=${encodeURIComponent(token)}`;
    await new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = reject;
      document.head.append(script);
    });
    const api = globalThis.assetBenchmarkRuntime;
    const prototype = HTMLImageElement.prototype,
      descriptor = Object.getOwnPropertyDescriptor(prototype, "src");
    Object.defineProperty(prototype, "src", {
      ...descriptor,
      set(value) {
        const url = new URL(value, location.href);
        if (
          url.origin === location.origin &&
          url.pathname.startsWith("/assets/")
        ) {
          url.pathname = prefix + url.pathname;
          url.searchParams.set("asset-bench", token);
        }
        return descriptor.set.call(this, url.href);
      },
    });
    performance.clearResourceTimings();
    let assets, coldMs, warmMs;
    try {
      let began = performance.now();
      assets = await api.preloadAssets(fighters, ["caracas"]);
      coldMs = performance.now() - began;
      began = performance.now();
      const warm = await api.preloadAssets(fighters, ["caracas"]);
      warmMs = performance.now() - began;
      if (fighters.some((id) => warm.sprites[id] !== assets.sprites[id]))
        throw Error("Warm sprite cache changed");
    } finally {
      Object.defineProperty(prototype, "src", descriptor);
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
    const requests = performance
      .getEntriesByType("resource")
      .filter((entry) =>
        entry.name.includes(`asset-bench=${encodeURIComponent(token)}`),
      )
      .map((entry) => ({
        file: new URL(entry.name).pathname.replace(/^\//, ""),
        bytes: entry.encodedBodySize,
        transferBytes: entry.transferSize,
        durationMs: entry.duration,
      }));
    if (!requests.length || requests.some((r) => !r.bytes))
      throw Error("Incomplete native image Resource Timing");
    const result = {
      label,
      prefix,
      pair: fighters,
      repeat,
      cache: "cold image URLs and fresh loader; immediate warm loader cache",
      coldMs,
      warmMs,
      requests: requests.length,
      bytes: requests.reduce((sum, r) => sum + r.bytes, 0),
      props: Object.keys(assets.finaleProps),
      resources: requests,
    };
    results.push(result);
    script.remove();
    return result;
  }
  function download(file = "native-loading-baseline.json") {
    const report = {
      scope:
        "Actual bundled production loader, native Chromium. Cold URLs/fresh loader then warm JS/image cache. Empty/baseline prefixes use loopback; /throttled prefixes use a shared aggregate 5 Mbps body scheduler with 80 ms response delay. Excludes app startup/JS and device throttling; not field data.",
      userAgent: navigator.userAgent,
      createdAtUtc: new Date().toISOString(),
      rows: results,
    };
    const blob = new Blob([JSON.stringify(report, null, 2) + "\n"], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = file;
    a.click();
    return { rows: results.length, bytes: blob.size };
  }
  globalThis.assetLoadingBenchmark = { runPair, download, results, pairs };
})();
