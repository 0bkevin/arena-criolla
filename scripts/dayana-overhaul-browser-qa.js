// Native-preview fixture: every sequence starts from real engine actions.
(async () => {
  window.dayanaQAProgress = "imports";
  const [engine, loader, renderer, cameras, art] = await Promise.all([
    import("/shared/engine.ts"),
    import("/src/game/assets.ts"),
    import("/src/game/renderer.ts"),
    import("/src/game/arena-camera.ts"),
    import("/src/game/attack-art.ts"),
  ]);
  window.dayanaQAProgress = "assets";
  const assets = await loader.preloadAssets(
    ["dayana", "zavarce", "momoy", "silbon", "capriles"],
    ["poliedro", "valencia"],
  );
  window.dayanaQAProgress = "matrix";
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
    if (image === assets.finaleProps[art.ATTACK_ART.dayana.file]) {
      const pose = Object.entries(art.ATTACK_ART.dayana.frames).find(
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
    evidence = [],
    renderEvidence = [];
  const check = (ok, message) => {
    if (!ok) throw Error(message);
  };
  const setup = (side, scenario, move) => {
    const actor = { name: "Dayana Mendoza", fighter: "dayana", wins: 3 },
      rival = {
        name: "Vicente",
        fighter:
          scenario === "tall"
            ? "silbon"
            : scenario === "small"
              ? "momoy"
              : "zavarce",
        wins: 3,
      };
    const state = engine.createMatch(
      ["platform", "platform-low"].includes(scenario) ? "valencia" : "poliedro",
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
              ? 180
              : 180);
    target.facing = -source.facing;
    if (scenario === "inward" || scenario === "close-edge") {
      source.x = side ? 1040 : 40;
      source.facing = side ? -1 : 1;
      target.x =
        source.x + source.facing * (scenario === "close-edge" ? 55 : 180);
      target.facing = -source.facing;
    }
    if (scenario === "unequal") {
      target.y -= 42;
      target.grounded = false;
      target.vy = 0;
    }
    if (scenario === "platform" || scenario === "platform-low") {
      source.x = side ? 855 : 225;
      source.y = 418;
      source.supportPlatform = side ? 2 : 0;
      target.x = side ? 620 : 460;
      source.facing = side ? -1 : 1;
      target.facing = -source.facing;
      target.y = 345;
      target.grounded = true;
      target.supportPlatform = 1;
      if (scenario === "platform-low") {
        [source.x, target.x] = [target.x, source.x];
        [source.y, target.y] = [target.y, source.y];
        [source.supportPlatform, target.supportPlatform] = [
          target.supportPlatform,
          source.supportPlatform,
        ];
        source.facing *= -1;
        target.facing *= -1;
      }
    }
    if (scenario === "miss") target.x = source.x + source.facing * 430;
    if (scenario === "lethal" || scenario === "last-stock") {
      target.hp = 1;
      target.stocks = scenario === "lethal" ? 2 : 1;
    }
    const inputs = [engine.emptyInput(), engine.emptyInput()];
    if (scenario === "guard" || scenario === "rear-guard")
      inputs[1 - side].block = true;
    if (scenario === "rear-guard")
      inputs[1 - side][side ? "left" : "right"] = true;
    if (scenario === "interrupt") {
      target.x = source.x + source.facing * 65;
      inputs[1 - side].actions.light++;
      for (let n = 0; n < 3; n++) engine.stepMatch(state, inputs);
    }
    inputs[side].actions[move === "final" ? "super" : "special"]++;
    return { state, source, target, inputs };
  };
  const paint = (sample, reduced = false, missing = false) => {
    const loaded = missing
      ? {
          ...assets,
          finaleProps: {
            ...assets.finaleProps,
            [art.ATTACK_ART.dayana.file]: undefined,
          },
        }
      : assets;
    const before = JSON.stringify(sample.state),
      beforeCamera = JSON.stringify(sample.camera);
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
    check(JSON.stringify(sample.state) === before, "Renderer mutated state");
    check(
      JSON.stringify(sample.camera) === beforeCamera,
      "Renderer mutated camera",
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
      for (const scenario of [
        "normal",
        "close",
        "unequal",
        "edge",
        "inward",
        "close-edge",
        "platform",
        "platform-low",
        "guard",
        "miss",
        "tall",
        "small",
        "lethal",
        "last-stock",
        "interrupt",
        "rear-guard",
      ]) {
        window.dayanaQAProgress = `${side}-${move}-${scenario}`;
        await new Promise((resolve) => setTimeout(resolve, 0));
        const run = setup(side, scenario, move);
        let camera,
          paid,
          last = run.target.hp;
        const impacts = [];
        const emitted = new Set();
        let captured, releaseState;
        for (let frame = 1; frame <= 280; frame++) {
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
            releaseState?.frame === frame ||
            (move === "final"
              ? [
                  0, 12, 30, 42, 60, 65, 66, 70, 82, 99, 100, 101, 110, 140,
                  168, 178,
                ].includes(tick)
              : [1, 20, 21, 22, 28, 29, 44, 45, 52, 60].includes(frame));
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
            renderEvidence.push({ key, ...result });
            if (
              move === "final" &&
              ["edge", "inward", "close-edge"].includes(scenario)
            )
              for (const r of result.rectangles.filter(
                (r) =>
                  [
                    "windup",
                    "contact",
                    "recover",
                    "a-windup",
                    "a-contact",
                    "a-recover",
                    "b-windup",
                    "b-contact",
                    "b-recover",
                  ].includes(r.pose) && r.alpha > 0,
              ))
                check(
                  r.left >= -0.01 && r.right <= 1280.01,
                  `Clipped ${key}: ${JSON.stringify(r)}`,
                );
          }
        }
        check(
          !run.state.finale &&
            (!run.source.attack || run.state.phase === "finished"),
          `Sequence failed to release ${move} ${side} ${scenario}: ${run.state.phase} ${run.source.attack}`,
        );
        check(paid === (move === "final" ? 25 : 75), "Incorrect energy charge");
        if (
          move === "final" &&
          !["guard", "miss", "interrupt"].includes(scenario)
        )
          check(
            impacts.length === 1 && impacts[0].tick === 100,
            "Final requires one collective football contact",
          );
        if (scenario === "guard") check(run.target.hp === 100, "Guard failed");
        if (move === "special" && ["normal", "guard"].includes(scenario))
          check(emitted.size === 1, "Football special emits exactly one ball");
        evidence.push({
          side: side + 1,
          move,
          scenario,
          paid,
          impacts,
          emitted: emitted.size,
          hp: run.target.hp,
          hits: run.source.hits,
          released:
            !run.state.finale &&
            (!run.source.attack || run.state.phase === "finished"),
          captured,
          releaseState,
          release: run.state.players.map((p) => [p.x, p.y]),
        });
      }
  window.dayanaQA = {
    evidence,
    renderEvidence,
    keys: [...samples.keys()],
    hide() {
      panel.style.display = "none";
    },
    inspect(key) {
      const sample = samples.get(key);
      return (
        sample && {
          state: sample.state,
          camera: sample.camera,
          frame: sample.frame,
        }
      );
    },
    show(key, reduced = false, missing = false) {
      panel.style.display = "flex";
      const sample = samples.get(key);
      check(sample, `Unknown ${key}`);
      return paint(sample, reduced, missing);
    },
  };
  window.dayanaQA.show("final-p1-normal-100");
  return { evidence, keys: [...samples.keys()] };
})().catch((error) => {
  window.dayanaQAError = String(error.stack || error);
  throw error;
});
