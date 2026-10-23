import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import sharp from "sharp";
import {
  BUILT_IN_FIGHTERS,
  SUPER_CHARGE_TICKS,
  fighterById,
  type FighterId,
} from "../shared/content";
import {
  createMatch,
  emptyInput,
  stepMatch,
  WORLD,
  type Input,
} from "../shared/engine";
import { finaleById } from "../shared/finales";
import { INAKI_CASH, INAKI_FINALE } from "../shared/inaki";
import { TECHNIQUES } from "../shared/techniques";
import entrances from "../shared/entrance-assets.json";
import actors from "../shared/finale-actor-assets.json";
import dancers from "../shared/perro-mujeriego-assets.json";
import geometry from "../shared/sprite-geometry.json";
import { ATTACK_ART } from "../src/game/attack-art";
import { INAKI_BODY_POSES, INAKI_PROP_POSES } from "../src/game/finales/inaki";

function setup(side: 0 | 1 = 0, gap = 220, rival: FighterId = "capriles") {
  const a = { name: "Iñaki", fighter: "inaki" as const, wins: 0 },
    b = { name: "Rival", fighter: rival, wins: 0 },
    state = createMatch("caracas", side ? [b, a] : [a, b]);
  state.phase = "playing";
  const player = state.players[side],
    target = state.players[1 - side];
  player.x = side ? 740 : 360;
  player.facing = side ? -1 : 1;
  target.x = player.x + player.facing * gap;
  target.facing = -player.facing;
  for (const p of state.players) {
    p.energy = 100;
    p.invincible = 0;
    p.stocks = 5;
  }
  const inputs: [Input, Input] = [emptyInput(), emptyInput()];
  const advance = (ticks = 1) => {
    for (let i = 0; i < ticks; i++) stepMatch(state, inputs);
  };
  const charge = () => {
    inputs[side].superHeld = true;
    inputs[side].actions.super++;
    advance(SUPER_CHARGE_TICKS);
  };
  const at = (tick: number) => {
    for (
      let i = 0;
      i < 300 && (state.fieldFinales?.[0]?.tick ?? -1) < tick;
      i++
    )
      advance();
    assert.equal(state.fieldFinales?.[0]?.tick, tick);
  };
  return { state, player, target, inputs, advance, charge, at };
}

test("Iñaki has a complete native inventory in transparent lossless atlases within the existing texture budget", async () => {
  assert.equal(fighterById("inaki").displayHeight, 177);
  assert.equal(fighterById("inaki").category, "founders");
  assert.equal(entrances.inaki.frames.length, 6);
  assert.equal(actors.seated.inaki.frames.length, 4);
  assert.equal(dancers.dancers.inaki.frames.length, 8);
  for (const pose of [...INAKI_BODY_POSES, ...INAKI_PROP_POSES])
    assert.ok(ATTACK_ART.inaki.frames[pose], pose);
  const atlases = [
    {
      file: fighterById("inaki").sprite,
      frames: geometry.sprites
        .find((sprite) => sprite.id === "inaki")!
        .files[0].components.map((bounds) => ({
          x: bounds.minX - 4,
          y: bounds.minY - 4,
          width: bounds.maxX - bounds.minX + 9,
          height: bounds.maxY - bounds.minY + 9,
        })),
    },
    { file: entrances.inaki.file, frames: entrances.inaki.frames },
    { file: actors.seated.inaki.file, frames: actors.seated.inaki.frames },
    { file: dancers.dancers.inaki.file, frames: dancers.dancers.inaki.frames },
    {
      file: ATTACK_ART.inaki.file,
      frames: Object.values(ATTACK_ART.inaki.frames),
    },
  ];
  assert.equal(new Set(atlases.map((a) => a.file)).size, 5);
  for (const atlas of atlases) {
    const bytes = await readFile(`public/assets/${atlas.file}.webp`),
      meta = await sharp(bytes).metadata();
    assert.equal(bytes.toString("ascii", 12, 16), "VP8L");
    assert.ok(meta.hasAlpha && meta.width! <= 2048 && meta.height! <= 2048);
    for (const f of atlas.frames) {
      assert.ok(
        f.x >= 0 &&
          f.y >= 0 &&
          f.x + f.width <= meta.width! &&
          f.y + f.height <= meta.height!,
      );
      const alpha = await sharp(bytes)
        .extract({ left: f.x, top: f.y, width: f.width, height: f.height })
        .extractChannel(3)
        .stats();
      assert.ok(alpha.channels[0].max >= 200 && alpha.channels[0].min === 0);
      const rgba = await sharp(bytes)
        .ensureAlpha()
        .extract({ left: f.x, top: f.y, width: f.width, height: f.height })
        .raw()
        .toBuffer();
      for (let y = 0; y < f.height; y++)
        for (let x = 0; x < f.width; x++)
          if (x === 0 || y === 0 || x === f.width - 1 || y === f.height - 1)
            assert.equal(
              rgba[(y * f.width + x) * 4 + 3],
              0,
              `${atlas.file}: transparent gutter at ${x},${y}`,
            );
    }
  }
});

test("Iñaki's special travels to its target and connects at body-contact distance on either side", () => {
  for (const side of [0, 1] as const)
    for (const gap of [43, 220])
      for (const guard of [false, true]) {
        const r = setup(side, gap);
        r.inputs[1 - side].block = guard;
        r.inputs[side].actions.special++;
        r.advance(TECHNIQUES.banknotes.startup - 1);
        assert.equal(r.target.hp, 100);
        r.advance(90);
        assert.equal(r.player.hits, guard ? 0 : 1);
        assert.equal(r.target.hp < 100, !guard);
        assert.equal(r.state.projectiles.length, 0);
        assert.equal(r.state.finale, undefined);
      }
});

test("the banknote charge needs the real held input, remains vulnerable and does no preparation damage", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side);
    r.inputs[side].superHeld = true;
    r.inputs[side].actions.super++;
    r.advance(SUPER_CHARGE_TICKS - 1);
    assert.equal(r.player.superChargeTicks, SUPER_CHARGE_TICKS - 1);
    assert.equal(r.player.superUsed, false);
    assert.equal(r.player.energy, 100);
    assert.equal(r.target.hp, 100);
    assert.equal(r.state.projectiles.length, 0);
    r.advance();
    assert.equal(r.player.superUsed, true);
    assert.equal(r.player.energy, 10);
    r.at(INAKI_FINALE.cues[0] - 1);
    assert.equal(r.target.hp, 100);
    assert.equal(r.state.projectiles.length, 0);
    assert.equal(r.state.finale, undefined);

    const interrupted = setup(side, 90);
    interrupted.inputs[side].superHeld = true;
    interrupted.inputs[side].actions.super++;
    interrupted.advance(8);
    interrupted.inputs[1 - side].actions.light++;
    interrupted.advance(20);
    assert.ok(interrupted.player.hp < 100);
    assert.equal(interrupted.player.superChargeTicks, 0);
    assert.equal(interrupted.player.superUsed, false);
    assert.equal(interrupted.target.hp, 100);
  }
});

test("Iñaki's definitive emits five physical cash balls and interacts with every rival at close range from both sides", () => {
  assert.equal(finaleById("inaki")?.mode, "field");
  for (const rival of BUILT_IN_FIGHTERS)
    for (const side of [0, 1] as const) {
      const r = setup(side, 43, rival.id),
        sourceX = r.player.x;
      r.charge();
      r.at(0);
      const field = r.state.fieldFinales![0],
        damage = field.damage;
      r.advance(250);
      const context = `${rival.id}/${side}`;
      assert.equal(r.player.hits, 5, context);
      assert.ok(
        Math.abs(r.target.hp - (100 - damage * rival.armor)) < 1e-8,
        context,
      );
      assert.equal(r.player.x, sourceX, context);
      assert.equal(r.state.finale, undefined, context);
      assert.equal(r.state.fieldFinales, undefined, context);
      assert.equal(r.state.projectiles.length, 0, context);
    }
});

test("guarding, a timed double jump, fleeing and interruption can defeat the paper beam in ordinary combat", () => {
  for (const side of [0, 1] as const)
    for (const defense of ["guard", "jump", "flee", "interrupt"] as const) {
      const r = setup(side);
      r.charge();
      r.at(0);
      if (defense === "guard") r.inputs[1 - side].block = true;
      if (defense === "flee") r.target.x = r.player.x - r.player.facing * 160;
      if (defense === "interrupt") {
        r.player.stun = 14;
        r.player.attack = null;
      }
      if (defense === "jump") {
        r.at(8);
        r.inputs[1 - side].actions.jump++;
        r.at(26);
        r.inputs[1 - side].actions.jump++;
      }
      r.advance(170);
      assert.equal(r.target.hp, 100, `${side}/${defense}`);
      assert.equal(r.state.finale, undefined);
    }
});

test("Iñaki can move and punch shortly after releasing the burst while his cash keeps flying", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 520);
    r.charge();
    r.at(INAKI_FINALE.cues.at(-1)! + 8);
    assert.equal(r.player.attack, null, "casting pose has ended");
    assert.equal(r.player.cooldown, 0);
    const shot = r.state.projectiles.find((p) => p.owner === side)!;
    assert.ok(shot, "the released attack outlives the casting pose");
    const shotX = shot.x;
    const playerX = r.player.x;
    r.inputs[side][side ? "right" : "left"] = true;
    r.advance();
    assert.ok((r.player.x - playerX) * (side ? 1 : -1) > 0);
    assert.ok((shot.x - shotX) * shot.direction! > 0);
    r.inputs[side].actions.light++;
    r.advance();
    assert.equal(
      r.player.attack,
      "light",
      "punch does not wait for the cash to disappear",
    );
    assert.equal(r.state.finale, undefined);
  }
});

test("emitted cash balls use the authored physical dimensions and retain Rial artwork on reflection", () => {
  for (const side of [0, 1] as const) {
    const r = setup(side, 220, "carolina");
    r.charge();
    r.at(INAKI_FINALE.cues[0]);
    const shot = r.state.projectiles.find((p) => p.owner === side)!;
    assert.ok(shot);
    assert.equal(shot.radius, INAKI_CASH.radius);
    assert.equal(shot.finaleArt?.fighter, "inaki");
    const artwork = { ...shot.finaleArt };
    r.inputs[1 - side].actions.special++;
    r.advance(30);
    assert.equal(shot.owner, 1 - side);
    assert.deepEqual(shot.finaleArt, artwork);
  }
});

test("the paper burst replays exactly across network snapshots and preserves the fight's single use", () => {
  const r = setup();
  r.charge();
  r.at(20);
  const copy = JSON.parse(JSON.stringify(r.state));
  for (let i = 0; i < 180; i++) {
    stepMatch(r.state, r.inputs);
    stepMatch(copy, r.inputs);
    assert.deepEqual(r.state, copy);
  }
  r.player.energy = 100;
  r.inputs[0].actions.super++;
  r.advance(SUPER_CHARGE_TICKS + 10);
  assert.equal(r.player.attack, null);
  assert.equal(r.player.energy, 100);
  assert.equal(r.player.superUsed, true);
});

// Frozen before the facial revision; includes RGB beneath transparent pixels.
test("Iñaki's face revision preserves every authored money prop exactly", async () => {
  const expected = {
    "note-flat":
      "70b32b02e7cd1acebb8be6cd0fb20709102ffbffe714eb4ece2427240cf7cf07",
    "note-curl":
      "87b0c15631353e4bb035598b90894ec2dadde03843fccce63c851283a6e0ae23",
    "note-tilt":
      "166983835c1ca1685cbf354c971936516bbab46bce0ed1b93a498780c9ad49a7",
    "stack-small":
      "65f3bc957d0bfe2337bf01ee5682f9a9ea6d9a6c2feec866e27478f46f502f4b",
    bundle: "6f6258e4ceb1008b591a97c9a4c299bb5fbd57dc51173ab9e3ea67c7826980bd",
    "cash-cloud-small":
      "16ac795015ac38646d27f309eb85ebbf8b8f3510d2c9b86999230a394f6f94cc",
    "cash-orb":
      "c86114f2afeb6d8b6739ea61cc25ad64c9ffa537ebbfe5c89a80ea92eef9eea4",
    "cash-orb-release":
      "6c5990ccf65a0dd274fe0637ec8e368f3d1380c4fcff0284df8cd072b51c4796",
  };
  assert.deepEqual(Object.keys(expected).sort(), [...INAKI_PROP_POSES].sort());
  for (const pose of INAKI_PROP_POSES) {
    const f = ATTACK_ART.inaki.frames[pose];
    const rgba = await sharp(`public/assets/${ATTACK_ART.inaki.file}.webp`)
      .ensureAlpha()
      .extract({ left: f.x, top: f.y, width: f.width, height: f.height })
      .raw()
      .toBuffer();
    assert.equal(
      createHash("sha256").update(rgba).digest("hex"),
      expected[pose],
      pose,
    );
  }
});
