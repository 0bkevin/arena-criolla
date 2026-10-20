import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { makeArenaServer } from '../../../server/index.ts';
import { emptyInput, stepMatch, createMatch } from '../../../shared/engine.ts';
const require=createRequire(new URL('../../../package.json', import.meta.url));
const {WebSocket}=require('ws');
class Client {
 socket:any; messages:any[]=[];
 constructor(url:string,token?:string){this.socket=new WebSocket(url,['arena-v1',...(token?['arena-resume.'+token]:[])]);this.socket.on('message',(raw:any)=>this.messages.push(JSON.parse(raw.toString())));}
 send(m:any){this.socket.send(JSON.stringify(m));}
 async wait(type:string,p=(m:any)=>true){const end=Date.now()+4000;while(Date.now()<end){const i=this.messages.findIndex(m=>m.type===type&&p(m));if(i>=0)return this.messages.splice(i,1)[0];await new Promise(r=>setTimeout(r,5));}throw new Error('timeout '+type);}
}
async function main(){
 const server=await makeArenaServer({serveClient:false});
 await new Promise<void>(r=>server.http.listen(0,'127.0.0.1',r));
 const address=server.http.address() as any;
 const url='ws://127.0.0.1:'+address.port+'/ws';
 const a=new Client(url), b=new Client(url); let reconnect:Client|undefined;
 try {
  const [wa,wb]=await Promise.all([a.wait('welcome'),b.wait('welcome')]);
  a.send({type:'create',name:'A',fighter:'puma',stage:'poliedro',wins:3,private:true});
  const {room}=await a.wait('room');
  b.send({type:'join',code:room.code,name:'B',fighter:'conde',wins:3});
  await a.wait('room',m=>m.room.players.length===2);
  a.send({type:'ready',ready:true});b.send({type:'ready',ready:true});
  await Promise.all([a.wait('start'),b.wait('start')]);
  const active=server.rooms.get(room.code)!;
  let state=active.state!;
  state.phase='playing'; state.players.forEach((p,i)=>{p.invincible=0;p.energy=100;p.x=i?500:330;});
  const ib=emptyInput();ib.actions.super=1;
  b.send({type:'input',matchId:state.id,input:ib});
  const transformed=await a.wait('state',m=>!!m.state.players[1].transformation);
  const peer=await b.wait('state',m=>m.state.tick===transformed.state.tick);
  assert.deepEqual(peer.state,transformed.state);
  assert.equal(transformed.state.players[1].transformation.id,'conde-bond');
  assert.equal(transformed.state.players[1].transformation.damageMultiplier,1.2);
  const ia=emptyInput();ia.actions.super=1;
  state.players[1].hp=1;
  a.send({type:'input',matchId:state.id,input:ia});
  const captured=await a.wait('state',m=>!!m.state.finale);
  const capturedPeer=await b.wait('state',m=>m.state.finale?.tick===captured.state.finale.tick);
  assert.deepEqual(capturedPeer.state,captured.state);
  const frozen=captured.state.players[1].transformation.ticks;
  const later=await a.wait('state',m=>m.state.finale?.tick>captured.state.finale.tick+6);
  assert.equal(later.state.players[1].transformation.ticks,frozen);
  reconnect=new Client(url,wb.resumeToken);
  assert.equal((await reconnect.wait('welcome')).resumed,true);
  const resumed=await reconnect.wait('start');
  assert.ok(resumed.state.finale);
  assert.equal(resumed.state.players[1].transformation.ticks,frozen);
  // Synchronously complete the isolated server's actual capture, preserving accepted inputs.
  while(state.finale)stepMatch(state,[ia,ib]);
  const flight=await a.wait('state',m=>m.state.players[1].knockoutDelay>0);
  const flightPeer=await reconnect.wait('state',m=>m.state.tick===flight.state.tick);
  assert.deepEqual(flightPeer.state,flight.state);
  assert.equal(flight.state.players[1].hp,0);
  assert.ok(flight.state.players[1].transformation.ticks<frozen);
  const reset=await a.wait('state',m=>m.state.players[1].stocks===1);
  assert.equal(reset.state.players[1].transformation,undefined);
  assert.equal(reset.state.players[1].knockoutDelay,undefined);
  // Actual ranged super emission and complete network payload, no capture.
  state=createMatch('poliedro',[{name:'A',fighter:'maite',wins:3},{name:'B',fighter:'javier',wins:3}],state.id+'-ranged');
  state.phase='playing';state.players.forEach((p,i)=>{p.energy=100;p.invincible=0;p.x=i?880:300;});
  active.state=state;active.clients.forEach(c=>{c.input=emptyInput();c.inputAt=performance.now();});
  const ranged=emptyInput();ranged.actions.super=1;
  a.send({type:'input',matchId:state.id,input:ranged});
  const shot=await a.wait('state',m=>m.state.id===state.id&&m.state.projectiles.some((p:any)=>p.impact==='super'));
  const shotPeer=await reconnect.wait('state',m=>m.state.id===state.id&&m.state.tick===shot.state.tick);
  assert.deepEqual(shotPeer.state,shot.state);
  assert.equal(shot.state.finale,undefined);
  assert.equal(shot.state.projectiles[0].kind,'sonic');
  const serialized=JSON.parse(JSON.stringify(shot.state));
  const duplicate=structuredClone(shot.state);
  for(let n=0;n<100;n++){stepMatch(serialized,[ranged,emptyInput()]);stepMatch(duplicate,[ranged,emptyInput()]);}
  assert.deepEqual(serialized,duplicate);
  assert.equal(serialized.players[0].hits,1);
  console.log(JSON.stringify({passed:true,transformationSocket:true,capturedBuffPause:true,reconnectDuringCapture:true,lethalDelaySocket:true,stockCleanup:true,rangedSuperSocket:true,rangedReplay:true,frozenTicks:frozen,flightDelay:flight.state.players[1].knockoutDelay,shot:shot.state.projectiles[0]},null,2));
 }finally{a.socket.terminate();b.socket.terminate();reconnect?.socket.terminate();await server.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
