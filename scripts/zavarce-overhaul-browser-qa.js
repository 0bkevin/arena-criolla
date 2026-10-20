// Run in the native browser against Vite. All samples come from real inputs.
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
  const assets = await preloadAssets(["zavarce", "javier"], ["poliedro"]);
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
  const ctx = canvas.getContext("2d");
  const drawImage = ctx.drawImage.bind(ctx);
  let bikeDraws = 0;
  ctx.drawImage = (image, ...args) => {
    if (image === assets.courier) bikeDraws++;
    drawImage(image, ...args);
  };
  const samples = [],
    evidence = [];
  const check = (truth, message) => {
    if (!truth) throw Error(message);
  };
  for (const side of [0, 1])
    for (const attack of ["special", "super"]) {
      const actor = {
        name: "Vicente",
        fighter: "zavarce",
        wins: attack === "special" ? 0 : 3,
      };
      const rival = { name: "Javier", fighter: "javier", wins: 3 };
      const state = createMatch(
        "poliedro",
        side ? [rival, actor] : [actor, rival],
      );
      state.phase = "playing";
      const source = state.players[side],
        target = state.players[1 - side];
      state.players.forEach((p) => {
        p.energy = 100;
        p.invincible = 0;
      });
      source.x = side ? 650 : 430;
      source.facing = side ? -1 : 1;
      target.x = source.x + source.facing * (attack === "special" ? 240 : 180);
      target.facing = -source.facing;
      const inputs = [emptyInput(), emptyInput()];
      inputs[side].actions[attack]++;
      const ids = new Set();
      let pulses = 0,
        previousHp = 100,
        camera,
        sample,
        peakBikes = 0,
        paid;
      for (let frame = 0; frame < (attack === "super" ? 195 : 150); frame++) {
        stepMatch(state, inputs);
        if (frame === 0) paid = source.energy;
        for (const shot of state.projectiles)
          if (shot.kind === "courier") ids.add(shot.id);
        if (target.hp < previousHp) pulses++;
        previousHp = target.hp;
        camera = advanceArenaCamera(camera, state, 1280, 800, 1000 / 60);
        bikeDraws = 0;
        renderMatch(
          ctx,
          state,
          assets,
          (state.tick * 1000) / 60,
          false,
          camera,
        );
        peakBikes = Math.max(peakBikes, bikeDraws);
        if (
          (attack === "special" && frame === 22) ||
          (attack === "super" && state.finale?.tick === 90)
        ) {
          sample = {
            side,
            attack,
            state: structuredClone(state),
            camera: structuredClone(camera),
          };
        }
      }
      check(
        pulses === (attack === "special" ? 1 : 7),
        "wrong damage pulse count",
      );
      check(
        ids.size === (attack === "special" ? 1 : 0),
        "wrong live projectile count",
      );
      check(
        peakBikes === (attack === "special" ? 1 : 7),
        "wrong painted rider count",
      );
      check(!state.finale && !source.attack, "release failed");
      check(
        source.stocks === 2 && target.stocks === 2,
        "unexpected stock loss " +
          JSON.stringify({
            side,
            attack,
            source: source.stocks,
            target: target.stocks,
            x: target.x,
            y: target.y,
            hp: target.hp,
          }),
      );
      samples.push(sample);
      evidence.push({
        side: side + 1,
        attack,
        wins: actor.wins,
        energyAfterInput: paid,
        uniqueProjectiles: ids.size,
        paintedRiders: peakBikes,
        damagePulses: pulses,
        damage: 100 - target.hp,
        stocks: target.stocks,
        released: !state.finale,
      });
    }
  window.zavarceQA = {
    evidence,
    samples,
    show(index, reducedMotion = false) {
      const sample = samples[index];
      bikeDraws = 0;
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
        attack: sample.attack,
        tick: sample.state.finale?.tick ?? sample.state.tick,
        reducedMotion,
        bikeDraws,
      };
    },
  };
  window.zavarceQA.show(1);
  return evidence;
})();
