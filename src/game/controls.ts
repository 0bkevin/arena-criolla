import { emptyInput, type Action, type Input } from "../../shared/engine";

export type Control = Action | "left" | "right" | "block" | "down";
export const KEY_MAP: Record<string, [number, Control]> = {
  KeyA: [0, "left"],
  KeyD: [0, "right"],
  KeyS: [0, "down"],
  KeyW: [0, "jump"],
  KeyJ: [0, "light"],
  KeyK: [0, "heavy"],
  KeyL: [0, "special"],
  KeyI: [0, "super"],
  KeyU: [0, "block"],
  ShiftLeft: [0, "dash"],
  ArrowLeft: [1, "left"],
  ArrowRight: [1, "right"],
  ArrowDown: [1, "down"],
  ArrowUp: [1, "jump"],
  Numpad1: [1, "light"],
  Numpad2: [1, "heavy"],
  Numpad3: [1, "special"],
  Numpad5: [1, "super"],
  Numpad0: [1, "block"],
  NumpadDecimal: [1, "dash"],
  Digit1: [1, "light"],
  Digit2: [1, "heavy"],
  Digit3: [1, "special"],
  Digit5: [1, "super"],
  Digit0: [1, "block"],
  Enter: [1, "dash"],
};
export function applyControl(input: Input, control: Control, down: boolean) {
  if (
    control === "left" ||
    control === "right" ||
    control === "block" ||
    control === "down"
  )
    input[control] = down;
  else if (down) input.actions[control]++;
}
export function clearHeld(input: Input) {
  input.left = false;
  input.right = false;
  input.block = false;
  input.down = false;
}
/** A held control stays down until its last finger, key or controller releases. */
export class ControlSources {
  private held = new Map<string, Control>();
  constructor(private input: Input) {}
  press(source: string, control: Control) {
    if (this.held.get(source) === control) return;
    this.release(source);
    this.held.set(source, control);
    applyControl(this.input, control, true);
  }
  release(source: string) {
    const control = this.held.get(source);
    if (!control) return;
    this.held.delete(source);
    if (![...this.held.values()].includes(control))
      applyControl(this.input, control, false);
  }
  clear() {
    this.held.clear();
    clearHeld(this.input);
  }
}
export class GamepadControls {
  private previous = [new Set<string>(), new Set<string>()];
  constructor(private sources?: [ControlSources, ControlSources]) {}
  update(inputs: [Input, Input], players: number) {
    const pads = navigator.getGamepads?.() || [];
    let assigned = 0;
    for (const pad of pads) {
      if (!pad || assigned >= players) continue;
      const index = assigned++;
      const input = inputs[index];
      const apply = (control: Control, down: boolean) => {
        if (this.sources) {
          if (down) this.sources[index].press(`pad:${control}`, control);
          else this.sources[index].release(`pad:${control}`);
        } else applyControl(input, control, down);
      };
      const pressed = new Set<string>();
      if (pad.axes[0] < -0.35 || pad.buttons[14]?.pressed) pressed.add("left");
      if (pad.axes[0] > 0.35 || pad.buttons[15]?.pressed) pressed.add("right");
      if (pad.axes[1] > 0.5 || pad.buttons[13]?.pressed) pressed.add("down");
      const map: [number, Control][] = [
        [0, "jump"],
        [1, "heavy"],
        [2, "light"],
        [3, "special"],
        [4, "block"],
        [5, "dash"],
        [7, "super"],
      ];
      map.forEach(([button, control]) => {
        if (pad.buttons[button]?.pressed) pressed.add(control);
      });
      for (const control of ["left", "right", "down", "block"] as const) {
        if (pressed.has(control)) apply(control, true);
        else if (this.previous[index].has(control)) apply(control, false);
      }
      for (const control of [
        "jump",
        "light",
        "heavy",
        "special",
        "dash",
        "super",
      ] as const)
        if (pressed.has(control) && !this.previous[index].has(control))
          apply(control, true);
        else if (!pressed.has(control) && this.previous[index].has(control))
          apply(control, false);
      this.previous[index] = pressed;
    }
    for (let index = assigned; index < this.previous.length; index++) {
      for (const control of this.previous[index]) {
        if (this.sources) this.sources[index].release(`pad:${control}`);
        else applyControl(inputs[index], control as Control, false);
      }
      this.previous[index].clear();
    }
  }
}
export const makeInputs = (): [Input, Input] => [emptyInput(), emptyInput()];
