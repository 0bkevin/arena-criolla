(async () => {
  const [engine, loader, renderer, cameras, art] = await Promise.all([
    import('/shared/engine.ts'), import('/src/game/assets.ts'), import('/src/game/renderer.ts'),
    import('/src/game/arena-camera.ts'), import('/src/game/attack-art.ts')]);
  const assets = await loader.preloadAssets(['emilio', 'javier'], ['poliedro']);
  const panel = document.createElement('div'); panel.style.cssText='position:fixed;inset:0;z-index:999999;background:#12131a;display:flex;flex-direction:column;align-items:center;justify-content:center';
  const canvas=document.createElement('canvas'); canvas.width=1280; canvas.height=760;
  canvas.style.cssText='display:block;max-width:100vw;max-height:calc(100vh - 40px);object-fit:contain';
  const caption=document.createElement('div'); caption.style.cssText='height:40px;color:#f4ebd7;font:16px system-ui';
  panel.append(canvas,caption); document.body.append(panel);
  const ctx=canvas.getContext('2d'), draw=ctx.drawImage.bind(ctx), sheet=art.ATTACK_ART.emilio;
  let painted=[]; const samples=new Map(), evidence=[];
  ctx.drawImage=(image,...args)=>{if(image===assets.finaleProps[sheet.file]) painted.push({pose:Object.entries(sheet.frames).find(([,f])=>f.x===args[0]&&f.y===args[1])?.[0],alpha:ctx.globalAlpha});draw(image,...args);};
  const check=(ok,msg)=>{if(!ok)throw Error(msg);};
  const setup=(side,gap=500)=>{
    const actor={name:'Emilio',fighter:'emilio',wins:3},rival={name:'Javier',fighter:'javier',wins:3};
    const s=engine.createMatch('poliedro',side?[rival,actor]:[actor,rival]);s.phase='playing';
    s.players.forEach(p=>{p.energy=100;p.invincible=0;});
    const p=s.players[side],t=s.players[1-side]; p.x=side?800:280;p.facing=side?-1:1;t.x=p.x+p.facing*gap;t.facing=-p.facing;
    const inputs=[engine.emptyInput(),engine.emptyInput()];
    const advance=n=>{for(let i=0;i<n;i++)engine.stepMatch(s,inputs);};
    return {s,p,t,inputs,advance,side};
  };
  const save=(r,name)=>samples.set(`${r.side}-${name}`,{state:structuredClone(r.s),side:r.side,name});
  for(const side of [0,1]) {
    const r=setup(side);r.inputs[side].actions.super++;r.advance(8);save(r,'startup');
    check(!r.p.transformation,'early transform');r.advance(1);save(r,'activation');
    check(r.p.transformation?.ticks===360&&!r.s.finale&&r.t.hp===100,'activation contract');
    r.advance(40);save(r,'ready');r.inputs[side][side?'left':'right']=true;r.advance(12);save(r,'run');
    r.inputs[side].left=r.inputs[side].right=false;r.inputs[side].actions.jump++;r.advance(10);save(r,'jump');
    r.advance(65);r.inputs[side].block=true;r.advance(1);save(r,'guard');r.inputs[side].block=false;
    r.advance(400);save(r,'expired');check(!r.p.transformation,'expiry');
    for(const action of ['light','heavy','special']) {
      const a=setup(side);a.inputs[side].actions.super++;a.advance(49);a.t.x=a.p.x+a.p.facing*80;
      a.inputs[side].actions[action]++;a.advance(action==='light'?6:action==='heavy'?11:8);save(a,action);
      const expected=(action==='light'?7:action==='heavy'?13:10)*0.99*1.03*1.2;
      check(Math.abs(100-a.t.hp-expected)<1e-8,'damage '+side+action);
      evidence.push({side,action,damage:100-a.t.hp,expected,ticks:a.p.transformation.ticks});
      if(action==='special') { while(a.p.attackTick<24)a.advance(1); save(a,'special-second'); check(Math.abs(100-a.t.hp-expected*2)<1e-8,'second pulse'); evidence.push({side,action:'special-second',damage:100-a.t.hp,expected:expected*2,ticks:a.p.transformation.ticks}); }
      const base=setup(side,80);base.inputs[side].actions[action]++;base.advance(action==='light'?6:action==='heavy'?11:8);save(base,'base-'+action);check(Math.abs(100-base.t.hp-expected/1.2)<1e-8,'base damage');
      if(action==='special'){while(base.p.attackTick<24)base.advance(1);save(base,'base-special-second');}

    }
    const hurt=setup(side);hurt.inputs[side].actions.super++;hurt.advance(49);hurt.t.x=hurt.p.x+hurt.p.facing*80;
    hurt.inputs[1-side].actions.light++;hurt.advance(6);save(hurt,'hurt');check(hurt.p.stun>0&&hurt.p.transformation,'hurt stays transformed');
    const stock=setup(side);stock.inputs[side].actions.super++;stock.advance(9);stock.p.hp=0;stock.advance(1);save(stock,'stock-loss');check(!stock.p.transformation,'stock reset');
    const base=setup(side);save(base,'base-ready');base.inputs[side][side?'left':'right']=true;base.advance(12);save(base,'base-run');base.inputs[side].left=base.inputs[side].right=false;base.inputs[side].actions.jump++;base.advance(10);save(base,'base-jump');base.advance(65);base.inputs[side].block=true;base.advance(1);save(base,'base-guard');base.inputs[side].block=false;base.t.x=base.p.x+base.p.facing*80;base.inputs[1-side].actions.light++;base.advance(6);save(base,'base-hurt');
    evidence.push({side,activationCost:75,duration:360,expiryCleared:true,stockCleared:true});
  }
  const show=(key,reduced=false,missing=false)=>{
    const sample=samples.get(key);if(!sample)throw Error(key);
    const s=structuredClone(sample.state), used=missing?{...assets,finaleProps:{...assets.finaleProps,[sheet.file]:undefined}}:assets;
    painted=[];const camera=cameras.advanceArenaCamera(undefined,s,canvas.width,canvas.height,0,reduced);
    renderer.renderMatch(ctx,s,used,s.tick*1000/60,reduced,camera);
    caption.textContent=`Emilio · P${sample.side+1} · ${sample.name} · ${s.players[sample.side].transformation?.ticks??0} ticks · rival HP ${s.players[1-sample.side].hp.toFixed(3)}${reduced?' · reduced motion':''}${missing?' · missing-art fallback':''}`;
    return {key,reduced,missing,painted:painted.slice(),state:{tick:s.tick,hp:s.players[1-sample.side].hp,transformation:s.players[sample.side].transformation},png:canvas.toDataURL('image/png')};
  };
  for(const key of samples.keys()) {
    const result=show(key); const name=samples.get(key).name;
    if(!['startup','expired','stock-loss'].includes(name)&&!name.startsWith('base-'))check(result.painted.length>0,'missing transformed art '+key);
    evidence.push({key,painted:result.painted});
  }
  check(show('0-special').painted.every(p=>p.pose==='retort'),'consistent dash trail costume');
  check(show('0-special',true).painted.length===1,'reduced motion trail');
  check(show('0-light',false,true).painted.length===0,'fallback');
  window.emilioQA={show,evidence,keys:[...samples.keys()]};
  show('0-special');return {evidence,keys:[...samples.keys()]};
})()
