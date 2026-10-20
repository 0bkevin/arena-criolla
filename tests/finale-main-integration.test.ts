import test from "node:test";
import assert from "node:assert/strict";
import {
  BUILT_IN_FIGHTERS,
  fighterById,
  type FighterId,
} from "../shared/content";
import { createMatch } from "../shared/engine";
import { CANONICAL_FINALE_FIGHTERS, finaleById } from "../shared/finales";
import actors from "../shared/finale-actor-assets.json";
import dancers from "../shared/perro-mujeriego-assets.json";
import { requireCompleteDancerRoster } from "../scripts/validate-perro-mujeriego";
import { drawFinale } from "../src/game/finale-renderer";
import type { SpriteAsset } from "../src/game/assets";

test("main's revised canonical identities remain selected and the authored batch is honestly incomplete for the expanded roster", () => {
  for (const [id, sprite] of Object.entries({
    knoche: "knoche-v46",
    javier: "javier-v43",
    nacho: "nacho-v42",
    capriles: "capriles-v39",
    dayana: "dayana-v49",
    deyna: "deyna-v1",
  }))
    assert.equal(fighterById(id as FighterId).sprite, sprite);
  assert.equal(BUILT_IN_FIGHTERS.length, 53);
  assert.equal(Object.keys(dancers.dancers).length, 48);
  assert.throws(
    () =>
      requireCompleteDancerRoster(
        Object.keys(dancers.dancers),
        Object.keys(dancers.dancers),
      ),
    /all 53/,
  );
  for (const id of CANONICAL_FINALE_FIGHTERS.filter(
    (id) => id !== "dayana" && id !== "deyna",
  )) {
    assert.equal((actors.seated as Record<string, unknown>)[id], undefined);
    assert.equal((dancers.dancers as Record<string, unknown>)[id], undefined);
  }
});

test("all six incoming fighters remain visible in their finales, Capriles's chairs and Nacho's phrase using their own canonical frames", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "document");
  const calls: { image: unknown; args: number[] }[] = [];
  const labels: string[] = [];
  const context = () =>
    new Proxy(
      {
        globalAlpha: 1,
        drawImage(image: unknown, ...args: number[]) {
          calls.push({ image, args });
        },
        fillText(label: string) {
          labels.push(label);
        },
      },
      { get: (target, key) => Reflect.get(target, key) ?? (() => {}) },
    ) as unknown as CanvasRenderingContext2D;
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement() {
        return { width: 0, height: 0, getContext: context };
      },
    },
  });
  const sprite = (id: FighterId): SpriteAsset => ({
    image: { id: fighterById(id).sprite } as unknown as HTMLImageElement,
    cellWidth: 512,
    cellHeight: 512,
    baseline: 482,
    bodyHeight: 300,
    portraitCenters: Array(8).fill(256),
    frameFacing: Array(8).fill(1),
    battleFrame: 0,
    frames: Array.from({ length: 8 }, (_, frame) => ({
      x: (frame % 4) * 512 + 100,
      y: Math.floor(frame / 4) * 512 + 100,
      width: 200,
      height: 382,
      slotX: (frame % 4) * 512,
      slotY: Math.floor(frame / 4) * 512,
    })),
  });
  try {
    for (const incoming of CANONICAL_FINALE_FIGHTERS)
      for (const source of ([incoming, "capriles", "nacho"] as const).filter(
        (source) => finaleById(source)?.mode === "capture",
      ))
        for (const owner of [0, 1] as const) {
          const target = source === incoming ? "javier" : incoming;
          const state = createMatch(
            "merida",
            owner === 0
              ? [
                  { name: "Actor", fighter: source, wins: 3 },
                  { name: "Rival", fighter: target, wins: 3 },
                ]
              : [
                  { name: "Rival", fighter: target, wins: 3 },
                  { name: "Actor", fighter: source, wins: 3 },
                ],
          );
          state.phase = "playing";
          state.finale = {
            owner,
            target: owner === 0 ? 1 : 0,
            fighter: source,
            startedTick: 1,
            tick: 0,
            duration: finaleById(source)!.duration,
            x: 540,
            y: 554,
            direction: owner === 0 ? 1 : -1,
            damage: 40,
            initialHp: 100,
          };
          const sprites = {
            [source]: sprite(source),
            [target]: sprite(target),
          };
          calls.length = 0;
          labels.length = 0;
          for (const tick of [0, 144, 222, 318]) {
            state.finale.tick = Math.min(tick, state.finale.duration - 1);
            drawFinale(context(), state, sprites, {});
          }
          for (const [id, asset] of Object.entries(sprites)) {
            const sourceCalls = calls.filter(
              ({ image }) => image === asset.image,
            );
            assert.ok(
              sourceCalls.length > 0,
              `${source}/${incoming}/P${owner + 1}: ${id} is visible`,
            );
            if (source === "nacho")
              assert.ok(
                new Set(
                  sourceCalls.map(({ args }) => args.slice(0, 2).join(":")),
                ).size >= 3,
                `${id}: canonical fallback changes pose with the shared phrase`,
              );
          }
          assert.equal(
            labels.filter((label) => label === "DEFINITIVA").length,
            4,
            "each rendered frame has one definitive heading",
          );
        }
  } finally {
    if (original) Object.defineProperty(globalThis, "document", original);
    else Reflect.deleteProperty(globalThis, "document");
  }
});
