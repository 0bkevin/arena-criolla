import type { Control } from "./controls";

const SLIDE_CONTROLS = new Set<Control>(["left", "right", "down"]);

/** Tracks independent fingers and keyboard holds for the virtual controls. */
export class TouchInputState {
  private active = new Map<
    number,
    { control: Control | null; slides: boolean }
  >();

  constructor(
    private readonly onPress: (pointer: number, control: Control) => void,
    private readonly onRelease: (pointer: number) => void,
  ) {}

  press(pointer: number, control: Control) {
    const previous = this.active.get(pointer);
    if (previous?.control === control) return false;
    if (previous?.control) this.onRelease(pointer);

    this.active.set(pointer, {
      control,
      slides: SLIDE_CONTROLS.has(control),
    });
    this.onPress(pointer, control);
    return true;
  }

  /** Direction fingers follow left/right/down buttons and release in the gaps. */
  move(pointer: number, target: Control | null) {
    const active = this.active.get(pointer);
    if (!active?.slides) return false;

    const next = target && SLIDE_CONTROLS.has(target) ? target : null;
    if (active.control === next) return false;
    if (active.control) this.onRelease(pointer);
    active.control = next;
    if (next) this.onPress(pointer, next);
    return true;
  }

  canSlide(pointer: number) {
    return this.active.get(pointer)?.slides === true;
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
        changed = this.release(pointer) || changed;
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
