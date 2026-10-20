(async()=>{
 const [renderer,art,loader,content]=await Promise.all([import('/src/game/renderer.ts'),import('/src/game/attack-art.ts'),import('/src/game/assets.ts'),import('/shared/content.ts')]);
 const qa=window.dudamelQA, rows=[];
 for(const [key,sample] of qa.samples){
  if(!key.startsWith('final-')||![41,42,89,90,137,138].includes(sample.state.finale?.tick))continue;
  const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=760;const ctx=canvas.getContext('2d');
  const mask=document.createElement('canvas');mask.width=1280;mask.height=760;const mc=mask.getContext('2d',{willReadFrequently:true});
  const state=sample.state, id=state.players[state.finale.target].config.fighter, sprite=qa.assets.sprites[id],index=sprite.battleFrame,source=loader.spriteFrameSource(sprite,index);
  const draw=ctx.drawImage.bind(ctx),arc=ctx.arc.bind(ctx);const circles=[];
  ctx.drawImage=(image,...args)=>{
   if(image===source.image&&args.length===8&&args[0]===source.x&&args[1]===source.y){mc.setTransform(ctx.getTransform());mc.drawImage(image,...args);}
   draw(image,...args);
  };
  ctx.arc=(x,y,r,...rest)=>{if(ctx.fillStyle==='#c6c4ff'&&r>60){const m=ctx.getTransform();circles.push({x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f,r:r*Math.abs(m.a),stroke:1.25*Math.abs(m.a)});}arc(x,y,r,...rest);};
  const before=JSON.stringify(state),cb=JSON.stringify(sample.camera);renderer.renderMatch(ctx,state,qa.assets,sample.frame*1000/60,false,sample.camera);
  const pixels=mc.getImageData(0,0,1280,760).data;const c=circles[0];if(!c)throw Error('no wave '+key);
  let gap=Infinity,count=0;
  for(let y=0;y<760;y++)for(let x=0;x<1280;x++)if(pixels[(y*1280+x)*4+3]>=100){count++;gap=Math.min(gap,Math.hypot(x+.5-c.x,y+.5-c.y)-c.r-c.stroke);}
  const impact=[42,90,138].includes(state.finale.tick);
  rows.push({key,id,tick:state.finale.tick,impact,gap,pixels:count,unchanged:before===JSON.stringify(state)&&cb===JSON.stringify(sample.camera)});
 }
 const failures=rows.filter(r=>!r.pixels||!r.unchanged||(r.impact?Math.abs(r.gap)>2.1:r.gap<=.1));
 window.dudamelContactAudit={rows,failures,passed:!failures.length};
 return {cases:rows.length,passed:!failures.length,failures,worstImpact:Math.max(...rows.filter(r=>r.impact).map(r=>Math.abs(r.gap))),minimumPreImpact:Math.min(...rows.filter(r=>!r.impact).map(r=>r.gap))};
})()
