// Evaluate in T3 Preview on the development server. Measures the actual renderer
// with every fighter, all stages, full-quality effects and unmodified assets.
(async () => {
  const [
    { createMatch, emptyInput, stepMatch },
    { BUILT_IN_FIGHTERS, STAGES },
    { preloadAssets },
    { renderMatch },
    { INTRO_COUNTDOWN_START },
  ] = await Promise.all([
    import("/shared/engine.ts"),
    import("/shared/content.ts"),
    import("/src/game/assets.ts"),
    import("/src/game/renderer.ts"),
    import("/shared/presentation.ts"),
  ]);
  await document.fonts.ready;
  const assets = await preloadAssets();
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 800;
  const ctx = canvas.getContext("2d");
  const results = [],
    pixels = [];
  const drawImage = ctx.drawImage.bind(ctx);
  let drawCalls = 0;
  ctx.drawImage = (...args) => {
    drawCalls++;
    return drawImage(...args);
  };
  const digest = async () => {
    const bytes = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(hash)]
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
  };
  for (const [index, fighter] of BUILT_IN_FIGHTERS.entries()) {
    const stage = STAGES[index % STAGES.length];
    const state = createMatch(
      stage.id,
      [
        { name: "Perf A", fighter: fighter.id, wins: 3 },
        {
          name: "Perf B",
          fighter:
            BUILT_IN_FIGHTERS[(index + 13) % BUILT_IN_FIGHTERS.length].id,
          wins: 3,
        },
      ],
      `render-${fighter.id}`,
    );
    const inputs = [emptyInput(), emptyInput()];
    state.phase = "playing";
    state.players.forEach((p) => {
      p.invincible = 0;
      p.energy = 100;
    });
    inputs.forEach((input) => input.actions.special++);
    for (let n = 0; n < 12; n++) stepMatch(state, inputs);
    for (const phase of ["playing", "intro", "finished"]) {
      state.phase = phase;
      if (phase === "intro")
        state.tick = Math.floor((INTRO_COUNTDOWN_START - 1) * 0.55);
      if (phase === "finished") state.winner = 0;
      drawCalls = 0;
      const times = [];
      for (let n = 0; n < 12; n++) {
        const began = performance.now();
        renderMatch(
          ctx,
          state,
          assets,
          1000 + n * 16.667,
          false,
          undefined,
          phase === "finished" ? 3500 : 0,
        );
        times.push(performance.now() - began);
      }
      results.push({
        fighter: fighter.id,
        stage: stage.id,
        phase,
        meanMs: times.reduce((sum, n) => sum + n, 0) / times.length,
        maxMs: Math.max(...times),
        drawCallsPerFrame: drawCalls / times.length,
      });
      pixels.push({
        fighter: fighter.id,
        stage: stage.id,
        phase,
        sha256: await digest(),
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  const quantile = (values, p) =>
    [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * p)];
  return {
    recordedAt: new Date().toISOString(),
    viewport: { width: canvas.width, height: canvas.height },
    fighters: BUILT_IN_FIGHTERS.length,
    stages: STAGES.length,
    phases: Object.fromEntries(
      ["playing", "intro", "finished"].map((phase) => {
        const group = results.filter((r) => r.phase === phase);
        return [
          phase,
          {
            meanMs: group.reduce((sum, r) => sum + r.meanMs, 0) / group.length,
            p95MeanMs: quantile(
              group.map((r) => r.meanMs),
              0.95,
            ),
            slowest: [...group].sort((a, b) => b.meanMs - a.meanMs).slice(0, 5),
          },
        ];
      }),
    ),
    results,
    pixels,
    scope:
      "Full-resolution canvas drawing; browser/hardware-specific timings. Pixel digests guard the same rendered scenes before and after.",
  };
})();
