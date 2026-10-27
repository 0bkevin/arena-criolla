import {
  DESKTOP,
  PHONE,
  PHONE_LANDSCAPE,
  TABLET,
  expect,
  expectInsideViewport,
  expectNothingCutOffHorizontally,
  expectNotCovered,
  openLobby,
  test,
} from "./layout";

const DEVICES = {
  phone: PHONE,
  "phone landscape": PHONE_LANDSCAPE,
  tablet: TABLET,
  desktop: DESKTOP,
};

for (const [name, device] of Object.entries(DEVICES)) {
  test.describe(name, () => {
    test.use(device);

    test("lobby fits the screen and its start button can be pressed", async ({
      page,
    }) => {
      await openLobby(page);
      await expectNothingCutOffHorizontally(page);
      const start = page
        .getByRole("button", { name: /Preparar|A DARLE/ })
        .first();
      await start.scrollIntoViewIfNeeded();
      await expect(start).toBeVisible();
      await expectNotCovered(start);
    });

    test("fighter moves and help dialogs fit on screen and return focus on Escape", async ({
      page,
    }) => {
      await openLobby(page);
      for (const trigger of [
        page.getByRole("button", { name: "Movimientos" }).first(),
        page.getByRole("button", { name: /Cómo jugar/ }).first(),
      ]) {
        await trigger.click();
        const dialog = page.locator("dialog[open]");
        await expect(dialog).toBeVisible();
        await expectInsideViewport(page, dialog);
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        await expect(trigger).toBeFocused();
      }
    });
  });
}

test("roster search ignores accents and recovers from an empty result", async ({
  page,
}) => {
  await openLobby(page);
  const search = page.getByRole("textbox", { name: "Buscar luchador" });
  const cards = page.locator(".fighter-card");
  await search.fill("dorangel");
  await expect(cards).toHaveCount(1);
  await expect(cards).toHaveText(/Dorángel Vargas/);
  await search.fill("zzzz");
  await expect(cards).toHaveCount(0);
  await page.getByRole("button", { name: "Ver todos" }).click();
  await expect(search).toHaveValue("");
  expect(await cards.count()).toBeGreaterThan(1);
});
