// Execute in the native preview: real super inputs and stepMatch capture each pose.
(async () => {
  const [
    { createMatch, emptyInput, stepMatch },
    { preloadAssets },
    { renderMatch },
    { advanceArenaCamera },
    { ATTACK_ART },
  ] = await Promise.all([
    import("/shared/engine.ts"),
    import("/src/game/assets.ts"),
    import("/src/game/renderer.ts"),
    import("/src/game/arena-camera.ts"),
    import("/src/game/attack-art.ts"),
  ]);
  const assets = await preloadAssets(["gomez", "zavarce"], ["poliedro"]);
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 800;
  canvas.style.cssText =
    "display:block;width:100%;height:100%;object-fit:contain";
  const panel = document.createElement("div");
  panel.style.cssText =
    "position:fixed;inset:0;z-index:999999;background:#12131a";
  panel.append(canvas);
  document.body.append(panel);
  const ctx = canvas.getContext("2d"),
    originalDraw = ctx.drawImage.bind(ctx);
  let artDraws = 0,
    artRects = [];
  ctx.drawImage = (image, ...args) => {
    if (image === assets.finaleProps["gomez-cavalry-attack-v1"]) {
      artDraws++;
      const pose = Object.entries(ATTACK_ART.gomez.frames).find(
        ([, f]) => f.x === args[0] && f.y === args[1],
      )?.[0];
      const m = ctx.getTransform(),
        x1 = m.a * args[4] + m.e,
        x2 = m.a * (args[4] + args[6]) + m.e;
      artRects.push({ pose, left: Math.min(x1, x2), right: Math.max(x1, x2) });
    }
    originalDraw(image, ...args);
  };
  const samples = [],
    evidence = [];
  const check = (truth, message) => {
    if (!truth) throw Error(message);
  };
  for (const side of [0, 1]) {
    const actor = { name: "Gómez", fighter: "gomez", wins: 3 },
      rival = { name: "Vicente", fighter: "zavarce", wins: 3 };
    const state = createMatch(
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
    source.x = side ? 650 : 430;
    source.facing = side ? -1 : 1;
    target.x = source.x + source.facing * 180;
    target.facing = -source.facing;
    const inputs = [emptyInput(), emptyInput()];
    inputs[side].actions.super++;
    const impacts = [];
    let previousHp = 100,
      pulses = 0,
      camera,
      paid,
      maxArt = 0,
      releasedSample;
    for (let frame = 0; frame < 220; frame++) {
      stepMatch(state, inputs);
      if (!frame) paid = source.energy;
      if (target.hp < previousHp) {
        pulses++;
        impacts.push({
          tick: state.finale?.tick,
          hp: target.hp,
          damage: previousHp - target.hp,
        });
      }
      previousHp = target.hp;
      camera = advanceArenaCamera(camera, state, 1280, 800, 1000 / 60);
      artDraws = 0;
      renderMatch(ctx, state, assets, (state.tick * 1000) / 60, false, camera);
      maxArt = Math.max(maxArt, artDraws);
      if (frame > 180 && !state.finale && !releasedSample)
        releasedSample = {
          side,
          tick: "released",
          state: structuredClone(state),
          camera: structuredClone(camera),
        };
      if (
        state.finale &&
        [12, 32, 48, 70, 92, 120, 148, 165, 178].includes(state.finale.tick)
      )
        samples.push({
          side,
          tick: state.finale.tick,
          state: structuredClone(state),
          camera: structuredClone(camera),
        });
    }
    samples.push(releasedSample);
    check(pulses === 3, "Expected three damage beats");
    check(maxArt === 3, "Expected three complete performer crops");
    check(!state.finale && !source.attack, "Expected normal combat release");
    check(source.stocks === 2 && target.stocks === 2, "Unexpected stock loss");
    evidence.push({
      side: side + 1,
      energyAfterInput: paid,
      damageBeats: pulses,
      impacts,
      damage: 100 - target.hp,
      paintedActors: maxArt,
      finalHp: target.hp,
      releasePositions: releasedSample.state.players.map((p) => [p.x, p.y]),
      sourcePosition: [source.x, source.y],
      targetPosition: [target.x, target.y],
      sourceStocks: source.stocks,
      targetStocks: target.stocks,
      released: !state.finale,
    });
  }
  const specialSamples = [],
    specialEvidence = [];
  for (const side of [0, 1]) {
    const actor = { name: "Gómez", fighter: "gomez", wins: 0 },
      rival = { name: "Vicente", fighter: "zavarce", wins: 0 };
    const state = createMatch(
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
    source.x = side ? 650 : 430;
    source.facing = side ? -1 : 1;
    target.x = source.x + source.facing * 130;
    target.facing = -source.facing;
    const inputs = [emptyInput(), emptyInput()];
    inputs[side].actions.special++;
    let camera, paid;
    for (let frame = 1; frame <= 80; frame++) {
      stepMatch(state, inputs);
      if (frame === 1) paid = source.energy;
      camera = advanceArenaCamera(camera, state, 1280, 800, 1000 / 60);
      if ([8, 17, 60].includes(frame))
        specialSamples.push({
          side,
          tick: frame,
          state: structuredClone(state),
          camera: structuredClone(camera),
        });
    }
    check(
      !source.attack && source.hits === 1,
      "Special should hit once and recover",
    );
    specialEvidence.push({
      side: side + 1,
      energyAfterInput: paid,
      damage: 100 - target.hp,
      hits: source.hits,
      released: !source.attack,
    });
  }
  const edgeSamples = [],
    edgeEvidence = [];
  for (const side of [0, 1]) {
    const actor = { name: "Gómez", fighter: "gomez", wins: 3 },
      rival = { name: "Vicente", fighter: "zavarce", wins: 3 };
    const state = createMatch(
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
    source.x = side ? 155 : 925;
    source.facing = side ? -1 : 1;
    target.x = source.x + source.facing * 120;
    target.facing = -source.facing;
    const inputs = [emptyInput(), emptyInput()];
    inputs[side].actions.super++;
    let camera;
    for (let frame = 0; frame < 150; frame++) {
      stepMatch(state, inputs);
      camera = advanceArenaCamera(camera, state, 1280, 800, 1000 / 60);
      const tick = state.finale?.tick;
      if (![76, 90, 94, 110].includes(tick)) continue;
      artRects = [];
      renderMatch(ctx, state, assets, (state.tick * 1000) / 60, false, camera);
      const commander = artRects.find(
        (p) => p.pose === "brake" || p.pose?.startsWith("gallop"),
      );
      check(
        commander && commander.left >= -0.01 && commander.right <= 1280.01,
        `Commander clipped near edge: side ${side}, tick ${tick}, ${JSON.stringify(commander)}`,
      );
      edgeEvidence.push({ side: side + 1, tick, ...commander });
      edgeSamples.push({
        side,
        tick,
        state: structuredClone(state),
        camera: structuredClone(camera),
      });
    }
  }
  window.gomezQA = {
    samples,
    evidence,
    specialEvidence,
    edgeEvidence,
    showEdge(index) {
      const sample = edgeSamples[index];
      renderMatch(
        ctx,
        sample.state,
        assets,
        (sample.state.tick * 1000) / 60,
        false,
        sample.camera,
      );
      return { side: sample.side + 1, tick: sample.tick };
    },
    showSpecial(index) {
      const sample = specialSamples[index];
      renderMatch(
        ctx,
        sample.state,
        assets,
        (sample.state.tick * 1000) / 60,
        false,
        sample.camera,
      );
      return { side: sample.side + 1, tick: sample.tick };
    },
    show(index, reducedMotion = false, missingArt = false) {
      const savedArt = assets.finaleProps["gomez-cavalry-attack-v1"];
      if (missingArt) delete assets.finaleProps["gomez-cavalry-attack-v1"];
      const sample = samples[index];
      artDraws = 0;
      renderMatch(
        ctx,
        sample.state,
        assets,
        (sample.state.tick * 1000) / 60,
        reducedMotion,
        sample.camera,
      );
      if (missingArt) assets.finaleProps["gomez-cavalry-attack-v1"] = savedArt;
      return {
        side: sample.side + 1,
        tick: sample.tick,
        reducedMotion,
        missingArt,
        artDraws,
      };
    },
  };
  window.gomezQA.show(2);
  return { finale: evidence, special: specialEvidence, edge: edgeEvidence };
})();
