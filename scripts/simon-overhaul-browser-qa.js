// Native-preview fixture: every sequence starts from real engine actions.
(async () => {
  const [engine, loader, renderer, cameras, art] = await Promise.all([
    import("/shared/engine.ts"),
    import("/src/game/assets.ts"),
    import("/src/game/renderer.ts"),
    import("/src/game/arena-camera.ts"),
    import("/src/game/attack-art.ts"),
  ]);
  const assets = await loader.preloadAssets(["simon", "zavarce"], ["poliedro"]);
  const panel = document.createElement("div");
  panel.style.cssText =
    "position:fixed;inset:0;z-index:999999;background:#12131a;display:flex;flex-direction:column;align-items:center;justify-content:center";
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 760;
  canvas.style.cssText =
    "display:block;max-width:100vw;max-height:calc(100vh - 40px);object-fit:contain";
  const caption = document.createElement("div");
  caption.style.cssText = "height:40px;color:#f4ebd7;font:16px system-ui";
  panel.append(canvas, caption);
  document.body.append(panel);
  const ctx = canvas.getContext("2d"),
    originalDraw = ctx.drawImage.bind(ctx);
  let rectangles = [],
    canonical = 0;
  ctx.drawImage = (image, ...args) => {
    if (image === assets.finaleProps[art.ATTACK_ART.simon.file]) {
      const pose = Object.entries(art.ATTACK_ART.simon.frames).find(
        ([, f]) => f.x === args[0] && f.y === args[1],
      )?.[0];
      const m = ctx.getTransform();
      const points = [
        [args[4], args[5]],
        [args[4] + args[6], args[5] + args[7]],
      ].map(([x, y]) => ({
        x: m.a * x + m.c * y + m.e,
        y: m.b * x + m.d * y + m.f,
      }));
      rectangles.push({
        pose,
        alpha: ctx.globalAlpha,
        left: Math.min(...points.map((p) => p.x)),
        right: Math.max(...points.map((p) => p.x)),
        top: Math.min(...points.map((p) => p.y)),
        bottom: Math.max(...points.map((p) => p.y)),
      });
    } else canonical++;
    originalDraw(image, ...args);
  };
  const samples = new Map(),
    evidence = [];
  const check = (ok, message) => {
    if (!ok) throw Error(message);
  };
  const setup = (side, scenario, move) => {
    const actor = { name: "Simón Díaz", fighter: "simon", wins: 3 },
      rival = { name: "Vicente", fighter: "zavarce", wins: 3 };
    const state = engine.createMatch(
      "poliedro",
      side ? [rival, actor] : [actor, rival],
    );
    state.phase = "playing";
    state.players.forEach((p) => {
      p.energy = 100;
      p.invincible = 0;
    });
    const source = state.players[side],
      target = state.players[1 - side];
    source.x = scenario === "edge" ? (side ? 155 : 925) : side ? 700 : 380;
    source.facing = side ? -1 : 1;
    target.x =
      source.x +
      source.facing *
        (scenario === "close"
          ? 55
          : scenario === "edge"
            ? 120
            : move === "special"
              ? 280
              : 180);
    target.facing = -source.facing;
    if (scenario === "unequal") {
      target.y -= 42;
      target.grounded = false;
      target.vy = 0;
    }
    const inputs = [engine.emptyInput(), engine.emptyInput()];
    if (scenario === "guard") inputs[1 - side].block = true;
    inputs[side].actions[move === "final" ? "super" : "special"]++;
    return { state, source, target, inputs };
  };
  const paint = (sample, reduced = false, missing = false) => {
    const loaded = missing
      ? {
          ...assets,
          finaleProps: {
            ...assets.finaleProps,
            [art.ATTACK_ART.simon.file]: undefined,
          },
        }
      : assets;
    rectangles = [];
    canonical = 0;
    renderer.renderMatch(
      ctx,
      sample.state,
      loaded,
      (sample.frame * 1000) / 60,
      reduced,
      sample.camera,
    );
    caption.textContent =
      sample.key +
      ` · HP ${sample.state.players.map((p) => p.hp.toFixed(2)).join(" / ")}` +
      (reduced ? " · movimiento reducido" : "") +
      (missing ? " · arte ausente" : "");
    return { rectangles, canonical };
  };
  for (const side of [0, 1])
    for (const move of ["special", "final"])
      for (const scenario of ["normal", "close", "unequal", "edge", "guard"]) {
        const run = setup(side, scenario, move);
        let camera,
          paid,
          last = 100;
        const impacts = [];
        const emitted = new Set();
        let captured, releaseState;
        for (let frame = 1; frame <= 220; frame++) {
          engine.stepMatch(run.state, run.inputs);
          if (frame === 1) paid = run.source.energy;
          if (run.target.hp < last)
            impacts.push({
              tick: run.state.finale?.tick ?? frame,
              hp: run.target.hp,
            });
          last = run.target.hp;
          run.state.projectiles.forEach((p) => emitted.add(p.id));
          camera = cameras.advanceArenaCamera(
            camera,
            run.state,
            1280,
            760,
            1000 / 60,
          );
          const tick = run.state.finale?.tick;
          if (tick === 0) captured = run.state.players.map((p) => [p.x, p.y]);
          if (captured && run.state.finale)
            check(
              JSON.stringify(captured) ===
                JSON.stringify(run.state.players.map((p) => [p.x, p.y])),
              "Captured positions moved",
            );
          if (captured && !run.state.finale && !releaseState)
            releaseState = {
              frame,
              hp: run.target.hp,
              stocks: run.state.players.map((p) => p.stocks),
              positions: run.state.players.map((p) => [p.x, p.y]),
            };
          const wanted =
            move === "final"
              ? [12, 30, 42, 60, 90, 138, 158, 178].includes(tick)
              : [11, 12, 20, 32, 60].includes(frame);
          if (wanted) {
            const key = `${move}-p${side + 1}-${scenario}-${tick ?? frame}`;
            const sample = {
              key,
              state: structuredClone(run.state),
              camera: structuredClone(camera),
              frame,
            };
            samples.set(key, sample);
            const result = paint(sample);
            if (move === "final" && scenario === "edge")
              for (const r of result.rectangles.filter(
                (r) => r.pose.startsWith("horse") && r.alpha > 0,
              ))
                check(
                  r.left >= -0.01 && r.right <= 1280.01,
                  `Clipped ${key}: ${JSON.stringify(r)}`,
                );
            if (tick && [42, 90, 138].includes(tick))
              check(
                result.rectangles.some(
                  (r) => r.pose === "horse-spring" && r.alpha === 1,
                ),
                `Missing contact ${key}`,
              );
          }
        }
        check(
          !run.state.finale && !run.source.attack,
          "Sequence failed to release",
        );
        check(paid === (move === "final" ? 25 : 75), "Incorrect energy charge");
        if (move === "final" && scenario !== "guard")
          check(impacts.length === 3, "Final requires three beats");
        if (scenario === "guard") check(run.target.hp === 100, "Guard failed");
        if (move === "special" && ["normal", "guard"].includes(scenario))
          check(emitted.size === 3, "Special must emit three notes");
        evidence.push({
          side: side + 1,
          move,
          scenario,
          paid,
          impacts,
          emitted: emitted.size,
          hp: run.target.hp,
          hits: run.source.hits,
          released: !run.state.finale && !run.source.attack,
          captured,
          releaseState,
          release: run.state.players.map((p) => [p.x, p.y]),
        });
      }
  window.simonQA = {
    evidence,
    keys: [...samples.keys()],
    show(key, reduced = false, missing = false) {
      const sample = samples.get(key);
      check(sample, `Unknown ${key}`);
      return paint(sample, reduced, missing);
    },
  };
  window.simonQA.show("final-p1-normal-42");
  return { evidence, keys: [...samples.keys()] };
})();
