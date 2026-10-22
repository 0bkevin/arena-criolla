import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { Modal } from "../../src/components/Modal";
import "../../src/styles.css";
import "../../src/lobby.css";
import "../../src/arcade-theme.css";
import "../../src/ui-accessibility.css";

const fixture = document.getElementById("fixture")!;
let root = createRoot(fixture);
const settle = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

function render(count: number) {
  flushSync(() =>
    root.render(
      <StrictMode>
        <div className="app-shell arcade-app">
          {Array.from({ length: count }, (_, index) => (
            <Modal
              key={index}
              title={`Dialog ${index + 1}`}
              onClose={() => render(count - 1)}
            >
              <div
                className="audit-dialog-body"
                style={{
                  maxHeight: 140,
                  overflowY: "auto",
                  overscrollBehavior: "contain",
                }}
              >
                {Array.from({ length: 30 }, (_, line) => (
                  <p key={line}>Dialog content {line}</p>
                ))}
              </div>
            </Modal>
          ))}
        </div>
      </StrictMode>,
    ),
  );
}

function expect(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const savedStyles = () =>
  [document.documentElement, document.body].map((element) => ({
    element,
    values: [
      "position",
      "top",
      "left",
      "width",
      "padding-right",
      "overflow-x",
      "overflow-y",
      "overscroll-behavior-x",
      "overscroll-behavior-y",
    ].map((property) => ({
      property,
      value: element.style.getPropertyValue(property),
      priority: element.style.getPropertyPriority(property),
    })),
  }));

async function run() {
  const results: { name: string; pass: boolean; error?: string }[] = [];
  const originalBody = document.body.style.cssText;
  const originalRoot = document.documentElement.style.cssText;
  async function scenario(name: string, test: () => Promise<void>) {
    render(0);
    document.body.style.cssText = originalBody;
    document.documentElement.style.cssText = originalRoot;
    window.scrollTo({ top: 0, behavior: "instant" });
    await settle();
    try {
      await test();
      results.push({ name, pass: true });
    } catch (error) {
      results.push({ name, pass: false, error: String(error) });
    } finally {
      render(0);
    }
  }
  await scenario(
    "reaching the dialog end cannot scroll the page behind it",
    async () => {
      window.scrollTo({ top: 240, behavior: "instant" });
      const anchorTop = document
        .getElementById("page-anchor")!
        .getBoundingClientRect().top;
      render(1);
      await settle();
      const inner = document.querySelector<HTMLElement>(".audit-dialog-body")!;
      inner.scrollTop = inner.scrollHeight;
      expect(inner.scrollTop > 0, "Dialog content must remain scrollable");
      const lockedY = window.scrollY;
      window.scrollBy({ top: 600, behavior: "instant" });
      await settle();
      expect(
        window.scrollY === lockedY,
        `Background moved ${window.scrollY - lockedY}px at the dialog boundary`,
      );
      expect(
        Math.abs(
          document.getElementById("page-anchor")!.getBoundingClientRect().top -
            anchorTop,
        ) < 1,
        "Opening a dialog moved the page underneath",
      );
      render(0);
      await settle();
      expect(
        Math.abs(window.scrollY - 240) < 1,
        "Closing did not restore the original page position",
      );
      window.scrollBy({ top: 100, behavior: "instant" });
      expect(
        Math.abs(window.scrollY - 340) < 1,
        "Page scrolling remained locked after close",
      );
    },
  );
  await scenario(
    "closing a stacked dialog keeps the first dialog locked",
    async () => {
      window.scrollTo({ top: 180, behavior: "instant" });
      render(1);
      await settle();
      render(2);
      await settle();
      render(1);
      await settle();
      const lockedY = window.scrollY;
      window.scrollBy({ top: 400, behavior: "instant" });
      expect(
        window.scrollY === lockedY,
        "Closing one dialog unlocked the remaining dialog",
      );
      render(0);
      await settle();
      expect(
        Math.abs(window.scrollY - 180) < 1,
        "Final close did not restore the page position",
      );
    },
  );
  await scenario(
    "unmount restores pre-existing styles and the page position in StrictMode",
    async () => {
      document.body.style.setProperty("padding-right", "7px", "important");
      document.body.style.overflowY = "auto";
      document.documentElement.style.overscrollBehaviorY = "contain";
      const before = savedStyles();
      window.scrollTo({ top: 160, behavior: "instant" });
      render(1);
      await settle();
      flushSync(() => root.unmount());
      root = createRoot(fixture);
      await settle();
      for (const { element, values } of before) {
        for (const { property, value, priority } of values) {
          expect(
            element.style.getPropertyValue(property) === value &&
              element.style.getPropertyPriority(property) === priority,
            `${property} was not restored`,
          );
        }
      }
      expect(
        Math.abs(window.scrollY - 160) < 1,
        "Unmount did not restore the original position",
      );
    },
  );
  await scenario(
    "a hidden opener returns focus to a visible control",
    async () => {
      const context = document.createElement("header");
      const opener = document.createElement("button");
      const fallback = document.createElement("button");
      opener.textContent = "Desktop dialog opener";
      fallback.textContent = "Visible navigation";
      context.append(opener, fallback);
      document.body.append(context);
      try {
        opener.focus();
        render(1);
        await settle();
        opener.hidden = true;
        render(0);
        await settle();
        expect(
          document.activeElement === fallback,
          "Focus was lost when the opener became hidden",
        );
      } finally {
        render(0);
        context.remove();
      }
    },
  );
  document.body.style.cssText = originalBody;
  document.documentElement.style.cssText = originalRoot;
  render(0);
  window.scrollTo({ top: 0, behavior: "instant" });
  return results;
}

Object.assign(window, { modalScrollAudit: { run, render } });
render(0);
