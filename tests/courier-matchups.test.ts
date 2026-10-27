import test from "node:test";
import assert from "node:assert/strict";
import {
  STAGES,
  platformsAtTick,
  type FighterId,
  type StageId,
} from "../shared/content";
import {
  createMatch,
  emptyInput,
  stepMatch,
  type Input,
  type MatchState,
} from "../shared/engine";
type Side = 0 | 1;

function scene(stage: StageId, rival: FighterId, side: Side, gap = 260) {
  const vicente = { name: "Vicente", fighter: "zavarce", wins: 0 } as const;
  const opponent = { name: rival, fighter: rival, wins: 3 };
  const state = createMatch(
    stage,
    side === 0 ? [vicente, opponent] : [opponent, vicente],
  );
  state.phase = "playing";
  for (const player of state.players) {
    player.invincible = 0;
    player.energy = 100;
  }
  const caster = state.players[side],
    target = state.players[1 - side];
  caster.x = side === 0 ? 230 : 850;
  target.x = caster.x + (side === 0 ? gap : -gap);
  caster.facing = side === 0 ? 1 : -1;
  target.facing = -caster.facing;
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (frames: number) => {
    for (let n = 0; n < frames; n++) stepMatch(state, inputs);
  };
  return { state, caster, target, side, inputs, advance };
}

function finite(state: MatchState, label: string) {
  for (const p of state.players) {
    assert.ok(
      [p.x, p.y, p.vx, p.vy, p.hp, p.energy].every(Number.isFinite),
      label,
    );
    assert.ok(
      p.hp >= 0 && p.hp <= 100 && p.energy >= 0 && p.energy <= 100,
      label,
    );
  }
  for (const shot of state.projectiles)
    assert.ok(
      [shot.x, shot.y, shot.vx, shot.life].every(Number.isFinite),
      label,
    );
}

test("the single ground motorcycle connects once, is guarded from the front and jumped over", () => {
  const defenses = ["idle", "guard", "double-jump", "backward-guard"] as const;
  for (const defense of defenses)
    for (const side of [0, 1] as const) {
      const run = scene("poliedro", "javier", side);
      const label = `${defense}/P${side + 1}`;
      const targetInput = run.inputs[1 - side];
      targetInput.block = defense === "guard" || defense === "backward-guard";
      if (defense === "double-jump") targetInput.actions.jump++;
      if (defense === "backward-guard") {
        targetInput.right = side === 0;
        targetInput.left = side === 1;
      }
      run.inputs[side].actions.special++;
      const seen = new Set<number>();
      const sourceX = run.caster.x;
      for (let frame = 0; frame < 190; frame++) {
        if (frame === 22 && defense === "double-jump")
          targetInput.actions.jump++;
        run.advance(1);
        for (const shot of run.state.projectiles) {
          seen.add(shot.id);
          assert.equal(shot.kind, "courier", label);
          assert.equal(shot.owner, side, label);
          assert.equal(shot.groundOnly, true, label);
        }
      }
      assert.equal(seen.size, 1, label + " one unique bike");
      assert.equal(run.caster.x, sourceX, label + " no involuntary dash");
      assert.equal(run.caster.hp, 100, label + " no self-hit");
      assert.equal(run.state.projectiles.length, 0, label + " cleanup");
      assert.equal(run.caster.attack, null, label + " recovery");
      if (defense === "guard" || defense === "double-jump") {
        assert.equal(run.caster.hits, 0, label + " defense");
        assert.equal(run.target.hp, 100, label + " defense damage");
      } else {
        assert.equal(run.caster.hits, 1, label + " single bike connects");
        assert.ok(run.target.hp < 100, label + " damage");
      }
    }
});

test("floor motorcycles miss opponents sheltered on every elevated platform", () => {
  for (const stage of STAGES)
    for (const [index, definition] of stage.platforms.entries()) {
      const run = scene(stage.id, "maite", 0);
      run.state.tick = definition.motion
        ? Math.floor(definition.motion.period / 4)
        : 0;
      const platform = platformsAtTick(stage.id, run.state.tick)[index];
      Object.assign(run.target, {
        x: platform.x + platform.width / 2,
        y: platform.y,
        grounded: true,
        supportPlatform: index,
      });
      run.caster.x =
        run.target.x < 540 ? run.target.x + 280 : run.target.x - 280;
      run.caster.facing = Math.sign(run.target.x - run.caster.x);
      run.inputs[0].actions.special++;
      run.advance(160);
      assert.equal(run.target.hp, 100, `${stage.id}/platform-${index}`);
      assert.equal(run.caster.hits, 0);
      finite(run.state, stage.id);
    }
});

test("Carolina reflects the motorcycle with its identity intact", () => {
  for (const side of [0, 1] as const) {
    const run = scene("poliedro", "carolina", side, 245);
    run.inputs[side].actions.special++;
    run.inputs[1 - side].actions.special++;
    const reflected = new Set<number>();
    for (let frame = 0; frame < 160; frame++) {
      run.advance(1);
      for (const shot of run.state.projectiles)
        if (shot.kind === "courier" && shot.owner !== side) {
          reflected.add(shot.id);
          assert.equal(Math.sign(shot.vx), side === 0 ? -1 : 1);
          assert.equal(shot.formationIndex, undefined);
          assert.equal(shot.groundOnly, true);
        }
    }
    assert.ok(reflected.size > 0, `P${side + 1} reflection`);
    assert.ok(run.caster.hp < 100, `P${side + 1}: returned bike hits Vicente`);
    assert.equal(run.state.projectiles.length, 0);
    finite(run.state, `carolina/P${side + 1}`);
  }
});

test("front-facing reflection of newly spawned bikes is independent of player order", () => {
  for (const gap of [80, 120, 180]) {
    const outcomes = [];
    for (const side of [0, 1] as const) {
      const run = scene("poliedro", "carolina", side, gap);
      run.inputs[side].actions.special++;
      run.inputs[1 - side].actions.special++;
      const reflected = new Set<number>();
      for (let tick = 0; tick < 22; tick++) {
        run.advance(1);
        for (const shot of run.state.projectiles)
          if (shot.kind === "courier" && shot.owner !== side)
            reflected.add(shot.id);
      }
      outcomes.push({
        reflected: reflected.size,
        casterHp: run.caster.hp,
        defenderHp: run.target.hp,
      });
    }
    assert.ok(
      outcomes[0].reflected > 0 || outcomes[0].casterHp < 100,
      `gap ${gap}: the couture window is active`,
    );
    assert.deepEqual(
      outcomes[0],
      outcomes[1],
      `gap ${gap}: either player must reflect the newly spawned motorcycles`,
    );
  }
});

test("Amanda counters an incoming motorcycle on either side", () => {
  for (const side of [0, 1] as const) {
    const run = scene("poliedro", "amanda", side, 180);
    run.inputs[side].actions.special++;
    run.inputs[1 - side].actions.special++;
    run.advance(22);
    assert.equal(run.target.countered, true);
    assert.ok(run.caster.hp < 100);
    assert.ok(run.target.hits > 0);
    assert.ok(run.caster.hits < 1);
    run.advance(88);
    finite(run.state, "Amanda counter");
  }
});

test("motorcycle matchups replay identically across JSON network round trips", () => {
  for (const rival of ["vallenilla", "silbon", "carolina"] as const)
    for (const side of [0, 1] as const) {
      const run = scene("merida", rival, side);
      let remote: MatchState = JSON.parse(JSON.stringify(run.state));
      run.inputs[side].actions.special++;
      for (let frame = 0; frame < 150; frame++) {
        run.advance(1);
        stepMatch(remote, run.inputs);
        remote = JSON.parse(JSON.stringify(remote));
        assert.deepEqual(
          JSON.parse(JSON.stringify(run.state)),
          remote,
          `${rival}/P${side + 1}/frame-${frame}`,
        );
      }
    }
});
