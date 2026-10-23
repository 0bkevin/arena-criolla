import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { App } from "../../src/App";
import {
  COMMUNITY_DEFINITIONS,
  FIGHTERS,
  type FighterDefinition,
} from "../../shared/content";
import { loadInterfaceFonts } from "../../src/fonts";

function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

const frame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
let running = false;

/** Real App, catalog and handlers; only catalog revision and debounce time are controlled. */
export async function run() {
  check(!running, "The roster audit is already running");
  running = true;
  const fixture = document.getElementById("fixture");
  check(fixture, "The roster fixture is missing");
  const fonts = loadInterfaceFonts();
  await fonts.ready;
  fonts.activateInterface();
  const root = createRoot(fixture);
  const originalTimeout = window.setTimeout;
  const originalClear = window.clearTimeout;
  const pending = new Map<number, () => void>();
  const results: { name: string; passed: boolean; error?: string }[] = [];
  let revision = 0;
  let timerId = -1;

  const find = <T extends HTMLElement>(selector: string) => {
    const element = fixture.querySelector<T>(selector);
    check(element, `Missing ${selector}`);
    return element;
  };
  const click = (element: HTMLElement) => flushSync(() => element.click());
  const key = (element: HTMLElement, value: string) =>
    flushSync(() => {
      element.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: value,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
  const render = () =>
    flushSync(() =>
      root.render(
        <StrictMode>
          <App communityRevision={revision} />
        </StrictMode>,
      ),
    );
  const names = () =>
    Array.from(
      fixture.querySelectorAll(".fighter-card strong"),
      (element) => element.textContent!,
    );
  const chooseCategory = (label: string) => {
    find(".roster-filter-toggle").scrollIntoView({
      block: "center",
      behavior: "instant",
    });
    if (!fixture.querySelector(".roster-filter-menu"))
      click(find(".roster-filter-toggle"));
    const option = Array.from(
      fixture.querySelectorAll<HTMLButtonElement>(".roster-filter-option"),
    ).find((element) => element.textContent!.startsWith(label));
    check(option, `Missing category ${label}`);
    click(option);
  };
  const input = (value: string) => {
    const element = find<HTMLInputElement>(".arcade-search input");
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    flushSync(() => {
      setter.call(element, value);
      element.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  const advanceSearch = () =>
    flushSync(() => {
      const callbacks = [...pending.values()];
      pending.clear();
      callbacks.forEach((callback) => callback());
    });
  const test = async (name: string, action: () => void | Promise<void>) => {
    try {
      await action();
      results.push({ name, passed: true });
    } catch (error) {
      results.push({ name, passed: false, error: String(error) });
    } finally {
      const trigger = fixture.querySelector<HTMLButtonElement>(
        ".roster-filter-toggle",
      );
      if (trigger?.getAttribute("aria-expanded") === "true")
        key(trigger, "Escape");
    }
  };

  try {
    render();
    await frame();
    await frame();
    window.setTimeout = ((
      handler: TimerHandler,
      delay = 0,
      ...args: unknown[]
    ) => {
      if (delay !== 250 || typeof handler !== "function")
        return originalTimeout(handler, delay, ...args);
      const id = timerId--;
      pending.set(id, () => handler(...args));
      return id;
    }) as typeof window.setTimeout;
    window.clearTimeout = (id) => {
      if (typeof id !== "number" || !pending.delete(id)) originalClear(id);
    };

    await test("unchanged catalog refresh preserves the current page", async () => {
      click(find('[aria-label="Página siguiente de luchadores"]'));
      const before = names().join("|");
      revision += 1;
      render();
      await frame();
      check(names().join("|") === before, "Catalog refresh reset pagination");
    });

    await test("debounce commits only the latest search and clear cancels pending work", () => {
      const before = names().join("|");
      input("amanda");
      input("bolivar");
      check(names().join("|") === before, "Search applied before debounce");
      check(pending.size === 1, "Superseded search was not cancelled");
      advanceSearch();
      check(
        names().join() === "Simón Bolívar",
        "Latest accent-insensitive search did not apply",
      );
      input("zzzzzz");
      click(find(".roster-search-clear"));
      advanceSearch();
      check(
        names().length > 1 &&
          find<HTMLInputElement>(".arcade-search input").value === "",
        "Pending search returned after clear",
      );
    });

    await test("search empty state recovers all characters", () => {
      input("zzzzzz");
      advanceSearch();
      check(names().length === 0, "Missing empty state");
      click(find(".fighter-empty button"));
      check(names().length > 1, "Empty-state recovery failed");
    });

    await test("filter and both sort directions preserve the shared catalog", () => {
      const registryOrder = FIGHTERS.map((fighter) => fighter.id).join();
      chooseCategory("Founders");
      const expected = FIGHTERS.filter(
        (fighter) => fighter.category === "founders",
      )
        .map((fighter) => fighter.name)
        .sort(new Intl.Collator("es", { sensitivity: "base" }).compare);
      check(
        names().join() === expected.join(),
        "Filtered A–Z order is incorrect",
      );
      click(find(".roster-sort"));
      check(
        names().join() === expected.reverse().join(),
        "Filtered Z–A order is incorrect",
      );
      click(find(".roster-sort"));
      chooseCategory("Todos");
      check(
        FIGHTERS.map((fighter) => fighter.id).join() === registryOrder,
        "Sorting mutated the shared catalog",
      );
    });

    await test("removing the final community fighter preserves a truthful keyboard selection", () => {
      const fighter: FighterDefinition = {
        ...FIGHTERS[0],
        id: "custom_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        name: "Pana de prueba",
        category: "community",
      };
      FIGHTERS.push(fighter);
      COMMUNITY_DEFINITIONS.set(fighter.id, fighter);
      try {
        revision += 1;
        render();
        chooseCategory("Panas");
        FIGHTERS.splice(FIGHTERS.indexOf(fighter), 1);
        revision += 1;
        render();
        const trigger = find(".roster-filter-toggle");
        check(
          trigger.textContent!.includes("Panas"),
          "Removed collection is misleadingly labelled Todos",
        );
        click(trigger);
        check(
          document.activeElement?.getAttribute("aria-checked") === "true",
          "Removed collection has no keyboard selection",
        );
      } finally {
        const index = FIGHTERS.indexOf(fighter);
        if (index >= 0) FIGHTERS.splice(index, 1);
        COMMUNITY_DEFINITIONS.delete(fighter.id);
        revision += 1;
        render();
        chooseCategory("Todos");
      }
    });

    await test("returning to the open trigger can re-enter keyboard navigation", () => {
      const trigger = find<HTMLButtonElement>(".roster-filter-toggle");
      click(trigger);
      // Result of native Shift+Tab from the focused menu item.
      trigger.focus();
      key(trigger, "ArrowDown");
      check(
        find(".roster-filter-menu").contains(document.activeElement),
        "ArrowDown stranded focus on the open trigger",
      );
      key(document.activeElement as HTMLElement, "End");
      check(
        document.activeElement ===
          fixture.querySelector(".roster-filter-option:last-child"),
        "End did not reach the last option",
      );
      key(document.activeElement as HTMLElement, "Escape");
      check(
        document.activeElement === trigger &&
          !fixture.querySelector(".roster-filter-menu"),
        "Escape failed to close and restore focus",
      );
    });

    await test("reopening an upward menu near the header does not move the page", async () => {
      chooseCategory("Todos");
      const trigger = find(".roster-filter-toggle");
      const dock = fixture
        .querySelector(".mobile-setup-dock")
        ?.getBoundingClientRect();
      const bottom = dock?.height
        ? Math.min(innerHeight, dock.top)
        : innerHeight;
      window.scrollTo({
        top: scrollY + trigger.getBoundingClientRect().top - bottom + 80,
        behavior: "instant",
      });
      await frame();
      click(trigger);
      await frame();
      if (find(".roster-filter-menu").dataset.side !== "top") return;
      key(trigger, "Escape");
      const top = find(".site-header").getBoundingClientRect().bottom;
      window.scrollTo({
        top: scrollY + trigger.getBoundingClientRect().top - top - 64,
        behavior: "instant",
      });
      await frame();
      const before = scrollY;
      click(trigger);
      await frame();
      await frame();
      check(
        Math.abs(scrollY - before) <= 1,
        "Opening focus unexpectedly scrolled the page",
      );
      check(
        fixture.querySelector(".roster-filter-menu"),
        "Opening focus dismissed the menu",
      );
    });

    await test("menu fits available space and follows scrolling", async () => {
      chooseCategory("Leyendas");
      const trigger = find(".roster-filter-toggle");
      window.scrollTo({
        top: scrollY + trigger.getBoundingClientRect().top - innerHeight * 0.4,
        behavior: "instant",
      });
      await frame();
      click(trigger);
      await frame();
      const fits = () => {
        const bounds = find(".roster-filter-menu").getBoundingClientRect();
        const dock = fixture
          .querySelector(".mobile-setup-dock")
          ?.getBoundingClientRect();
        const bottom = dock?.height
          ? Math.min(innerHeight, dock.top)
          : innerHeight;
        const top =
          fixture.querySelector(".site-header")?.getBoundingClientRect()
            .bottom ?? 0;
        check(
          bounds.top >= top + 7 && bounds.bottom <= bottom - 7,
          `Menu is clipped (${bounds.top}..${bounds.bottom}, available 8..${bottom - 8})`,
        );
      };
      fits();
      window.scrollBy({ top: 80, behavior: "instant" });
      await frame();
      await frame();
      fits();
      key(find(".roster-filter-option"), "End");
      await frame();
      const last = find(
        ".roster-filter-option:last-child",
      ).getBoundingClientRect();
      const menu = find(".roster-filter-menu").getBoundingClientRect();
      check(
        last.top >= menu.top && last.bottom <= menu.bottom,
        "Last option cannot be reached in the scrollable menu",
      );
    });

    await test("expanded tap targets select the visible option at its edge", async () => {
      chooseCategory("Todos");
      find(".roster-toolbar").scrollIntoView({
        block: "center",
        behavior: "instant",
      });
      await frame();
      click(find(".roster-filter-toggle"));
      await frame();
      const options = Array.from(
        fixture.querySelectorAll<HTMLButtonElement>(".roster-filter-option"),
      );
      for (const option of options) {
        option.scrollIntoView({ block: "nearest", behavior: "instant" });
        const bounds = option.getBoundingClientRect();
        const target = document.elementFromPoint(
          bounds.x + bounds.width / 2,
          bounds.bottom - 1,
        );
        check(
          target?.closest(".roster-filter-option") === option,
          `Another tap target covers ${option.textContent}`,
        );
      }
    });
  } finally {
    flushSync(() => root.unmount());
    window.setTimeout = originalTimeout;
    window.clearTimeout = originalClear;
    pending.clear();
    running = false;
  }
  return {
    width: innerWidth,
    height: innerHeight,
    passed: results.filter((result) => result.passed).length,
    failed: results.filter((result) => !result.passed).length,
    results,
  };
}
