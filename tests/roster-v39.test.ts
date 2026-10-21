import test from "node:test";
import assert from "node:assert/strict";
import { FIGHTERS, fighterById } from "../shared/content";
import {
  createMatch,
  emptyInput,
  stepMatch,
  cpuInput,
  WORLD,
  type Input,
} from "./helpers/charged-finale-engine";
import {
  INTRO_TOTAL_TICKS,
  normalizedFacing,
  presentationById,
  selectionProgress,
} from "../shared/presentation";
import { sampleGesture, REST } from "../shared/choreography";
import { sampleVictory } from "../src/game/victory";
import { CULTURE_SOUNDS } from "../src/game/culture-sounds";

const reviewed = [
  "capriles",
  "javier",
  "lorenzo",
  "carolina",
  "dayana",
  "deyna",
  "bolivar",
  "edgar",
  "nacho",
] as const;
type Reviewed = (typeof reviewed)[number];
type Side = 0 | 1;
const spriteVersions: Record<Reviewed, string> = {
  capriles: "v39",
  javier: "v43",
  lorenzo: "v39",
  carolina: "v39",
  dayana: "v49",
  deyna: "v1",
  bolivar: "v39",
  edgar: "v39",
  nacho: "v42",
};

function setup(id: Reviewed, side: Side = 0, gap = 140, wins = 3) {
  const state = createMatch(
    "caracas",
    [
      { name: "Uno", fighter: side === 0 ? id : "zavarce", wins },
      { name: "Dos", fighter: side === 1 ? id : "zavarce", wins },
    ],
    "roster-v39",
  );
  state.phase = "playing";
  const actor = state.players[side],
    rival = state.players[1 - side];
  actor.x = side === 0 ? 450 : 750;
  rival.x = actor.x + (side === 0 ? gap : -gap);
  for (const player of state.players) {
    player.y = WORLD.floor;
    player.grounded = true;
    player.invincible = 0;
    player.energy = 100;
    player.facing =
      player === actor ? (side === 0 ? 1 : -1) : side === 0 ? -1 : 1;
  }
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (ticks: number) => {
    for (let n = 0; n < ticks; n++) stepMatch(state, inputs);
  };
  return { state, actor, rival, inputs, advance, side };
}

for (const id of reviewed) {
  test(`${id}: registration, single-play presentations and victory stay complete`, () => {
    const fighter = fighterById(id);
    assert.equal(fighter.sprite, `${id}-${spriteVersions[id]}`);
    assert.equal(new Set(fighter.combos).size, 3);
    assert.equal(
      FIGHTERS.filter((f) => f.ability === fighter.ability).length,
      1,
    );
    if (id !== "capriles" && id !== "javier")
      assert.ok(CULTURE_SOUNDS[fighter.ability]);
    for (let frame = 0; frame < 8; frame++) {
      const sourceFacing = id === "javier" && frame === 7 ? -1 : 1;
      assert.equal(normalizedFacing(id, frame, 1), sourceFacing);
      assert.equal(normalizedFacing(id, frame, -1), -sourceFacing);
    }
    assert.equal(presentationById(id).battleFrame, 0);
    assert.equal(selectionProgress(id, 60_000), 1);
    assert.deepEqual(sampleGesture(id, 1), { at: 1, ...REST });
    assert.deepEqual(sampleVictory(id, 3500), sampleVictory(id, 60_000));
  });

  test(`${id}: intro consumes queued movement and attacks on either side`, () => {
    for (const side of [0, 1] as const) {
      const run = setup(id, side);
      run.state.phase = "intro";
      const x = run.actor.x;
      run.inputs[side].right = true;
      run.inputs[side].actions.special++;
      run.advance(INTRO_TOTAL_TICKS - 1);
      assert.equal(run.actor.x, x);
      assert.equal(run.actor.attack, null);
      run.advance(1);
      assert.equal(run.state.phase, "playing");
      run.inputs[side].right = false;
      run.advance(1);
      assert.equal(run.actor.attack, null);
    }
  });

  test(`${id}: runs, turns, double-jumps and lands for P1 and P2`, () => {
    for (const side of [0, 1] as const) {
      const run = setup(id, side, 450),
        direction = side === 0 ? 1 : -1;
      const x = run.actor.x;
      run.inputs[side][side === 0 ? "right" : "left"] = true;
      run.advance(16);
      assert.ok((run.actor.x - x) * direction > 40);
      assert.equal(run.actor.facing, direction);
      run.inputs[side].left = false;
      run.inputs[side].right = false;
      run.inputs[side].actions.jump++;
      run.advance(8);
      assert.equal(run.actor.jumps, 1);
      assert.ok(run.actor.y < WORLD.floor);
      run.inputs[side].actions.jump++;
      run.advance(1);
      assert.equal(run.actor.jumps, 2);
      run.inputs[side].actions.jump++;
      run.advance(1);
      assert.equal(run.actor.jumps, 2);
      run.advance(140);
      assert.equal(run.actor.grounded, true);
      assert.equal(run.actor.jumps, 0);
      assert.ok(Number.isFinite(run.actor.x));
    }
  });

  test(`${id}: light, heavy and special hit once started and respect a facing guard`, () => {
    for (const side of [0, 1] as const)
      for (const attack of ["light", "heavy", "special"] as const) {
        const gap = attack === "special" ? (id === "bolivar" ? 80 : 120) : 75;
        const run = setup(id, side, gap);
        run.inputs[side].actions[attack]++;
        run.advance(90);
        assert.ok(run.rival.hp < 100, `${id}/${side}/${attack}: no hit`);
        assert.ok(run.actor.hits > 0);
        const blocked = setup(id, side, gap);
        blocked.inputs[1 - side].block = true;
        blocked.inputs[side].actions[attack]++;
        blocked.advance(90);
        assert.equal(
          blocked.rival.hp,
          100,
          `${id}/${side}/${attack}: block leaked damage`,
        );
      }
  });

  test(`${id}: special energy and advanced combo gates preserve the definitive from zero wins`, () => {
    const depleted = setup(id);
    depleted.actor.energy = 24;
    depleted.inputs[0].actions.special++;
    depleted.advance(1);
    assert.equal(depleted.actor.attack, null);
    for (const advanced of [false, true]) {
      const run = setup(id, 0, 450, advanced ? 1 : 0);
      run.inputs[0].actions.light++;
      run.advance(23);
      if (advanced) {
        run.inputs[0].actions.light++;
        run.advance(23);
      }
      run.inputs[0].actions.heavy++;
      run.advance(1);
      assert.equal(run.actor.combo, fighterById(id).combos[advanced ? 1 : 0]);
    }
    for (const wins of [0, 1, 2, 3]) {
      const run = setup(id, 0, 160, wins);
      run.inputs[0].actions.super++;
      run.advance(1);
      assert.equal(run.actor.attack, "super");
      assert.equal(run.actor.combo, fighterById(id).combos[2]);
      assert.ok(run.actor.energy < 11);
    }
  });

  test(`${id}: a complete normal-CPU fight finishes and replays deterministically`, () => {
    function bout() {
      const run = setup(id, 1, 380);
      let special = false;
      for (
        let tick = 0;
        tick < 12_000 && run.state.phase !== "finished";
        tick++
      ) {
        const human = run.rival,
          dx = run.actor.x - human.x;
        run.inputs[0].left = dx < -80;
        run.inputs[0].right = dx > 80;
        if (!human.cooldown && !human.stun && Math.abs(dx) < 200)
          run.inputs[0].actions[
            human.energy >= 25 && tick % 120 < 45
              ? "special"
              : tick % 3
                ? "light"
                : "heavy"
          ]++;
        if (human.jumps < 2 && run.actor.y < human.y - 70 && tick % 40 === 0)
          run.inputs[0].actions.jump++;
        run.inputs[1] = cpuInput(run.state, run.inputs[1], "normal");
        run.advance(1);
        special ||= run.actor.attack === "special";
        for (const p of run.state.players) {
          assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
          assert.ok(p.hp >= 0 && p.hp <= 100);
        }
      }
      assert.equal(run.state.phase, "finished");
      assert.ok(run.actor.hits > 0);
      assert.ok(special, `${id}: CPU never used special`);
      return run.state;
    }
    assert.deepEqual(bout(), bout());
  });
}

test("Lorenzo's three P.A.N. packages take different paths and slow their target", () => {
  const run = setup("lorenzo", 0, 270);
  run.inputs[0].actions.special++;
  run.advance(15);
  assert.equal(run.state.projectiles.length, 3);
  assert.equal(new Set(run.state.projectiles.map((s) => s.vy)).size, 3);
  let slowed = false;
  for (let n = 0; n < 55; n++) {
    run.advance(1);
    slowed ||= run.rival.slowTicks > 0;
  }
  assert.ok(slowed);
  assert.ok(run.rival.hp < 100);
});

test("Carolina reflects a projectile during anticipation, then closes the silk arc", () => {
  for (const side of [0, 1] as const) {
    const run = setup("carolina", side, 190),
      direction = side === 0 ? 1 : -1;
    run.inputs[side].actions.special++;
    run.advance(5);
    run.state.projectiles.push({
      id: run.state.nextId++,
      owner: 1 - side,
      x: run.actor.x + direction * 70,
      y: WORLD.floor - 75,
      vx: -direction * 8,
      life: 70,
      kind: "broadcast",
      damage: 8,
      force: 4,
    });
    run.advance(1);
    const reflected = run.state.projectiles[0];
    assert.equal(reflected.owner, side);
    assert.equal(Math.sign(reflected.vx), direction);
    assert.equal(run.actor.hp, 100);
    run.advance(50);
    assert.ok(run.rival.hp < 100);
  }
});

test("Deyna's single football projectile hits once and has no retired radial pulses", () => {
  const run = setup("deyna", 0, 75);
  run.inputs[0].actions.special++;
  const hitTicks: number[] = [];
  let hp = 100;
  for (let n = 0; n < 50; n++) {
    run.advance(1);
    if (run.rival.hp < hp) hitTicks.push(run.actor.attackTick);
    hp = run.rival.hp;
  }
  assert.deepEqual(hitTicks, [21]);
});

test("Bolívar's sabre connects three close strikes without movement or remote reach", () => {
  for (const side of [0, 1] as const) {
    const run = setup("bolivar", side, 80),
      x = run.actor.x;
    run.inputs[side].actions.special++;
    run.advance(80);
    assert.equal(run.actor.x, x);
    assert.equal(run.actor.hits, 3);
    assert.ok(Math.abs(run.actor.vx) < 0.1);
    const miss = setup("bolivar", side, 140);
    miss.inputs[side].actions.special++;
    miss.advance(80);
    assert.equal(miss.actor.hits, 0);
  }
});

test("Édgar's counter intercepts a facing strike once on either side", () => {
  for (const side of [0, 1] as const) {
    const run = setup("edgar", side, 80);
    run.inputs[side].actions.special++;
    run.advance(5);
    run.inputs[1 - side].actions.light++;
    run.advance(6);
    assert.equal(run.actor.hp, 100);
    assert.equal(run.actor.countered, true);
    assert.ok(run.rival.hp < 100);
  }
});
