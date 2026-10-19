import test from "node:test";
import assert from "node:assert/strict";
import { fighterById, platformsAtTick } from "../shared/content";
import { TECHNIQUES } from "../shared/techniques";
import {
  createMatch,
  cpuInput,
  emptyInput,
  stepMatch,
  type Input,
} from "../shared/engine";
import {
  INTRO_TOTAL_TICKS,
  normalizedFacing,
  presentationById,
  selectionProgress,
  samplePose,
} from "../shared/presentation";
import { CHOREOGRAPHIES } from "../shared/choreography";

function setup(
  side: 0 | 1 = 0,
  gap = 280,
  wins = 3,
  stage = "poliedro" as const,
) {
  const melanio = { name: "Audit Melanio", fighter: "melanio" as const, wins };
  const rival = { name: "Audit rival", fighter: "javier" as const, wins: 3 };
  const configs: [
    typeof melanio | typeof rival,
    typeof melanio | typeof rival,
  ] = side === 0 ? [melanio, rival] : [rival, melanio];
  const state = createMatch(stage, configs, "melanio-v44-audit");
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (frames: number) => {
    for (let n = 0; n < frames; n++) stepMatch(state, inputs);
  };
  advance(INTRO_TOTAL_TICKS);
  const player = state.players[side],
    opponent = state.players[1 - side];
  player.x = side === 0 ? 200 : 880;
  opponent.x = player.x + (side === 0 ? gap : -gap);
  player.facing = side === 0 ? 1 : -1;
  opponent.facing = -player.facing;
  player.energy = 100;
  opponent.energy = 100;
  return { state, inputs, player, opponent, advance, side };
}

test("Melanio identity, signal tuning, one-shot presentation and right-facing sprite metadata are registered", () => {
  const f = fighterById("melanio");
  assert.equal(f.name, "Melanio Escobar");
  assert.equal(f.sprite, "melanio-v44");
  assert.equal(f.ability, "signal");
  assert.equal(f.special, "Señal libre");
  assert.deepEqual(f.combos, [
    "Micrófono abierto",
    "Frecuencia punk",
    "Red en marcha",
  ]);
  assert.deepEqual(TECHNIQUES.signal.projectile, {
    speed: 7,
    life: 58,
    returnAfter: 24,
    wave: { amplitude: 8, period: 30 },
    radius: 10,
  });
  assert.equal(TECHNIQUES.signal.startup, 21);
  assert.equal(
    presentationById("melanio").introName,
    "Asiente y abre la señal",
  );
  assert.equal(CHOREOGRAPHIES.melanio.name, "Asiente y abre la señal");
  assert.equal(selectionProgress("melanio", 2800), 1);
  assert.deepEqual(
    samplePose(presentationById("melanio").selectionBeats, 1),
    samplePose(presentationById("melanio").selectionBeats, 2),
  );
  for (let frame = 0; frame < 8; frame++)
    for (const facing of [1, -1])
      assert.equal(normalizedFacing("melanio", frame, facing), facing);
});

test("Señal libre pays energy, leaves a startup punish window, returns and expires on both sides", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 280);
    const initialX = r.player.x;
    r.inputs[side].actions.special++;
    r.advance(1);
    assert.equal(r.player.energy, 75);
    assert.equal(r.player.attack, "special");
    assert.equal(r.state.projectiles.length, 0, "startup delays the packet");
    const shots = new Map<
      number,
      {
        age: number;
        x: number;
        vx: number;
        life: number;
        kind: string;
        returnAfter?: number;
        wave?: { amplitude: number; period: number };
      }
    >();
    let outbound = false,
      returned = false;
    for (let n = 0; n < 90; n++) {
      r.advance(1);
      for (const shot of r.state.projectiles) {
        if ((shot.age ?? 0) < (shot.returnAfter ?? Infinity))
          outbound ||= Math.sign(shot.vx) === (side === 0 ? 1 : -1);
        else returned ||= Math.sign(shot.vx) === (side === 0 ? -1 : 1);
      }
      for (const shot of r.state.projectiles)
        if (!shots.has(shot.id))
          shots.set(shot.id, {
            age: shot.age ?? 0,
            x: shot.x,
            vx: shot.vx,
            life: shot.life,
            kind: shot.kind,
            returnAfter: shot.returnAfter,
            wave: shot.wave,
          });
    }
    assert.equal(shots.size, 1);
    assert.ok(
      outbound && returned,
      "the same packet really reverses velocity before expiry",
    );
    const packet = [...shots.values()][0];
    assert.equal(packet.kind, "signal");
    assert.equal(packet.vx, side === 0 ? 7 : -7);
    assert.equal(packet.returnAfter, 24);
    assert.deepEqual(packet.wave, { amplitude: 8, period: 30 });
    assert.equal(r.player.x, initialX);
    assert.equal(
      r.state.projectiles.length,
      0,
      "the returning packet has a finite lifetime",
    );
  }
  const lowEnergy = setup();
  lowEnergy.player.energy = 24;
  lowEnergy.inputs[0].actions.special++;
  lowEnergy.advance(1);
  assert.equal(lowEnergy.player.attack, null);
  assert.ok(lowEnergy.player.energy >= 24 && lowEnergy.player.energy < 25);
  assert.equal(lowEnergy.state.projectiles.length, 0);
});

test("a facing guard blocks the signal packet and a close heavy hit interrupts startup", () => {
  for (const side of [0, 1] as const) {
    const guarded = setup(side, 200);
    guarded.inputs[1 - side].block = true;
    guarded.inputs[side].actions.special++;
    let sawBlock = false;
    for (let n = 0; n < 90; n++) {
      guarded.advance(1);
      sawBlock ||= guarded.state.effects.some(
        (effect) => effect.kind === "block" && effect.owner === side,
      );
    }
    assert.equal(guarded.opponent.hp, 100);
    assert.equal(guarded.player.hits, 0);
    assert.ok(sawBlock);
    assert.equal(guarded.state.projectiles.length, 0);

    const interrupted = setup(side, 80);
    interrupted.inputs[side].actions.special++;
    interrupted.advance(1);
    interrupted.inputs[1 - side].actions.heavy++;
    interrupted.advance(18);
    assert.equal(interrupted.player.attack, null);
    assert.equal(interrupted.player.stun > 0, true);
    assert.equal(interrupted.state.projectiles.length, 0);
  }
});

test("all three named combos and the super gate follow shared engine rules", () => {
  for (const side of [0, 1] as const) {
    for (const [wins, actions, expected, bonus] of [
      [0, ["light", "heavy"], "Micrófono abierto", 3],
      [1, ["light", "light", "heavy"], "Frecuencia punk", 7],
    ] as const) {
      const r = setup(side, 80, wins);
      for (const action of actions) {
        r.inputs[side].actions[action]++;
        r.advance(action === "light" ? 26 : 36);
      }
      assert.equal(r.player.combo, expected);
      assert.equal(r.player.comboBonus, bonus);
    }
    const noSuper = setup(side, 80, 0);
    noSuper.inputs[side].actions["super"]++;
    noSuper.advance(1);
    assert.equal(noSuper.player.attack, null);
    const gatedSuper = setup(side, 80, 3);
    gatedSuper.inputs[side].actions["super"]++;
    gatedSuper.advance(1);
    assert.equal(gatedSuper.player.attack, "super");
    assert.equal(gatedSuper.player.combo, "Red en marcha");
  }
});

test("Melanio CPU signal remains deterministic on the moving Roques stage", () => {
  assert.notDeepEqual(
    platformsAtTick("roques", 0),
    platformsAtTick("roques", 75),
  );
  function run() {
    const state = createMatch(
      "roques",
      [
        { name: "Audit rival", fighter: "javier", wins: 3 },
        { name: "CPU Melanio", fighter: "melanio", wins: 3 },
      ],
      "melanio-moving-cpu-v44",
    );
    const inputs: [Input, Input] = [emptyInput(), emptyInput()];
    for (let n = 0; n < INTRO_TOTAL_TICKS; n++) stepMatch(state, inputs);
    state.tick = 400;
    state.players[0].x = 430;
    state.players[1].x = 630;
    state.players[0].vx = state.players[1].vx = 0;
    let signalEmissions = 0;
    for (let n = 0; n < 300; n++) {
      inputs[1] = cpuInput(state, inputs[1], "normal");
      stepMatch(state, inputs);
      signalEmissions += state.projectiles.filter(
        (projectile) => projectile.kind === "signal",
      ).length;
      assert.ok(
        state.players.every(
          (p) =>
            Number.isFinite(p.x) &&
            Number.isFinite(p.y) &&
            Number.isFinite(p.energy),
        ),
      );
      assert.ok(
        state.projectiles.every(
          (p) => Number.isFinite(p.x) && Number.isFinite(p.y) && p.life > 0,
        ),
      );
    }
    return {
      players: state.players.map((p) => ({
        x: p.x,
        y: p.y,
        hp: p.hp,
        energy: p.energy,
        hits: p.hits,
        combo: p.combo,
      })),
      projectiles: state.projectiles,
      packetsEmitted: state.nextId,
      signalEmissions,
    };
  }
  const first = run();
  assert.ok(
    first.signalEmissions > 0,
    "CPU uses Melanio's special during the fight",
  );
  assert.deepEqual(first, run());
});
