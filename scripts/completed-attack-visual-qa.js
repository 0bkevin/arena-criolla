// Run in the native preview against Vite. Every sample starts from actual inputs.
(async () => {
  const [engine, assetLoader, renderer, cameraTools, attackArt, finales] =
    await Promise.all([
      import("/shared/engine.ts"),
      import("/src/game/assets.ts"),
      import("/src/game/renderer.ts"),
      import("/src/game/arena-camera.ts"),
      import("/src/game/attack-art.ts"),
      import("/shared/finales.ts"),
    ]);
  const assets = await assetLoader.preloadAssets(
    ["renny", "vallenilla", "javier", "capriles", "zavarce"],
    ["poliedro"],
  );
  const panel = document.createElement("div");
  panel.style.cssText =
    "position:fixed;inset:0;z-index:999999;background:#12131a;display:flex;flex-direction:column;align-items:center;justify-content:center";
  const canvas = document.createElement("canvas");
  canvas.width = 1440;
  canvas.height = 800;
  canvas.style.cssText =
    "display:block;max-width:100vw;max-height:calc(100vh - 44px);object-fit:contain";
  const caption = document.createElement("div");
  caption.style.cssText =
    "height:44px;flex:none;display:flex;align-items:center;justify-content:center;color:#f4ebd7;font:16px system-ui;text-align:center";
  panel.append(canvas, caption);
  document.body.append(panel);
  const ctx = canvas.getContext("2d");
  const originalDraw = ctx.drawImage.bind(ctx);
  let rectangles = [];
  ctx.drawImage = (image, ...args) => {
    for (const [fighter, sheet] of Object.entries(attackArt.ATTACK_ART)) {
      if (image !== assets.finaleProps[sheet.file]) continue;
      const pose = Object.entries(sheet.frames).find(
        ([, frame]) => frame.x === args[0] && frame.y === args[1],
      )?.[0];
      const matrix = ctx.getTransform();
      const corners = [
        [args[4], args[5]],
        [args[4] + args[6], args[5]],
        [args[4], args[5] + args[7]],
        [args[4] + args[6], args[5] + args[7]],
      ].map(([x, y]) => ({
        x: matrix.a * x + matrix.c * y + matrix.e,
        y: matrix.b * x + matrix.d * y + matrix.f,
      }));
      rectangles.push({
        fighter,
        pose,
        alpha: ctx.globalAlpha,
        left: Math.min(...corners.map((p) => p.x)),
        right: Math.max(...corners.map((p) => p.x)),
        top: Math.min(...corners.map((p) => p.y)),
        bottom: Math.max(...corners.map((p) => p.y)),
      });
    }
    originalDraw(image, ...args);
  };
  const samples = new Map(),
    evidence = [];
  const check = (truth, message) => {
    if (!truth) throw Error(message);
  };
  const setup = (fighter, side, gap, edge = false) => {
    const actor = { name: fighter, fighter, wins: 3 };
    const rival = { name: "Vicente", fighter: "zavarce", wins: 3 };
    const state = engine.createMatch(
      "poliedro",
      side ? [rival, actor] : [actor, rival],
    );
    state.phase = "playing";
    state.players.forEach((player) => {
      player.energy = 100;
      player.invincible = 0;
    });
    const source = state.players[side],
      target = state.players[1 - side];
    source.x = edge ? (side ? 155 : 925) : side ? 700 : 435;
    source.facing = side ? -1 : 1;
    target.x = source.x + source.facing * gap;
    target.facing = -source.facing;
    return {
      state,
      source,
      target,
      inputs: [engine.emptyInput(), engine.emptyInput()],
    };
  };
  const paint = (sample, missingArt = false) => {
    let loaded = assets;
    if (missingArt) {
      loaded = { ...assets, finaleProps: { ...assets.finaleProps } };
      delete loaded.finaleProps[attackArt.ATTACK_ART.vallenilla.file];
    }
    rectangles = [];
    renderer.renderMatch(
      ctx,
      sample.state,
      loaded,
      (sample.frame * 1000) / 60,
      false,
      sample.camera,
    );
    caption.textContent =
      sample.label +
      (missingArt ? " · bitmap unavailable: visible fallback" : "") +
      ` · HP ${sample.state.players.map((player) => player.hp.toFixed(2)).join(" / ")}`;
    return rectangles;
  };
  for (const fighter of ["renny", "vallenilla"])
    for (const side of [0, 1]) {
      const run = setup(fighter, side, 120, true);
      const originalPositions = run.state.players.map((player) => [
        player.x,
        player.y,
      ]);
      let camera = cameraTools.advanceArenaCamera(
        undefined,
        run.state,
        1440,
        800,
        0,
        false,
      );
      const profile = finales.finaleById(fighter);
      const phases = new Set([30, ...profile.damageBeats, 110, 158]);
      run.inputs[side].actions.super++;
      let clippedFrames = 0,
        maxActors = 0;
      for (let frame = 0; frame < 195; frame++) {
        engine.stepMatch(run.state, run.inputs);
        if (!run.state.finale) {
          camera = cameraTools.advanceArenaCamera(
            camera,
            run.state,
            1440,
            800,
            1000 / 60,
            false,
          );
          continue;
        }
        const tick = run.state.finale.tick;
        check(
          JSON.stringify(
            run.state.players.map((player) => [player.x, player.y]),
          ) === JSON.stringify(originalPositions),
          "Finale moved a captured fighter",
        );
        const sample = {
          state: structuredClone(run.state),
          camera: structuredClone(camera),
          frame,
          label: `${fighter} · P${side + 1} · ledge · finale tick ${tick}`,
        };
        const art = paint(sample).filter(
          (rectangle) => rectangle.alpha >= 0.25,
        );
        maxActors = Math.max(maxActors, art.length);
        if (
          art.some(
            (rectangle) => rectangle.left < -0.01 || rectangle.right > 1440.01,
          )
        )
          clippedFrames++;
        if (phases.has(tick))
          samples.set(`${fighter}-p${side + 1}-edge-${tick}`, sample);
      }
      check(
        clippedFrames === 0,
        `${fighter} P${side + 1}: ${clippedFrames} frames still clip complete loaded art`,
      );
      check(maxActors === 3, `${fighter}: three painted actors were not drawn`);
      evidence.push({
        fighter,
        side: side + 1,
        clippedFrames,
        paintedActors: maxActors,
        released: !run.state.finale,
      });
    }
  for (const fighter of ["capriles", "javier", "vallenilla"])
    for (const side of [0, 1]) {
      const run = setup(
        fighter,
        side,
        fighter === "capriles" ? 214 : fighter === "javier" ? 140 : 240,
      );
      run.inputs[side].actions.special++;
      let camera,
        previousHp = 100,
        firstHit,
        shotSample;
      for (let frame = 0; frame < 150; frame++) {
        engine.stepMatch(run.state, run.inputs);
        camera = cameraTools.advanceArenaCamera(
          camera,
          run.state,
          1440,
          800,
          1000 / 60,
          false,
        );
        const snapshot = () => ({
          state: structuredClone(run.state),
          camera: structuredClone(camera),
          frame,
          label: `${fighter} · P${side + 1} · special attack tick ${run.source.attackTick}`,
        });
        if (!firstHit && run.target.hp < previousHp) {
          firstHit = snapshot();
          samples.set(`${fighter}-p${side + 1}-special-contact`, firstHit);
        }
        if (
          fighter === "vallenilla" &&
          run.state.projectiles.filter((shot) => shot.kind === "installments")
            .length >= 2 &&
          !shotSample
        ) {
          shotSample = snapshot();
          samples.set(`${fighter}-p${side + 1}-special-boxes`, shotSample);
        }
        previousHp = run.target.hp;
      }
      check(firstHit, `${fighter} P${side + 1}: regular special never hit`);
      evidence.push({
        fighter,
        side: side + 1,
        firstHitFrame: firstHit.frame,
        attackTick: firstHit.state.players[side].attackTick,
        gap: Math.abs(
          firstHit.state.players[0].x - firstHit.state.players[1].x,
        ),
        damage: 100 - run.target.hp,
      });
    }
  window.completedAttackQA = {
    canvas,
    samples,
    evidence,
    show(name, missingArt = false) {
      const sample = samples.get(name);
      if (!sample) throw Error(`Unknown sample ${name}`);
      const art = paint(sample, missingArt);
      return {
        label: sample.label,
        art,
        positions: sample.state.players.map((player) => [player.x, player.y]),
        hp: sample.state.players.map((player) => player.hp),
        attackTicks: sample.state.players.map((player) => player.attackTick),
      };
    },
  };
  window.completedAttackQA.show("renny-p1-edge-90");
  return { evidence, samples: [...samples.keys()] };
})();
