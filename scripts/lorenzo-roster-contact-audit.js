(async () => {
  const [engine, content, loader, renderer, cameras, art] = await Promise.all([
    import('/shared/engine.ts'), import('/shared/content.ts'),
    import('/src/game/assets.ts'), import('/src/game/renderer.ts'),
    import('/src/game/arena-camera.ts'), import('/src/game/attack-art.ts'),
  ]);
  const ids = content.FIGHTERS.map(f => f.id);
  const assets = await loader.preloadAssets(ids, ['poliedro', 'valencia']);
  const canvas = document.createElement('canvas');
  canvas.width = 1280; canvas.height = 760;
  const ctx = canvas.getContext('2d');
  const draw = ctx.drawImage.bind(ctx);
  let rides = 0, supports = 0;
  ctx.drawImage = (image, ...args) => {
    const pose = Object.entries(art.ATTACK_ART.lorenzo.frames).find(([,f])=>f.x===args[0]&&f.y===args[1])?.[0];
    if (image === assets.finaleProps[art.ATTACK_ART.lorenzo.file] && args.length === 8) {
      if (pose?.startsWith('ride-')) rides++;
      if (pose?.startsWith('front-')) supports++;
    }
    return draw(image, ...args);
  };
  const rows = [];
  for (const id of ids) for (const side of [0, 1]) for (const scenario of ['normal', 'platform']) {
    const actor = {name:'Lorenzo', fighter:'lorenzo', wins:3};
    const target = {name:id, fighter:id, wins:3};
    const state = engine.createMatch(scenario === 'platform' ? 'valencia' : 'poliedro', side ? [target,actor] : [actor,target]);
    state.phase = 'playing';
    state.players.forEach(p => { p.energy=100; p.invincible=0; });
    state.players[side].x = side ? 700 : 380;
    state.players[side].facing = side ? -1 : 1;
    state.players[1-side].x = state.players[side].x + state.players[side].facing*180;
    state.players[1-side].facing = -state.players[side].facing;
    if (scenario === 'platform') {
      const p = state.players[side], q = state.players[1-side];
      p.x = side ? 855 : 225; p.y = 418; p.supportPlatform = side ? 2 : 0;
      q.x = side ? 620 : 460; q.y = 345; q.supportPlatform = 1;
    }
    const inputs = [engine.emptyInput(), engine.emptyInput()];
    inputs[side].actions.super++;
    let camera;
    for (let frame=0; frame<105; frame++) {
      engine.stepMatch(state,inputs);
      camera = cameras.advanceArenaCamera(camera,state,1280,760,1000/60);
    }
    rides=0; supports=0;
    const before = JSON.stringify(state), cameraBefore=JSON.stringify(camera);
    renderer.renderMatch(ctx,state,assets,105000/60,false,camera);
    rows.push({rival:id,side:side+1,scenario,tick:state.finale?.tick,
      hp:state.players[1-side].hp,hits:state.players[side].hits,rides,supports,
      unchanged:before===JSON.stringify(state)&&cameraBefore===JSON.stringify(camera)});
  }
  const failures = rows.filter(r=>r.tick!==96||r.hp>=100||r.hits!==1||r.rides!==1||r.supports!==2||!r.unchanged);
  window.lorenzoRosterAudit={scope:'208 real-input casts: 52 rivals in both slots on the floor and unequal platforms. Rendered contact frame only, not complete visual timelines.',rows,failures,passed:!failures.length};
  return {cases:rows.length,passed:!failures.length,failures};
})()
