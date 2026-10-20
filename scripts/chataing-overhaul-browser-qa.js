// Native-preview fixture: every sequence starts from real engine actions.
(async () => {
  const [engine, loader, renderer, cameras, art] = await Promise.all([
    import("/shared/engine.ts"),
    import("/src/game/assets.ts"),
    import("/src/game/renderer.ts"),
    import("/src/game/arena-camera.ts"),
    import("/src/game/attack-art.ts"),
  ]);
  const assets = await loader.preloadAssets(
    ["chataing", "zavarce", "carolina", "momoy", "silbon"],
    ["poliedro", "valencia"],
  );
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
    if (image === assets.finaleProps[art.ATTACK_ART.chataing.file]) {
      const pose = Object.entries(art.ATTACK_ART.chataing.frames).find(
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
    const actor = { name: "Luis Chataing", fighter: "chataing", wins: 3 },
      rival = {
        name: "Rival",
        fighter:
          scenario === "short"
            ? "momoy"
            : scenario === "tall"
              ? "silbon"
              : scenario === "reflect"
                ? "carolina"
                : scenario === "double"
                  ? "chataing"
                  : "zavarce",
        wins: 3,
      };
    const state = engine.createMatch(
      scenario === "platform" ? "valencia" : "poliedro",
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
    if (scenario === "platform") {
      source.x = side ? 855 : 225;
      source.y = 418;
      source.supportPlatform = side ? 2 : 0;
      target.x = side ? 620 : 460;
      source.facing = side ? -1 : 1;
      target.facing = -source.facing;
      target.y = 345;
      target.grounded = true;
      target.supportPlatform = 1;
    }
    if (scenario === "reflect") target.x = source.x + source.facing * 300;
    if (scenario === "capture") target.x = source.x + source.facing * 200;
    if (scenario === "miss") target.x = source.x + source.facing * 600;
    if (scenario === "lethal" || scenario === "last-stock") target.hp = 1;
    if (scenario === "last-stock") target.stocks = 1;
    const inputs = [engine.emptyInput(), engine.emptyInput()];
    if (scenario === "guard") inputs[1 - side].block = true;
    if (["reflect", "interrupt-after", "double"].includes(scenario))
      inputs[1 - side].actions.special++;
    if (scenario === "interrupt-before") {
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
            [art.ATTACK_ART.chataing.file]: undefined,
          },
        }
      : assets;
    rectangles = [];
    canonical = 0;
    const before = JSON.stringify([sample.state, sample.camera]);
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
      "Rendering mutated world or camera",
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
        "guard",
        "miss",
        "lethal",
        "last-stock",
        "short",
        "tall",
        "reflect",
        "jump",
        "interrupt-before",
        "interrupt-after",
        "capture",
        "double",
      ]) {
        if (
          move === "final" &&
          ["reflect", "jump", "interrupt-after", "capture", "double"].includes(
            scenario,
          )
        )
          continue;
        if (
          move === "special" &&
          ["lethal", "last-stock", "short", "tall"].includes(scenario)
        )
          continue;
        const run = setup(side, scenario, move);
        let camera,
          paid,
          last = run.target.hp;
        const impacts = [];
        const emitted = new Set();
        let captured, releaseState;
        const flight = [];
        let lostAt;
        for (let frame = 1; frame <= 300; frame++) {
          if (scenario === "jump" && frame === 14)
            run.inputs[side].actions.jump++;
          if (scenario === "capture" && frame === 12)
            run.inputs[1 - side].actions.super++;
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
          if (
            releaseState &&
            run.target.stocks === (scenario === "last-stock" ? 1 : 2)
          )
            flight.push({
              frame,
              x: run.target.x,
              y: run.target.y,
              hp: run.target.hp,
              vx: run.target.vx,
              vy: run.target.vy,
            });
          if (
            releaseState &&
            run.target.stocks < (scenario === "last-stock" ? 1 : 2) &&
            !lostAt
          )
            lostAt = frame;
          const wanted =
            (releaseState &&
              [1, 5, 10, 20, 35, 60].includes(frame - releaseState.frame)) ||
            lostAt === frame ||
            releaseState?.frame === frame ||
            (move === "final"
              ? [
                  12, 30, 66, 79, 80, 95, 96, 105, 113, 114, 118, 126, 138, 150,
                  168, 179,
                ].includes(tick)
              : [7, 10, 11, 12, 15, 20, 25, 32, 40, 50, 60, 70].includes(
                  frame,
                ));
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
            if (
              move === "final" &&
              ["edge", "inward", "close-edge"].includes(scenario)
            )
              for (const r of result.rectangles.filter(
                (r) =>
                  ["windup", "cast", "reel", "recover"].includes(r.pose) &&
                  r.alpha > 0,
              ))
                check(
                  r.left >= -0.01 && r.right <= 1280.01,
                  `Clipped ${key}: ${JSON.stringify(r)}`,
                );
          }
        }
        check(
          !run.state.finale && !run.source.attack,
          "Sequence failed to release",
        );
        check(paid === (move === "final" ? 25 : 75), "Incorrect energy charge");
        if (
          move === "final" &&
          ![
            "guard",
            "miss",
            "lethal",
            "last-stock",
            "interrupt-before",
          ].includes(scenario)
        )
          check(impacts.length === 1, "Final requires one smash");

        if (["guard", "reflect", "interrupt-before"].includes(scenario))
          check(run.target.hp === 100, "Defense failed");
        if (["interrupt-before", "interrupt-after"].includes(scenario))
          check(run.source.hp < 100, "Interruption must come from a real hit");
        if (move === "special" && ["normal", "guard"].includes(scenario))
          check(emitted.size === 1, "One wired microphone");
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
          flight,
          lostAt,
          stocks: run.target.stocks,
          release: run.state.players.map((p) => [p.x, p.y]),
        });
      }
  window.chataingQA = {
    evidence,
    canvas,
    sample(key) {
      return samples.get(key);
    },
    keys: [...samples.keys()],
    hide() {
      panel.remove();
    },
    show(key, reduced = false, missing = false) {
      if (!panel.isConnected) document.body.append(panel);
      const sample = samples.get(key);
      check(sample, `Unknown ${key}`);
      return paint(sample, reduced, missing);
    },
  };
  window.chataingQA.show("final-p1-normal-114");
  return {
    cases: evidence.length,
    samples: samples.size,
    keys: [...samples.keys()].slice(0, 20),
  };
})();
