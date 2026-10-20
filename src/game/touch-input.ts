import type { Control } from "./controls";

/** Energy-consuming abilities require a new contact or keyboard/AT activation. */
export function requiresFreshPress(control: Control) {
  return control === "special" || control === "super";
}

/** Tracks independent fingers and keyboard holds for the virtual controls. */
export class TouchInputState {
  private active = new Map<number, { control: Control | null }>();

  constructor(
    private readonly onPress: (pointer: number, control: Control) => void,
    private readonly onRelease: (pointer: number) => void,
  ) {}

  press(pointer: number, control: Control | null) {
    const previous = this.active.get(pointer);
    if (previous?.control === control) return false;
    if (previous?.control) this.onRelease(pointer);

    this.active.set(pointer, { control });
    if (control) this.onPress(pointer, control);
    return true;
  }

  /** Slides transfer immediately, but cannot enter an energy-consuming ability. */
  move(pointer: number, target: Control | null) {
    const active = this.active.get(pointer);
    if (!active) return false;

    if (target && requiresFreshPress(target) && active.control !== target)
      target = null;
    if (active.control === target) return false;
    if (active.control) this.onRelease(pointer);
    active.control = target;
    if (target) this.onPress(pointer, target);
    return true;
  }

  hasPointer(pointer: number) {
    return this.active.has(pointer);
  }

  controlFor(pointer: number) {
    return this.active.get(pointer)?.control ?? null;
  }

  release(pointer: number) {
    const active = this.active.get(pointer);
    if (!active) return false;
    this.active.delete(pointer);
    if (active.control) this.onRelease(pointer);
    return true;
  }

  releaseControl(control: Control) {
    let changed = false;
    for (const [pointer, active] of this.active) {
      if (active.control === control)
        changed = this.move(pointer, null) || changed;
    }
    return changed;
  }

  releaseAll() {
    let changed = false;
    for (const pointer of [...this.active.keys()])
      changed = this.release(pointer) || changed;
    return changed;
  }

  pointers() {
    return [...this.active.keys()];
  }

  pressedControls() {
    return new Set(
      [...this.active.values()]
        .map(({ control }) => control)
        .filter((control): control is Control => control !== null),
    );
  }
}
