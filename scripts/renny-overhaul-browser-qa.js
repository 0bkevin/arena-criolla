// Execute in the native preview: real super inputs and stepMatch capture each pose.
(async () => {
  const [
    { createMatch, emptyInput, stepMatch },
    { preloadAssets },
    { renderMatch },
    { advanceArenaCamera },
  ] = await Promise.all([
    import("/shared/engine.ts"),
    import("/src/game/assets.ts"),
    import("/src/game/renderer.ts"),
    import("/src/game/arena-camera.ts"),
  ]);
  const assets = await preloadAssets(["renny", "zavarce"], ["poliedro"]);
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
  let artDraws = 0;
  ctx.drawImage = (image, ...args) => {
    if (image === assets.finaleProps["renny-commercial-attack-v1"]) artDraws++;
    originalDraw(image, ...args);
  };
  const samples = [],
    evidence = [];
  const check = (truth, message) => {
    if (!truth) throw Error(message);
  };
  for (const side of [0, 1]) {
    const actor = { name: "Renny", fighter: "renny", wins: 3 },
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
    let previousHp = 100,
      pulses = 0,
      camera,
      paid,
      maxArt = 0;
    for (let frame = 0; frame < 195; frame++) {
      stepMatch(state, inputs);
      if (!frame) paid = source.energy;
      if (target.hp < previousHp) pulses++;
      previousHp = target.hp;
      camera = advanceArenaCamera(camera, state, 1280, 800, 1000 / 60);
      artDraws = 0;
      renderMatch(ctx, state, assets, (state.tick * 1000) / 60, false, camera);
      maxArt = Math.max(maxArt, artDraws);
      if (state.finale && [12, 42, 90, 138].includes(state.finale.tick))
        samples.push({
          side,
          tick: state.finale.tick,
          state: structuredClone(state),
          camera: structuredClone(camera),
        });
    }
    check(pulses === 3, "Expected three damage beats");
    check(maxArt === 3, "Expected three complete performer crops");
    check(!state.finale && !source.attack, "Expected normal combat release");
    check(source.stocks === 2 && target.stocks === 2, "Unexpected stock loss");
    evidence.push({
      side: side + 1,
      energyAfterInput: paid,
      damageBeats: pulses,
      damage: 100 - target.hp,
      paintedActors: maxArt,
      released: !state.finale,
    });
  }
  window.rennyQA = {
    samples,
    evidence,
    show(index, reducedMotion = false) {
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
      return {
        side: sample.side + 1,
        tick: sample.tick,
        reducedMotion,
        artDraws,
      };
    },
  };
  window.rennyQA.show(1);
  return evidence;
})();
