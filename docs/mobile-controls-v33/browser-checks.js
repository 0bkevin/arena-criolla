(async()=>{
const q=window.__mobileControlQA;if(!q)throw new Error('No control fixture');
const results=[],check=(name,ok,details)=>results.push({name,passed:!!ok,...(details?{details}: {})});
const emit=(control,type,id)=>q.emit(q.button(control),type,id,q.center(q.button(control)));
const releases=()=>{for(const [id] of q.active)q.emit(document.body,'pointercancel',id);};
const idle=()=>Object.values(q.state().held).every(v=>!v)&&q.active.size===0;
try{
const before=q.button('left').getBoundingClientRect();emit('left','pointerdown',11);emit('block','pointerdown',12);emit('heavy','pointerdown',13);await q.wait();
check('movement + block + attack with 3 independent fingers',q.inputs[0].left&&q.inputs[0].block&&q.inputs[0].actions.heavy===1,q.state());
const after=q.button('left').getBoundingClientRect();check('pressed feedback preserves full target geometry',before.width===after.width&&before.height===after.height,{before:[before.width,before.height],after:[after.width,after.height]});
q.emit(document.body,'pointerup',11);await q.wait();check('outside release preserves second finger',!q.inputs[0].left&&q.inputs[0].block,q.state());
q.emit(document.body,'pointercancel',12);q.emit(document.body,'pointerup',13);await q.wait();check('outside cancel clears only tracked pointer',idle(),q.state());
emit('left','pointerdown',14);emit('left','pointerdown',15);q.emit(document.body,'pointerup',14);check('same-direction second finger survives first release',q.inputs[0].left);q.emit(document.body,'pointerup',15);check('last same-direction release stops movement',idle());
const group=q.host.querySelector('.touch-controls');group.setPointerCapture=()=>{throw new DOMException('Fixture capture failure','NotFoundError')};emit('right','pointerdown',16);q.emit(document.body,'pointerup',16);await q.wait();check('failed pointer capture plus release outside cannot stick',idle(),q.state());delete group.setPointerCapture;
emit('left','pointerdown',21);q.emit(window,'pointermove',21,q.center(q.button('right')));await q.wait();check('sliding transfers left to right',!q.inputs[0].left&&q.inputs[0].right,q.state());
const jumpBefore=q.inputs[0].actions.jump;q.emit(window,'pointermove',21,q.center(q.button('jump')));await q.wait();check('sliding onto jump releases direction without accidental action',!q.inputs[0].right&&q.inputs[0].actions.jump===jumpBefore,q.state());
q.emit(window,'pointermove',21,q.center(q.button('down')));await q.wait();check('direction finger can reenter after leaving target',q.inputs[0].down,q.state());q.emit(document.body,'pointerup',21);check('sliding finger releases at end',idle());
emit('block','pointerdown',22);q.emit(window,'pointermove',22,q.center(q.button('light')));check('attack slide does not trigger adjacent action',q.inputs[0].block&&q.inputs[0].actions.light===0);q.emit(document.body,'pointercancel',22);
emit('left','pointerdown',31);q.emit(q.button('left'),'lostpointercapture',31);check('capture handoff from child button preserves root gesture',q.inputs[0].left);q.emit(group,'lostpointercapture',31);check('losing container capture releases the gesture',idle());
const actionBefore=q.inputs[0].actions.light;emit('light','pointerdown',41);emit('light','pointerdown',41);q.emit(document.body,'pointerup',41);q.button('light').dispatchEvent(new PointerEvent('click',{bubbles:true,detail:1,pointerType:'touch'}));check('pointer duplicate and compatibility click do not double attack',q.inputs[0].actions.light===actionBefore+1);
q.button('light').click();await q.wait(140);check('assistive click activates once and automatically releases',q.inputs[0].actions.light===actionBefore+2&&idle(),q.state());
let enterLeaks=0;const track=e=>{if(e.code==='Enter')enterLeaks++};window.addEventListener('keydown',track);
q.button('block').dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'Enter',code:'Enter'}));await q.wait();check('focused control accepts keyboard hold without global game shortcut',q.inputs[0].block&&enterLeaks===0,q.state());q.button('block').dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'Enter',code:'Enter',repeat:true}));window.dispatchEvent(new KeyboardEvent('keyup',{bubbles:true,cancelable:true,key:'Enter',code:'Enter'}));window.removeEventListener('keydown',track);check('keyboard release outside focused button clears hold',idle());
emit('left','pointerdown',51);emit('block','pointerdown',52);q.reset++;q.render();await q.wait();check('reset releases all fingers and feedback',idle()&&q.state().pressed.length===0,q.state());
emit('right','pointerdown',53);window.dispatchEvent(new Event('blur'));await q.wait();check('window blur releases controls',idle(),q.state());
emit('left','pointerdown',54);window.dispatchEvent(new PageTransitionEvent('pagehide'));await q.wait();check('pagehide releases controls',idle(),q.state());
emit('special','pointerdown',61);q.energy=0;q.wins=0;q.render();await q.wait();check('energy depletion releases and disables specials',q.button('special').disabled&&q.button('super').disabled&&!q.active.has(61),q.state());const actions={...q.inputs[0].actions};q.button('special').click();emit('super','pointerdown',62);await q.wait();check('disabled attacks cannot fire',q.inputs[0].actions.special===actions.special&&q.inputs[0].actions.super===actions.super);
const mouseBefore=q.events.length;q.emit(q.button('left'),'pointerdown',71,{...q.center(q.button('left')),button:2,buttons:2},'mouse');check('secondary mouse button ignored',q.events.length===mouseBefore);
const context=new MouseEvent('contextmenu',{bubbles:true,cancelable:true});q.button('left').dispatchEvent(context);check('long-press context menu suppressed on control',context.defaultPrevented);
q.energy=100;q.wins=3;q.render();await q.wait();const targets=[...q.host.querySelectorAll('.touch-button')].map(b=>{const r=b.getBoundingClientRect();return {control:b.dataset.control,width:r.width,height:r.height,inBounds:r.x>=0&&r.y>=0&&r.right<=innerWidth+.5&&r.bottom<=innerHeight+.5}});check('all ten gameplay targets are at least48 CSSpx and inside viewport',targets.length===10&&targets.every(b=>b.width>=48&&b.height>=48&&b.inBounds),targets);
emit('right','pointerdown',81);q.root.unmount();await q.wait();check('unmount releases game inputs',idle(),q.state());q.host.remove();delete window.__mobileControlQA;
}catch(error){results.push({name:'fixture runtime',passed:false,error:String(error)});try{q.cleanup()}catch{}}
return {viewport:[innerWidth,innerHeight],passed:results.filter(x=>x.passed).length,total:results.length,results};
})()
