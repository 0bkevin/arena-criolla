// Evaluate after journey-browser-probe.js in a finished creator trial.
(async () => {
  const q = window.__journeyAudit;
  if (
    !q?.state() ||
    q.state().phase !== "finished" ||
    location.pathname !== "/create"
  )
    throw new Error(
      "Finish a real creator trial before running this regression.",
    );
  const previousId = q.state().id;
  const button = [...document.querySelectorAll("button")].find((element) =>
    element.textContent.includes("¡Revancha!"),
  );
  if (!button) throw new Error("The rematch button is missing.");
  button.click();
  await q.wait(150);
  const state = q.state();
  return q.check(
    "La revancha del taller reinicia partida, salud y vidas",
    state.id !== previousId &&
      state.phase === "intro" &&
      state.players.every((player) => player.hp === 100 && player.stocks === 2),
    {
      previousId,
      nextId: state.id,
      phase: state.phase,
      resultVisible: Boolean(document.querySelector(".result-card")),
    },
  );
})();
