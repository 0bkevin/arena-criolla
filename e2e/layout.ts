import {
  expect,
  test as base,
  type Locator,
  type Page,
} from "@playwright/test";

/** Fails the test on any uncaught page error. */
export const test = base.extend<{ errors: string[] }>({
  errors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await use(errors);
      expect(errors, "uncaught page errors").toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

export const PHONE = {
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
};
export const PHONE_LANDSCAPE = {
  viewport: { width: 844, height: 390 },
  isMobile: true,
  hasTouch: true,
};
export const TABLET = {
  viewport: { width: 820, height: 1180 },
  isMobile: true,
  hasTouch: true,
};
export const DESKTOP = { viewport: { width: 1440, height: 900 } };

export async function openLobby(page: Page) {
  await page.goto("/");
  await expect(page.locator(".fighter-card").first()).toBeVisible({
    timeout: 20_000,
  });
}

/**
 * No visible control or heading is cut off at the sides of the screen. The page
 * clips horizontal overflow, so a scroll-width check could never fail. Content
 * inside a horizontal scroller (such as the stage strip) may extend past it.
 */
export async function expectNothingCutOffHorizontally(page: Page) {
  const cut = await page.evaluate(() => {
    const scrolls = (element: Element) =>
      /auto|scroll/.test(getComputedStyle(element).overflowX);
    return [...document.querySelectorAll("button, input, a, h1, h2, h3")]
      .filter((element) => {
        const { left, right, width, height } = element.getBoundingClientRect();
        if (
          !width ||
          !height ||
          getComputedStyle(element).visibility === "hidden"
        )
          return false;
        for (
          let parent = element.parentElement;
          parent;
          parent = parent.parentElement
        )
          if (scrolls(parent)) return false;
        return left < -1 || right > innerWidth + 1;
      })
      .map((element) => element.outerHTML.slice(0, 80));
  });
  expect(cut, "elements cut off at the screen edge").toEqual([]);
}

export async function expectInsideViewport(page: Page, locator: Locator) {
  const box = (await locator.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.y).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
}

/** The element itself receives a click at its centre: nothing is drawn over it. */
export async function expectNotCovered(locator: Locator) {
  const reachable = await locator.evaluate((element) => {
    const { x, y, width, height } = element.getBoundingClientRect();
    const hit = document.elementFromPoint(x + width / 2, y + height / 2);
    return !!hit && (hit === element || element.contains(hit));
  });
  expect(reachable, "another element covers it").toBe(true);
}

/** Desktop starts from the lobby; phones open the fight sheet first. */
export async function startCpuMatch(page: Page) {
  const prepare = page.getByRole("button", { name: /Preparar/ });
  if (await prepare.isVisible()) await prepare.click();
  await page.getByRole("button", { name: /A DARLE/ }).click();
  await expect(page.locator("canvas.arena-canvas")).toBeVisible({
    timeout: 20_000,
  });
}

/** The arena keeps its drawing-buffer proportions and stays on screen. */
export async function expectArenaFits(page: Page) {
  const canvas = page.locator("canvas.arena-canvas");
  const { buffer, css } = await canvas.evaluate(
    (element: HTMLCanvasElement) => {
      const { width, height } = element.getBoundingClientRect();
      return { buffer: element.width / element.height, css: width / height };
    },
  );
  expect(Math.abs(buffer - css), "arena is stretched").toBeLessThan(0.02);
  await expectInsideViewport(page, canvas);
}
