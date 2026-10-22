import test from "node:test";
import assert from "node:assert/strict";
import { STAGES, platformsAtTick, type FighterId, type StageId } from "../shared/content";
import { cpuInput, createMatch, emptyInput, stepMatch, WORLD, type Input, type MatchState } from "../shared/engine";
const rivals = [
  "vallenilla", // multi-shot projectile
  "gomez", // grounded control and snare
  "capriles", // dash strike
  "edgar", // counter
  "carolina", // projectile reflection
  "knoche", // slow projectile
  "tiotigre", // pulse and dash
  "llorona", // pulling projectile
] as const satisfies readonly FighterId[];
const difficulties = ["easy", "normal", "hard"] as const;
type Side = 0 | 1;

function setup(
  stage: StageId,
  fighters: [FighterId, FighterId] = ["melanio", "zavarce"],
  gap = 200,
) {
  const state = createMatch(
    stage,
    [
      { name: "Left", fighter: fighters[0], wins: 3 },
      { name: "Right", fighter: fighters[1], wins: 3 },
    ],
    "melanio-adversarial-v45",
  );
  state.phase = "playing";
  state.players[0].x = 430;
  state.players[1].x = 430 + gap;
  for (const [i, p] of state.players.entries()) {
    p.y = WORLD.floor;
    p.vx = 0;
    p.vy = 0;
    p.grounded = true;
    p.supportPlatform = -1;
    p.facing = i === 0 ? 1 : -1;
    p.invincible = 0;
    p.energy = 100;
  }
  return { state, inputs: [emptyInput(), emptyInput()] as [Input, Input] };
}

function tick(state: MatchState, inputs: [Input, Input], count = 1) {
  for (let i = 0; i < count; i++) stepMatch(state, inputs);
}

function assertFinite(state: MatchState, where: string) {
  for (const [i, p] of state.players.entries()) {
    assert.ok(
      Number.isFinite(p.x) && Number.isFinite(p.y),
      `${where} P${i + 1} position`,
    );
    assert.ok(
      Number.isFinite(p.vx) && Number.isFinite(p.vy),
      `${where} P${i + 1} velocity`,
    );
    assert.ok(
      p.hp >= 0 && p.hp <= 100 && p.energy >= 0 && p.energy <= 100,
      `${where} P${i + 1} resources`,
    );
  }
  for (const shot of state.projectiles) {
    assert.ok(
      Number.isFinite(shot.x) && Number.isFinite(shot.y),
      `${where} projectile position`,
    );
    assert.ok(
      Number.isFinite(shot.vx) && Number.isFinite(shot.life),
      `${where} projectile state`,
    );
  }
}

test("Melanio movement accelerates, reverses, settles without input and obeys jump limits on both sides", () => {
  for (const side of [0, 1] as const) {
    const run = setup(
      "poliedro",
      side === 0 ? ["melanio", "zavarce"] : ["zavarce", "melanio"],
      330,
    );
    const p = run.state.players[side];
    const input = run.inputs[side];
    const sign = side === 0 ? 1 : -1;
    input[side === 0 ? "right" : "left"] = true;
    tick(run.state, run.inputs, 18);
    assert.ok(
      p.vx * sign > 3,
      `P${side + 1} accelerates toward held direction`,
    );
    input[side === 0 ? "right" : "left"] = false;
    input[side === 0 ? "left" : "right"] = true;
    tick(run.state, run.inputs, 36);
    assert.ok(p.vx * sign < -2, `P${side + 1} reverses after opposite input`);
    input[side === 0 ? "left" : "right"] = false;
    tick(run.state, run.inputs, 100);
    assert.ok(Math.abs(p.vx) < 0.1, `P${side + 1} settles after input release`);

    input.actions.jump++;
    tick(run.state, run.inputs);
    assert.equal(p.jumps, 1, `P${side + 1} first jump`);
    input.actions.jump++;
    tick(run.state, run.inputs);
    assert.equal(p.jumps, 2, `P${side + 1} second jump`);
    assert.ok(p.vy < 0, `P${side + 1} second jump launches upward`);
    input.actions.jump++;
    const thirdJumpVy = p.vy;
    tick(run.state, run.inputs);
    assert.equal(p.jumps, 2, `P${side + 1} rejects third jump`);
    assert.ok(
      p.vy > thirdJumpVy,
      `P${side + 1} rejected press does not relaunch`,
    );
    input.actions.jump++;
    input[side === 0 ? "left" : "right"] = true;
    for (let frame = 0; frame < 120 && !p.grounded; frame++)
      tick(run.state, run.inputs);
    assert.equal(p.grounded, true, `P${side + 1} lands`);
    assert.equal(p.jumps, 0, `P${side + 1} landing restores jumps`);
    assertFinite(run.state, `movement/P${side + 1}`);
  }
});

test("Melanio drop-through, upward pass-through and landing work across all nine stages on both sides", () => {
  assert.equal(STAGES.length, 9);
  for (const stage of STAGES)
    for (const side of [0, 1] as const) {
      const { state, inputs } = setup(
        stage.id,
        side === 0 ? ["melanio", "javier"] : ["javier", "melanio"],
        380,
      );
      const player = state.players[side];
      const platformIndex = stage.platforms.length ? 0 : -1;
      if (platformIndex >= 0) {
        const platform = platformsAtTick(stage.id, 0)[platformIndex];
        player.x = platform.x + platform.width / 2;
        player.y = platform.y;
        player.supportPlatform = platformIndex;
        player.grounded = true;
        inputs[side].down = true;
        tick(state, inputs);
        assert.equal(
          player.grounded,
          false,
          `${stage.id} P${side + 1} drops through`,
        );
        assert.equal(player.supportPlatform, null);
        inputs[side].down = false;
        let landed = false;
        for (let frame = 0; frame < 100 && !landed; frame++) {
          tick(state, inputs);
          landed = player.grounded;
        }
        assert.ok(landed, `${stage.id} P${side + 1} lands after drop`);

        player.y = platform.y + 12;
        player.vy = -9;
        player.grounded = false;
        player.supportPlatform = null;
        player.jumps = 1;
        tick(state, inputs);
        assert.equal(
          player.grounded,
          false,
          `${stage.id} P${side + 1} passes upward through underside`,
        );
      }
      assertFinite(state, `${stage.id}/P${side + 1}/platform`);
    }
  for (const stage of STAGES)
    for (const [index, def] of stage.platforms.entries()) {
      if (!def.motion) continue;
      for (const side of [0, 1] as const) {
        const { state, inputs } = setup(
          stage.id,
          side === 0 ? ["melanio", "zavarce"] : ["zavarce", "melanio"],
          400,
        );
        const platform = platformsAtTick(stage.id, 0)[index];
        const player = state.players[side];
        player.x = platform.x + platform.width / 2;
        player.y = platform.y;
        player.grounded = true;
        player.supportPlatform = index;
        tick(state, inputs, Math.min(def.motion.period + 2, 180));
        const moved = platformsAtTick(stage.id, state.tick)[index];
        assert.equal(
          player.supportPlatform,
          index,
          `${stage.id} P${side + 1} moving support preserved`,
        );
        assert.ok(
          Math.abs(player.x - moved.x - moved.width / 2) < 0.01,
          `${stage.id} P${side + 1} rider follows platform horizontally`,
        );
        assert.ok(
          Math.abs(player.y - moved.y) < 0.01,
          `${stage.id} P${side + 1} rider follows platform vertically`,
        );
      }
    }
});

test("Melanio dash has a direction, cooldown, and hit interruption contract on both sides", () => {
  for (const side of [0, 1] as const) {
    const fighters: [FighterId, FighterId] =
      side === 0 ? ["melanio", "zavarce"] : ["zavarce", "melanio"];
    const run = setup("poliedro", fighters, 500);
    const p = run.state.players[side];
    const originalX = p.x;
    run.inputs[side].actions.dash++;
    tick(run.state, run.inputs, 4);
    assert.ok(
      (p.x - originalX) * (side === 0 ? 1 : -1) > 30,
      `P${side + 1} dash travels forward`,
    );
    assert.ok(p.dash > 0, `P${side + 1} dash is active`);
    assert.ok(
      p.energy >= 50,
      `P${side + 1} dash does not consume special energy`,
    );
    const xAfterDash = p.x;
    run.inputs[side].actions.dash++;
    tick(run.state, run.inputs);
    assert.ok(
      Math.abs(p.x - xAfterDash) < 20,
      `P${side + 1} cannot restart dash during cooldown`,
    );

    const special = setup("poliedro", fighters, 200);
    const attacker = special.state.players[1 - side];
    const target = special.state.players[side];
    target.x = side === 0 ? 510 : 580;
    attacker.x = side === 0 ? 580 : 510;
    attacker.facing = side === 0 ? -1 : 1;
    target.facing = -attacker.facing;
    special.inputs[side].actions.special++;
    tick(special.state, special.inputs, 4);
    assert.equal(
      target.attack,
      "special",
      `P${side + 1} began interruptible special`,
    );
    special.inputs[1 - side].actions.light++;
    tick(special.state, special.inputs, 14);
    assert.ok(
      target.stun > 0,
      `P${side + 1} is interrupted by a confirmed hit`,
    );
    assert.notEqual(
      target.attack,
      "special",
      `P${side + 1} interrupted startup stops special`,
    );
    assertFinite(special.state, `dash-interrupt/P${side + 1}`);
  }
});

test("root, slow, hitstun, blocking drift, low-energy spam and ringout recovery retain combat contracts", () => {
  for (const side of [0, 1] as const) {
    const root = setup(
      "poliedro",
      side === 0 ? ["melanio", "gomez"] : ["gomez", "melanio"],
      300,
    );
    const rooted = root.state.players[side];
    const startX = rooted.x;
    rooted.rootTicks = 30;
    root.inputs[side][side === 0 ? "right" : "left"] = true;
    tick(root.state, root.inputs, 12);
    assert.ok(
      rooted.x === startX,
      `P${side + 1} root prevents voluntary drift`,
    );
    root.inputs[side].actions.jump++;
    tick(root.state, root.inputs);
    assert.equal(rooted.rootTicks, 0, `P${side + 1} jump clears root`);
    assert.ok(rooted.vy < 0, `P${side + 1} jumps out of root`);

    const sideFighters: [FighterId, FighterId] =
      side === 0 ? ["melanio", "javier"] : ["javier", "melanio"];
    const moveDirection = side === 0 ? "right" : "left";
    const slow = setup("poliedro", sideFighters, 500);
    const slowed = slow.state.players[side];
    const slowStartX = slowed.x;
    slowed.slowTicks = 35;
    slow.inputs[side][moveDirection] = true;
    tick(slow.state, slow.inputs, 24);
    const normal = setup("poliedro", sideFighters, 500);
    normal.inputs[side][moveDirection] = true;
    tick(normal.state, normal.inputs, 24);
    const slowedDistance = Math.abs(slowed.x - slowStartX);
    const normalDistance = Math.abs(normal.state.players[side].x - slowStartX);
    assert.ok(
      normalDistance > slowedDistance,
      `P${side + 1} slow movement is below normal (${slowedDistance} vs ${normalDistance})`,
    );

    const stunned = setup("poliedro", sideFighters, 500);
    const victim = stunned.state.players[side];
    victim.stun = 8;
    const stunnedX = victim.x;
    stunned.inputs[side][side === 0 ? "right" : "left"] = true;
    tick(stunned.state, stunned.inputs, 5);
    assert.equal(
      victim.x,
      stunnedX,
      `P${side + 1} hitstun suppresses voluntary movement`,
    );

    const guarded = setup("poliedro", ["melanio", "javier"], 500);
    const guard = guarded.state.players[0];
    guard.vx = 2;
    guard.energy = 50;
    const guardX = guard.x;
    guarded.inputs[0].block = true;
    tick(guarded.state, guarded.inputs, 90);
    assert.ok(
      Math.abs(guard.x - guardX) < 8,
      `held block settles without meaningful drift (${guard.x - guardX})`,
    );
    assert.ok(guard.blocking, "guard remains active when energy is available");

    const lowEnergy = setup(
      "poliedro",
      side === 0 ? ["melanio", "zavarce"] : ["zavarce", "melanio"],
      500,
    );
    const spender = lowEnergy.state.players[side];
    spender.energy = 0;
    for (let n = 0; n < 8; n++) {
      lowEnergy.inputs[side].actions.special++;
      tick(lowEnergy.state, lowEnergy.inputs);
    }
    assert.notEqual(
      spender.attack,
      "special",
      `P${side + 1} cannot spam special below threshold`,
    );
    assert.ok(
      spender.energy >= 0 && spender.energy < 25,
      `P${side + 1} energy remains bounded`,
    );

    const ringout = setup("poliedro", sideFighters, 500);
    const fallen = ringout.state.players[side];
    fallen.x = side === 0 ? WORLD.x - 121 : WORLD.x + WORLD.width + 121;
    fallen.rootTicks = 20;
    fallen.slowTicks = 20;
    tick(ringout.state, ringout.inputs);
    assert.equal(fallen.stocks, 1, `P${side + 1} loses one stock on ringout`);
    assert.equal(fallen.rootTicks, 0, `P${side + 1} ringout clears root`);
    assert.equal(fallen.slowTicks, 0, `P${side + 1} ringout clears slow`);
    assert.equal(fallen.hp, 100, `P${side + 1} ringout restores health`);
    assert.ok(
      fallen.invincible > 0,
      `P${side + 1} ringout grants respawn protection`,
    );
    assertFinite(root.state, `root/P${side + 1}`);
  }
});

test("Melanio return signal hits, is guarded from the front, and hits a rear-facing guard on both sides", () => {
  for (const side of [0, 1] as const)
    for (const mode of ["hit", "front-block", "rear-block"] as const) {
      const fighters: [FighterId, FighterId] =
        side === 0 ? ["melanio", "javier"] : ["javier", "melanio"];
      const run = setup("poliedro", fighters, 190);
      const owner = run.state.players[side];
      const target = run.state.players[1 - side];
      owner.facing = side === 0 ? 1 : -1;
      target.facing = mode === "rear-block" ? owner.facing : -owner.facing;
      if (mode !== "hit") run.inputs[1 - side].block = true;
      if (mode === "rear-block") {
        // Contact is staged immediately behind the guard; the forced retreat
        // also gives the defender a real movement input that holds this facing.
        const direction = side === 0 ? 1 : -1;
        target.x = owner.x + direction * 100;
        target.facing = direction;
        run.inputs[1 - side][direction > 0 ? "right" : "left"] = true;
        run.state.projectiles.push({
          id: run.state.nextId++,
          owner: side,
          kind: "signal",
          x: target.x - direction * 28,
          y: target.y - 75,
          vx: direction * 7,
          life: 40,
          age: 8,
          damage: 8,
        });
      }
      if (mode !== "rear-block") run.inputs[side].actions.special++;
      const initialHp = target.hp;
      let sawSignal = false;
      let sawBlock = false;
      for (let frame = 0; frame < 75; frame++) {
        tick(run.state, run.inputs);
        sawSignal ||= run.state.projectiles.some(
          (shot) => shot.owner === side && shot.kind === "signal",
        );
        sawBlock ||= run.state.effects.some(
          (effect) => effect.kind === "block",
        );
      }
      if (mode !== "rear-block")
        assert.ok(sawSignal, `P${side + 1} launched signal`);
      if (mode === "hit")
        assert.ok(
          target.hp < initialHp,
          `P${side + 1} signal deals contact damage`,
        );
      if (mode === "front-block") {
        assert.equal(
          target.hp,
          initialHp,
          `P${side + 1} front block prevents signal damage`,
        );
        assert.ok(sawBlock, `P${side + 1} front block has contact effect`);
      }
      if (mode === "rear-block")
        assert.ok(
          target.hp < initialHp,
          `P${side + 1} rear-facing guard does not block signal`,
        );
      assertFinite(run.state, `signal/${mode}/P${side + 1}`);
    }
});

test("signal has a deterministic long-range whiff and can contact the rival again on return", () => {
  for (const side of [0, 1] as const) {
    const whiff = setup(
      "poliedro",
      side === 0 ? ["melanio", "javier"] : ["javier", "melanio"],
      320,
    );
    const whiffOwner = whiff.state.players[side];
    const whiffTarget = whiff.state.players[1 - side];
    whiffOwner.facing = side === 0 ? 1 : -1;
    whiffTarget.facing = -whiffOwner.facing;
    whiff.inputs[side].actions.special++;
    tick(whiff.state, whiff.inputs, 100);
    assert.equal(whiffTarget.hp, 100, `P${side + 1} distant signal whiffs`);
    assert.equal(
      whiffOwner.hits,
      0,
      `P${side + 1} whiff does not record a hit`,
    );
    assert.equal(
      whiff.state.projectiles.length,
      0,
      `P${side + 1} whiff expires`,
    );

    const returning = setup(
      "poliedro",
      side === 0 ? ["melanio", "javier"] : ["javier", "melanio"],
      120,
    );
    const owner = returning.state.players[side];
    const target = returning.state.players[1 - side];
    owner.facing = side === 0 ? 1 : -1;
    target.facing = -owner.facing;
    target.invincible = 1000;
    returning.inputs[side].actions.special++;
    let releasedAtTurn = false;
    let returnHit = false;
    for (let frame = 0; frame < 70; frame++) {
      tick(returning.state, returning.inputs);
      const shot = returning.state.projectiles.find(
        (candidate) => candidate.owner === side,
      );
      if (shot && (shot.age ?? 0) >= (shot.returnAfter ?? Infinity)) {
        releasedAtTurn = true;
        target.invincible = 0;
      }
      if (target.hp < 100) returnHit = true;
    }
    assert.ok(
      releasedAtTurn,
      `P${side + 1} observes reversal before return contact`,
    );
    assert.ok(returnHit, `P${side + 1} returning packet contacts rival`);
    assert.equal(owner.hits, 1, `P${side + 1} return contact is counted once`);
    assertFinite(returning.state, `return-contact/P${side + 1}`);
  }
});

test("return signal reflection transfers ownership, and counter contact resolves damage", () => {
  for (const side of [0, 1] as const) {
    const fighters: [FighterId, FighterId] =
      side === 0 ? ["melanio", "carolina"] : ["carolina", "melanio"];
    const run = setup("poliedro", fighters, 200);
    const owner = run.state.players[side];
    const reflector = run.state.players[1 - side];
    owner.facing = side === 0 ? 1 : -1;
    reflector.facing = -owner.facing;
    run.state.projectiles.push({
      id: run.state.nextId++,
      owner: side,
      kind: "signal",
      x: reflector.x + reflector.facing * 100,
      y: reflector.y - 75,
      vx: owner.facing * 7,
      life: 40,
      age: 10,
      damage: 8,
      returnAfter: 24,
    });
    reflector.attack = "special";
    reflector.attackTick = 6;
    reflector.countered = false;
    reflector.facing = -owner.facing;
    tick(run.state, run.inputs, 1);
    assert.ok(
      run.state.projectiles.some((shot) => shot.owner === 1 - side),
      `P${1 - side + 1} reflects signal ownership`,
    );

    const counter = setup("poliedro", ["zavarce", "edgar"], 90);
    const attacker = counter.state.players[0];
    const defender = counter.state.players[1];
    attacker.facing = 1;
    defender.facing = -1;
    defender.attack = "special";
    defender.attackTick = 5;
    counter.inputs[0].actions.light++;
    tick(counter.state, counter.inputs, 6);
    assert.ok(defender.countered, "Edgar consumes active counter window");
    assert.ok(attacker.hp < 100, "counter contact damages the attacker");
  }
});

test("simultaneous Melanio signal contact resolves for both players without order bias", () => {
  const run = setup("poliedro", ["melanio", "melanio"], 70);
  run.state.players[0].facing = 1;
  run.state.players[1].facing = -1;
  run.inputs[0].actions.special++;
  run.inputs[1].actions.special++;
  for (let frame = 0; frame < 70; frame++) tick(run.state, run.inputs);
  assert.ok(run.state.players[0].hp < 100, "P1 receives signal contact");
  assert.ok(run.state.players[1].hp < 100, "P2 receives signal contact");
  assertFinite(run.state, "simultaneous-signal-contact");
});

test("Melanio and eight rival abilities produce deterministic movement and combat observations across stages, sides, and CPU difficulty", () => {
  const seenStages = new Set<string>();
  const seenRivals = new Set<FighterId>();
  const seenDifficulties = new Set<string>();
  let movement = 0;
  let confirmedHits = 0;
  let specialStarts = 0;
  let projectileFrames = 0;
  let contactEffects = 0;
  let hitstopFrames = 0;
  let cpuActionEdges = 0;
  let rows = 0;

  for (const [rivalIndex, rival] of rivals.entries())
    for (const stage of STAGES)
      for (const side of [0, 1] as const)
        for (const [difficultyIndex, difficulty] of difficulties.entries()) {
          const fighters: [FighterId, FighterId] =
            side === 0 ? ["melanio", rival] : [rival, "melanio"];
          const run = setup(
            stage.id,
            fighters,
            175 + ((rivalIndex * 17 + difficultyIndex * 13) % 120),
          );
          run.state.players[0].invincible = 0;
          run.state.players[1].invincible = 0;
          const startX = run.state.players.map((p) => p.x);
          let previousCpu = run.inputs[1];
          for (let frame = 0; frame < 260; frame++) {
            const scripted = run.inputs[0];
            const p = run.state.players[0];
            const other = run.state.players[1];
            scripted.left = other.x < p.x - 85;
            scripted.right = other.x > p.x + 85;
            scripted.block = frame % 61 >= 53 && Math.abs(other.x - p.x) < 220;
            if (p.cooldown === 0 && !p.attack) {
              if (frame % 101 === 12 && p.energy >= 25)
                scripted.actions.special++;
              else if (frame % 43 === 9) scripted.actions.light++;
              else if (frame % 73 === 31) scripted.actions.dash++;
            }
            if (frame % 67 === 22 && p.jumps < 2) scripted.actions.jump++;
            const cpuBefore = previousCpu;
            previousCpu = cpuInput(run.state, previousCpu, difficulty);
            run.inputs[1] = previousCpu;
            for (const key of Object.keys(
              previousCpu.actions,
            ) as (keyof Input["actions"])[])
              cpuActionEdges += Number(
                previousCpu.actions[key] > cpuBefore.actions[key],
              );
            const before = run.state.players.map((player) => ({
              hp: player.hp,
              attack: player.attack,
            }));
            const specialBefore = run.state.players.map(
              (player) => player.attack === "special",
            );
            const effectsBefore = run.state.effects.length;
            const hitstopBefore = run.state.hitstop;
            stepMatch(run.state, run.inputs);
            movement += run.state.players.reduce(
              (n, player, i) => n + Number(Math.abs(player.x - startX[i]) > 25),
              0,
            );
            confirmedHits += run.state.players.reduce(
              (n, player, i) =>
                n + Number(player.hits > 0 && player.hp <= before[1 - i].hp),
              0,
            );
            specialStarts += run.state.players.reduce(
              (n, player, i) =>
                n + Number(!specialBefore[i] && player.attack === "special"),
              0,
            );
            projectileFrames += Number(run.state.projectiles.length > 0);
            contactEffects += Number(
              run.state.effects.length > effectsBefore &&
                run.state.effects.some(
                  (effect) => effect.kind === "hit" || effect.kind === "block",
                ),
            );
            hitstopFrames += Number(hitstopBefore > 0 || run.state.hitstop > 0);
            assertFinite(
              run.state,
              `${rival}/${stage.id}/P${side + 1}/${difficulty}/frame-${frame}`,
            );
          }
          seenStages.add(stage.id);
          seenRivals.add(rival);
          seenDifficulties.add(difficulty);
          rows++;
        }
  assert.equal(rows, 8 * 9 * 2 * 3);
  assert.equal(seenStages.size, 9);
  assert.equal(seenRivals.size, 8);
  assert.equal(seenDifficulties.size, 3);
  assert.ok(movement > 100, `observed movement (${movement})`);
  assert.ok(
    confirmedHits > 0,
    `observed confirmed hit damage (${confirmedHits})`,
  );
  assert.ok(specialStarts > 0, `observed specials (${specialStarts})`);
  assert.ok(
    projectileFrames > 0,
    `observed active projectiles (${projectileFrames})`,
  );
  assert.ok(
    contactEffects > 0,
    `observed hit/block contact effects (${contactEffects})`,
  );
  assert.ok(hitstopFrames > 0, `observed hitstop (${hitstopFrames})`);
  assert.ok(cpuActionEdges > 0, `observed CPU decisions (${cpuActionEdges})`);
});
