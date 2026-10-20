// Production assets, renderer and engine, driven only by real attack inputs.
(async () => {
  const [engine, loader, renderer, cameras, art] = await Promise.all([
    import("/shared/engine.ts"),
    import("/src/game/assets.ts"),
    import("/src/game/renderer.ts"),
    import("/src/game/arena-camera.ts"),
    import("/src/game/attack-art.ts"),
  ]);
  const assets = await loader.preloadAssets(["maite", "zavarce"], ["poliedro"]);
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
    originalDraw = ctx.drawImage.bind(ctx),
    samples = new Map(),
    evidence = [];
  let rectangles = [],
    labels = [],
    boxes = [];
  ctx.drawImage = (image, ...args) => {
    if (image === assets.finaleProps[art.ATTACK_ART.maite.file]) {
      const pose = Object.entries(art.ATTACK_ART.maite.frames).find(
        ([, f]) => f.x === args[0] && f.y === args[1],
      )?.[0];
      const m = ctx.getTransform(),
        corners = [
          [args[4], args[5]],
          [args[4] + args[6], args[5] + args[7]],
        ].map(([x, y]) => ({
          x: m.a * x + m.c * y + m.e,
          y: m.b * x + m.d * y + m.f,
        }));
      rectangles.push({
        pose,
        anchorX: m.e,
        left: Math.min(...corners.map((p) => p.x)),
        right: Math.max(...corners.map((p) => p.x)),
        top: Math.min(...corners.map((p) => p.y)),
        bottom: Math.max(...corners.map((p) => p.y)),
      });
    }
    originalDraw(image, ...args);
  };
  const originalText = ctx.fillText.bind(ctx);
  const originalBox = ctx.roundRect.bind(ctx);
  ctx.roundRect = (x, y, w, h, radius) => {
    const m = ctx.getTransform();
    boxes.push({
      left: m.a * x + m.e,
      top: m.d * y + m.f,
      right: m.a * (x + w) + m.e,
      bottom: m.d * (y + h) + m.f,
    });
    originalBox(x, y, w, h, radius);
  };
  ctx.fillText = (value, ...args) => {
    labels.push(value);
    originalText(value, ...args);
  };
  const check = (ok, message) => {
    if (!ok) throw Error(message);
  };
  const paint = (sample, reduced = false, missing = false) => {
    rectangles = [];
    labels = [];
    boxes = [];
    const before = JSON.stringify([sample.state, sample.camera]);
    const loaded = missing
      ? {
          ...assets,
          finaleProps: {
            ...assets.finaleProps,
            [art.ATTACK_ART.maite.file]: undefined,
          },
        }
      : assets;
    renderer.renderMatch(
      ctx,
      sample.state,
      loaded,
      (sample.frame * 1000) / 60,
      reduced,
      sample.camera,
    );
    check(
      before === JSON.stringify([sample.state, sample.camera]),
      "Rendering mutated engine or camera",
    );
    const source = sample.state.players.find(
      (p) => p.config.fighter === "maite",
    );
    const bounds = cameras.cameraBounds(sample.camera, 1280, 760);
    const shake =
      !reduced && sample.state.shake > 0.3
        ? Math.sin(((sample.frame * 1000) / 60) * 0.07) * sample.state.shake
        : 0;
    rectangles.forEach(
      (r) =>
        (r.presentationOffsetX =
          r.anchorX / sample.camera.zoom + bounds.x - shake - source.x),
    );
    boxes.forEach((b) =>
      check(
        b.left >= 0 && b.right <= 1280 && b.top >= 0 && b.bottom <= 760,
        "Caption box clipped",
      ),
    );
    caption.textContent =
      sample.key +
      ` · HP ${sample.state.players.map((p) => p.hp.toFixed(2)).join(" / ")}` +
      (reduced ? " · movimiento reducido" : "") +
      (missing ? " · arte ausente" : "");
    return { rectangles, labels, boxes };
  };
  for (const side of [0, 1])
    for (const move of ["final", "special"])
      for (const scenario of move === "final"
        ? ["normal", "close", "edge-out", "edge-in", "guard", "miss", "jump"]
        : ["normal", "guard"]) {
        const actor = { name: "Maite Delgado", fighter: "maite", wins: 3 },
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
          target = state.players[1 - side],
          direction = side ? -1 : 1;
        source.x = side ? 760 : 320;
        let gap = move === "special" ? 250 : 430;
        if (scenario === "close") gap = 55;
        if (scenario === "edge-out") {
          source.x = side ? 155 : 925;
          gap = 120;
        }
        if (scenario === "edge-in") {
          source.x = side ? 1045 : 35;
          gap = 430;
        }
        if (scenario === "miss") {
          source.x = side ? 990 : 90;
          gap = 900;
        }
        source.facing = direction;
        target.x = source.x + direction * gap;
        target.facing = -direction;
        const inputs = [engine.emptyInput(), engine.emptyInput()];
        inputs[side].actions[move === "final" ? "super" : "special"]++;
        if (scenario === "guard") inputs[1 - side].block = true;
        let camera,
          last = 100,
          paid,
          recovery;
        const impacts = [],
          waveFrames = [];
        for (let frame = 1; frame <= 180; frame++) {
          if (scenario === "jump" && (frame === 1 || frame === 17))
            inputs[1 - side].actions.jump++;
          const prior = state.projectiles.map((p) => ({ ...p }));
          engine.stepMatch(state, inputs);
          if (frame === 1) paid = source.energy;
          if (target.hp < last)
            impacts.push({
              frame,
              damage: last - target.hp,
              hp: target.hp,
              positions: state.players.map((p) => [p.x, p.y]),
              waveBefore: prior,
            });
          last = target.hp;
          if (state.projectiles.length)
            waveFrames.push({
              frame,
              shots: structuredClone(state.projectiles),
            });
          if (frame > 9 && !source.attack && !recovery)
            recovery = {
              frame,
              hp: target.hp,
              stocks: state.players.map((p) => p.stocks),
              positions: state.players.map((p) => [p.x, p.y]),
              projectiles: state.projectiles.length,
            };
          camera = cameras.advanceArenaCamera(
            camera,
            state,
            1280,
            760,
            1000 / 60,
            false,
          );
          if (
            [5, 9, 16, 27, 32, 40, 50, 70, 84, 100].includes(frame) ||
            impacts.at(-1)?.frame === frame
          ) {
            const key = `${move}-p${side + 1}-${scenario}-${frame}`,
              sample = {
                key,
                state: structuredClone(state),
                camera: structuredClone(camera),
                frame,
              };
            samples.set(key, sample);
            const rendered = paint(sample);
            check(!state.finale, "Ranged super entered capture");
            if (move === "final" && ["edge-in", "edge-out"].includes(scenario))
              for (const r of rendered.rectangles)
                check(
                  r.left >= 0 &&
                    r.right <= 1280 &&
                    r.top >= 0 &&
                    r.bottom <= 760,
                  `Clipped full body: ${key} ${JSON.stringify(r)}`,
                );
          }
        }
        check(paid === (move === "final" ? 25 : 75), "Wrong energy cost");
        check(!source.attack && !state.finale, "Recovery missing");
        const expected = ["guard", "miss", "jump"].includes(scenario) ? 0 : 1;
        check(
          source.hits === expected,
          `${side}/${move}/${scenario} expected ${expected} hits got ${source.hits}`,
        );
        evidence.push({
          side: side + 1,
          move,
          scenario,
          paid,
          impacts,
          waveFrames,
          recovery,
          hits: source.hits,
          hp: target.hp,
          stocks: state.players.map((p) => p.stocks),
          remaining: state.remaining,
        });
      }
  window.maiteQA = {
    evidence,
    keys: [...samples.keys()],
    show(key, reduced = false, missing = false) {
      const sample = samples.get(key);
      check(sample, `Unknown ${key}`);
      return paint(sample, reduced, missing);
    },
  };
  window.maiteQA.show("final-p1-normal-27");
  return {
    cases: evidence.map(({ waveFrames, ...e }) => e),
    keys: [...samples.keys()],
  };
})();
