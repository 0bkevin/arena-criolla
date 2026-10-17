// Run after journey-browser-probe.js, signed into journey-qa-server.ts on /create.
(async () => {
  const q = window.__journeyAudit;
  const fixture = await (await fetch("/api/qa/fixture")).json();
  if (
    !q ||
    fixture.provider !== "deterministic" ||
    !document.querySelector(".creator-form")
  )
    throw new Error(
      "This regression requires the isolated deterministic QA workshop.",
    );
  const name = "Recurso QA " + crypto.randomUUID().slice(0, 6);
  q.input('.creator-form input[maxlength="24"]', name);
  q.input(
    ".creator-form textarea",
    "Personaje sintético para recuperar una carga interrumpida.",
  );
  const canvas = document.createElement("canvas");
  canvas.width = 40;
  canvas.height = 50;
  canvas.getContext("2d").fillRect(0, 0, 40, 50);
  const photo = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg"),
  );
  const transfer = new DataTransfer();
  transfer.items.add(
    new File([photo], "qa-reference.jpg", { type: "image/jpeg" }),
  );
  const upload = document.querySelector('input[type="file"]');
  upload.files = transfer.files;
  upload.dispatchEvent(new Event("change", { bubbles: true }));
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLImageElement.prototype,
    "src",
  );
  let failing = true,
    failures = 0;
  Object.defineProperty(HTMLImageElement.prototype, "src", {
    configurable: true,
    get: descriptor.get,
    set(value) {
      if (
        failing &&
        String(value).startsWith("/api/community/assets/custom_")
      ) {
        failures++;
        setTimeout(() => this.dispatchEvent(new Event("error")), 0);
        return;
      }
      descriptor.set.call(this, value);
    },
  });
  const record = () =>
    [...document.querySelectorAll(".creator-record")].find((element) =>
      element.innerText.includes(name),
    );
  const trial = () =>
    [...record().querySelectorAll("button")]
      .find((element) => element.textContent.includes("Probar"))
      .click();
  try {
    document.querySelector(".creator-form .creator-primary").click();
    await q.until(() => record()?.querySelector(".state-ready"), 10000);
    trial();
    await q.until(() =>
      document
        .querySelector(".loading-overlay h2")
        ?.textContent.includes("No se pudieron cargar"),
    );
    failing = false;
    Object.defineProperty(HTMLImageElement.prototype, "src", descriptor);
    document.querySelector(".loading-overlay button").click();
    await q.until(() => record());
    trial();
    await q.wait(500);
    const recovered =
      !document.querySelector(".loading-overlay") &&
      Boolean(document.querySelector(".arena-canvas"));
    const records = (await (await fetch("/api/creator/characters")).json())
      .characters;
    q.recoveredCharacter = records.find(
      (character) => character.input.name === name,
    );
    return q.check(
      "Recursos recuperados al reintentar sin recargar la página",
      recovered,
      {
        failures,
        name,
        id: q.recoveredCharacter.id,
        overlay: document.querySelector(".loading-overlay h2")?.textContent,
      },
    );
  } finally {
    Object.defineProperty(HTMLImageElement.prototype, "src", descriptor);
  }
})();
