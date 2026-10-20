import test from "node:test";
import assert from "node:assert/strict";
import {
  STAGES,
  platformsAtTick,
  type FighterId,
  type StageId,
} from "../shared/content";
import {
  cpuInput,
  createMatch,
  emptyInput,
  stepMatch,
  WORLD,
  type Input,
  type MatchState,
} from "../shared/engine";

const reviewed = [
  "javier",
  "dayana",
  "nacho",
  "capriles",
  "lorenzo",
  "carolina",
  "bolivar",
  "edgar",
] as const satisfies readonly FighterId[];
const rivals = [
  "vallenilla", // multi-shot projectile
  "gomez", // grounded control special
  "capriles", // dash strike
  "edgar", // counter
  "carolina", // projectile reflect
  "knoche", // folklore projectile with slow
  "tiotigre", // folklore pulse and dash
  "llorona", // pulling folklore projectile
] as const satisfies readonly FighterId[];
const difficulties = ["easy", "normal", "hard"] as const;
type Side = 0 | 1;
type Difficulty = (typeof difficulties)[number];

function setup(
  stage: StageId,
  fighter: FighterId,
  side: Side,
  rival: FighterId,
  gap = 170,
  wins = 0,
) {
  const configs = [
    { name: "Left", fighter: side === 0 ? fighter : rival, wins },
    { name: "Right", fighter: side === 1 ? fighter : rival, wins },
  ] as const;
  const state = createMatch(stage, [configs[0], configs[1]], "adversarial-v41");
  state.phase = "playing";
  const target = state.players[side];
  const other = state.players[1 - side];
  target.x = side === 0 ? 430 : 620;
  other.x = target.x + (side === 0 ? gap : -gap);
  for (let index = 0; index < state.players.length; index++) {
    const player = state.players[index];
    player.y = WORLD.floor;
    player.grounded = true;
    player.supportPlatform = -1;
    player.invincible = 0;
    player.energy = 100;
    player.facing = index === 0 ? 1 : -1;
  }
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  return { state, target, other, inputs, side };
}

function scriptedLeftInput(state: MatchState, previous: Input): Input {
  const next: Input = {
    ...previous,
    actions: { ...previous.actions },
  };
  const left = state.players[0];
  const dx = state.players[1].x - left.x;
  next.left = Math.abs(dx) > 110 && dx < 0;
  next.right = Math.abs(dx) > 110 && dx > 0;
  if (state.tick % 83 >= 72 && Math.abs(dx) < 200) {
    next.left = dx > 0;
    next.right = dx < 0;
  }
  next.block = state.tick % 127 >= 98 && Math.abs(dx) < 210;
  if (left.cooldown === 0 && left.stun === 0 && left.attack === null) {
    if (state.tick % 113 === 5 && left.energy >= 25) next.actions.special++;
    else if (state.tick % 47 === 7) next.actions.heavy++;
    else if (state.tick % 23 === 3) next.actions.light++;
  }
  if (state.tick % 79 === 10) next.actions.dash++;
  if (state.tick % 61 === 12 && left.jumps < 2) next.actions.jump++;
  return next;
}

function assertFiniteState(state: MatchState, label: string) {
  assert.ok(Number.isInteger(state.tick) && state.tick >= 0, `${label}: tick`);
  assert.ok(Number.isInteger(state.remaining), `${label}: timer`);
  assert.ok(
    state.phase === "playing" || state.phase === "finished",
    `${label}: phase`,
  );
  if (state.phase === "finished")
    assert.notEqual(state.winner, null, `${label}: winner`);
  for (const [index, p] of state.players.entries()) {
    assert.ok(
      Number.isFinite(p.x) && Number.isFinite(p.y),
      `${label}: P${index + 1} position`,
    );
    assert.ok(
      Number.isFinite(p.vx) && Number.isFinite(p.vy),
      `${label}: P${index + 1} velocity`,
    );
    assert.ok(
      Number.isFinite(p.energy) && p.energy >= 0 && p.energy <= 100,
      `${label}: P${index + 1} energy`,
    );
    assert.ok(
      Number.isFinite(p.hp) && p.hp >= 0 && p.hp <= 100,
      `${label}: P${index + 1} hp`,
    );
    assert.ok(
      Number.isInteger(p.stocks) && p.stocks >= 0 && p.stocks <= 2,
      `${label}: P${index + 1} stocks`,
    );
    assert.ok(
      Number.isInteger(p.attackTick) && p.attackTick >= 0,
      `${label}: P${index + 1} attack tick`,
    );
  }
  for (const shot of state.projectiles) {
    assert.ok(
      Number.isFinite(shot.x) && Number.isFinite(shot.y),
      `${label}: projectile position`,
    );
    assert.ok(
      Number.isFinite(shot.vx) && Number.isFinite(shot.vy ?? 0),
      `${label}: projectile velocity`,
    );
    assert.ok(
      Number.isFinite(shot.damage) && Number.isFinite(shot.life),
      `${label}: projectile lifetime/damage`,
    );
  }
}

function difficultyFor(
  fighterIndex: number,
  stageIndex: number,
  side: Side,
): Difficulty {
  return difficulties[(fighterIndex + stageIndex + side) % difficulties.length];
}

test("adversarial v41: all eight fighters survive both-side stage and rival pressure", () => {
  assert.equal(STAGES.length, 9);
  const seenRivals = new Set<FighterId>();
  const seenDifficulties = new Set<Difficulty>();
  let rows = 0;
  let cpuActionEdges = 0;
  let targetSpecialStarts = 0;
  let projectileTicks = 0;
  let hitstopTicks = 0;
  let landings = 0;
  let ringouts = 0;
  let respawns = 0;

  for (const [fighterIndex, fighter] of reviewed.entries()) {
    for (const [stageIndex, stage] of STAGES.entries()) {
      for (const side of [0, 1] as const) {
        const rival =
          rivals[(fighterIndex * 3 + stageIndex + side) % rivals.length];
        const difficulty = difficultyFor(fighterIndex, stageIndex, side);
        seenRivals.add(rival);
        seenDifficulties.add(difficulty);
        const run = setup(stage.id, fighter, side, rival);
        const label = `seed=${rows} ${fighter}/${stage.id}/P${side + 1} vs ${rival}/${difficulty}`;
        let wasGrounded = run.target.grounded;

        for (
          let tick = 0;
          tick < 300 && run.state.phase !== "finished";
          tick++
        ) {
          run.inputs[0] = scriptedLeftInput(run.state, run.inputs[0]);
          const cpuBefore = { ...run.inputs[1].actions };
          run.inputs[1] = cpuInput(run.state, run.inputs[1], difficulty);
          cpuActionEdges += Object.keys(cpuBefore).reduce(
            (count, key) =>
              count +
              Number(
                run.inputs[1].actions[key as keyof typeof cpuBefore] >
                  cpuBefore[key as keyof typeof cpuBefore],
              ),
            0,
          );
          const targetWasSpecial = run.target.attack === "special";
          const stocksBefore = run.state.players.map((player) => player.stocks);
          const oldTargetGrounded = wasGrounded;
          stepMatch(run.state, run.inputs);
          if (!targetWasSpecial && run.target.attack === "special")
            targetSpecialStarts++;
          projectileTicks += Number(run.state.projectiles.length > 0);
          hitstopTicks += Number(run.state.hitstop > 0);
          if (!oldTargetGrounded && run.target.grounded) landings++;
          for (const [index, player] of run.state.players.entries()) {
            if (player.stocks >= stocksBefore[index]) continue;
            ringouts++;
            if (player.stocks > 0) {
              respawns++;
              assert.equal(
                player.x,
                index === 0 ? 330 : 750,
                `${label}: ringout spawn x`,
              );
              assert.equal(player.y, 260, `${label}: ringout spawn y`);
              assert.equal(player.hp, 100, `${label}: ringout health reset`);
              assert.ok(player.invincible > 0, `${label}: respawn protection`);
            } else {
              assert.equal(player.hp, 0, `${label}: final ringout health`);
            }
          }
          wasGrounded = run.target.grounded;
          assertFiniteState(run.state, label);
        }
        assert.ok(
          run.state.phase === "playing" || run.state.phase === "finished",
          `${label}: left an invalid phase`,
        );
        rows++;
      }
    }
  }

  assert.equal(
    rows,
    8 * 9 * 2,
    "each fighter must run through all nine stages from both sides",
  );
  assert.equal(
    seenRivals.size,
    rivals.length,
    "matrix must include all rival archetypes",
  );
  assert.equal(
    seenDifficulties.size,
    3,
    "matrix must exercise easy, normal and hard cpuInput",
  );
  assert.ok(
    cpuActionEdges > 0,
    "cpuInput must produce attack or movement action edges",
  );
  assert.ok(
    targetSpecialStarts > 0,
    "reviewed fighters must enter specials under pressure",
  );
  assert.ok(
    projectileTicks > 0,
    "projectile interactions must be present in the matrix",
  );
  assert.ok(hitstopTicks > 0, "landed attacks must exercise hitstop pauses");
  assert.ok(
    landings > 0,
    "jump and knockback paths must return fighters to platforms/floor",
  );
  assert.ok(
    ringouts > 0 && respawns > 0,
    "aggressive pressure must exercise stock loss and respawn",
  );
});

test("adversarial v41: every reviewed fighter dashes through a close rival on either side", () => {
  for (const fighter of reviewed) {
    for (const side of [0, 1] as const) {
      const run = setup("poliedro", fighter, side, "zavarce", 16);
      const direction = side === 0 ? 1 : -1;
      const startingOrder = Math.sign(run.other.x - run.target.x);
      run.inputs[side].actions.dash++;
      for (let tick = 0; tick < 4; tick++) stepMatch(run.state, run.inputs);
      assert.equal(
        Math.sign(run.other.x - run.target.x),
        -startingOrder,
        `${fighter}/P${side + 1}: dash did not cross`,
      );
      assert.ok(
        (run.target.x - (side === 0 ? 430 : 600)) * direction > 35,
        `${fighter}/P${side + 1}: dash moved the wrong way`,
      );
      assertFiniteState(run.state, `${fighter}/P${side + 1}/dash-cross`);
    }
  }
});

test("adversarial v41: attack arcs and guard direction hold on both player sides", () => {
  for (const fighter of reviewed) {
    for (const side of [0, 1] as const) {
      const forward = setup("poliedro", fighter, side, "zavarce", 75);
      forward.inputs[side].actions.light++;
      for (let tick = 0; tick < 24; tick++)
        stepMatch(forward.state, forward.inputs);
      assert.ok(
        forward.other.hp < 100,
        `${fighter}/P${side + 1}: forward light missed`,
      );

      const backFacing = setup("poliedro", fighter, side, "zavarce", 75);
      const away = side === 0 ? "left" : "right";
      backFacing.inputs[side][away] = true;
      backFacing.inputs[side].actions.light++;
      for (let tick = 0; tick < 24; tick++)
        stepMatch(backFacing.state, backFacing.inputs);
      assert.equal(
        backFacing.other.hp,
        100,
        `${fighter}/P${side + 1}: light hit behind its facing`,
      );

      const guarded = setup("poliedro", fighter, side, "zavarce", 90);
      guarded.inputs[side].block = true;
      guarded.inputs[1 - side].actions.heavy++;
      for (let tick = 0; tick < 30; tick++)
        stepMatch(guarded.state, guarded.inputs);
      assert.equal(
        guarded.target.hp,
        100,
        `${fighter}/P${side + 1}: facing guard leaked a heavy hit`,
      );

      const crossedGuard = setup("poliedro", fighter, side, "zavarce", 90);
      crossedGuard.inputs[side].block = true;
      crossedGuard.inputs[side][away] = true;
      crossedGuard.inputs[1 - side].actions.heavy++;
      for (let tick = 0; tick < 30; tick++)
        stepMatch(crossedGuard.state, crossedGuard.inputs);
      assert.ok(
        crossedGuard.target.hp < 100,
        `${fighter}/P${side + 1}: rear-facing guard blocked the hit`,
      );
      assertFiniteState(forward.state, `${fighter}/P${side + 1}/forward-light`);
      assertFiniteState(backFacing.state, `${fighter}/P${side + 1}/back-light`);
      assertFiniteState(guarded.state, `${fighter}/P${side + 1}/front-guard`);
      assertFiniteState(
        crossedGuard.state,
        `${fighter}/P${side + 1}/rear-guard`,
      );
    }
  }
});

test("adversarial v41: special and super gates charge once on both player sides", () => {
  for (const fighter of reviewed) {
    for (const side of [0, 1] as const) {
      const short = setup("poliedro", fighter, side, "zavarce", 500);
      short.target.energy = 24;
      short.inputs[side].actions.special++;
      stepMatch(short.state, short.inputs);
      assert.equal(
        short.target.attack,
        null,
        `${fighter}/P${side + 1}: special started below 25 energy`,
      );

      const paid = setup("poliedro", fighter, side, "zavarce", 500);
      paid.target.energy = 25;
      paid.other.invincible = 120;
      paid.inputs[side].actions.special++;
      stepMatch(paid.state, paid.inputs);
      assert.equal(
        paid.target.attack,
        "special",
        `${fighter}/P${side + 1}: special failed at 25 energy`,
      );
      assert.ok(
        paid.target.energy >= 0 && paid.target.energy < 1,
        `${fighter}/P${side + 1}: special did not charge 25 once`,
      );
      for (let tick = 0; tick < 12; tick++) stepMatch(paid.state, paid.inputs);
      assert.ok(
        paid.target.energy > 0 && paid.target.energy < 2,
        `${fighter}/P${side + 1}: held special counter was charged again`,
      );

      const superRun = setup("poliedro", fighter, side, "zavarce", 500, 3);
      superRun.target.energy = 100;
      superRun.inputs[side].actions.super++;
      stepMatch(superRun.state, superRun.inputs);
      assert.equal(
        superRun.target.attack,
        "super",
        `${fighter}/P${side + 1}: unlocked super failed`,
      );
      assert.ok(
        superRun.target.energy >= 25 && superRun.target.energy < 26,
        `${fighter}/P${side + 1}: super did not charge 75 once`,
      );
    }
  }
});

test("adversarial v41: moving platforms carry every reviewed fighter without dropping support", () => {
  const movingStages = STAGES.flatMap((stage) =>
    stage.platforms.some((platform) => platform.motion) ? [stage] : [],
  );
  assert.ok(movingStages.length >= 4);
  for (const fighter of reviewed) {
    for (const stage of movingStages) {
      const platforms = platformsAtTick(stage.id, 0);
      const support = platforms.findIndex((platform) => platform.motion);
      const platform = platforms[support];
      for (const side of [0, 1] as const) {
        const run = setup(stage.id, fighter, side, "zavarce", 420);
        const target = run.target;
        target.x = platform.x + platform.width / 2;
        target.y = platform.y;
        target.grounded = true;
        target.supportPlatform = support;
        for (let tick = 0; tick < 180; tick++) {
          stepMatch(run.state, run.inputs);
          assertFiniteState(
            run.state,
            `${fighter}/${stage.id}/P${side + 1}/moving-platform`,
          );
        }
        assert.equal(
          target.grounded,
          true,
          `${fighter}/${stage.id}/P${side + 1}: lost platform support`,
        );
        assert.equal(
          target.supportPlatform,
          support,
          `${fighter}/${stage.id}/P${side + 1}: support index changed`,
        );
        const expected = platformsAtTick(stage.id, run.state.tick)[support];
        assert.ok(
          Math.abs(target.x - (expected.x + expected.width / 2)) < 0.01,
          `${fighter}/${stage.id}: missed horizontal platform carry`,
        );
        assert.ok(
          Math.abs(target.y - expected.y) < 0.01,
          `${fighter}/${stage.id}: missed vertical platform carry`,
        );
      }
    }
  }
});

test("adversarial v41: all reviewed fighters complete deterministic CPU matches at all difficulties", () => {
  for (const [fighterIndex, fighter] of reviewed.entries()) {
    for (const [difficultyIndex, difficulty] of difficulties.entries()) {
      const stage =
        STAGES[(fighterIndex * 2 + difficultyIndex * 3) % STAGES.length].id;
      const rival =
        rivals[(fighterIndex + difficultyIndex * 2) % rivals.length];
      function bout() {
        const run = setup(stage, fighter, 1, rival, 180, 3);
        let cpuSpecials = 0;
        let cpuSupers = 0;
        let cpuAction = run.inputs[1];
        for (
          let tick = 0;
          tick < 5_500 && run.state.phase !== "finished";
          tick++
        ) {
          run.inputs[0] = scriptedLeftInput(run.state, run.inputs[0]);
          const previousSpecial = cpuAction.actions.special;
          const previousSuper = cpuAction.actions.super;
          cpuAction = cpuInput(run.state, cpuAction, difficulty);
          cpuSpecials += Number(cpuAction.actions.special > previousSpecial);
          cpuSupers += Number(cpuAction.actions.super > previousSuper);
          run.inputs[1] = cpuAction;
          stepMatch(run.state, run.inputs);
          assertFiniteState(
            run.state,
            `${fighter}/${stage}/cpu-${difficulty}/tick-${tick}`,
          );
        }
        assert.equal(
          run.state.phase,
          "finished",
          `${fighter}/${stage}/cpu-${difficulty}: match did not finish`,
        );
        assert.ok(
          run.state.winner === 0 ||
            run.state.winner === 1 ||
            run.state.winner === "draw",
        );
        assert.ok(
          run.target.hits > 0 || run.other.hits > 0,
          `${fighter}/${stage}/cpu-${difficulty}: no confirmed hit`,
        );
        assert.ok(
          cpuSpecials > 0,
          `${fighter}/${stage}/cpu-${difficulty}: cpuInput did not request its special`,
        );
        if (difficulty === "hard")
          assert.ok(
            cpuSupers > 0,
            `${fighter}/${stage}: hard cpuInput did not request a super`,
          );
        return run.state;
      }
      assert.deepEqual(
        bout(),
        bout(),
        `${fighter}/${stage}/cpu-${difficulty}: deterministic replay diverged`,
      );
    }
  }
});

test("adversarial v41: Dayana's football resumes after hitstop without duplicate hits", () => {
  const run = setup("canaima", "dayana", 0, "zavarce", 80);
  run.inputs[0].actions.special++;
  const hitTicks: number[] = [];
  let priorHp = run.other.hp;
  let hitstopPauses = 0;
  for (let tick = 0; tick < 100; tick++) {
    const hitstopBefore = run.state.hitstop;
    stepMatch(run.state, run.inputs);
    if (hitstopBefore > 0) hitstopPauses++;
    if (run.other.hp < priorHp) hitTicks.push(run.target.attackTick);
    priorHp = run.other.hp;
  }
  assert.deepEqual(hitTicks, [21]);
  assert.ok(
    hitstopPauses >= 1,
    "the football impact should pause the shared simulation",
  );
  assert.equal(run.target.hits, 1);
  assertFiniteState(run.state, "dayana/canaima/football-hitstop");
});
