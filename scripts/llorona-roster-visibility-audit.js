(async()=>{
 const [engine,content,loader,renderer,cameras,art]=await Promise.all([
  import('/shared/engine.ts'),import('/shared/content.ts'),import('/src/game/assets.ts'),
  import('/src/game/renderer.ts'),import('/src/game/arena-camera.ts'),import('/src/game/attack-art.ts')]);
 const ids=content.FIGHTERS.map(f=>f.id),assets=await loader.preloadAssets(ids,['poliedro','valencia']);
 const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=760;
 const ctx=canvas.getContext('2d',{willReadFrequently:true}),draw=ctx.drawImage.bind(ctx);
 let canonicalImages=new Set(),actorCalls=0,rivalCalls=0,portalCalls=0;
 // Keep production transforms and hardware clip operations, but paint only the
 // two character bitmaps into a transparent mask. Never redraw the portal here.
 for(const name of ['fillRect','fill','stroke','fillText','strokeText'])ctx[name]=()=>{};
 ctx.drawImage=(image,...args)=>{
  if(image===assets.finaleProps[art.ATTACK_ART.llorona.file]){
   const pose=Object.entries(art.ATTACK_ART.llorona.frames).find(([,f])=>f.x===args[0]&&f.y===args[1])?.[0];
   if(pose==='portal'){portalCalls++;return;}
   if(['lure','cast','reveal','embrace-high','embrace-low','recover'].includes(pose)){actorCalls++;return draw(image,...args);}
  }else if(canonicalImages.has(image)){rivalCalls++;return draw(image,...args);}
 };
 const rows=[],casts=[];
 for(const id of ids)for(const side of [0,1])for(const scenario of ['normal','platform','platform-reverse']){
  const a={name:'La Llorona',fighter:'llorona',wins:3},b={name:id,fighter:id,wins:3};
  const state=engine.createMatch(scenario==='normal'?'poliedro':'valencia',side?[b,a]:[a,b]);state.phase='playing';
  state.players.forEach(p=>{p.energy=100;p.invincible=0;});
  const p=state.players[side],q=state.players[1-side];p.x=side?700:380;p.facing=side?-1:1;q.x=p.x+p.facing*180;q.facing=-p.facing;
  if(scenario!=='normal'){
   p.x=side?855:225;p.y=418;p.supportPlatform=side?2:0;q.x=side?620:460;q.y=345;q.supportPlatform=1;
   if(scenario==='platform-reverse'){
    [p.x,q.x]=[q.x,p.x];[p.y,q.y]=[q.y,p.y];[p.supportPlatform,q.supportPlatform]=[q.supportPlatform,p.supportPlatform];p.facing*=-1;q.facing*=-1;
   }
  }
  const sprite=assets.sprites[id];canonicalImages=new Set([sprite.image,...(sprite.frameTextures??[])]);
  const inputs=[engine.emptyInput(),engine.emptyInput()];inputs[side].actions.super++;
  let camera,captured,lastHp=q.hp,damageEvents=0;
  for(let frame=1;frame<=189;frame++){
   engine.stepMatch(state,inputs);camera=cameras.advanceArenaCamera(camera,state,1280,760,1000/60);
   if(q.hp<lastHp)damageEvents++;lastHp=q.hp;
   if(state.finale?.tick===0)captured=state.players.map(p=>[p.x,p.y]);
   if(![87,147,187].includes(frame))continue;
   actorCalls=0;rivalCalls=0;portalCalls=0;ctx.clearRect(0,0,1280,760);
   const before=JSON.stringify(state),cb=JSON.stringify(camera);
   renderer.renderMatch(ctx,state,assets,frame*1000/60,false,camera);
   const pixels=ctx.getImageData(0,0,1280,760).data;let visible=0;
   for(let i=3;i<pixels.length;i+=4)if(pixels[i]>=100)visible++;
   rows.push({rival:id,side:side+1,scenario,frame,tick:state.finale?.tick,visible,actorCalls,rivalCalls,portalCalls,
    unchanged:before===JSON.stringify(state)&&cb===JSON.stringify(camera)});
  }
  casts.push({rival:id,side:side+1,scenario,damageEvents,released:!state.finale&&p.attack===null,
   restored:JSON.stringify(captured)===JSON.stringify(state.players.map(p=>[p.x,p.y]))});
 }
 const failures=[...rows.filter(r=>r.tick!==r.frame-9||r.actorCalls!==1||r.rivalCalls!==1||!r.unchanged||(r.tick===138?r.visible!==0:r.visible<1000)||(r.tick===178?r.portalCalls!==0:r.portalCalls!==2)),...casts.filter(c=>c.damageEvents!==3||!c.released||!c.restored)];
 window.lloronaRosterVisibility={scope:'312 real-input captures:52 rivals×2slots×floor/both unequal platform directions;936 production renders filtered to actual body bitmaps with production clipping. Checks visible grip/return phases, zero visible body pixels in underworld, closed portal and release/position restoration. Does not prove hand placement for every rival.',casts,rows,failures,passed:!failures.length};
 return {casts:casts.length,frames:rows.length,passed:!failures.length,failureCount:failures.length,failures:failures.slice(0,6)};
})()
