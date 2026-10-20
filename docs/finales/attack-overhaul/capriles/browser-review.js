(async () => {
  const [engine, assets, renderer, presentation] = await Promise.all([
    import('/shared/engine.ts'), import('/src/game/assets.ts'),
    import('/src/game/renderer.ts'), import('/shared/presentation.ts'),
  ]);
  const loaded = await assets.preloadAssets(['capriles', 'nacho'], ['caracas']);
  const panel = document.createElement('div');
  panel.style = 'position:fixed;inset:0;z-index:9999;background:#151b25;display:grid;place-items:center';
  const canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = 640;
  canvas.style = 'width:min(100vw,1080px);height:auto';
  panel.append(canvas); document.body.append(panel);
  const qa = { canvas, loaded, renderer, engine, reset(side = 0) {
    const configs = [{ name: 'Capriles', fighter: 'capriles', wins: 3 }, { name: 'Nacho', fighter: 'nacho', wins: 3 }];
    this.state = engine.createMatch('caracas', side === 0 ? configs : [configs[1], configs[0]]);
    this.inputs = [engine.emptyInput(), engine.emptyInput()];
    for (let i = 0; i < presentation.INTRO_TOTAL_TICKS; i++) engine.stepMatch(this.state, this.inputs);
    this.state.players[0].x = 450; this.state.players[1].x = 630; this.state.players[side].energy = 100;
    this.inputs[side].actions.super++;
    for (let i = 0; i < 20 && !this.state.finale; i++) engine.stepMatch(this.state, this.inputs);
    if (!this.state.finale) throw Error('actual super input failed to capture');
  }, sample(tick) {
    while (this.state.finale && this.state.finale.tick < tick) engine.stepMatch(this.state, this.inputs);
    renderer.renderMatch(canvas.getContext('2d'), this.state, loaded, 0, false);
    return { tick: this.state.finale?.tick, hp: this.state.players.map(p => p.hp) };
  } };
  window.caprilesQA = qa;
  qa.reset();
  const sample = qa.sample(30);
  const ctx = canvas.getContext('2d');
  ctx.font = '700 20px "Barlow Condensed", sans-serif';
  return { sample, textWidths: ['Maduro tiene la leche', 'acaparada', 'y yo se la voy a sacar', 'de donde sea.'].map(text => ({ text, width: ctx.measureText(text).width, available: 252 })) };
})()
