import assert from "node:assert/strict";
import test from "node:test";
import {
  type Input,
  createMatch,
  emptyInput,
  stepMatch,
} from "../helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../../shared/engine/intro";
function setup(side: 0 | 1) {
  const actor = { name: "La Llorona", fighter: "llorona" as const, wins: 3 };
  const rival = { name: "Vicente", fighter: "zavarce" as const, wins: 3 };
  const state = createMatch("poliedro", side ? [rival, actor] : [actor, rival]);
  state.phase = "playing";
  state.players.forEach((p) => {
    p.energy = 100;
    p.invincible = 0;
  });
  const source = state.players[side],
    target = state.players[1 - side];
  source.x = side ? 700 : 380;
  source.facing = side ? -1 : 1;
  target.x = source.x + source.facing * 180;
  target.facing = -source.facing;
  const inputs = [emptyInput(), emptyInput()] as const;
  const advance = (ticks: number) => {
    for (let i = 0; i < ticks; i++) stepMatch(state, [...inputs]);
  };
  return { state, source, target, inputs, advance };
}

test("La Llorona's undertow travels, pulls the rival toward her once and expires", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side);
    r.target.x = r.source.x + r.source.facing * 280;
    r.inputs[side].actions.special++;
    for (let i = 0; i < 40 && !r.state.projectiles.length; i++) r.advance(1);
    assert.equal(r.state.projectiles.length, 1);
    assert.equal(r.target.hp, 100, "startup deals no remote damage");
    const wave = r.state.projectiles[0];
    assert.equal(wave.kind, "undertow");
    assert.equal(wave.pulls, true);
    const direction = r.source.facing;
    let contacts = 0,
      previous = 100;
    for (let tick = 0; tick < 130; tick++) {
      r.advance(1);
      if (r.target.hp < previous) {
        contacts++;
        assert.equal(Math.sign(r.target.vx), -direction);
      }
      previous = r.target.hp;
    }
    assert.equal(contacts, 1);
    assert.equal(r.source.hits, 1);
    assert.equal(r.state.projectiles.length, 0);
    assert.equal(r.source.attack, null);
  }
});

/** A full match start, intro included, rather than a match already in play. */
function setupAfterIntro(side: 0 | 1 = 0, gap = 280) {
  const configs = [
    { name: "Audit La Llorona", fighter: "llorona" as const, wins: 3 },
    { name: "Audit Javier", fighter: "javier" as const, wins: 3 },
  ] as const;
  const state = createMatch(
    "poliedro",
    side === 0 ? [...configs] : [configs[1], configs[0]],
    "llorona-v28-audit",
  );
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (frames: number) => {
    for (let n = 0; n < frames; n++) stepMatch(state, inputs);
  };
  advance(INTRO_TOTAL_TICKS);
  const player = state.players[side],
    rival = state.players[1 - side];
  player.x = side === 0 ? 180 : 900;
  rival.x = player.x + (side === 0 ? gap : -gap);
  player.energy = 100;
  rival.energy = 100;
  return { state, inputs, player, rival, advance };
}

test("Marea en pena pulls a damaged rival toward La Llorona, while a blocked wave pushes away as usual", () => {
  for (const side of [0, 1] as const)
    for (const guard of ["idle", "front"] as const) {
      const r = setupAfterIntro(side);
      const towardCaster = side === 0 ? -1 : 1;
      r.inputs[1 - side].block = guard === "front";
      const impacts: number[] = [];
      let blockVx: number | null = null,
        sawPullingShot = false;
      const blocks = new Set<number>();
      r.inputs[side].actions.special++;
      for (let n = 0; n < 170; n++) {
        const hp = r.rival.hp;
        r.advance(1);
        if (r.state.projectiles.some((p) => p.pulls)) sawPullingShot = true;
        if (r.rival.hp !== hp) impacts.push(r.rival.vx);
        for (const e of r.state.effects)
          if (e.kind === "block" && e.owner === side && !blocks.has(e.id)) {
            blocks.add(e.id);
            blockVx = r.rival.vx;
          }
      }
      assert.ok(sawPullingShot);
      assert.equal(r.state.projectiles.length, 0);
      if (guard === "front") {
        assert.equal(r.rival.hp, 100);
        assert.equal(blocks.size, 1);
        assert.equal(r.player.hits, 0);
        assert.equal(impacts.length, 0);
        assert.equal(Math.sign(blockVx ?? 0), -towardCaster);
      } else {
        assert.equal(r.player.hits, 1);
        assert.equal(impacts.length, 1);
        assert.ok(r.rival.hp < 100);
        assert.equal(Math.sign(impacts[0]), towardCaster);
      }
    }
});
