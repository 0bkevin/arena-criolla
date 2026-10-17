// Run after journey-browser-probe.js in the arena lobby with no active room.
// The browser plays one side; real WebSocket peers leave and rejoin the room.
(async () => {
  const q = window.__journeyAudit;
  if (!q || q.state() || document.querySelector(".ready-room"))
    throw new Error("Start in the arena lobby outside a room.");
  const peers = [];
  let code;
  const peer = async () => {
    const socket = new WebSocket(
      `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`,
    );
    peers.push(socket);
    const messages = [];
    socket.addEventListener("message", (event) =>
      messages.push(JSON.parse(event.data)),
    );
    await q.until(() => messages.some((m) => m.type === "welcome"));
    socket.send(
      JSON.stringify({
        type: "join",
        code,
        name: "Rival de recuperación",
        fighter: "javier",
        wins: 0,
      }),
    );
    await q.until(() =>
      messages.some((m) => m.type === "room" && m.room.players.length === 2),
    );
    return socket;
  };
  try {
    document.querySelector("#mode-online").click();
    await q.wait(50);
    document.querySelector(".arcade-start").click();
    await q.until(() => document.querySelector("#lobby-name"));
    q.input("#lobby-name", "Anfitrión recuperación");
    await q.wait(50);
    const privacy = document.querySelector(".create-room-panel input");
    if (!privacy.checked) privacy.click();
    await q.wait(50);
    document.querySelector(".create-room-panel button").click();
    await q.until(() => document.querySelector(".ready-room"));
    code = q.room.code;
    const first = await peer();
    await q.until(() => q.room.players.length === 2);
    document.querySelector(".arcade-start").click();
    first.send(JSON.stringify({ type: "ready", ready: true }));
    await q.until(() => q.state());
    first.close();
    await q.until(
      () =>
        !q.state() &&
        document
          .querySelector(".notice-banner")
          ?.textContent.includes("Tu pana salió"),
    );
    await peer();
    await q.until(() => q.room.players.length === 2);
    await q.wait(100);
    const rejoined = !document
      .querySelector(".notice-banner")
      ?.textContent.includes("Tu pana salió");
    // Exercise leaving while the notice is visible again, independently of rejoining.
    peers.at(-1).send(JSON.stringify({ type: "ready", ready: true }));
    document.querySelector(".arcade-start").click();
    await q.until(() => q.state());
    peers.at(-1).close();
    await q.until(
      () =>
        !q.state() &&
        document
          .querySelector(".notice-banner")
          ?.textContent.includes("Tu pana salió"),
    );
    document.querySelector("#mode-practice").click();
    await q.until(() => !document.querySelector(".ready-room"));
    await q.wait(100);
    const left = !document
      .querySelector(".notice-banner")
      ?.textContent.includes("Tu pana salió");
    return q.check(
      "Aviso de salida se limpia al regresar el rival y abandonar la sala",
      rejoined && left,
      { rejoined, left },
    );
  } finally {
    peers.forEach((socket) => socket.close());
    if (document.querySelector("#mode-practice"))
      document.querySelector("#mode-practice").click();
  }
})();
