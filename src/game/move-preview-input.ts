import type { GuideMove } from "./move-demo";
import { GamepadControls, makeInputs } from "./controls";

export const PREVIEW_GAMEPAD_KEYS = {
  J: "X",
  K: "B",
  L: "Y",
  I: "RT",
} as const;

export const PREVIEW_MOVES = {
  light: { keys: ["J"], label: "Golpe rápido" },
  heavy: { keys: ["K"], label: "Golpe fuerte" },
  special: { keys: ["L"], label: "Especial" },
  final: { keys: ["I"], label: "Definitiva" },
  combo1: { keys: ["J", "K"], label: "Combo J, K" },
  combo2: { keys: ["J", "J", "K"], label: "Combo J, J, K" },
} as const satisfies Record<
  GuideMove,
  { keys: readonly string[]; label: string }
>;

// The combat engine accepts a combo within 150 ticks at 60 Hz.
const COMBO_WINDOW_MS = 2500;

export class MovePreviewInput {
  private lightPresses: number[] = [];

  reset() {
    this.lightPresses = [];
  }

  press(code: string, now: number): GuideMove | undefined {
    this.lightPresses = this.lightPresses.filter(
      (at) => now >= at && now - at < COMBO_WINDOW_MS,
    );
    if (code === "KeyJ") {
      this.lightPresses = [...this.lightPresses, now].slice(-2);
      return "light";
    }
    const lights = this.lightPresses.length;
    this.reset();
    if (code === "KeyK")
      return lights === 2 ? "combo2" : lights === 1 ? "combo1" : "heavy";
    if (code === "KeyL") return "special";
    if (code === "KeyI") return "final";
    return undefined;
  }
}

/** Preview the same controller bindings as combat, with independent combo chains. */
export class MovePreviewGamepads {
  private controls = new GamepadControls();
  private inputs = makeInputs();
  private sequences = [new MovePreviewInput(), new MovePreviewInput()];
  private consumed = this.inputs.map((input) => ({ ...input.actions }));
  private connection = "";

  get connected() {
    return this.connection !== "";
  }

  reset() {
    this.sequences.forEach((sequence) => sequence.reset());
  }

  private syncConnection() {
    const connection = Array.from(navigator.getGamepads?.() ?? [])
      .filter((pad): pad is Gamepad => Boolean(pad && pad.connected !== false))
      .map((pad) => `${pad.index}:${pad.id}`)
      .join("|");
    if (connection !== this.connection) this.reset();
    this.connection = connection;
  }

  resume() {
    this.syncConnection();
    this.controls.resume(this.inputs, 2);
    this.consumed = this.inputs.map((input) => ({ ...input.actions }));
    this.reset();
  }

  suspend() {
    this.controls.suspend(this.inputs);
    this.reset();
  }

  poll(now: number): GuideMove[] {
    this.syncConnection();
    this.controls.update(this.inputs, 2, { menu: false });
    const moves: GuideMove[] = [];
    for (const [index, input] of this.inputs.entries()) {
      for (const [action, code] of [
        ["light", "KeyJ"],
        ["heavy", "KeyK"],
        ["special", "KeyL"],
        ["super", "KeyI"],
      ] as const) {
        if (input.actions[action] === this.consumed[index][action]) continue;
        const move = this.sequences[index].press(code, now);
        if (move) moves.push(move);
      }
      this.consumed[index] = { ...input.actions };
    }
    return moves;
  }
}
