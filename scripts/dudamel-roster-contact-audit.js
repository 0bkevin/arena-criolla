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
  const ctx = canvas.getContext('2d'), draw = ctx.drawImage.bind(ctx);
  let conductor = 0, orchestra = 0;
  ctx.drawImage = (image, ...args) => {
    if (image === assets.finaleProps[art.ATTACK_ART.dudamel.file] && args.length === 8) {
      const pose = Object.entries(art.ATTACK_ART.dudamel.frames).find(([,f])=>f.x===args[0]&&f.y===args[1])?.[0];
      if (['ready','upbeat','downbeat','fortissimo'].includes(pose)) conductor++;
      if (pose === 'orchestra') orchestra++;
    }
    return draw(image, ...args);
  };
  const rows = [];
  for (const id of ids) for (const side of [0, 1]) for (const scenario of ['normal', 'platform']) {
    const actor = {name:'Dudamel', fighter:'dudamel', wins:3};
    const target = {name:id, fighter:id, wins:3};
    const state = engine.createMatch(scenario === 'platform' ? 'valencia' : 'poliedro', side ? [target,actor] : [actor,target]);
    state.phase = 'playing';
    state.players.forEach(p => { p.energy=100; p.invincible=0; });
    const p=state.players[side], q=state.players[1-side];
    p.x=side?700:380; p.facing=side?-1:1;
    q.x=p.x+p.facing*180; q.facing=-p.facing;
    if (scenario === 'platform') {
      p.x=side?855:225; p.y=418; p.supportPlatform=side?2:0;
      q.x=side?620:460; q.y=345; q.supportPlatform=1;
    }
    const inputs = [engine.emptyInput(), engine.emptyInput()];
    inputs[side].actions.super++;
    let camera, lastHp=q.hp;
    const damageFrames=[];
    for (let frame=1; frame<=147; frame++) {
      engine.stepMatch(state,inputs);
      if(q.hp<lastHp) damageFrames.push(frame);
      lastHp=q.hp;
      camera=cameras.advanceArenaCamera(camera,state,1280,760,1000/60);
      if (![51,99,147].includes(frame)) continue;
      conductor=0; orchestra=0;
      const before=JSON.stringify(state), cameraBefore=JSON.stringify(camera);
      renderer.renderMatch(ctx,state,assets,frame*1000/60,false,camera);
      rows.push({rival:id,side:side+1,scenario,frame,tick:state.finale?.tick,
        hp:q.hp,hits:p.hits,damageEvents:damageFrames.length,conductor,orchestra,
        unchanged:before===JSON.stringify(state)&&cameraBefore===JSON.stringify(camera)});
    }
  }
  const failures=rows.filter(r=>r.tick!==r.frame-9||r.hp>=100||r.hits!==1||r.damageEvents!==[42,90,138].indexOf(r.tick)+1||r.conductor!==1||r.orchestra!==1||!r.unchanged);
  window.dudamelRosterAudit={scope:'208 real-input casts: 52 rivals in both slots on the floor and unequal platforms; 624 rendered damage frames, not complete visual timelines or a pixel-contact proof.',rows,failures,passed:!failures.length};
  return {casts:ids.length*4,renderedFrames:rows.length,passed:!failures.length,failureCount:failures.length,failures:failures.slice(0,5)};
})()
