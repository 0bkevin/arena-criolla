(async () => {
  const [{ fighterById }, { createMatch, emptyInput, stepMatch }, { finaleById }, { preloadAssets }, { renderMatch }] = await Promise.all([
    import("/shared/content.ts"), import("/shared/engine.ts"), import("/shared/finales.ts"), import("/src/game/assets.ts"), import("/src/game/renderer.ts"),
  ]);
  const pairs = [["capriles", "nacho"], ["capriles", "javier"], ["capriles", "knoche"], ["nacho", "capriles"], ["nacho", "javier"], ["nacho", "knoche"], ["javier", "capriles"], ["knoche", "javier"]];
  const assets = await preloadAssets(["capriles", "nacho", "javier", "knoche"], ["caracas"]);
  const font = new FontFace("Barlow Condensed", "url('/fonts/barlow-800.ttf')", { weight: "800" });
  document.fonts.add(await font.load());
  const canvas = document.createElement("canvas"); canvas.width = 1080; canvas.height = 640;
  canvas.style.cssText = "width:100%;max-width:1080px"; document.body.append(canvas);
  const ctx = canvas.getContext("2d"), crop = document.createElement("canvas");
  crop.width = 740; crop.height = 410;
  const cropped = crop.getContext("2d");
  const run = window.identityExport = { events: [], done: false, async start() {
    for (const [actor, rival] of pairs) {
      const profile = finaleById(actor), id = `${actor}-${rival}`;
      const state = createMatch("caracas", [{ name: fighterById(actor).name, fighter: actor, wins: 3 }, { name: fighterById(rival).name, fighter: rival, wins: 3 }]);
      state.phase = "playing"; state.tick = 1;
      state.players.forEach((p, slot) => { p.x = slot ? 625 : 435; p.y = 555; p.facing = slot ? -1 : 1; p.invincible = 0; });
      state.finale = { owner: 0, target: 1, fighter: actor, startedTick: 1, tick: 0, duration: profile.duration, x: 530, y: 555, direction: 1, initialHp: 100, damage: (28 * fighterById(actor).damage + 12) * fighterById(rival).armor };
      const input = [emptyInput(), emptyInput()], blobs = [], event = { id, actor, rival, durationTicks: profile.duration, ticks: [], targetHp: 100 };
      for (let tick = 0; tick < profile.duration; tick += profile.duration / 36) {
        while (state.finale.tick < tick) stepMatch(state, input);
        renderMatch(ctx, state, assets, tick / 60 * 1000, false);
        cropped.clearRect(0, 0, 740, 410); cropped.drawImage(canvas, 170, 210, 740, 410, 0, 0, 740, 410);
        blobs.push(await new Promise(resolve => crop.toBlob(resolve, "image/webp", 0.96)));
        event.ticks.push(tick);
      }
      const header = new TextEncoder().encode(JSON.stringify(blobs.map(blob => blob.size))), size = new Uint8Array(4);
      new DataView(size.buffer).setUint32(0, header.length, true);
      const response = await fetch(`/__frames/${id}`, { method: "POST", body: new Blob([size, header, ...blobs]) });
      if (!response.ok) throw Error(`${id}: ${response.status}`);
      event.targetHp = state.players[1].hp; this.events.push(event);
      document.querySelector("#status").textContent = `${this.events.length}/${pairs.length} ${id}`;
    }
    this.done = true; return this.events;
  } };
  return { ready: true, scenes: pairs.length };
})();
