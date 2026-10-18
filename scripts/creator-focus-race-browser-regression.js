// Evaluate on /create after scripts/account-browser-regressions.js has restored
// its first account and photo draft. Only runs on the deterministic QA server.
// Delays the real accepted-creation UI frame across a real logout/new signup.
(async () => {
  const fixture = await (await fetch("/api/qa/fixture")).json();
  if (fixture.provider !== "deterministic")
    throw new Error("Requires the isolated deterministic creator QA server");
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const until = async (predicate) => {
    const end = performance.now() + 8000;
    while (!(await predicate())) {
      if (performance.now() > end)
        throw new Error("Creator focus race timed out");
      await wait(20);
    }
  };
  const input = (selector, value) => {
    const element = document.querySelector(selector);
    if (!element) throw new Error(`Missing ${selector}`);
    const prototype =
      element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value").set.call(
      element,
      value,
    );
    element.dispatchEvent(new Event("input", { bubbles: true }));
  };
  await until(() => document.querySelectorAll(".creator-photo").length === 1);
  const accountBefore = document.querySelector(
    ".creator-account span",
  ).textContent;
  const frames = [];
  const originalFrame = window.requestAnimationFrame;
  window.requestAnimationFrame = (callback) => {
    if (callback.toString().includes("workbench")) {
      frames.push(callback);
      return 0;
    }
    return originalFrame.call(window, callback);
  };
  try {
    document.querySelector(".creator-form .creator-primary").click();
    await until(() => frames.length > 0);
    document.querySelector('button[aria-label="Cerrar sesión"]').click();
    await until(
      async () => !(await (await fetch("/api/auth/session")).json()).user,
    );
    await until(() => document.querySelector(".creator-auth input"));
    document.querySelector("#creator-signup-tab").click();
    await wait(30);
    const accountAfter = "Delayed frame account";
    input('.creator-auth input[autocomplete="nickname"]', accountAfter);
    input(
      '.creator-auth input[type="email"]',
      `frame-${crypto.randomUUID()}@example.test`,
    );
    input('.creator-auth input[type="password"]', crypto.randomUUID() + "Aa!");
    await wait(30);
    document.querySelector(".creator-auth form button").click();
    await until(
      () =>
        document.querySelector(".creator-account span")?.textContent ===
        accountAfter,
    );
    await until(() =>
      document.querySelector('.creator-form input[maxlength="24"]'),
    );
    const editor = document.querySelector(
      '.creator-form input[maxlength="24"]',
    );
    editor.focus();
    const before = { tag: document.activeElement.tagName, scrollY };
    for (const callback of frames) callback(performance.now());
    const after = {
      tag: document.activeElement.tagName,
      label: document.activeElement.getAttribute("aria-label"),
      scrollY,
    };
    return {
      pass:
        document.activeElement === editor && after.scrollY === before.scrollY,
      queuedFrames: frames.length,
      accountBefore,
      accountAfter,
      before,
      after,
    };
  } finally {
    window.requestAnimationFrame = originalFrame;
  }
})();
