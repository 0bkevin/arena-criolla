(async()=>{
 const [{preloadAssets},{renderMatch},{ATTACK_ART}]=await Promise.all([import('/src/game/assets.ts'),import('/src/game/renderer.ts'),import('/src/game/attack-art.ts')]);
 const assets=await preloadAssets(['bolivar','zavarce','silbon','momoy'],['poliedro','valencia']);
 const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=760;const ctx=canvas.getContext('2d'),draw=ctx.drawImage.bind(ctx);
 let calls=[],targetImages=new Set();
 ctx.drawImage=(im,...args)=>{const sheet=ATTACK_ART.bolivar,pose=im===assets.finaleProps[sheet.file]?Object.entries(sheet.frames).find(([,f])=>f.x===args[0]&&f.y===args[1])?.[0]:undefined;
  if(pose?.startsWith('gallop')||targetImages.has(im))calls.push({im,args,m:ctx.getTransform(),kind:pose?'horse':'rival'});draw(im,...args)};
 const pixels=kind=>{const c=document.createElement('canvas');c.width=1280;c.height=760;const x=c.getContext('2d');for(const p of calls.filter(p=>p.kind===kind)){x.setTransform(p.m);x.drawImage(p.im,...p.args)}return x.getImageData(0,0,1280,760).data};
 const results=[];
 for(const p of [1,2])for(const scenario of ['normal','close','edge','inward','close-edge','platform','platform-low','tall','small'])for(const tick of [54,60,65,66,70,82,95,96]){
  const key=`final-p${p}-${scenario}-${tick}`,sample=bolivarQA.inspect(key),state=sample.state,scene=state.finale,sprite=assets.sprites[state.players[scene.target].config.fighter];targetImages=new Set([sprite.image,...(sprite.frameTextures??[])]);calls=[];renderMatch(ctx,state,assets,sample.frame*1000/60,false,sample.camera);
  const a=pixels('horse'),b=pixels('rival'),direction=scene.direction;let minGap=Infinity,overlap=0,bounds={left:1280,right:0,top:760,bottom:0};
  for(let y=0;y<760;y++){let front=direction>0?-Infinity:Infinity,edge=direction>0?Infinity:-Infinity;for(let x=0;x<1280;x++){const i=(y*1280+x)*4+3;if(a[i]>=100)front=direction>0?Math.max(front,x):Math.min(front,x);if(b[i]>=100){edge=direction>0?Math.min(edge,x):Math.max(edge,x);bounds.left=Math.min(bounds.left,x);bounds.right=Math.max(bounds.right,x);bounds.top=Math.min(bounds.top,y);bounds.bottom=Math.max(bounds.bottom,y)}if(a[i]>=100&&b[i]>=100)overlap++}if(Number.isFinite(front)&&Number.isFinite(edge))minGap=Math.min(minGap,(edge-front)*direction)}
  if(minGap < -3)throw Error(`Premature overlap ${key}: ${minGap}, ${overlap}`);
  if(tick===96&&minGap>5)throw Error(`Remote horse impact ${key}: ${minGap}`);
  if(bounds.left<2||bounds.right>1277)throw Error(`Clipped rival ${key}: ${JSON.stringify(bounds)}`);
  results.push({key,minGap,overlap,bounds});
 }
 window.bolivarContactAudit=results;return{checks:results.length,contacts:results.filter(r=>r.key.endsWith('-96')),minimum:Math.min(...results.map(r=>r.minGap))};
})()
