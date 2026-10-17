(async()=>{
const before=document.querySelector('#mobile-control-qa-fixture');
if(before){window.__mobileControlQA?.root.unmount();before.remove();}
const source=await(await fetch('/src/components/TouchControls.tsx')).text();
const main=await(await fetch('/src/main.tsx')).text();
const reactUrl=source.match(/from\s+["']([^"']*react\.js[^"']*)["']/)?.[1];
const domUrl=main.match(/from\s+["']([^"']*react-dom_client\.js[^"']*)["']/)?.[1];
if(!reactUrl||!domUrl)throw new Error('Vite module URLs unavailable');
const [React,DOM,component,controls]=await Promise.all([import(reactUrl),import(domUrl),import('/src/components/TouchControls.tsx?t='+Date.now()),import('/src/game/controls.ts')]);
const host=document.createElement('div');host.id='mobile-control-qa-fixture';host.className='game-page is-touch';host.style.zIndex='100000';document.querySelector('.arcade-app').append(host);
const inputs=controls.makeInputs(),sources=new controls.ControlSources(inputs[0]);
const qa={root:(DOM.createRoot??DOM.default?.createRoot)(host),host,events:[],inputs,active:new Map(),energy:100,wins:3,reset:0};
qa.render=()=>qa.root.render((React.createElement??React.default?.createElement)(component.TouchControls,{energy:qa.energy,wins:qa.wins,reset:qa.reset,
onPress:(id,control)=>{qa.events.push({kind:'press',id,control,at:performance.now()});qa.active.set(id,control);sources.press('touch:'+id,control);},
onRelease:id=>{qa.events.push({kind:'release',id,at:performance.now()});qa.active.delete(id);sources.release('touch:'+id);}}));
qa.button=c=>host.querySelector('[data-control="'+c+'"]');
qa.center=b=>{const r=b.getBoundingClientRect();return {clientX:r.x+r.width/2,clientY:r.y+r.height/2};};
qa.emit=(target,type,id,coords={},pointerType='touch')=>{const event=new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:id,pointerType,button:0,buttons:type==='pointerup'||type==='pointercancel'?0:1,...coords});target.dispatchEvent(event);return event;};
qa.wait=ms=>new Promise(r=>setTimeout(r,ms??40));
qa.state=()=>({held:{left:inputs[0].left,right:inputs[0].right,down:inputs[0].down,block:inputs[0].block},actions:{...inputs[0].actions},active:[...qa.active],pressed:[...host.querySelectorAll('.is-pressed')].map(b=>b.dataset.control)});
qa.cleanup=()=>{qa.root.unmount();host.remove();delete window.__mobileControlQA;};
window.__mobileControlQA=qa;qa.render();await qa.wait(80);
return {mounted:true,buttons:host.querySelectorAll('.touch-button').length};
})()
