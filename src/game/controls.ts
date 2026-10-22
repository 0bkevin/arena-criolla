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
  if (control === "super") {
    if (down && !input.superHeld) input.actions.super++;
    input.superHeld = down;
  } else if (
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
  input.superHeld = false;
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
  private assignments = new Map<number, number>();
  private active = true;
  private menuActive = true;
  private rearmOnConnect = [false, false];
  constructor(private sources?: [ControlSources, ControlSources]) {}
  /** Keep polling while suspended so held buttons never become fresh actions. */
  update(
    inputs: [Input, Input],
    players: number,
    {
      gameplay = true,
      menu = true,
    }: { gameplay?: boolean; menu?: boolean } = {},
  ): boolean {
    const pads = navigator.getGamepads?.() || [];
    const connected = new Map<number, Gamepad>();
    for (let slot = 0; slot < pads.length; slot++) {
      const pad = pads[slot];
      if (pad && pad.connected !== false) connected.set(pad.index ?? slot, pad);
    }
    for (const [pad, index] of this.assignments) {
      if (connected.has(pad) && index < players) continue;
      // Keep the release requirement across any number of controller-free polls.
      this.rearmOnConnect[index] = true;
      this.release(inputs, index);
      this.assignments.delete(pad);
    }
    // Keep surviving controllers on their player when another pad disconnects.
    for (const pad of connected.keys()) {
      if (this.assignments.has(pad)) continue;
      const index = Array.from({ length: players }, (_, i) => i).find(
        (i) => ![...this.assignments.values()].includes(i),
      );
      if (index !== undefined) this.assignments.set(pad, index);
    }
    const pausePressed =
      menu &&
      this.menuActive &&
      [...this.assignments].some(
        ([pad, index]) =>
          !this.rearmOnConnect[index] &&
          connected.get(pad)!.buttons[9]?.pressed &&
          !this.previous[index].has("pause"),
      );
    const enabled = gameplay && !pausePressed;
    for (const [padIndex, index] of this.assignments) {
      const pad = connected.get(padIndex)!;
      const input = inputs[index];
      const apply = (control: Control, down: boolean) => {
        if (this.sources) {
          if (down) this.sources[index].press(`pad:${control}`, control);
          else this.sources[index].release(`pad:${control}`);
        } else applyControl(input, control, down);
      };
      const pressed = new Set<string>();
      if (pad.buttons[9]?.pressed) pressed.add("pause");
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
        if (enabled && pressed.has(control)) apply(control, true);
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
        if (
          enabled &&
          this.active &&
          !this.rearmOnConnect[index] &&
          pressed.has(control) &&
          !this.previous[index].has(control)
        )
          apply(control, true);
        else if (
          (!enabled || !pressed.has(control)) &&
          this.previous[index].has(control)
        )
          apply(control, false);
      this.previous[index] = pressed;
      this.rearmOnConnect[index] = false;
    }
    this.active = enabled;
    this.menuActive = menu;
    return pausePressed;
  }
  /** Snapshot held buttons at resume; presses after this boundary are fresh. */
  resume(inputs: [Input, Input], players: number) {
    this.update(inputs, players, { gameplay: false, menu: false });
    this.active = true;
    this.menuActive = true;
  }
  /** Also rearm when blur and focus occur between two animation frames. */
  suspend(inputs: [Input, Input], { menu = false }: { menu?: boolean } = {}) {
    this.active = false;
    this.menuActive = menu && this.menuActive;
    for (const index of this.assignments.values())
      this.release(inputs, index, false);
  }
  private release(inputs: [Input, Input], index: number, forget = true) {
    for (const control of this.previous[index]) {
      if (control === "pause") continue;
      if (this.sources) this.sources[index].release(`pad:${control}`);
      else applyControl(inputs[index], control as Control, false);
    }
    if (forget) this.previous[index].clear();
  }
}
export const makeInputs = (): [Input, Input] => [emptyInput(), emptyInput()];
