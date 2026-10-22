let locks = 0;
let restorePage: (() => void) | undefined;

function overrideStyles(element: HTMLElement, styles: Record<string, string>) {
  const previous = Object.keys(styles).map((property) => ({
    property,
    value: element.style.getPropertyValue(property),
    priority: element.style.getPropertyPriority(property),
  }));
  for (const [property, value] of Object.entries(styles)) {
    element.style.setProperty(property, value);
  }
  return () => {
    for (const { property, value, priority } of previous) {
      if (value) element.style.setProperty(property, value, priority);
      else element.style.removeProperty(property);
    }
  };
}

/** Keep the page stationary until the last stacked dialog closes. */
export function lockPageScroll() {
  if (locks === 0) {
    const { scrollX, scrollY } = window;
    const gutter = Math.max(
      0,
      window.innerWidth - document.documentElement.clientWidth,
    );
    const padding =
      parseFloat(getComputedStyle(document.body).paddingRight) || 0;
    const restoreRoot = overrideStyles(document.documentElement, {
      "overflow-x": "hidden",
      "overflow-y": "hidden",
      "overscroll-behavior-x": "none",
      "overscroll-behavior-y": "none",
    });
    const restoreBody = overrideStyles(document.body, {
      position: "fixed",
      top: `${-scrollY}px`,
      left: `${-scrollX}px`,
      width: "100%",
      "overflow-x": "hidden",
      "overflow-y": "hidden",
      ...(gutter > 0 ? { "padding-right": `${padding + gutter}px` } : {}),
    });
    restorePage = () => {
      restoreBody();
      restoreRoot();
      window.scrollTo({ left: scrollX, top: scrollY, behavior: "instant" });
    };
  }
  locks += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks -= 1;
    if (locks === 0) {
      restorePage?.();
      restorePage = undefined;
    }
  };
}
