import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, WORLD, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
function setup(side: 0 | 1 = 0, gap = 280, wins = 3) {
  const configs = [
    { name: "Audit Sayona", fighter: "sayona" as const, wins },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "sayona-v28-audit");
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (frames: number) => { for (let n = 0; n < frames; n++) stepMatch(state, inputs); };
  advance(INTRO_TOTAL_TICKS);
  const player = state.players[side], rival = state.players[1 - side];
  player.x = side === 0 ? 180 : 900;
  rival.x = player.x + (side === 0 ? gap : -gap);
  player.energy = 100; rival.energy = 100;
  return { state, inputs, player, rival, advance, side };
}
function close(actual: number, expected: number) { assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`); }
function emit(check: string, value: unknown) { console.log(JSON.stringify({ character: "sayona", check, evidence: value })); }
test("Paso espectral blinks at tick 12, consumes 25 energy and hits idle/rear guard once while front guard blocks on both sides", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear"] as const) {
    const r = setup(side, 280), direction = side === 0 ? 1 : -1;
    r.inputs[1-side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1-side][side === 0 ? "right" : "left"] = true;
    const origin = r.player.x, trace: unknown[] = [], blocks = new Set<number>();
    r.inputs[side].actions.special++; r.advance(1); close(r.player.energy,75);
    r.advance(10); close(r.player.x,origin); assert.equal(r.player.invincible,0);
    r.advance(1); const blinkX = r.player.x, blinkInvincible = r.player.invincible;
    assert.ok((blinkX-origin)*direction > 190 && (blinkX-origin)*direction <= 210);
    assert.equal(blinkInvincible,7);
    for(let n=0;n<85;n++) {
      for(const e of r.state.effects) if(e.kind === "block" && e.owner === side) blocks.add(e.id);
      if([0,7,20,60,84].includes(n)) trace.push({tick:r.state.tick,attackTick:r.player.attackTick,x:r.player.x,invincible:r.player.invincible});
      r.advance(1);
    }
    assert.equal(r.state.projectiles.length,0); assert.equal(r.player.attack,null); close(r.player.x,blinkX);
    if(guard === "front") {assert.equal(r.rival.hp,100); assert.equal(r.player.hits,0); assert.equal(blocks.size,1);}
    else {close(r.rival.hp,85.3225); assert.equal(r.player.hits,1); assert.equal(blocks.size,0);}
    emit("special",{side,guard,origin,blinkX,blinkInvincible,hp:r.rival.hp,hits:r.player.hits,blocks:blocks.size,trace});
  }
  for(const side of [0,1] as const) for(const energy of [24,25]) {
    const r=setup(side,500); r.player.energy=energy; r.inputs[side].actions.special++; r.advance(12);
    assert.equal(r.player.attack,energy===24?null:"special");
    close(r.player.x, (side === 0 ? 180 : 900) + (energy===24 ? 0 : side===0?210:-210));
  }
});

test("blink gap, strict melee reach and stage clamp are bounded on both sides", () => {
  for(const side of [0,1] as const) for(const gap of [80,86,120,210,296,329,330,400,830]) {
    const r=setup(side,gap), origin=r.player.x, target=r.rival.x, direction=side===0?1:-1;
    r.inputs[side].actions.special++; r.advance(12);
    const distance=Math.min(210,Math.max(0,gap-86));
    close(r.player.x,Math.max(WORLD.left,Math.min(WORLD.right,origin+direction*distance)));
    assert.equal(r.player.hits,gap<330?1:0);
    emit("range",{side,gap,origin,target,blinkX:r.player.x,distance,hits:r.player.hits,hp:r.rival.hp,attackTick:r.player.attackTick});
  }
  for(const [side,x,target] of [[0,WORLD.right-30,WORLD.right-300],[1,WORLD.left+30,WORLD.left+300]] as const) {
    const r=setup(side,500);r.player.x=x;r.rival.x=target;
    r.player.y=500;r.player.grounded=false;r.player.supportPlatform=null;r.player.facing=side===0?1:-1;
    r.inputs[side].actions.special++;r.advance(12);
    close(r.player.x,side===0?WORLD.right:WORLD.left);
    assert.equal(r.player.hits,0);
    emit("edge-clamp",{side,origin:x,target,blinkX:r.player.x});
  }
});

test("the blink and its melee collision retain the chosen facing when the rival is behind", () => {
  for(const side of [0,1] as const) for(const gap of [80,300]) {
    const r=setup(side,gap), forward=side===0?1:-1, origin=r.player.x;
    r.player.y=500;r.player.grounded=false;r.player.supportPlatform=null;r.player.facing=-forward;
    r.inputs[side].actions.special++;r.advance(12);
    assert.equal(r.player.facing,-forward);
    close(r.player.x,gap===80?origin:Math.max(WORLD.left,Math.min(WORLD.right,origin-forward*210)));
    assert.equal(r.player.hits,0);assert.equal(r.rival.hp,100);
    emit("rear-target",{side,gap,origin,target:r.rival.x,facing:r.player.facing,blinkX:r.player.x,hits:r.player.hits});
  }
});

test("seven blink invulnerability frames reject a real light strike at tick 18 and expire before tick 19", () => {
  for(const side of [0,1] as const) for(const offset of [12,13]) {
    const r=setup(side,500);
    r.inputs[side].actions.special++;r.advance(offset);
    r.rival.x=r.player.x+(side===0?80:-80);r.rival.vx=0;
    r.inputs[1-side].actions.light++;r.advance(6);
    if(offset===12){assert.equal(r.player.hp,100);assert.equal(r.rival.hits,0);assert.equal(r.player.invincible,1);}
    else {assert.ok(r.player.hp<100);assert.equal(r.rival.hits,1);assert.equal(r.player.attack,null);}
    emit("blink-invulnerability",{side,lightStart:offset+1,contact:offset+6,hp:r.player.hp,rivalHits:r.rival.hits,invincible:r.player.invincible});
  }
});
