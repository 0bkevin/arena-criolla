import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, type Input } from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/presentation";
function setup(side: 0 | 1 = 0, gap = 280, wins = 3) {
  const configs = [
    { name: "Audit Gabriela", fighter: "gabriela" as const, wins },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch("poliedro", side === 0 ? [...configs] : [configs[1], configs[0]], "gabriela-v28-audit");
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
function emit(check: string, value: unknown) { console.log(JSON.stringify({ character: "gabriela", check, evidence: value })); }
test("Doble de novela reverses the second pulse direction and guard on both sides", () => {
  for (const side of [0, 1] as const) for (const guard of ["idle", "front", "rear", "switch"] as const) {
    const r = setup(side, 120); const direction = side === 0 ? 1 : -1;
    r.inputs[1 - side].block = guard !== "idle";
    if (guard === "rear") r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
    const contacts = new Map<number, { tick: number; kind: string; direction: number; x: number; targetX: number; hp: number }>();
    const pulses = new Map<number, { tick: number; x: number; direction: number; targetX: number }>();
    r.inputs[side].actions.special++; r.advance(1); close(r.player.energy, 75);
    for (let n = 1; n < 100; n++) {
      if (guard === "switch" && n >= 20) r.inputs[1 - side][side === 0 ? "right" : "left"] = true;
      const targetBeforeX = r.rival.x, targetBeforeY = r.rival.y;
      r.advance(1);
      for (const e of r.state.effects) {
        if (e.owner !== side || e.impact !== "special") continue;
        if ((e.kind === "hit" || e.kind === "block") && !contacts.has(e.id)) contacts.set(e.id, {tick:r.state.tick-INTRO_TOTAL_TICKS,kind:e.kind,direction:e.direction ?? 0,x:e.x,targetX:r.rival.x,hp:r.rival.hp});
        if (e.kind === "special" && !pulses.has(e.id)) {
          if (r.player.attackTick === 33 && e.life === e.duration) {
            close(e.x, targetBeforeX + direction * 90); close(e.y, targetBeforeY - 75); assert.equal(e.direction, -direction);
          }
          pulses.set(e.id, {tick:r.state.tick-INTRO_TOTAL_TICKS,x:e.x,direction:e.direction ?? 0,targetX:r.rival.x});
        }
      }
    }
    const contact = [...contacts.values()]; assert.equal(contact.length, 2);
    assert.deepEqual(contact.map(c=>c.direction), [direction,-direction]);
    assert.deepEqual(contact.map(c=>c.kind), guard === "idle" ? ["hit","hit"] : guard === "front" ? ["block","hit"] : guard === "rear" ? ["hit","block"] : ["block","block"]);
    close(r.rival.hp, guard === "idle" ? 81.46 : guard === "switch" ? 100 : 90.73);
    assert.equal(r.player.hits, guard === "idle" ? 2 : guard === "switch" ? 0 : 1);
    assert.equal(r.state.projectiles.length, 0); assert.equal(r.player.attack, null);
    emit("special", {side,guard,contacts:contact,pulses:[...pulses.values()],hp:r.rival.hp,hits:r.player.hits,finalX:r.player.x,targetX:r.rival.x});
  }
  for (const side of [0,1] as const) for(const energy of [24,25]) {const r=setup(side,120);r.player.energy=energy;r.inputs[side].actions.special++;r.advance(1);assert.equal(r.player.attack, energy===24?null:"special");}
});
