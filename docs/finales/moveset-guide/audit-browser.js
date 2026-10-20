/* Browser-only, injected before the SAME bundle used by build.mjs. No game edits. */
(() => {
  const config = globalThis.__arenaGuideAuditInputs;
  const known = new Set(config.assets.map(a => a.id));
  const byUrl = new Map(Object.entries(globalThis.__arenaGuideImages).map(([id, url]) => [new URL(url, location.href).href, id]));
  const dependencies = new WeakMap(), loaded = new Set(), pending = new Set(), errors = [];
  let frameAssets = null, current = null, caseIndex = 0, busy = false;
  const rows = [], pairs = config.fighters.flatMap(fighter => config.moves.map(move => ({ fighter, move })));
  const idFor = image => byUrl.get(image.currentSrc || image.src);
  const dependenciesOf = image => image instanceof HTMLImageElement ? (idFor(image) ? new Set([idFor(image)]) : new Set()) : dependencies.get(image) ?? new Set();
  const imageSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
  Object.defineProperty(HTMLImageElement.prototype, "src", { ...imageSrc, set(value) {
    const id = byUrl.get(new URL(String(value), location.href).href);
    if (id) {
      pending.add(id);
      this.addEventListener("load", () => { pending.delete(id); loaded.add(id); }, { once: true });
      this.addEventListener("error", () => { pending.delete(id); errors.push(`Image load failed: ${id}`); }, { once: true });
    }
    return imageSrc.set.call(this, value);
  } });
  const draw = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function(image, ...args) {
    const inherited = dependenciesOf(image);
    if (frameAssets && image instanceof HTMLImageElement && !idFor(image)) errors.push(`Unknown rendered image: ${image.currentSrc || image.src}`);
    if (frameAssets && ["ImageBitmap", "HTMLVideoElement", "SVGImageElement", "VideoFrame"].some(type => typeof globalThis[type] === "function" && image instanceof globalThis[type])) errors.push("Unsupported canvas image source; extend audit provenance before pruning.");
    let target = dependencies.get(this.canvas);
    if (!target) dependencies.set(this.canvas, target = new Set());
    for (const id of inherited) {
      target.add(id);
      if (frameAssets) frameAssets.add(id);
      if (!known.has(id)) errors.push(`Unknown image ID: ${id}`);
    }
    return draw.call(this, image, ...args);
  };
  // Keep provenance conservatively for a canvas's lifetime. A nominal full clear
  // can be offset, transformed or clipped, leaving source pixels behind. Keeping
  // an erased dependency can retain an extra image; dropping a live one could
  // incorrectly authorize its pruning.
  addEventListener("error", event => errors.push(`Browser error: ${event.message}`));
  addEventListener("unhandledrejection", event => errors.push(`Unhandled rejection: ${String(event.reason)}`));

  const status = () => ({ complete: caseIndex === pairs.length && !current, demos: rows.length, total: pairs.length, renderedFrames: rows.reduce((n, row) => n + row.renderedFrames, 0) + (current?.renderedFrames ?? 0), current: current ? `${current.fighter}/${current.move}:${current.renderedFrames}/${current.frames}` : null, errors: errors.slice(-8) });
  globalThis.arenaGuideDrawAudit = {
    async runBatch(frameBudget = 300) {
      if (busy) throw Error("A draw audit batch is already running.");
      if (!Number.isInteger(frameBudget) || frameBudget < 1 || frameBudget > 2000) throw Error("Frame budget must be 1..2000.");
      busy = true;
      try {
        const guide = globalThis.arenaMoveGuide;
        if (!guide?.ready) throw Error("Guide is not ready.");
        guide.pause();
        for (let rendered = 0; rendered < frameBudget && caseIndex < pairs.length;) {
          if (!current) {
            const pair = pairs[caseIndex];
            await guide.selectFighter(pair.fighter);
            await guide.selectMove(pair.move);
            guide.pause();
            const states = guide.snapshots;
            const activatedFinal = pair.move !== "final" || states.some(state => !!state.finale || !!state.players[0].transformation) || (states.some(state => state.players[0].attack === "super") && states.some(state => state.players[0].energy <= 30));
            current = { ...pair, frames: states.length, renderedFrames: 0, firstFrame: 0, lastFrame: -1, contiguous: true, drawnAssets: new Set(), activatedFinal };
          }
          const next = current.renderedFrames;
          frameAssets = new Set();
          try {
            guide.seek(next);
            if (guide.selected !== current.fighter || guide.mode !== current.move || guide.state !== guide.snapshots[next]) throw Error("Guide selection/frame changed while auditing.");
          } finally {
            for (const id of frameAssets) current.drawnAssets.add(id);
            frameAssets = null;
          }
          current.contiguous &&= next === current.lastFrame + 1;
          current.lastFrame = next; current.renderedFrames++; rendered++;
          if (current.renderedFrames === current.frames) {
            rows.push({ ...current, drawnAssets: [...current.drawnAssets].sort() });
            current = null; caseIndex++;
          }
        }
        return status();
      } catch (error) { errors.push(String(error)); throw error; }
      finally { frameAssets = null; busy = false; }
    },
    get status() { return status(); },
    async finish() {
      if (!status().complete) throw Error("Audit has not completed all demos and frames.");
      const response = await fetch("/guide-audit-current-inputs.json", { cache: "no-store" });
      if (!response.ok) throw Error("The static audit server could not verify current source inputs.");
      const { fingerprint } = await response.json();
      if (fingerprint !== config.fingerprint) throw Error("Guide sources changed during the audit; regenerate the audit page and repeat after edits settle.");
      return globalThis.arenaGuideDrawAudit.report();
    },
    report() {
      if (busy || current || caseIndex !== pairs.length) throw Error("Audit has not completed all demos and frames.");
      return { schema: 1, fingerprint: config.fingerprint, complete: true, fighters: config.fighters, moves: config.moves, cases: rows, usedAssets: [...new Set(rows.flatMap(row => row.drawnAssets))].sort(), loadedAssets: [...loaded].sort(), pendingImages: [...pending].sort(), errors: [...new Set(errors)] };
    },
  };
})();
