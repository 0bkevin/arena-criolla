import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
function setup(side: 0 | 1 = 0, gap = 280, wins = 3) {
  const configs = [
    { name: "Audit Knoche", fighter: "knoche" as const, wins },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "knoche-v28-audit");
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
function emit(check: string, value: unknown) { console.log(JSON.stringify({ character: "knoche", check, evidence: value })); }
test("Frasco de Galipán launches one bounded arc and slows only damaging idle/rear-guard hits on both sides", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear", "invincible"] as const) {
    const r = setup(side, 280);
    r.inputs[1 - side].block = guard === "front" || guard === "rear";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    if (guard === "invincible") r.rival.invincible = 150;
    const shots = new Map<number, unknown>(), impacts: unknown[] = [], blocks = new Set<number>();
    let maxSlow = 0; const origin = r.player.x;
    r.inputs[side].actions.special++; r.advance(1); const energyAfterCost = r.player.energy; close(energyAfterCost, 75);
    for (let n = 1; n < 150; n++) {
      const hp = r.rival.hp; r.advance(1);
      for (const p of r.state.projectiles) if (!shots.has(p.id)) shots.set(p.id, { tick: r.state.tick - INTRO_TOTAL_TICKS, vx:p.vx, vy:p.vy ?? 0, life:p.life, slowTicks:p.slowTicks ?? 0, kind:p.kind });
      if (r.rival.hp !== hp) impacts.push({ tick:r.state.tick - INTRO_TOTAL_TICKS, hp:r.rival.hp, slowTicks:r.rival.slowTicks });
      maxSlow = Math.max(maxSlow, r.rival.slowTicks);
      for (const e of r.state.effects) if (e.kind === "block" && e.owner === side) blocks.add(e.id);
    }
    assert.equal(shots.size,1); assert.equal(r.player.x,origin); assert.equal(r.state.projectiles.length,0);
    if (guard === "front" || guard === "invincible") { assert.equal(r.rival.hp,100); assert.equal(r.player.hits,0); assert.equal(maxSlow,0); assert.equal(blocks.size,guard === "front" ? 1 : 0); }
    else { close(r.rival.hp,89.7); assert.equal(r.player.hits,1); assert.equal(maxSlow,60); assert.equal(blocks.size,0); }
    assert.equal(r.rival.slowTicks,0);
    emit("special",{side,guard,energyAfterCost,shots:[...shots.values()],impacts,blockCount:blocks.size,maxSlow,hp:r.rival.hp,hits:r.player.hits});
  }
  for (const side of [0, 1] as const) for (const energy of [24,25]) { const r=setup(side);r.player.energy=energy;r.inputs[side].actions.special++;r.advance(1);assert.equal(r.player.attack,energy===24?null:"special"); }
});

test("elixir expires after sixty simulation ticks, reduces movement to sixty percent and clears on a lost stock",()=>{
  for (const side of [0,1] as const) {
    const r=setup(side,280);r.inputs[side].actions.special++;
    for(let n=0;n<100 && !r.rival.slowTicks;n++)r.advance(1);
    assert.equal(r.rival.slowTicks,60); const hitTick=r.state.tick;
    while(r.rival.slowTicks) r.advance(1);
    assert.equal(r.state.tick-hitTick,60);
    const slowed=setup(side,400), normal=setup(side,400);
    slowed.player.x=normal.player.x=540;slowed.rival.x=normal.rival.x=900;
    slowed.player.slowTicks=60;
    slowed.inputs[side].right=normal.inputs[side].right=true;
    slowed.advance(20);normal.advance(20); const slowedSpeed=slowed.player.vx, normalSpeed=normal.player.vx;
    close(slowed.player.vx/normal.player.vx,0.6);
    const expired=slowed.player.x; slowed.advance(60);assert.equal(slowed.player.slowTicks,0);assert.ok(slowed.player.vx>4.19);
    const lost=setup(side,280);lost.inputs[side].actions.special++;
    for(let n=0;n<100 && !lost.rival.slowTicks;n++)lost.advance(1);
    assert.equal(lost.rival.slowTicks,60); lost.rival.hp=0;
    for(let n=0;n<10 && lost.rival.stocks===2;n++)lost.advance(1);
    assert.equal(lost.rival.stocks,1);assert.equal(lost.rival.slowTicks,0);assert.equal(lost.rival.hp,100);
    emit("slow-lifecycle",{side,hitTick,expiryTick:r.state.tick,simulationDuration:r.state.tick-hitTick,slowedSpeed,normalSpeed,restoredSpeed:slowed.player.vx,slowPositionAt20:expired,resetStocks:lost.rival.stocks});
  }
});

test("elixir range is bounded on both sides and an airborne target can avoid its arc",()=>{
  for(const side of [0,1] as const)for(const gap of [80,280,440,480,490,500,700]){
    const r=setup(side,gap);const shots=new Set<number>();let minY=Infinity,maxY=-Infinity,lastAge=0;
    r.inputs[side].actions.special++;
    for(let n=0;n<120;n++){r.advance(1);for(const p of r.state.projectiles){shots.add(p.id);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);lastAge=Math.max(lastAge,p.age??0);}}
    assert.equal(r.state.projectiles.length,0);assert.ok(lastAge<=72);assert.ok(shots.size<=1);assert.equal(r.player.hits,gap<=480?1:0);
    emit("range-probe",{side,gap,hp:r.rival.hp,hits:r.player.hits,lastAge,minY,maxY});
  }
  for(const side of [0,1] as const){const r=setup(side,280);r.inputs[side].actions.special++;r.advance(24);r.inputs[1-side].actions.jump++;r.advance(80);assert.equal(r.rival.hp,100);assert.equal(r.rival.slowTicks,0);}
});
