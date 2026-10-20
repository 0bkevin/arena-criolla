// Evaluate in the collaborative browser at the running development server.
// Uses the shipped engine, asset loader, camera, and renderer; returns serializable evidence.
(async () => {
  const [
    { createMatch, emptyInput, stepMatch },
    { platformsAtTick },
    { preloadAssets },
    { renderMatch },
    { advanceArenaCamera },
  ] = await Promise.all([
    import("/shared/engine.ts"),
    import("/shared/content.ts"),
    import("/src/game/assets.ts"),
    import("/src/game/renderer.ts"),
    import("/src/game/arena-camera.ts"),
  ]);
  const scenes = [
    { stage: "caracas", rival: "vallenilla", side: 0, mode: "hit" },
    { stage: "guaira", rival: "capriles", side: 1, mode: "guard" },
    { stage: "valencia", rival: "maite", side: 0, mode: "jump" },
    { stage: "canaima", rival: "silbon", side: 1, mode: "hit" },
    { stage: "maracaibo", rival: "dudamel", side: 0, mode: "reflect", gap: 260 },
    { stage: "merida", rival: "amanda", side: 1, mode: "counter", gap: 180 },
    { stage: "coro", rival: "diablo", side: 0, mode: "clash" },
    { stage: "roques", rival: "lionza", side: 0, mode: "platform" },
    { stage: "poliedro", rival: "oscar", side: 1, mode: "hit" },
    { stage: "poliedro", rival: "dudamel", side: 1, mode: "reflect", gap: 260 },
  ];
  const assets = await preloadAssets(
    ["zavarce", ...scenes.map((s) => s.rival)],
    scenes.map((s) => s.stage),
  );
  if (!assets.courier?.complete || !assets.courier.naturalWidth)
    throw new Error("Motorcycle atlas failed to load");
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 800;
  canvas.style.cssText =
    "width:100%;height:100%;object-fit:contain;display:block";
  const panel = document.createElement("div");
  panel.id = "courier-qa-overlay";
  panel.style.cssText =
    "position:fixed;inset:0;z-index:99999;background:#11141d";
  document.getElementById(panel.id)?.remove();
  panel.append(canvas);
  document.body.append(panel);
  const ctx = canvas.getContext("2d");
  const drawImage = ctx.drawImage.bind(ctx);
  let bikeDraws = 0;
  ctx.drawImage = function (image, ...args) {
    if (image === assets.courier) bikeDraws++;
    return drawImage(image, ...args);
  };
  const evidence = [],
    samples = [];
  const check = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const began = performance.now();
  for (const scene of scenes) {
    const vicente = { name: "Vicente", fighter: "zavarce", wins: 0 };
    const rival = { name: scene.rival, fighter: scene.rival, wins: 3 };
    const state = createMatch(
      scene.stage,
      scene.side === 0 ? [vicente, rival] : [rival, vicente],
    );
    state.phase = "playing";
    state.players.forEach((p) => {
      p.invincible = 0;
      p.energy = 100;
    });
    const source = state.players[scene.side],
      target = state.players[1 - scene.side];
    source.x = scene.side === 0 ? 230 : 850;
    target.x = source.x + (scene.side === 0 ? 1 : -1) * (scene.gap ?? 260);
    if (scene.mode === "platform") {
      const surface = platformsAtTick(scene.stage, 0)[2];
      Object.assign(source, {
        x: surface.x + surface.width / 2,
        y: surface.y,
        supportPlatform: 2,
        grounded: true,
      });
      target.x = 900;
    }
    source.facing = Math.sign(target.x - source.x);
    target.facing = -source.facing;
    const inputs = [emptyInput(), emptyInput()];
    inputs[scene.side].actions.special++;
    inputs[1 - scene.side].block = scene.mode === "guard";
    if (scene.mode === "jump") inputs[1 - scene.side].actions.jump++;
    if (["reflect", "counter", "clash"].includes(scene.mode))
      inputs[1 - scene.side].actions.special++;
    let camera,
      minSourceHp = 100,
      minTargetHp = 100,
      rendered = 0,
      initialReflectorHp;
    const reflected = new Set();
    bikeDraws = 0;
    for (let frame = 0; frame < 180; frame++) {
      if (scene.mode === "jump" && frame === 22)
        inputs[1 - scene.side].actions.jump++;
      stepMatch(state, inputs);
      minSourceHp = Math.min(minSourceHp, source.hp);
      minTargetHp = Math.min(minTargetHp, target.hp);
      if (frame === 11) {
        initialReflectorHp = target.hp;
        samples.push({ scene, state: structuredClone(state) });
      }
      for (const p of state.players)
        check(
          [p.x, p.y, p.hp, p.energy].every(Number.isFinite),
          "Invalid physics: " + JSON.stringify(scene),
        );
      for (const shot of state.projectiles)
        if (shot.kind === "courier" && shot.owner !== scene.side)
          reflected.add(shot.id);
      if (frame % 8 === 0 || frame === 11) {
        camera = advanceArenaCamera(
          camera,
          state,
          canvas.width,
          canvas.height,
          1000 / 60,
        );
        renderMatch(
          ctx,
          state,
          assets,
          (state.tick * 1000) / 60,
          false,
          camera,
        );
        rendered++;
      }
    }
    check(
      bikeDraws > 0,
      "Motorcycle sprites were not rendered: " + scene.stage,
    );
    if (["guard", "jump"].includes(scene.mode))
      check(
        minTargetHp === 100 && source.hits === 0,
        "Defense failed: " + JSON.stringify(scene),
      );
    if (scene.mode === "hit")
      check(source.hits === 1, "Expected one hit: " + JSON.stringify(scene));
    if (scene.mode === "reflect")
      check(
        reflected.size > 0 && initialReflectorHp === 100,
        "Player-order reflection failed: " + JSON.stringify(scene),
      );
    if (scene.mode === "counter")
      check(target.countered && minSourceHp < 100, "Counter did not respond");
    evidence.push({
      ...scene,
      sourceHits: source.hits,
      minSourceHp,
      minTargetHp,
      reflectedBikes: reflected.size,
      bikeDraws,
      renderedFrames: rendered,
      passed: true,
    });
  }
  window.courierBrowserQA = {
    evidence,
    samples,
    show(index, reducedMotion = false) {
      const { scene, state } = samples[index];
      renderMatch(ctx, state, assets, (state.tick * 1000) / 60, reducedMotion);
      ctx.fillStyle = "#141a28e8";
      ctx.fillRect(18, 18, 920, 68);
      ctx.fillStyle = "#f5f1ff";
      ctx.font = "600 23px system-ui";
      ctx.fillText(
        `Vicente vs ${scene.rival} · ${scene.stage} · ${scene.mode} · P${scene.side + 1}`,
        38,
        61,
      );
      return {
        scene,
        reducedMotion,
        sprites: state.projectiles.filter((s) => s.kind === "courier").length,
      };
    },
  };
  window.courierBrowserQA.show(4);
  return {
    passed: true,
    cases: evidence.length,
    elapsedMs: Math.round(performance.now() - began),
    atlas: {
      width: assets.courier.naturalWidth,
      height: assets.courier.naturalHeight,
    },
    evidence,
  };
})();
