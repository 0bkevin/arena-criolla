// Evaluate on /create against an isolated QA server. Creates disposable accounts
// through the real forms; generated credentials never leave this expression.
(async () => {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const until = async (predicate) => {
    const deadline = performance.now() + 5000;
    while (!predicate()) {
      if (performance.now() > deadline)
        throw new Error("Account UI timed out.");
      await wait(20);
    }
  };
  const input = (selector, value) => {
    const element = document.querySelector(selector);
    if (!element) throw new Error(`Missing form field: ${selector}`);
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
  const assert = (pass, message) => {
    if (!pass) throw new Error(message);
  };
  const signout = async () => {
    document.querySelector('button[aria-label="Cerrar sesión"]')?.click();
    await until(() => document.querySelector(".creator-auth input"));
  };
  const signup = async (name) => {
    const account = {
      name,
      email: `qa-${crypto.randomUUID()}@example.test`,
      password: crypto.randomUUID() + "Aa!",
    };
    const tabs = [...document.querySelectorAll('.creator-auth [role="tab"]')];
    tabs.find((tab) => tab.textContent === "Crear cuenta").click();
    await wait(30);
    input('.creator-auth input[autocomplete="nickname"]', name);
    input('.creator-auth input[type="email"]', account.email);
    input('.creator-auth input[type="password"]', account.password);
    await wait(30);
    document
      .querySelector(
        '.creator-auth button[type="submit"], .creator-auth form button',
      )
      .click();
    await until(
      () => document.querySelector(".creator-account")?.textContent === name,
    );
    await wait(100);
    return account;
  };
  const results = [];
  await until(() => document.querySelector(".creator-auth, .creator-account"));
  if (document.querySelector(".creator-account")) await signout();
  const firstAccount = await signup("Primera cuenta QA");
  input('.creator-form input[maxlength="24"]', "Borrador privado QA");
  input(".creator-form textarea", "Descripción privada de la primera cuenta.");
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 2;
  const blob = await new Promise((resolve) => canvas.toBlob(resolve));
  const transfer = new DataTransfer();
  transfer.items.add(new File([blob], "private-qa.png", { type: "image/png" }));
  const upload = document.querySelector('input[type="file"]');
  upload.files = transfer.files;
  upload.dispatchEvent(new Event("change", { bubbles: true }));
  await until(() => document.querySelectorAll(".creator-photo").length === 1);
  await signout();
  await signup("Segunda cuenta QA");
  const draftIsolated =
    document.querySelector('.creator-form input[maxlength="24"]').value ===
      "Segunda cuenta QA" &&
    document.querySelector(".creator-form textarea").value === "" &&
    document.querySelectorAll(".creator-photo").length === 0;
  results.push({
    name: "drafts and reference photos are isolated between accounts",
    pass: draftIsolated,
  });

  // Hold an old authenticated collection response across logout and new signup.
  const originalFetch = window.fetch;
  let release,
    captured = false,
    completed = false;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    if (!captured && String(args[0]) === "/api/creator/characters") {
      captured = true;
      await held;
      completed = true;
      return new Response(
        JSON.stringify({
          characters: [
            {
              id: "custom_" + "a".repeat(32),
              ownerId: "previous-account",
              input: {
                name: "Registro privado anterior QA",
                description: "Private QA fixture",
                style: "agile",
                color: "#669bff",
              },
              status: "failed",
              progress: 0,
              message: "Previous account response",
              character: null,
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return response;
  };
  try {
    document.querySelector(".creator-back").click();
    await until(() => !document.querySelector(".creator-shell"));
    [...document.querySelectorAll("button")]
      .find((button) => button.textContent.trim() === "Crear luchador")
      .click();
    await until(() => captured && document.querySelector(".creator-account"));
    await signout();
    await signup("Tercera cuenta QA");
    release();
    await until(() => completed);
    await wait(150);
    const responsesIsolated = !document
      .querySelector(".creator-workbench")
      .textContent.includes("Registro privado anterior QA");
    results.push({
      name: "late collection responses cannot cross account boundaries",
      pass: responsesIsolated,
    });
  } finally {
    release();
    window.fetch = originalFetch;
  }
  await signout();
  [...document.querySelectorAll('.creator-auth [role="tab"]')]
    .find((tab) => tab.textContent === "Ya tengo cuenta")
    .click();
  await wait(30);
  input('.creator-auth input[type="email"]', firstAccount.email);
  input(
    '.creator-auth input[type="password"]',
    firstAccount.password + "wrong",
  );
  await wait(30);
  document.querySelector(".creator-auth form button").click();
  await until(() => document.querySelector('.creator-auth [role="alert"]'));
  const failedLogin = document
    .querySelector('.creator-auth [role="alert"]')
    .textContent.includes("no coinciden");
  input('.creator-auth input[type="password"]', firstAccount.password);
  await wait(30);
  document.querySelector(".creator-auth form button").click();
  await until(
    () =>
      document.querySelector(".creator-account")?.textContent ===
      firstAccount.name,
  );
  results.push({
    name: "wrong-password errors allow retrying the existing account",
    pass: failedLogin,
  });
  assert(
    results.every((result) => result.pass),
    JSON.stringify(results),
  );
  const session = await (await fetch("/api/auth/session")).json();
  return { pass: true, results, accountId: session.user.id };
})();
