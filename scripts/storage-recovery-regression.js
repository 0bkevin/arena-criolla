// Evaluate after journey-browser-probe.js in the arena lobby, outside a room.
(async () => {
  const q = window.__journeyAudit;
  if (!q || q.state() || document.querySelector(".ready-room"))
    throw new Error("Start in the arena lobby outside a room.");
  const saved = localStorage.getItem("arena-name");
  const remount = async () => {
    [...document.querySelectorAll("button")]
      .find((e) => e.textContent.trim() === "Crear luchador")
      .click();
    await q.until(
      () =>
        location.pathname === "/create" &&
        document.querySelector(".creator-header button"),
    );
    document.querySelector(".creator-header button").click();
    await q.until(() => document.querySelector("#player-name"));
  };
  try {
    localStorage.setItem("arena-name", JSON.stringify({ legacy: true }));
    await remount();
    document.querySelector(".arcade-start").click();
    await q.wait(100);
    return q.check(
      "Un apodo guardado corrupto recupera el formulario sin romper el botón de pelear",
      document.querySelector("#player-name").value === "" &&
        Boolean(document.querySelector("#player-name-error")) &&
        !q.state(),
      {
        value: document.querySelector("#player-name").value,
        error: document.querySelector("#player-name-error")?.textContent,
      },
    );
  } finally {
    if (saved === null) localStorage.removeItem("arena-name");
    else localStorage.setItem("arena-name", saved);
    await remount();
  }
})();
