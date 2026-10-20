(async()=>{
  const [{BUILT_IN_FIGHTERS,fighterById},{createMatch,emptyInput,stepMatch},
    {finaleById},{preloadAssets},{renderMatch}]=await Promise.all([
      import('/shared/content.ts'),import('/shared/engine.ts'),import('/shared/finales.ts'),
      import('/src/game/assets.ts'),import('/src/game/renderer.ts')]);
  const roster=BUILT_IN_FIGHTERS.filter(({id})=>!['nacho','capriles'].includes(id));
  const assets=await preloadAssets(roster.map(f=>f.id),['caracas']);
  const font=new FontFace('Barlow Condensed',"url('/fonts/barlow-800.ttf')",{weight:'800'});
  document.fonts.add(await font.load());
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=640;
  canvas.style.cssText='display:block;width:100%;max-width:1080px';document.body.append(canvas);
  const ctx=canvas.getContext('2d');
  const crop=document.createElement('canvas');crop.width=740;crop.height=370;
  const cropped=crop.getContext('2d');
  const run=window.frameExport={ready:true,done:false,events:[],errors:[],async start(){
    this.startedAt=Date.now();
    for(const[index,fighter]of roster.entries()){
      try{
        const rival=roster[(index+17)%roster.length],profile=finaleById(fighter.id);
        const state=createMatch('caracas',[
          {name:fighter.name,fighter:fighter.id,wins:3},{name:rival.name,fighter:rival.id,wins:3}]);
        state.phase='playing';state.tick=1;
        state.players.forEach((p,slot)=>{p.x=slot?625:435;p.y=555;p.facing=slot?-1:1;p.invincible=0;});
        state.finale={owner:0,target:1,fighter:fighter.id,startedTick:1,tick:0,duration:profile.duration,
          x:530,y:555,direction:1,initialHp:100,damage:(28*fighter.damage+12)*fighterById(rival.id).armor};
        const input=[emptyInput(),emptyInput()],event={id:fighter.id,rival:rival.id,frames:0,ticks:[]},blobs=[];
        this.events.push(event);
        for(let tick=0;tick<profile.duration;tick+=5){
          while(state.finale.tick<tick)stepMatch(state,input);
          renderMatch(ctx,state,assets,tick/60*1000,false);
          cropped.clearRect(0,0,740,370);cropped.drawImage(canvas,170,230,740,370,0,0,740,370);
          const blob=await new Promise(resolve=>crop.toBlob(resolve,'image/webp',0.96));
          blobs.push(blob);
          event.frames++;event.ticks.push(tick);
          document.getElementById('status').textContent=`${index+1}/44 · ${fighter.name} · ${event.frames}/36 frames`;
        }
        const header=new TextEncoder().encode(JSON.stringify(blobs.map(blob=>blob.size)));
        const length=new Uint8Array(4);new DataView(length.buffer).setUint32(0,header.length,true);
        const result=await fetch(`/__frames/${fighter.id}`,{method:'POST',body:new Blob([length,header,...blobs])});
        if(!result.ok)throw Error('frame batch write failed '+result.status);
        event.targetHp=state.players[1].hp;
      }catch(error){this.errors.push(String(error));throw error;}
    }
    this.done=true;this.endedAt=Date.now();
    return this.events.length;
  }};
  return{ready:true,count:roster.length};
})();
