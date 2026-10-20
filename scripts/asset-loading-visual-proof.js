// Inject only into the frozen static loading benchmark. This observes production
// drawing and compares pixels; it does not change game code, artwork or physics.
(() => {
  const moves = ["light", "heavy", "combo1", "combo2", "special", "final"];
  const initiators = ["capriles", "juan", "carlos", "florentino", "nacho"];
  const sampleTargets = ["zavarce", "capriles", "nacho", "silbon", "momoy"];
  const width = 1080,
    height = 640;
  const firstCanvas = document.createElement("canvas");
  const secondCanvas = document.createElement("canvas");
  firstCanvas.width = secondCanvas.width = width;
  firstCanvas.height = secondCanvas.height = height;
  const first = firstCanvas.getContext("2d", { willReadFrequently: true });
  const second = secondCanvas.getContext("2d", { willReadFrequently: true });
  const dependencies = new WeakMap();
  const originalDraw = CanvasRenderingContext2D.prototype.drawImage;
  let observing = null,
    busy = false,
    ready = false,
    baseline,
    optimized,
    full,
    inputs;
  let phase = "not-started",
    demoIndex = 0,
    current = null,
    fixtureIndex = 0;
  let renderedFrames = 0,
    provenanceChecks = 0,
    pixelComparisons = 0;
  const rows = [],
    pixelRows = [],
    fixtures = [],
    errors = [];
  const templates = new Map();
  const normalize = (id) =>
    id === "finales-nacho-dance" ? "perro-mujeriego-v3-nacho" : id;
  const imageId = (image) => {
    const source = image.currentSrc || image.src;
    const url = new URL(source, location.href);
    if (
      url.origin !== location.origin ||
      !url.pathname.startsWith("/assets/") ||
      !url.pathname.endsWith(".webp")
    )
      throw Error(`Unknown image source ${source}`);
    return normalize(decodeURIComponent(url.pathname.slice(8, -5)));
  };
  CanvasRenderingContext2D.prototype.drawImage = function (image, ...args) {
    let inherited;
    if (image instanceof HTMLImageElement)
      inherited = new Set([imageId(image)]);
    else if (
      image instanceof HTMLCanvasElement ||
      (typeof OffscreenCanvas !== "undefined" &&
        image instanceof OffscreenCanvas)
    )
      inherited = dependencies.get(image) ?? new Set();
    else throw Error(`Unsupported image source ${image?.constructor?.name}`);
    let target = dependencies.get(this.canvas);
    if (!target) dependencies.set(this.canvas, (target = new Set()));
    for (const id of inherited) {
      target.add(id);
      if (observing) observing.add(id);
    }
    return originalDraw.call(this, image, ...args);
  };
  addEventListener("error", (event) =>
    errors.push(`Browser error: ${event.message}`),
  );
  addEventListener("unhandledrejection", (event) =>
    errors.push(`Unhandled rejection: ${String(event.reason)}`),
  );
  const imageIds = (assets) =>
    new Set(
      [
        ...Object.values(assets.sprites).flatMap((sprite) => [
          sprite.image,
          sprite.entrance?.image,
        ]),
        ...Object.values(assets.stages),
        assets.courier,
        ...Object.values(assets.finaleProps),
      ]
        .filter(Boolean)
        .map(imageId),
    );
  const filtered = (assets, omit) => ({
    ...assets,
    finaleProps: Object.fromEntries(
      Object.entries(assets.finaleProps).filter(([id]) => !omit.has(id)),
    ),
  });
  const stateKeyframes = (states, move) => {
    const indices = new Set([0, states.length - 1]);
    const firstAttack = states.findIndex(
      (state) =>
        state.players[0].attack === (move === "final" ? "super" : "special"),
    );
    if (firstAttack >= 0) indices.add(firstAttack);
    for (let i = 1; i < states.length; i++)
      if (states[i].players[1].hp < states[i - 1].players[1].hp) indices.add(i);
    if (move === "final" && states.some((state) => state.finale)) {
      const duration = states.find((state) => state.finale).finale.duration;
      for (const tick of [24, 90, 138, duration - 2]) {
        let best = -1,
          distance = Infinity;
        for (let i = 0; i < states.length; i++)
          if (states[i].finale) {
            const gap = Math.abs(states[i].finale.tick - tick);
            if (gap < distance) {
              best = i;
              distance = gap;
            }
          }
        if (best >= 0) indices.add(best);
      }
    } else if (move === "final") {
      for (const i of [44, 180, 360]) if (i < states.length) indices.add(i);
    } else for (const i of [15, 45]) if (i < states.length) indices.add(i);
    return indices;
  };
  const status = () => ({
    ready,
    phase,
    demos: rows.length,
    totalDemos: 312,
    renderedFrames,
    provenanceChecks,
    pixelComparisons,
    fixtures: fixtureIndex,
    totalFixtures: fixtures.length,
    current: current
      ? `${current.fighter}/${current.move}:${current.next}/${current.states.length}`
      : null,
    complete: phase === "complete",
    errors: errors.slice(-8),
  });
  const render = (api, ctx, state, assets, reduced) =>
    api.renderMatch(
      ctx,
      state,
      assets,
      2000 + (state.tick * 1000) / 60,
      reduced,
    );
  function verifyAvailability(
    state,
    sourceAssets,
    selectedAssets,
    reduced,
    label,
  ) {
    const allowed = imageIds(selectedAssets),
      drawn = new Set();
    observing = drawn;
    try {
      render(baseline, first, state, sourceAssets, reduced);
    } finally {
      observing = null;
    }
    const missing = [...drawn].filter((id) => !allowed.has(id));
    if (missing.length)
      throw Error(
        `${label}: selected loader omitted drawn images ${missing.join(", ")}`,
      );
    provenanceChecks++;
    return drawn;
  }
  function verifyPixels(state, selectedAssets, reduced, label) {
    const before = JSON.stringify(state);
    render(optimized, second, state, selectedAssets, reduced);
    const a = first.getImageData(0, 0, width, height).data;
    const b = second.getImageData(0, 0, width, height).data;
    const aw = new Uint32Array(a.buffer, a.byteOffset, a.byteLength / 4);
    const bw = new Uint32Array(b.buffer, b.byteOffset, b.byteLength / 4);
    for (let i = 0; i < aw.length; i++)
      if (aw[i] !== bw[i])
        throw Error(
          `${label}: RGBA mismatch at x=${i % width}, y=${Math.floor(i / width)} (${aw[i]} vs ${bw[i]})`,
        );
    if (JSON.stringify(state) !== before)
      throw Error(`${label}: renderer mutated match state`);
    pixelComparisons++;
  }
  function matrixState(actor, target, slot, at) {
    if (!templates.has(actor))
      templates.set(actor, baseline.simulateMoveDemo(actor, "final"));
    const states = templates.get(actor),
      duration = states.find((s) => s.finale).finale.duration;
    const tick = ([42, 90, 138][at] * duration) / 180;
    const source = states.reduce(
      (best, state) =>
        state.finale &&
        (!best ||
          Math.abs(state.finale.tick - tick) <
            Math.abs(best.finale.tick - tick))
          ? state
          : best,
      null,
    );
    if (!source?.finale)
      throw Error(`Missing real capture template for ${actor}`);
    const state = structuredClone(source);
    state.players[1].config = {
      ...state.players[1].config,
      fighter: target,
      name: target,
    };
    if (slot === 1) {
      for (const player of state.players) {
        player.x = 1080 - player.x;
        player.facing *= -1;
        player.vx *= -1;
      }
      state.players.reverse();
      state.finale.owner = 1;
      state.finale.target = 0;
      state.finale.x = 1080 - state.finale.x;
      state.finale.direction *= -1;
      state.projectiles.forEach((p) => {
        p.owner = 1 - p.owner;
        p.x = 1080 - p.x;
        p.vx *= -1;
        if (p.direction) p.direction *= -1;
      });
      state.effects.forEach((e) => {
        e.x = 1080 - e.x;
        if (e.owner !== undefined) e.owner = 1 - e.owner;
        if (e.direction) e.direction *= -1;
      });
    }
    return state;
  }
  const appendMatrix = (variant, actors, targets, reduced = false) => {
    for (const actor of actors)
      for (const target of targets)
        for (const slot of [0, 1])
          fixtures.push({
            actor,
            target,
            slot,
            variant,
            reduced,
            type: "matrix",
          });
  };
  const omissions = (fixture) => {
    if (fixture.variant === "missing-art") return new Set(inputs.attackFiles);
    if (fixture.variant === "missing-choreography")
      return new Set([...inputs.recordedFiles, "finales-nacho-dance"]);
    if (fixture.variant === "missing-cafe") return new Set(inputs.cafeFiles);
    return new Set();
  };
  globalThis.assetLoadingVisualProof = {
    async start(config) {
      if (ready || busy) throw Error("The proof was already initialized");
      inputs = config;
      if (
        !config.aliasProof?.byteIdentical ||
        config.aliasProof.primarySha256 !== config.aliasProof.alternateSha256
      )
        throw Error("Nacho alias lacks exact source equality proof");
      baseline = globalThis.assetBenchmarkRuntime;
      if (!baseline?.simulateMoveDemo)
        throw Error("Frozen baseline bundle did not load");
      const script = document.createElement("script");
      script.src = "optimized-runtime.js";
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
        document.head.append(script);
      });
      optimized = globalThis.assetBenchmarkRuntime;
      if (!optimized?.simulateMoveDemo || optimized === baseline)
        throw Error("Separate optimized API did not load");
      if (
        JSON.stringify(baseline.BUILT_IN_FIGHTERS) !==
        JSON.stringify(optimized.BUILT_IN_FIGHTERS)
      )
        throw Error("Frozen runtime rosters differ");
      globalThis.assetBaselineProofRuntime = baseline;
      globalThis.assetOptimizedProofRuntime = optimized;
      for (const [family, file, weight, style] of [
        ["DM Sans", "dm-sans-400.ttf", "400", "normal"],
        ["DM Sans", "dm-sans-700.ttf", "700", "normal"],
        ["Barlow Condensed", "barlow-800.ttf", "800", "normal"],
        ["Barlow Condensed", "barlow-800-italic.ttf", "800", "italic"],
      ]) {
        const font = new FontFace(family, `url(/fonts/${file})`, {
          weight,
          style,
        });
        document.fonts.add(font);
        await font.load();
      }
      await document.fonts.ready;
      full = await baseline.preloadAssets(undefined, ["caracas"]);
      if (Object.keys(full.sprites).length !== 52)
        throw Error("The full baseline roster did not load");
      const allIds = baseline.BUILT_IN_FIGHTERS.map((f) => f.id);
      appendMatrix("normal", initiators, allIds);
      appendMatrix("reduced-motion", initiators, sampleTargets, true);
      appendMatrix("missing-choreography", ["nacho"], allIds);
      appendMatrix("missing-cafe", ["capriles"], allIds);
      for (const actor of allIds)
        for (const move of ["special", "final"])
          fixtures.push({
            actor,
            move,
            variant: "missing-art",
            type: "demo-fallback",
            reduced: false,
          });
      ready = true;
      phase = "demos";
      return {
        ...status(),
        fullPropFiles: Object.keys(full.finaleProps).length,
        sourceFingerprint: inputs.sourceFingerprint,
      };
    },
    async runBatch(frameBudget = 300) {
      if (!ready || busy)
        throw Error("Proof is not ready or another batch is active");
      if (
        !Number.isInteger(frameBudget) ||
        frameBudget < 1 ||
        frameBudget > 2000
      )
        throw Error("Frame budget must be 1..2000");
      busy = true;
      try {
        for (
          let count = 0;
          count < frameBudget && phase !== "complete";
          count++
        ) {
          if (phase === "demos") {
            if (!current) {
              const fighter =
                baseline.BUILT_IN_FIGHTERS[Math.floor(demoIndex / moves.length)]
                  .id;
              const move = moves[demoIndex % moves.length],
                states = baseline.simulateMoveDemo(fighter, move);
              const ids = states[0].players.map(
                (player) => player.config.fighter,
              );
              current = {
                fighter,
                move,
                states,
                next: 0,
                selected: await optimized.preloadAssets(ids, ["caracas"]),
                drawn: new Set(),
                keyframes: ["special", "final"].includes(move)
                  ? stateKeyframes(states, move)
                  : new Set(),
                compared: [],
              };
            }
            const state = current.states[current.next],
              label = `${current.fighter}/${current.move}/${current.next}`;
            for (const id of verifyAvailability(
              state,
              full,
              current.selected,
              false,
              label,
            ))
              current.drawn.add(id);
            if (current.keyframes.has(current.next)) {
              verifyPixels(state, current.selected, false, label);
              current.compared.push(current.next);
            }
            renderedFrames++;
            current.next++;
            if (current.next === current.states.length) {
              rows.push({
                fighter: current.fighter,
                move: current.move,
                frames: current.next,
                contiguousFrames: true,
                drawnAssets: [...current.drawn].sort(),
                rgbaComparedFrames: current.compared,
              });
              current = null;
              demoIndex++;
              if (demoIndex === 312) phase = "fixtures";
            }
          } else {
            const fixture = fixtures[fixtureIndex],
              omit = omissions(fixture);
            let states;
            if (fixture.type === "matrix")
              states = [0, 1, 2].map((at) =>
                matrixState(fixture.actor, fixture.target, fixture.slot, at),
              );
            else {
              const all = baseline.simulateMoveDemo(
                fixture.actor,
                fixture.move,
              );
              const keys = [...stateKeyframes(all, fixture.move)].sort(
                (a, b) => a - b,
              );
              // Missing-art checks sample the first and last authored contact,
              // or two interior action frames when no contact was scheduled.
              const interior = keys.filter((i) => i > 1 && i < all.length - 1);
              states = [
                ...new Set(
                  [interior[0], interior[interior.length - 1]].filter(
                    (i) => i !== undefined,
                  ),
                ),
              ].map((i) => all[i]);
            }
            const ids = states[0].players.map(
              (player) => player.config.fighter,
            );
            const selected = filtered(
              await optimized.preloadAssets(ids, ["caracas"]),
              omit,
            );
            const source = filtered(full, omit),
              drawn = new Set();
            for (const state of states) {
              const label = `${fixture.variant}/${fixture.actor}/${fixture.target ?? fixture.move}/slot${fixture.slot ?? 0}/t${state.finale?.tick ?? state.tick}`;
              for (const id of verifyAvailability(
                state,
                source,
                selected,
                fixture.reduced,
                label,
              ))
                drawn.add(id);
              verifyPixels(state, selected, fixture.reduced, label);
            }
            pixelRows.push({
              ...fixture,
              comparedFrames: states.map((state) => ({
                tick: state.tick,
                captureTick: state.finale?.tick ?? null,
              })),
              drawnAssets: [...drawn].sort(),
              passed: true,
            });
            fixtureIndex++;
            if (fixtureIndex === fixtures.length) phase = "complete";
          }
          if (count % 100 === 99)
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
        if (errors.length) throw Error(errors.join("; "));
        return status();
      } catch (error) {
        errors.push(String(error));
        throw error;
      } finally {
        observing = null;
        busy = false;
      }
    },
    get status() {
      return status();
    },
    report() {
      if (busy || phase !== "complete" || errors.length)
        throw Error("An incomplete or failed proof cannot be published");
      return {
        schema: 1,
        createdAtUtc: new Date().toISOString(),
        scope:
          "Native Chromium, frozen production bundles, original public images. Every-frame drawImage provenance over all 312 simulated demos; exact full-resolution RGBA equality only at the separately listed keyframes and rendering fixtures. Extended target fixtures substitute target identity and mirror actual captured simulation snapshots; they do not claim replaying every target's combat physics.",
        userAgent: navigator.userAgent,
        viewport: { width, height },
        inputs,
        status: status(),
        demos: rows,
        rgbaFixtures: pixelRows,
        errors,
      };
    },
    download() {
      const report = this.report(),
        blob = new Blob([JSON.stringify(report, null, 2) + "\n"], {
          type: "application/json",
        });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "loading-visual-proof.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      return { ...status(), reportBytes: blob.size };
    },
  };
})();
