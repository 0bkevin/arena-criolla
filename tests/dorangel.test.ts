import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import {
  createMatch,
  emptyInput,
  stepMatch,
  WORLD,
  type Input,
} from "./helpers/charged-finale-engine";
import {
  fighterById,
  STAGES,
  platformsAtTick,
  type FighterId,
  type StageId,
} from "../shared/content";
import {
  DORANGEL_BITE,
  DORANGEL_FINALE,
  DORANGEL_POT,
  dorangelPot,
  dorangelPotIsHot,
} from "../shared/dorangel";
import { TECHNIQUES } from "../shared/techniques";
import entrances from "../shared/entrance-assets.json";
import actors from "../shared/finale-actor-assets.json";
import dancers from "../shared/perro-mujeriego-assets.json";
import { ATTACK_ART } from "../src/game/attack-art";

test("Dorángel ships every native pose and prop in bounded transparent lossless atlases", async () => {
  assert.equal(fighterById("dorangel").displayHeight, 177);
  assert.equal(entrances.dorangel.frames.length, 6);
  assert.equal(actors.seated.dorangel.frames.length, 4);
  assert.equal(dancers.dancers.dorangel.frames.length, 8);
  const art = ATTACK_ART.dorangel;
  for (const pose of [
    "pot",
    "hearth",
    "flame",
    "steam",
    "cook-finish",
    "cook-carry",
    "cook-lower",
    "cook-place",
    "cook-light-a",
    "cook-light-b",
    "cook-stir-a",
    "cook-stir-b",
    "bite-ready",
    "bite-reach",
    "bite-close",
    "bite-release",
  ])
    assert.ok(art.frames[pose]);
  const atlases = [
    { file: fighterById("dorangel").sprite, frames: [] },
    { file: entrances.dorangel.file, frames: entrances.dorangel.frames },
    {
      file: actors.seated.dorangel.file,
      frames: actors.seated.dorangel.frames,
    },
    {
      file: dancers.dancers.dorangel.file,
      frames: dancers.dancers.dorangel.frames,
    },
    { file: art.file, frames: Object.values(art.frames) },
  ];
  assert.equal(new Set(atlases.map((a) => a.file)).size, 5);
  for (const atlas of atlases) {
    const bytes = await readFile(`public/assets/${atlas.file}.webp`);
    assert.equal(bytes.toString("ascii", 12, 16), "VP8L");
    const meta = await sharp(bytes).metadata();
    assert.ok(meta.hasAlpha && meta.width! <= 2048 && meta.height! <= 2048);
    for (const frame of atlas.frames) {
      assert.ok(
        frame.x >= 0 &&
          frame.y >= 0 &&
          frame.x + frame.width <= meta.width! &&
          frame.y + frame.height <= meta.height!,
      );
      const alpha = await sharp(bytes)
        .extract({
          left: frame.x,
          top: frame.y,
          width: frame.width,
          height: frame.height,
        })
        .extractChannel(3)
        .stats();
      assert.ok(alpha.channels[0].max >= 200 && alpha.channels[0].min === 0);
    }
  }
});

function setup(
  side: 0 | 1 = 0,
  gap = 75,
  stage: StageId = "caracas",
  rival: FighterId = "capriles",
) {
  const actor = { name: "Dorángel", fighter: "dorangel" as const, wins: 3 },
    opponent = { name: "Rival", fighter: rival, wins: 3 },
    state = createMatch(stage, side ? [opponent, actor] : [actor, opponent]);
  state.phase = "playing";
  const player = state.players[side],
    target = state.players[1 - side];
  player.x = side ? 720 : 360;
  player.facing = side ? -1 : 1;
  target.x = player.x + player.facing * gap;
  target.facing = -player.facing;
  for (const p of state.players) {
    p.energy = 100;
    p.invincible = 0;
    p.stocks = 5;
  }
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (n = 1) => {
    for (let i = 0; i < n; i++) stepMatch(state, inputs);
  };
  const at = (tick: number) => {
    for (
      let wait = 0;
      wait < 300 && (state.fieldFinales?.[0]?.tick ?? -1) < tick;
      wait++
    )
      advance();
    assert.equal(state.fieldFinales?.[0]?.tick, tick);
  };
  return { state, player, target, inputs, advance, at };
}

test("Dorángel's arm bite connects twice locally and never grabs through guard or spawn protection", () => {
  for (const side of [0, 1] as const)
    for (const defense of ["none", "guard", "immune"] as const) {
      const r = setup(side);
      r.inputs[1 - side].block = defense === "guard";
      if (defense === "immune") r.target.invincible = 100;
      r.inputs[side].actions.special++;
      r.advance(15);
      assert.equal(r.target.hp, 100);
      r.advance();
      const firstHp = r.target.hp;
      if (defense === "none") {
        assert.ok(firstHp < 100);
        assert.equal(r.target.rootKind, "bite");
        assert.ok(r.target.grounded);
        assert.equal(r.target.vx, 0);
        assert.equal(r.target.vy, 0);
      } else {
        assert.equal(firstHp, 100);
        assert.equal(r.target.rootKind, undefined);
      }
      r.advance(65);
      assert.equal(r.player.hits, defense === "none" ? 2 : 0);
      assert.equal(r.target.rootTicks, 0);
      assert.equal(r.target.rootKind, undefined);
      assert.ok(r.target.hp >= 80, "a special remains a modest two-hit attack");
    }
});

test("the bite walks toward the arm before contact, stops short and grants no invulnerability", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 120);
    const start = r.player.x,
      rivalStart = r.target.x;
    r.inputs[side].actions.special++;
    r.advance(DORANGEL_BITE.approachStart - 1);
    assert.equal(r.player.x, start);
    let previous = start;
    for (
      let tick = DORANGEL_BITE.approachStart;
      tick < DORANGEL_BITE.approachEnd;
      tick++
    ) {
      r.advance();
      const step = (r.player.x - previous) * r.player.facing;
      assert.ok(step > 0 && step <= DORANGEL_BITE.stepSpeed);
      assert.equal(r.target.hp, 100, "opening the jaw does not deal damage");
      assert.equal(r.target.x, rivalStart, "the victim is never pulled closer");
      assert.equal(r.player.invincible, 0);
      previous = r.player.x;
    }
    const end = r.player.x;
    r.advance();
    assert.equal(r.player.x, end, "the approach ends before the contact tick");
    r.advance(TECHNIQUES.bite.startup - r.player.attackTick);
    assert.equal(r.target.rootKind, "bite");
    assert.ok(r.target.hp < 100);
    assert.equal(
      r.player.x,
      end,
      "the grip does not drag the attacker through its victim",
    );

    const close = setup(side, DORANGEL_BITE.gap + 5);
    close.inputs[side].actions.special++;
    close.advance(TECHNIQUES.bite.startup);
    assert.equal(Math.abs(close.player.x - close.target.x), DORANGEL_BITE.gap);

    const interrupted = setup(side, 120);
    interrupted.inputs[side].actions.special++;
    interrupted.advance(4);
    interrupted.inputs[1 - side].actions.light++;
    interrupted.advance(11);
    assert.ok(
      interrupted.player.hp < 100,
      "a punch can interrupt the vulnerable approach",
    );
    assert.equal(interrupted.target.hp, 100);
    assert.equal(interrupted.target.rootKind, undefined);
  }
});

test("a jump, an out-of-range target and interruption break the bite without pulling either fighter", () => {
  for (const side of [0, 1] as const) {
    const far = setup(side, 150);
    far.inputs[side].actions.special++;
    far.advance(80);
    assert.equal(far.target.hp, 100);
    for (const escape of ["jump", "interrupt"] as const) {
      const r = setup(side);
      r.inputs[side].actions.special++;
      r.advance(16);
      assert.equal(r.target.rootKind, "bite");
      const x = r.target.x;
      if (escape === "interrupt") {
        r.player.stun = 12;
        r.player.attack = null;
        r.advance(r.state.hitstop + 1);
      } else {
        for (
          let wait = 0;
          wait < 30 && (r.target.stun || r.state.hitstop);
          wait++
        )
          r.advance();
        assert.ok(r.target.rootTicks > 0);
        r.inputs[1 - side].actions.jump++;
        r.advance();
        assert.ok(!r.target.grounded);
      }
      assert.equal(r.target.rootTicks, 0);
      assert.equal(r.target.rootKind, undefined);
      assert.ok(
        Math.abs(r.target.x - x) < 2,
        "no forced teleport or finishing throw",
      );
    }
  }
});

test("Dorángel's pot affects a rival at minimum fighting distance on either side", () => {
  for (const side of [0, 1] as const)
    for (const gap of [43, 50]) {
      const r = setup(side, gap);
      const start = { player: r.player.x, target: r.target.x };
      r.inputs[side].actions.super++;
      for (const cue of DORANGEL_FINALE.cues) {
        const hp = r.target.hp;
        r.at(cue);
        assert.ok(
          r.target.hp < hp,
          `close-range ultimate misses on side ${side}`,
        );
        assert.equal(r.target.rootKind, "pot");
      }
      assert.equal(r.player.hits, 4);
      assert.equal(r.player.x, start.player);
      assert.equal(r.target.x, start.target);
      assert.equal(
        dorangelPot(r.state.fieldFinales![0])!.height,
        DORANGEL_POT.height,
      );
      assert.equal(r.state.finale, undefined);
    }
});

test("a close-range pot locks its placement before lowering and cannot retarget an escaping rival", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 43);
    r.inputs[side].actions.super++;
    r.at(DORANGEL_POT.spawnTick);
    r.target.x = r.player.x + r.player.facing * 145;
    r.at(DORANGEL_POT.placeTick);
    const pot = dorangelPot(r.state.fieldFinales![0])!;
    const placedX = pot.x;
    r.at(DORANGEL_FINALE.cues[0]);
    assert.equal(pot.x, placedX);
    assert.equal(r.target.hp, 100);
    assert.equal(r.target.rootKind, undefined);
  }
});

test("the pot telegraphs before four physical heat contacts and never applies passive helper damage", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, DORANGEL_POT.offset);
    r.inputs[side].actions.super++;
    r.advance(9);
    const field = r.state.fieldFinales![0];
    assert.ok(!r.state.effects.some((effect) => effect.kind === "special"));
    assert.equal(r.state.finale, undefined);
    r.at(DORANGEL_POT.spawnTick);
    assert.ok(dorangelPot(field));
    assert.equal(r.target.hp, 100);
    let previous = r.target.hp;
    for (const tick of DORANGEL_FINALE.cues) {
      r.at(tick - 1);
      assert.equal(
        r.target.hp,
        previous,
        "the pot body cannot attack between heat cues",
      );
      r.at(tick);
      assert.ok(r.target.hp < previous);
      assert.equal(r.target.rootKind, "pot");
      assert.ok(r.target.grounded);
      assert.equal(r.target.y, WORLD.floor);
      assert.equal(r.target.vx, 0);
      assert.equal(
        r.state.effects.filter((effect) => effect.kind === "hit").at(-1)
          ?.visual,
        "heat",
      );
      previous = r.target.hp;
    }
    assert.equal(r.player.hits, 4);
    const expected =
      100 - field.damage * fighterById(r.target.config.fighter).armor;
    assert.ok(Math.abs(r.target.hp - expected) < 1e-8);
    r.advance(200);
    assert.equal(r.state.fieldFinales, undefined);
    assert.equal(r.target.rootTicks, 0);
    assert.ok(r.state.tick > 154);
  }
});

test("Dorángel carries a cold pot into place before lighting it, without moving the rival", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, DORANGEL_POT.offset);
    const rivalX = r.target.x,
      rivalY = r.target.y;
    r.inputs[side].actions.super++;
    r.advance(9);
    const field = r.state.fieldFinales![0];
    r.at(DORANGEL_POT.spawnTick);
    const pot = dorangelPot(field)!;
    assert.equal(field.tick, DORANGEL_POT.spawnTick);
    assert.equal(
      pot.x,
      r.player.x + r.player.facing * DORANGEL_POT.carryOffset,
    );
    assert.equal(pot.y, r.player.y - DORANGEL_POT.carryLift);
    let previousX = pot.x,
      previousY = pot.y;
    while (field.tick < DORANGEL_POT.placeTick) {
      r.advance();
      assert.ok((pot.x - previousX) * r.player.facing >= 0);
      assert.ok(
        Math.abs(pot.x - previousX) < 5,
        "the pot is lowered, never teleported",
      );
      assert.ok(pot.y >= previousY);
      assert.equal(r.target.hp, 100);
      assert.equal(r.target.rootKind, undefined);
      assert.equal(r.target.x, rivalX);
      assert.equal(r.target.y, rivalY);
      assert.equal(dorangelPotIsHot(field), false);
      previousX = pot.x;
      previousY = pot.y;
    }
    assert.equal(pot.x, r.player.x + r.player.facing * DORANGEL_POT.offset);
    assert.equal(pot.y, WORLD.floor);
    r.at(DORANGEL_POT.fireTick);
    assert.equal(r.target.hp, 100, "striking the match is still a warning");
    assert.equal(dorangelPotIsHot(field), false);
    r.at(DORANGEL_POT.stirTick);
    assert.equal(dorangelPotIsHot(field), true);
    assert.equal(r.target.hp, 100);
    r.at(DORANGEL_FINALE.cues[0]);
    assert.ok(r.target.hp < 100);
  }
});

test("the pot can be jumped, blocked, missed and interrupted; it never follows a fleeing opponent", () => {
  for (const side of [0, 1] as const)
    for (const gap of [43, DORANGEL_POT.offset])
      for (const defense of [
        "jump",
        "guard",
        "flee",
        "interrupt",
        "immune",
      ] as const) {
        const r = setup(side, gap);
        r.inputs[side].actions.super++;
        r.advance(9);
        r.at(DORANGEL_FINALE.cues[0] - 1);
        const pot = dorangelPot(r.state.fieldFinales![0])!;
        const potX = pot.x;
        if (defense === "jump") r.inputs[1 - side].actions.jump++;
        if (defense === "guard") r.inputs[1 - side].block = true;
        if (defense === "flee") r.target.x = r.player.x - r.player.facing * 120;
        if (defense === "interrupt") {
          r.player.stun = 15;
          r.player.attack = null;
        }
        if (defense === "immune") r.target.invincible = 100;
        r.advance();
        assert.equal(r.target.hp, 100);
        assert.equal(r.target.rootTicks, 0);
        assert.equal(pot.x, potX);
      }
});

test("a fresh jump escapes the hot pot after ordinary hit recovery", () => {
  for (const side of [0, 1] as const)
    for (const gap of [43, DORANGEL_POT.offset]) {
      const r = setup(side, gap);
      r.inputs[side].actions.super++;
      r.advance(9);
      r.at(DORANGEL_FINALE.cues[0]);
      for (
        let wait = 0;
        wait < 30 && (r.target.stun || r.state.hitstop);
        wait++
      )
        r.advance();
      assert.equal(r.target.rootKind, "pot");
      assert.ok(r.target.rootTicks > 0);
      r.inputs[1 - side].actions.jump++;
      r.advance();
      assert.equal(r.target.rootTicks, 0);
      assert.ok(!r.target.grounded);
      const hp = r.target.hp;
      r.at(DORANGEL_FINALE.cues[1]);
      assert.equal(
        r.target.hp,
        hp,
        "an airborne escape avoids the next heat pulse",
      );
    }
});

test("the grounded pot follows the same moving surface as its caster and held opponent", () => {
  const stage = STAGES.find((s) =>
    s.platforms.some((p) => p.motion && p.width >= 145),
  )!;
  assert.ok(stage);
  const index = stage.platforms.findIndex((p) => p.motion && p.width >= 145);
  for (const side of [0, 1] as const)
    for (const gap of [43, DORANGEL_POT.offset]) {
      const r = setup(side, gap, stage.id);
      const surface = platformsAtTick(stage.id, r.state.tick)[index];
      r.player.x = surface.x + surface.width / 2 - r.player.facing * 50;
      r.target.x = r.player.x + r.player.facing * gap;
      for (const p of r.state.players) {
        p.y = surface.y;
        p.grounded = true;
        p.supportPlatform = index;
      }
      r.inputs[side].actions.super++;
      r.advance(9);
      r.at(DORANGEL_FINALE.cues[0]);
      const pot = dorangelPot(r.state.fieldFinales![0])!;
      assert.equal(pot.supportPlatform, index);
      assert.equal(r.target.supportPlatform, index);
      assert.equal(r.target.rootKind, "pot");
      const initial = { x: pot.x, y: pot.y };
      r.advance(r.state.hitstop + 5);
      const current = platformsAtTick(stage.id, r.state.tick)[index];
      assert.equal(pot.y, current.y);
      assert.equal(r.target.y, current.y);
      assert.ok(pot.x !== initial.x || pot.y !== initial.y);
    }
});

test("bite and pot states replay identically through network serialization and clear on stock loss", () => {
  for (const action of ["special", "super"] as const)
    for (const gap of action === "super" ? [43, DORANGEL_POT.offset] : [75]) {
      const r = setup(0, gap);
      r.inputs[0].actions[action]++;
      r.advance(action === "super" ? 12 : TECHNIQUES.bite.startup);
      const copy = JSON.parse(JSON.stringify(r.state));
      for (let i = 0; i < 100; i++) {
        stepMatch(r.state, r.inputs);
        stepMatch(copy, r.inputs);
        assert.deepEqual(r.state, copy);
      }
      r.player.hp = 0;
      r.advance(r.state.hitstop + 2);
      assert.equal(r.target.rootTicks, 0);
      assert.ok(!r.state.fieldFinales?.some((f) => f.owner === 0));
    }
});
