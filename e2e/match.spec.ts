import {
  DESKTOP,
  PHONE,
  PHONE_LANDSCAPE,
  expect,
  expectArenaFits,
  expectInsideViewport,
  expectNothingCutOffHorizontally,
  openLobby,
  startCpuMatch,
  test,
} from "./layout";

test.describe("desktop", () => {
  test.use(DESKTOP);

  test("the arena keeps its proportions and shows both fighters' HUD", async ({
    page,
  }) => {
    await openLobby(page);
    await startCpuMatch(page);
    await expect(page.getByText("Jugador 1")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("CPU", { exact: true }).first()).toBeVisible();
    await expectArenaFits(page);
    await expectNothingCutOffHorizontally(page);
  });
});

test.describe("phone portrait", () => {
  test.use(PHONE);

  test("asks to rotate instead of squeezing the arena", async ({ page }) => {
    await openLobby(page);
    await startCpuMatch(page);
    await expect(page.getByText("Gira tu teléfono")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Jugar en horizontal" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Volver a la selección" }).click();
    await expect(page.locator(".fighter-card").first()).toBeVisible();
  });
});

test.describe("phone landscape", () => {
  test.use(PHONE_LANDSCAPE);

  test("touch controls stay on screen without overlapping each other", async ({
    page,
  }) => {
    await openLobby(page);
    await startCpuMatch(page);
    const skip = page.getByRole("button", { name: "Saltar intro" });
    if (await skip.isVisible()) await skip.click();
    const buttons = page.locator(".touch-controls .touch-button");
    await expect(buttons.first()).toBeVisible({ timeout: 20_000 });
    await expectArenaFits(page);
    const boxes = [];
    for (const button of await buttons.all()) {
      await expectInsideViewport(page, button);
      boxes.push({
        label: await button.getAttribute("aria-label"),
        ...(await button.boundingBox())!,
      });
    }
    for (const [index, a] of boxes.entries())
      for (const b of boxes.slice(index + 1)) {
        const overlap =
          Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1 &&
          Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1;
        expect(overlap, `${a.label} overlaps ${b.label}`).toBe(false);
      }
  });
});
