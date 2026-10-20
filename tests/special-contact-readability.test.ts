import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch } from "../shared/engine";
import { renderMatch, type Assets } from "../src/game/renderer";
import type { SpriteAsset } from "../src/game/assets";

function sprite() {
  const textures = Array.from({ length: 8 }, (_, frame) => ({ frame }));
  return {
    textures,
    sprite: {
      image: {}, frameTextures: textures, cellWidth: 400, cellHeight: 400,
      baseline: 390, bodyHeight: 177, portraitCenters: Array(8).fill(200),
      frameFacing: Array(8).fill(1), battleFrame: 0,
      frames: textures.map((_, frame) => ({
        x: frame % 4 * 400, y: Math.floor(frame / 4) * 400,
        width: 250, height: 350, slotX: frame % 4 * 400,
        slotY: Math.floor(frame / 4) * 400,
      })),
    } as unknown as SpriteAsset,
  };
}

for (const side of [0, 1] as const) {
  test(`Javier P${side + 1} shows the kick and full sweep when the actual special damages`, () => {
    const state = createMatch("caracas", [
      { name: "P1", fighter: side === 0 ? "javier" : "capriles", wins: 3 },
      { name: "P2", fighter: side === 1 ? "javier" : "capriles", wins: 3 },
    ]);
    state.phase = "playing";
    state.players.forEach(p => { p.energy = 100; p.invincible = 0; });
    const actor = state.players[side], rival = state.players[1 - side];
    actor.x = side ? 700 : 400;
    actor.facing = side ? -1 : 1;
    rival.x = actor.x + actor.facing * 140;
    const inputs = [emptyInput(), emptyInput()] as const;
    inputs[side].actions.special++;
    while (rival.hp === 100 && state.tick < 30) stepMatch(state, [...inputs]);
    assert.ok(rival.hp < 100);
    const actorSprite = sprite(), rivalSprite = sprite(), drawn: object[] = [], ellipses: number[][] = [];
    const context = new Proxy({
      canvas: { width: 1280, height: 800 },
      createLinearGradient: () => ({ addColorStop() {} }),
      drawImage(image: object) { drawn.push(image); },
      ellipse(...values: number[]) { ellipses.push(values); },
    }, { get: (target, key) => Reflect.get(target, key) ?? (() => {}) }) as unknown as CanvasRenderingContext2D;
    renderMatch(context, state, {
      sprites: { javier: actorSprite.sprite, capriles: rivalSprite.sprite },
      stages: { caracas: { naturalWidth: 1080, naturalHeight: 640, width: 1080, height: 640 } }, finaleProps: {},
    } as unknown as Assets, 0, true);
    assert.ok(drawn.includes(actorSprite.textures[6]), "the damaging frame must show an extended leg");
    assert.ok(ellipses.some(([x, , radius]) => x === actor.x && radius >= 140), "the visible sweep reaches the damaged rival");
  });

  test(`Capriles P${side + 1} crosses the empty gap before his rush connects once`, () => {
    const state = createMatch("caracas", [
      { name: "P1", fighter: side === 0 ? "capriles" : "javier", wins: 3 },
      { name: "P2", fighter: side === 1 ? "capriles" : "javier", wins: 3 },
    ]);
    state.phase = "playing";
    state.players.forEach(p => { p.energy = 100; p.invincible = 0; });
    const actor = state.players[side], rival = state.players[1 - side];
    actor.x = side ? 700 : 400;
    actor.facing = side ? -1 : 1;
    rival.x = actor.x + actor.facing * 214;
    const inputs = [emptyInput(), emptyInput()] as const;
    inputs[side].actions.special++;
    let impactTick = 0;
    for (let tick = 1; tick <= 65; tick++) {
      const beforeHp = rival.hp;
      const gap = Math.abs(actor.x - rival.x);
      stepMatch(state, [...inputs]);
      if (tick === 9) assert.equal(rival.hp, 100, "a remote rival cannot be hit at dash startup");
      if (rival.hp < beforeHp) {
        assert.equal(impactTick, 0);
        impactTick = tick;
        assert.ok(gap < 125, `contact gap ${gap}`);
      }
    }
    assert.ok(impactTick > 9);
    assert.equal(actor.hits, 1);
    assert.equal(actor.attack, null);
  });
}

test("a missing Cashea sheet leaves all three damaging boxes visibly represented", () => {
  const state = createMatch("caracas", [
    { name: "Pedro", fighter: "vallenilla", wins: 3 },
    { name: "Rival", fighter: "capriles", wins: 3 },
  ]);
  state.phase = "playing";
  state.players.forEach(p => { p.invincible = 0; });
  state.players[1].x = 1000;
  const inputs = [emptyInput(), emptyInput()] as const;
  inputs[0].actions.special++;
  for (let tick = 0; tick < 32; tick++) stepMatch(state, [...inputs]);
  assert.equal(state.projectiles.length, 3);
  const boxes: number[][] = [], actor = sprite().sprite;
  const ctx = new Proxy({
    canvas: { width: 1280, height: 800 },
    createLinearGradient: () => ({ addColorStop() {} }),
    roundRect(...values: number[]) { boxes.push(values); },
  }, { get: (target, key) => Reflect.get(target, key) ?? (() => {}) }) as unknown as CanvasRenderingContext2D;
  renderMatch(ctx, state, { sprites: { vallenilla: actor, capriles: actor }, stages: { caracas: { naturalWidth: 1080, naturalHeight: 640, width: 1080, height: 640 } }, finaleProps: {} } as unknown as Assets, 0, true);
  assert.equal(boxes.filter(([x, y, w, h]) => x === -21 && y === -21 && w === 42 && h === 42).length, 3);
});
