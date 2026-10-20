(async () => {
  const [engine, content, loader, renderer, cameras, art] = await Promise.all([
    import('/shared/engine.ts'), import('/shared/content.ts'),
    import('/src/game/assets.ts'), import('/src/game/renderer.ts'),
    import('/src/game/arena-camera.ts'), import('/src/game/attack-art.ts'),
  ]);
  const ids = content.FIGHTERS.map(f => f.id);
  const assets = await loader.preloadAssets(ids, ['poliedro']);
  const canvas = document.createElement('canvas');
  canvas.width = 1280; canvas.height = 760;
  const ctx = canvas.getContext('2d');
  const draw = ctx.drawImage.bind(ctx);
  let balls = 0;
  ctx.drawImage = (image, ...args) => {
    const ball = art.ATTACK_ART.dayana.frames.ball;
    if (image === assets.finaleProps[art.ATTACK_ART.dayana.file] &&
        args.length === 8 && args[0] === ball.x && args[1] === ball.y) balls++;
    return draw(image, ...args);
  };
  const rows = [];
  for (const id of ids) for (const side of [0, 1]) {
    const actor = {name:'Dayana', fighter:'dayana', wins:3};
    const target = {name:id, fighter:id, wins:3};
    const state = engine.createMatch('poliedro', side ? [target,actor] : [actor,target]);
    state.phase = 'playing';
    state.players.forEach(p => { p.energy=100; p.invincible=0; });
    state.players[side].x = side ? 700 : 380;
    state.players[side].facing = side ? -1 : 1;
    state.players[1-side].x = state.players[side].x + state.players[side].facing*180;
    state.players[1-side].facing = -state.players[side].facing;
    const inputs = [engine.emptyInput(), engine.emptyInput()];
    inputs[side].actions.super++;
    let camera;
    for (let frame=0; frame<109; frame++) {
      engine.stepMatch(state,inputs);
      camera = cameras.advanceArenaCamera(camera,state,1280,760,1000/60);
    }
    balls=0;
    const before = JSON.stringify(state), cameraBefore=JSON.stringify(camera);
    renderer.renderMatch(ctx,state,assets,109000/60,false,camera);
    rows.push({rival:id,side:side+1,tick:state.finale?.tick,
      hp:state.players[1-side].hp,hits:state.players[side].hits,balls,
      unchanged:before===JSON.stringify(state)&&cameraBefore===JSON.stringify(camera)});
  }
  const failures = rows.filter(r=>r.tick!==100||r.hp>=100||r.hits!==1||r.balls!==3||!r.unchanged);
  window.dayanaRosterAudit={scope:'104 real-input casts; rendered contact frame only, not complete visual timelines.',rows,failures,passed:!failures.length};
  return {cases:rows.length,passed:!failures.length,failures};
})()
