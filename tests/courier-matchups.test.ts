import test, { after } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import {
  FIGHTERS,
  STAGES,
  fighterById,
  platformsAtTick,
  type FighterId,
  type StageId,
} from "../shared/content";
import {
  createMatch,
  emptyInput,
  stepMatch,
  WORLD,
  type Input,
  type MatchState,
} from "../shared/engine";
import { TECHNIQUES } from "../shared/techniques";

type Side = 0 | 1;
type Defense = "idle" | "guard" | "double-jump" | "backward-guard";
const defenses: Defense[] = ["idle", "guard", "double-jump", "backward-guard"];
const summaries: {
  stage: StageId;
  defense: Defense;
  cases: number;
  minHits: number;
  maxHits: number;
  minHp: number;
}[] = [];
let clashCases = 0,
  matrixCases = 0,
  platformCases = 0,
  interactionCases = 0;

function scene(stage: StageId, rival: FighterId, side: Side, gap = 260) {
  const vicente = { name: "Vicente", fighter: "zavarce", wins: 3 } as const;
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

for (const stage of STAGES) {
  test(`Yummy pack / ${stage.id}: every fighter, both sides, four defenses`, () => {
    for (const defense of defenses) {
      const result = {
        stage: stage.id,
        defense,
        cases: 0,
        minHits: Infinity,
        maxHits: 0,
        minHp: 100,
      };
      for (const rival of FIGHTERS)
        for (const side of [0, 1] as const) {
          const run = scene(stage.id, rival.id, side);
          const label = `${stage.id}/${rival.id}/P${side + 1}/${defense}`;
          const targetInput = run.inputs[1 - side];
          targetInput.block =
            defense === "guard" || defense === "backward-guard";
          if (defense === "double-jump") targetInput.actions.jump++;
          if (defense === "backward-guard") {
            targetInput.right = side === 0;
            targetInput.left = side === 1;
          }
          run.inputs[side].actions.special++;
          const seen = new Set<number>();
          const origins = new Map<number, number>();
          const sourceX = run.caster.x;
          for (let frame = 0; frame < 190; frame++) {
            if (frame === 22 && defense === "double-jump")
              targetInput.actions.jump++;
            run.advance(1);
            finite(run.state, label);
            if (frame === 0)
              assert.ok(
                run.caster.energy >= 75 && run.caster.energy < 76,
                label + " energy cost",
              );
            for (const shot of run.state.projectiles) {
              seen.add(shot.id);
              if (!origins.has(shot.id)) origins.set(shot.id, frame);
              assert.equal(shot.kind, "courier", label);
              assert.equal(shot.owner, side, label);
              assert.equal(shot.groundOnly, true, label);
            }
          }
          assert.equal(seen.size, 7, label + " seven unique bikes");
          assert.equal(
            new Set(origins.values()).size,
            1,
            label + " simultaneous formation",
          );
          assert.equal(run.caster.x, sourceX, label + " no involuntary dash");
          assert.equal(run.caster.hp, 100, label + " no self-hit");
          assert.equal(run.caster.stocks, 2, label);
          assert.equal(run.target.stocks, 2, label + " no unexpected ringout");
          assert.equal(run.state.projectiles.length, 0, label + " cleanup");
          assert.equal(run.caster.attack, null, label + " recovery");
          if (defense === "guard" || defense === "double-jump") {
            assert.equal(run.caster.hits, 0, label + " defense");
            assert.equal(run.target.hp, 100, label + " defense damage");
          } else {
            assert.ok(
              run.caster.hits > 0 && run.caster.hits <= 7,
              label + " bounded hits",
            );
            if (defense === "idle")
              assert.equal(run.caster.hits, 7, label + " full pack connects");
            const damage =
              run.caster.hits *
              TECHNIQUES.courier.damage *
              fighterById("zavarce").damage *
              rival.armor;
            assert.ok(
              Math.abs(100 - run.target.hp - damage) < 1e-8,
              label + " damage matches armor and unique hits",
            );
          }
          result.cases++;
          matrixCases++;
          result.minHits = Math.min(result.minHits, run.caster.hits);
          result.maxHits = Math.max(result.maxHits, run.caster.hits);
          result.minHp = Math.min(result.minHp, run.target.hp);
        }
      summaries.push(result);
    }
  });
}

test("motorcycle clashes with every opponent's special remain bounded and replay identically on all stages", () => {
  for (const stage of STAGES)
    for (const rival of FIGHTERS)
      for (const side of [0, 1] as const) {
        const run = scene(stage.id, rival.id, side);
        const replay = structuredClone(run.state);
        run.inputs[side].actions.special++;
        run.inputs[1 - side].actions.special++;
        const motorcycles = new Set<number>();
        const label = `${stage.id}/${rival.id}/P${side + 1}/special-clash`;
        for (let frame = 0; frame < 220; frame++) {
          run.advance(1);
          stepMatch(replay, run.inputs);
          finite(run.state, label);
          for (const shot of run.state.projectiles)
            if (shot.kind === "courier") motorcycles.add(shot.id);
        }
        assert.deepEqual(run.state, replay, label + " deterministic replay");
        assert.ok(
          motorcycles.size <= (rival.id === "zavarce" ? 14 : 7),
          label + " bounded summons",
        );
        if (run.state.phase === "playing")
          assert.ok(
            run.state.projectiles.every((shot) => shot.kind !== "courier"),
            label + " pack cleanup",
          );
        clashCases++;
      }
});

test("Yummy pack launches from every fixed and moving platform at four motion phases", () => {
  for (const stage of STAGES)
    for (const [index, definition] of stage.platforms.entries()) {
      const phases = definition.motion
        ? [0, 0.25, 0.5, 0.75].map((f) =>
            Math.floor(f * definition.motion!.period),
          )
        : [0];
      for (const tick of phases)
        for (const side of [0, 1] as const) {
          const run = scene(stage.id, "vallenilla", side);
          run.state.tick = tick;
          const platform = platformsAtTick(stage.id, tick)[index];
          Object.assign(run.caster, {
            x: platform.x + platform.width / 2,
            y: platform.y,
            grounded: true,
            supportPlatform: index,
          });
          run.target.invincible = 300;
          run.target.x =
            run.caster.x < 540
              ? Math.min(1010, run.caster.x + 300)
              : Math.max(70, run.caster.x - 300);
          run.caster.facing = Math.sign(run.target.x - run.caster.x);
          run.inputs[side].actions.special++;
          run.advance(12);
          const label = `${stage.id}/platform-${index}/phase-${tick}/P${side + 1}`;
          assert.equal(run.state.projectiles.length, 7, label);
          assert.equal(run.caster.supportPlatform, index, label);
          assert.equal(
            run.caster.y,
            platformsAtTick(stage.id, run.state.tick)[index].y,
            label,
          );
          for (const shot of run.state.projectiles)
            assert.equal(shot.y, run.caster.y - 42, label + " launch height");
          run.advance(140);
          assert.equal(run.state.projectiles.length, 0, label + " cleanup");
          finite(run.state, label);
          platformCases++;
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
      platformCases++;
    }
});

test("Dudamel reflects real motorcycle formations with their identity and spacing intact", () => {
  for (const stage of STAGES)
    for (const side of [0, 1] as const) {
      const run = scene(stage.id, "dudamel", side, 260);
      run.inputs[side].actions.special++;
      run.inputs[1 - side].actions.special++;
      const reflected = new Set<number>();
      for (let frame = 0; frame < 160; frame++) {
        run.advance(1);
        for (const shot of run.state.projectiles)
          if (shot.kind === "courier" && shot.owner !== side) {
            reflected.add(shot.id);
            assert.equal(Math.sign(shot.vx), side === 0 ? -1 : 1);
            assert.ok(Number.isInteger(shot.formationIndex));
            assert.equal(shot.groundOnly, true);
          }
      }
      assert.ok(reflected.size > 0, stage.id + " reflection");
      assert.ok(run.caster.hp < 100, stage.id + " returned bikes hit Vicente");
      assert.equal(run.state.projectiles.length, 0);
      finite(run.state, stage.id);
      interactionCases++;
    }
});

test("front-facing reflection of newly spawned bikes is independent of player order", () => {
  for (const gap of [80, 120, 180]) {
    const outcomes = [];
    for (const side of [0, 1] as const) {
      const run = scene("poliedro", "dudamel", side, gap);
      run.inputs[side].actions.special++;
      run.inputs[1 - side].actions.special++;
      run.advance(12);
      outcomes.push({
        reflected: run.state.projectiles.filter((shot) => shot.owner !== side)
          .length,
        defenderHp: run.target.hp,
      });
    }
    assert.ok(
      outcomes[0].reflected > 0,
      `gap ${gap}: the conducting window is active`,
    );
    assert.deepEqual(
      outcomes[0],
      outcomes[1],
      `gap ${gap}: either player must reflect the newly spawned motorcycles`,
    );
    interactionCases += 2;
  }
});

test("Amanda counters an incoming motorcycle on either side", () => {
  for (const side of [0, 1] as const) {
    const run = scene("poliedro", "amanda", side, 180);
    run.inputs[side].actions.special++;
    run.inputs[1 - side].actions.special++;
    run.advance(12);
    assert.equal(run.target.countered, true);
    assert.ok(run.caster.hp < 100);
    assert.ok(run.target.hits > 0);
    assert.ok(run.caster.hits < 7);
    run.advance(88);
    finite(run.state, "Amanda counter");
    interactionCases++;
  }
});

test("low energy rejects summons and a hit during startup cancels the pack", () => {
  for (const stage of STAGES)
    for (const side of [0, 1] as const) {
      const depleted = scene(stage.id, "gomez", side);
      depleted.caster.energy = 24;
      depleted.inputs[side].actions.special++;
      depleted.advance(40);
      assert.equal(depleted.state.projectiles.length, 0);
      assert.equal(depleted.caster.hits, 0);
      assert.equal(depleted.caster.attack, null);
      const interrupted = scene(stage.id, "vallenilla", side, 80);
      interrupted.inputs[side].actions.special++;
      interrupted.inputs[1 - side].actions.light++;
      interrupted.advance(30);
      assert.ok(interrupted.caster.hp < 100);
      assert.equal(interrupted.state.projectiles.length, 0);
      assert.equal(interrupted.caster.hits, 0);
      interactionCases += 2;
    }
});

test("the pack resolves final-stock knockouts and edge ringouts on both sides", () => {
  for (const side of [0, 1] as const)
    for (const kind of ["knockout", "ringout"] as const) {
      const run = scene("poliedro", "tiotigre", side, 300);
      run.target.stocks = 1;
      if (kind === "knockout") run.target.hp = 2;
      else {
        run.caster.x = side === 0 ? 700 : 380;
        run.target.x = side === 0 ? 1000 : 80;
      }
      run.inputs[side].actions.special++;
      run.advance(240);
      assert.equal(run.state.phase, "finished", `${kind}/P${side + 1}`);
      assert.equal(run.state.winner, side);
      assert.equal(run.target.stocks, 0);
      finite(run.state, kind);
      interactionCases++;
    }
});

test("matchup replays remain identical across JSON network round trips on every stage", () => {
  for (const stage of STAGES)
    for (const rival of ["vallenilla", "silbon", "dudamel"] as const)
      for (const side of [0, 1] as const) {
        const run = scene(stage.id, rival, side);
        let remote: MatchState = JSON.parse(JSON.stringify(run.state));
        run.inputs[side].actions.special++;
        for (let frame = 0; frame < 150; frame++) {
          run.advance(1);
          stepMatch(remote, run.inputs);
          remote = JSON.parse(JSON.stringify(remote));
          assert.deepEqual(
            JSON.parse(JSON.stringify(run.state)),
            remote,
            `${stage.id}/${rival}/P${side + 1}/frame-${frame}`,
          );
        }
        interactionCases++;
      }
});

after(() => {
  const report = {
    ability: "Entrega exprés / seven-motorcycle pack",
    fighters: FIGHTERS.map((f) => ({ id: f.id, name: f.name })),
    stages: STAGES.map((s) => ({ id: s.id, name: s.name })),
    defenses,
    counts: {
      matrixCases,
      clashCases,
      platformCases,
      interactionCases,
      total: matrixCases + clashCases + platformCases + interactionCases,
    },
    summaries,
  };
  if (process.env.COURIER_QA_REPORT)
    writeFileSync(
      process.env.COURIER_QA_REPORT,
      JSON.stringify(report, null, 2) + "\n",
    );
  console.log(
    `Courier coverage: ${matrixCases} matchup cases, ${clashCases} special clashes, ${platformCases} platform cases, ${interactionCases} interaction cases.`,
  );
});
