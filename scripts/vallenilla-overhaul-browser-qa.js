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
  const assets = await preloadAssets(["vallenilla", "javier"], ["poliedro"]);
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
  let artDraws = 0;
  let artFacings = [];
  ctx.drawImage = (image, ...args) => {
    if (image === assets.finaleProps["vallenilla-cashea-attack-v1"]) artDraws++;
    drawImage(image, ...args);
  };
  const phases = [];
  const samples = [],
    evidence = [];
  const check = (truth, message) => {
    if (!truth) throw Error(message);
  };
  for (const side of [0, 1])
    for (const attack of ["special", "super"]) {
      const actor = {
        name: "Pedro",
        fighter: "vallenilla",
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
        peakArt = 0,
        paid;
      for (let frame = 0; frame < (attack === "super" ? 195 : 150); frame++) {
        stepMatch(state, inputs);
        if (frame === 0) paid = source.energy;
        for (const shot of state.projectiles)
          if (shot.kind === "installments") ids.add(shot.id);
        if (target.hp < previousHp) pulses++;
        previousHp = target.hp;
        camera = advanceArenaCamera(camera, state, 1280, 800, 1000 / 60);
        artDraws = 0;
        artFacings = [];
        renderMatch(
          ctx,
          state,
          assets,
          (state.tick * 1000) / 60,
          false,
          camera,
        );
        if (attack === "special")
          check(
            artFacings.every((scale) => scale > 0),
            "Cashea C must not be mirrored",
          );
        peakArt = Math.max(peakArt, artDraws);
        if (
          (attack === "special" && frame === 30) ||
          (attack === "super" && state.finale?.tick === 80)
        ) {
          sample = {
            side,
            attack,
            state: structuredClone(state),
            camera: structuredClone(camera),
          };
        }
        if (
          attack === "super" &&
          [44, 62, 98, 116, 134].includes(state.finale?.tick)
        ) {
          phases.push({
            side,
            attack,
            state: structuredClone(state),
            camera: structuredClone(camera),
          });
        }
      }
      check(
        pulses === (attack === "special" ? 3 : 6),
        "wrong damage pulse count",
      );
      check(
        ids.size === (attack === "special" ? 3 : 0),
        "wrong live projectile count",
      );
      check(
        peakArt >= (attack === "special" ? 2 : 3),
        "wrong painted sprite count",
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
        paintedSprites: peakArt,
        damagePulses: pulses,
        damage: 100 - target.hp,
        stocks: target.stocks,
        released: !state.finale,
      });
    }
  samples.push(...phases);
  window.vallenillaQA = {
    evidence,
    samples,
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
        attack: sample.attack,
        tick: sample.state.finale?.tick ?? sample.state.tick,
        reducedMotion,
        artDraws,
      };
    },
  };
  window.vallenillaQA.show(1);
  return evidence;
})();
