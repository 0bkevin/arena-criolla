// Run with preview_evaluate in the collaborative browser, after each UI state.
// Measurements describe a Chromium viewport, not a physical device.
(() => {
  const visible = (element) => {
    const style = getComputedStyle(element);
    return (
      element.getClientRects().length &&
      style.visibility !== "hidden" &&
      style.display !== "none"
    );
  };
  window.uiReview = () => {
    const root =
      document.querySelector("dialog[open]") ||
      document.querySelector("main") ||
      document.body;
    const rect = root.getBoundingClientRect();
    const elements = [...root.querySelectorAll("*")].filter(visible);
    const label = (e) =>
      (e.getAttribute("aria-label") || e.innerText || e.tagName)
        .trim()
        .slice(0, 100);
    const clipped = elements
      .filter(
        (e) =>
          !e.children.length &&
          e.textContent.trim() &&
          !e.closest(".sr-only, [aria-hidden=true], .stage-strip") &&
          (e.scrollWidth > e.clientWidth + 2 ||
            e.scrollHeight > e.clientHeight + 2) &&
          ["hidden", "clip"].includes(getComputedStyle(e).overflowX),
      )
      .map((e) => ({
        text: label(e),
        class: e.className,
        width: e.clientWidth,
        scroll: e.scrollWidth,
      }));
    const smallTargets = [
      ...root.querySelectorAll("button, input, select, textarea"),
    ]
      .filter(visible)
      .filter((e) => !e.disabled)
      .map((e) => ({
        label: label(e),
        width: Math.round(e.getBoundingClientRect().width),
        height: Math.round(e.getBoundingClientRect().height),
      }))
      .filter((e) => e.width < 44 || e.height < 44);
    const offscreen = [...root.querySelectorAll("button,input,select,textarea")]
      .filter(visible)
      .filter(
        (e) =>
          !e.closest(".stage-strip") &&
          (e.getBoundingClientRect().left < -1 ||
            e.getBoundingClientRect().right > innerWidth + 1),
      )
      .map(label);
    return {
      width: innerWidth,
      height: innerHeight,
      title: root.getAttribute("aria-label"),
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      rootOverflow: root.scrollWidth > root.clientWidth + 2,
      rootBounds: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      },
      clipped,
      smallTargets,
      offscreen,
      brokenImages: [...document.images]
        .filter((e) => e.complete && !e.naturalWidth)
        .map((e) => e.src),
    };
  };
  window.uiContrast = () => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const rgb = (s) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = s;
      context.fillRect(0, 0, 1, 1);
      const bytes = [...context.getImageData(0, 0, 1, 1).data];
      return [...bytes.slice(0, 3), bytes[3] / 255];
    };
    const blend = (a, b) => {
      const alpha = a[3] ?? 1;
      return a.slice(0, 3).map((n, i) => n * alpha + b[i] * (1 - alpha));
    };
    const luminance = (a) =>
      a
        .slice(0, 3)
        .map((n) => {
          n /= 255;
          return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
        })
        .reduce((s, n, i) => s + n * [0.2126, 0.7152, 0.0722][i], 0);
    const root =
      document.querySelector("dialog[open]") ||
      document.querySelector("main") ||
      document.body;
    return [...root.querySelectorAll("*")]
      .filter(
        (e) =>
          visible(e) &&
          !e.children.length &&
          e.textContent.trim() &&
          !e.closest(".sr-only, [aria-hidden=true]"),
      )
      .flatMap((e) => {
        let backgrounds = [[9, 21, 36]],
          stack = [],
          imageBackground = false;
        for (let p = e; p; p = p.parentElement) stack.unshift(p);
        for (const p of stack) {
          const style = getComputedStyle(p),
            color = rgb(style.backgroundColor);
          backgrounds = backgrounds.map((bg) => blend(color, bg));
          if (color[3] === 1) imageBackground = false;
          if (style.backgroundImage.includes("url(")) imageBackground = true;
          else if (style.backgroundImage !== "none") {
            const stops =
              style.backgroundImage.match(
                /(?:rgba?|color)\([^)]+\)|#[a-f\d]{3,8}/gi,
              ) || [];
            if (stops.length)
              backgrounds = stops
                .flatMap((stop) =>
                  backgrounds.map((bg) => blend(rgb(stop), bg)),
                )
                .slice(-20);
          }
        }
        const s = getComputedStyle(e),
          ratios = backgrounds.map((bg) => {
            const fg = blend(rgb(s.color), bg);
            return (
              (Math.max(luminance(fg), luminance(bg)) + 0.05) /
              (Math.min(luminance(fg), luminance(bg)) + 0.05)
            );
          }),
          ratio = Math.min(...ratios),
          bg = backgrounds[ratios.indexOf(ratio)];
        const large =
          parseFloat(s.fontSize) >= 24 ||
          (parseFloat(s.fontSize) >= 18.66 && parseInt(s.fontWeight) >= 700);
        return ratio < (large ? 3 : 4.5)
          ? [
              {
                text: e.textContent.trim().slice(0, 90),
                class: e.className,
                color: s.color,
                font: s.fontSize,
                ratio: +ratio.toFixed(2),
                background: bg.map(Math.round),
                imageBackground,
                disabled: !!e.closest(":disabled"),
              },
            ]
          : [];
      });
  };
  return "UI review probes installed";
})();
