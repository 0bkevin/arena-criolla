import test from "node:test";
import assert from "node:assert/strict";
import {
  COMMUNITY_DEFINITIONS,
  fighterById,
  platformsAtTick,
  type FighterId,
} from "../shared/content";
import {
  ACTIONS,
  createMatch,
  emptyInput,
  stepMatch,
  WORLD,
  type Input,
  type MatchState,
} from "./helpers/charged-finale-engine";
import {
  FINALES,
  FINALE_CAPTURE_TICK,
  FINALE_DAMAGE_BEATS,
  FINALE_DURATION,
  finaleById,
} from "../shared/finales";

function setup(
  fighter: FighterId = "capriles",
  rival: FighterId = "javier",
  side: 0 | 1 = 0,
) {
  const state = createMatch("caracas", [
    { name: "Uno", fighter: side === 0 ? fighter : rival, wins: 3 },
    { name: "Dos", fighter: side === 1 ? fighter : rival, wins: 3 },
  ]);
  state.phase = "playing";
  state.players.forEach((p, i) => {
    p.x = i === 0 ? 330 : 530;
    p.invincible = 0;
    p.energy = 100;
  });
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (frames: number) => {
    for (let frame = 0; frame < frames; frame++) stepMatch(state, inputs);
  };
  const start = () => {
    inputs[side].actions.super++;
    advance(FINALE_CAPTURE_TICK);
  };
  return {
    state,
    inputs,
    advance,
    start,
    source: state.players[side],
    target: state.players[1 - side],
  };
}

function close(actual: number, expected: number, message?: string) {
  assert.ok(
    Math.abs(actual - expected) < 1e-8,
    message ?? `${actual} ≈ ${expected}`,
  );
}

test("each finale mode resolves its combat behaviour on either side", () => {
  for (const side of [0, 1] as const) {
    // Capture: the scene freezes both fighters and the clock while beats land.
    const r = setup("capriles", "javier", side);
    r.start();
    const scene = r.state.finale;
    assert.ok(scene, `capture/P${side + 1}`);
    assert.equal(scene.owner, side);
    assert.equal(scene.target, 1 - side);
    assert.equal(scene.direction, side === 0 ? 1 : -1);
    assert.equal(r.target.hp, 100, "capture alone deals no damage");
    const positions = r.state.players.map((p) => [p.x, p.y]);
    const remaining = r.state.remaining;
    const tick = r.state.tick;
    const beats = finaleById("capriles")!.damageBeats;
    let priorBeat = 0;
    for (const [index, beat] of beats.entries()) {
      r.advance(beat - priorBeat);
      close(r.target.hp, 100 - (scene.damage * (index + 1)) / beats.length);
      assert.equal(r.source.hits, 1, "the whole scene counts as one hit");
      assert.deepEqual(
        r.state.players.map((p) => [p.x, p.y]),
        positions,
      );
      assert.equal(r.state.remaining, remaining);
      assert.equal(r.state.tick, tick);
      priorBeat = beat;
    }
    r.advance(scene.duration - priorBeat);
    assert.equal(r.state.finale, undefined);
    close(r.target.hp, 100 - scene.damage);
    assert.equal(r.target.stocks, 2);
    assert.equal(
      Math.sign(r.target.vx),
      scene.direction,
      "release launches away",
    );
    assert.equal(r.source.attack, null);

    // Projectile: nothing lands remotely; the shot hits once on contact.
    const shot = setup("maite", "javier", side);
    shot.start();
    assert.equal(shot.state.finale, undefined);
    assert.equal(shot.target.hp, 100);
    assert.equal(shot.state.projectiles.length, 1);
    shot.advance(25);
    assert.ok(shot.target.hp < 100);
    assert.equal(shot.source.hits, 1);
    assert.equal(shot.state.projectiles.length, 0);

    // Transformation: an empowerment on the clock, with no direct damage.
    const empowered = setup("conde", "javier", side);
    empowered.start();
    const duration = finaleById("conde")!.empowerment!.duration;
    assert.equal(empowered.state.finale, undefined);
    assert.equal(empowered.source.transformation?.ticks, duration);
    assert.equal(empowered.target.hp, 100);
    const startTick = empowered.state.tick;
    empowered.advance(duration);
    assert.equal(empowered.source.transformation, undefined);
    assert.equal(empowered.state.tick, startTick + duration);
    assert.equal(empowered.target.hp, 100);
  }
});

test("Nacho releases the rival in place without any launch, residual momentum or edge ringout", () => {
  for (const side of [0, 1] as const)
    for (const direction of [-1, 1])
      for (const airborne of [false, true]) {
        const r = setup("nacho", "giuseppe", side);
        r.target.x = direction > 0 ? WORLD.right - 10 : WORLD.left + 10;
        r.source.x = r.target.x - direction * 180;
        r.source.facing = direction;
        r.target.facing = -direction;
        if (airborne)
          for (const player of r.state.players) {
            player.y = WORLD.floor - 100;
            player.grounded = false;
            player.vy = -4;
          }
        r.start();
        assert.equal(r.state.finale?.fighter, "nacho");
        const position = [r.target.x, r.target.y],
          stocks = r.target.stocks;
        // Motion frozen during the dance must not leak into its release.
        r.target.vx = direction * 8;
        r.target.recoilVx = direction * 6;
        r.target.vy = -9;
        r.advance(FINALES.nacho.duration);
        assert.equal(r.state.finale, undefined);
        assert.deepEqual([r.target.x, r.target.y], position);
        assert.equal(r.target.vx, 0);
        assert.equal(r.target.recoilVx, 0);
        assert.equal(r.target.vy, 0);
        assert.equal(r.target.stun, 0);
        r.advance(30);
        close(r.target.x, position[0]);
        assert.equal(r.target.stocks, stocks);
        assert.ok(r.target.hp < 100, "the dance retains its damage");
      }
});

test("distance, height, facing, spawn protection and a facing guard can prevent capture", () => {
  for (const side of [0, 1] as const)
    for (const reason of [
      "distance",
      "height",
      "behind",
      "invincible",
      "guard",
    ] as const) {
      const r = setup("capriles", "javier", side);
      if (reason === "distance") r.target.x += side === 0 ? 100 : -100;
      if (reason === "height") {
        r.target.y -= 220;
        r.target.grounded = false;
        r.target.supportPlatform = null;
      }
      if (reason === "invincible") r.target.invincible = 30;
      if (reason === "guard") r.inputs[1 - side].block = true;
      r.inputs[side].actions.super++;
      r.advance(1);
      if (reason === "behind") r.source.facing *= -1;
      r.advance(FINALE_CAPTURE_TICK - 1);
      assert.equal(r.state.finale, undefined, `${side}/${reason}`);
      assert.equal(r.target.hp, 100, `${side}/${reason}`);
      assert.equal(r.source.hits, 0, `${side}/${reason}`);
      if (reason === "guard") {
        assert.ok(r.target.energy < 91);
        assert.ok(
          r.state.effects.some(
            (e) => e.kind === "block" && e.impact === "super",
          ),
        );
      }
      assert.ok(
        r.source.energy < 11,
        "a missed or defended super still costs energy",
      );
    }
  const backwards = setup();
  backwards.inputs[1].block = true;
  backwards.inputs[1].right = true;
  backwards.start();
  assert.ok(
    backwards.state.finale,
    "guarding in the wrong direction does not prevent capture",
  );
});

test("a counter and a startup interruption stop a cinematic before capture", () => {
  for (const side of [0, 1] as const) {
    const counter = setup("capriles", "amanda", side);
    counter.inputs[1 - side].actions.special++;
    counter.start();
    assert.equal(counter.state.finale, undefined);
    assert.equal(counter.target.hp, 100);
    assert.equal(counter.target.countered, true);
    assert.ok(counter.source.hp < 100);
    assert.equal(counter.source.attack, null);
    const interrupted = setup("capriles", "javier", side);
    interrupted.target.x = interrupted.source.x + (side === 0 ? 80 : -80);
    interrupted.inputs[1 - side].actions.light++;
    interrupted.start();
    assert.equal(interrupted.state.finale, undefined);
    assert.ok(interrupted.source.hp < 100);
    assert.equal(interrupted.source.attack, null);
  }
});

test("cinematics consume inputs without queueing, freeze projectiles, and retain recovery on release", () => {
  const r = setup();
  r.start();
  r.state.projectiles.push({
    id: r.state.nextId++,
    owner: 1,
    x: 30,
    y: 40,
    vx: 4,
    life: 60,
    age: 7,
    kind: "spin",
    damage: 7,
  });
  const projectiles = structuredClone(r.state.projectiles);
  const cooldown = r.source.cooldown;
  for (let frame = 0; frame < FINALE_DURATION; frame++) {
    for (const input of r.inputs) {
      for (const action of ACTIONS) input.actions[action]++;
      input.left = input.right = input.block = input.down = true;
    }
    r.advance(1);
    assert.deepEqual(r.state.projectiles, projectiles);
  }
  assert.equal(r.source.cooldown, cooldown);
  assert.ok(r.source.cooldown > 0);
  assert.equal(r.source.attack, null);
  assert.ok(r.target.stun > 0, "the released rival keeps its hitstun");
  r.advance(1);
  assert.equal(r.state.projectiles[0].age, 8);
  assert.equal(r.state.projectiles[0].life, 59);
  r.advance(75);
  assert.equal(r.source.attack, null);
  assert.equal(r.target.attack, null);
  assert.equal(r.source.jumps, 0);
});

test("an airborne cinematic freezes actors in place and releases them without teleporting", () => {
  const r = setup();
  for (const p of r.state.players) {
    p.y = 260;
    p.grounded = false;
    p.supportPlatform = null;
    p.vy = -4;
  }
  r.start();
  const positions = r.state.players.map((p) => [p.x, p.y]);
  assert.equal(r.state.finale!.y, Math.min(...positions.map((p) => p[1])));
  r.advance(FINALE_DURATION);
  assert.deepEqual(
    r.state.players.map((p) => [p.x, p.y]),
    positions,
  );
  r.advance(1);
  assert.ok(r.source.y !== positions[0][1]);
});

test("a moving platform pauses on capture and carries its rider smoothly after release", () => {
  const r = setup();
  r.state.stage = "canaima";
  const platform = platformsAtTick(r.state.stage, r.state.tick)[2];
  r.source.x = platform.x + 35;
  r.source.y = platform.y;
  r.source.supportPlatform = 2;
  r.target.x = r.source.x + 110;
  r.target.y = platform.y;
  r.target.supportPlatform = 2;
  r.start();
  assert.ok(r.state.finale);
  const before = { tick: r.state.tick, x: r.source.x, y: r.source.y };
  r.advance(FINALE_DURATION);
  assert.equal(r.state.tick, before.tick);
  assert.equal(r.source.x, before.x);
  assert.equal(r.source.y, before.y);
  const next = platformsAtTick(r.state.stage, before.tick + 1)[2];
  r.advance(1);
  assert.equal(r.source.grounded, true);
  assert.equal(r.source.supportPlatform, 2);
  assert.equal(r.source.y, next.y);
});

test("lethal beats and a timer reaching zero wait until the scene ends to resolve stock or match results", () => {
  for (const stocks of [1, 2]) {
    const r = setup();
    r.target.hp = 1;
    r.target.stocks = stocks;
    r.state.remaining = FINALE_CAPTURE_TICK;
    r.start();
    assert.equal(r.state.remaining, 0);
    assert.equal(r.state.phase, "playing");
    r.advance(FINALE_DAMAGE_BEATS[0]);
    assert.equal(r.target.hp, 0);
    assert.equal(r.target.stocks, stocks);
    assert.equal(r.state.phase, "playing");
    r.advance(FINALE_DURATION - FINALE_DAMAGE_BEATS[0] - 1);
    assert.ok(r.state.finale);
    assert.equal(r.target.stocks, stocks);
    r.advance(1);
    assert.equal(r.state.finale, undefined);
    assert.equal(r.target.stocks, stocks - 1);
    assert.equal(r.state.phase, "finished");
    assert.equal(r.state.winner, 0);
    assert.equal(r.target.hp, stocks === 2 ? 100 : 0);
  }
});

test("simultaneous supers select one deterministic scene and serialized scenes replay exactly", () => {
  const r = setup("nacho", "giuseppe");
  r.inputs[1].actions.super++;
  r.start();
  assert.equal(r.state.finale!.owner, 0);
  assert.equal(r.target.attack, null);
  r.advance(66);
  const replay: MatchState = JSON.parse(JSON.stringify(r.state));
  const replayInputs: [Input, Input] = structuredClone(r.inputs);
  for (let frame = 0; frame < FINALES.nacho.duration + 60; frame++) {
    if (frame % 11 === 0) {
      r.inputs[0].actions.jump++;
      replayInputs[0].actions.jump++;
    }
    if (frame % 17 === 0) {
      r.inputs[1].actions.light++;
      replayInputs[1].actions.light++;
    }
    r.advance(1);
    stepMatch(replay, replayInputs);
    assert.deepEqual(replay, r.state);
  }
  const rematch = createMatch(r.state.stage, [
    r.source.config,
    r.target.config,
  ]);
  assert.equal(rematch.finale, undefined);
  assert.equal(rematch.players[0].hits, 0);
  assert.equal(rematch.players[1].hp, 100);
});

test("exact lethal thresholds resolve without floating-point survivors, while a tiny HP advantage survives", () => {
  // One representative per damaging mode; the threshold logic is shared.
  for (const fighter of (["capriles", "maite", "nacho", "conde"] as const).map(
    (id) => fighterById(id),
  ))
    for (const side of [0, 1] as const)
      for (const margin of [0, -0.0001, 0.0001]) {
        const r = setup(fighter.id, "javier", side);
        const damage = (28 * fighter.damage + 12) * fighterById("javier").armor;
        if (finaleById(fighter.id)!.mode === "field") continue;
        if (finaleById(fighter.id)!.mode === "transformation") {
          r.target.hp = Math.max(0.0001, damage + margin);
          r.start();
          r.advance(360);
          assert.equal(r.target.hp, Math.max(0.0001, damage + margin));
          assert.equal(r.target.stocks, 2);
          continue;
        }
        r.target.hp = damage + margin;
        r.target.stocks = 1;
        r.start();
        r.advance(r.state.finale?.duration ?? 30);
        if (margin <= 0 && finaleById(fighter.id)?.release?.knockoutDelay) {
          assert.equal(r.target.hp, 0);
          assert.equal(
            r.target.stocks,
            1,
            "finishing throw must fly before stock loss",
          );
          for (let frame = 0; frame < 90 && r.target.stocks; frame++)
            r.advance(1);
        }
        assert.equal(
          r.target.stocks,
          margin > 0 ? 1 : 0,
          `${fighter.id}/${side}/${margin}`,
        );
        if (margin > 0) close(r.target.hp, margin);
        else assert.equal(r.state.winner, side);
      }
});

test("community fighters keep their generic definitive until they have a cinematic definition", () => {
  const customId = "custom_finale-test";
  COMMUNITY_DEFINITIONS.set(customId, {
    ...fighterById("capriles"),
    id: customId,
  });
  try {
    const r = setup(customId);
    r.start();
    assert.equal(r.state.finale, undefined);
    assert.ok(r.target.hp < 100);
    assert.equal(r.source.hits, 1);
  } finally {
    COMMUNITY_DEFINITIONS.delete(customId);
  }
});
