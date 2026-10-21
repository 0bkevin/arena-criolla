import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, emptyInput, stepMatch, type Input } from "./helpers/charged-finale-engine";
import { INTRO_TOTAL_TICKS } from "../shared/presentation";
import { drawFinale } from "../src/game/finale-renderer";

for (const side of [0, 1] as const) {
  for (const reducedMotion of [false, true]) {
    test(`Capriles P${side + 1} café delivers the requested dialogue in readable beats (reduced motion: ${reducedMotion})`, () => {
      const configs = [
        { name: "Capriles", fighter: "capriles" as const, wins: 3 },
        { name: "Nacho", fighter: "nacho" as const, wins: 3 },
      ] as const;
      const state = createMatch("caracas", side === 0 ? [...configs] : [configs[1], configs[0]]);
      const inputs: [Input, Input] = [emptyInput(), emptyInput()];
      for (let tick = 0; tick < INTRO_TOTAL_TICKS; tick++) stepMatch(state, inputs);
      state.players[0].x = 450;
      state.players[1].x = 630;
      state.players[side].energy = 100;
      inputs[side].actions.super++;
      for (let tick = 0; tick < 20 && !state.finale; tick++) stepMatch(state, inputs);
      assert.ok(state.finale, "the actual super input captures the nearby rival");

      const messages: string[] = [];
      const translations: number[][] = [];
      const boxes: number[][] = [];
      const context = new Proxy({
        createLinearGradient: () => ({ addColorStop() {} }),
        createRadialGradient: () => ({ addColorStop() {} }),
        fillText(value: string) { messages.push(value); },
        translate(...values: number[]) { translations.push(values); },
        roundRect(...values: number[]) { boxes.push(values); },
      }, {
        get(target, property) { return Reflect.get(target, property) ?? (() => {}); },
      }) as unknown as CanvasRenderingContext2D;

      const samples = [
        [0, ["¡Qué manguangua!"]],
        [56, ["¡Qué manguangua!"]],
        [57, ["Maduro tiene la leche", "acaparada"]],
        [107, ["Maduro tiene la leche", "acaparada"]],
        [108, ["y yo se la voy a sacar", "de donde sea."]],
        [179, ["y yo se la voy a sacar", "de donde sea."]],
      ] as const;
      for (const [tick, expected] of samples) {
        while (state.finale!.tick < tick) stepMatch(state, inputs);
        messages.length = translations.length = boxes.length = 0;
        drawFinale(context, state, {}, {}, reducedMotion);
        assert.deepEqual(messages.slice(0, expected.length), expected);
        assert.ok(messages.includes("DEFINITIVA"));
        assert.ok(!messages.some((message) => /conversar|con calma|Otro cafecito/.test(message)));
        assert.ok(boxes.some(([x, y, width, height]) => x === 386 && y === 161 && width === 276 && height === (expected.length === 1 ? 50 : 72)));
        if (expected.length === 2) {
          assert.ok(translations.some(([x, y]) => x === 524 && y === 193));
          assert.ok(translations.some(([x, y]) => x === 524 && y === 215));
        }
      }
      assert.ok(state.players[1 - side].hp < 100, "the conversation still drains health");
      stepMatch(state, inputs);
      assert.equal(state.finale, undefined, "combat resumes after the original three-second finale");
    });
  }
}
