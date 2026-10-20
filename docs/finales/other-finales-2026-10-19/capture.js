// Run on the Vite finale gallery with T3 preview_evaluate. This is a review
// harness, not a game entry point. All sequences use the actual engine/renderer.
(async () => {
  const [
    { BUILT_IN_FIGHTERS, fighterById },
    { createMatch, emptyInput, stepMatch },
    { finaleById },
    { preloadAssets },
    { renderMatch },
  ] = await Promise.all([
    import("/shared/content.ts"),
    import("/shared/engine.ts"),
    import("/shared/finales.ts"),
    import("/src/game/assets.ts"),
    import("/src/game/renderer.ts"),
  ]);
  const roster = BUILT_IN_FIGHTERS.filter(
    ({ id }) => !["nacho", "capriles"].includes(id),
  );
  const assets = await preloadAssets(
    roster.map(({ id }) => id),
    ["caracas"],
  );
  const display = new FontFace("Barlow Condensed", "url('/fonts/barlow-800.ttf')", { weight: "800" });
  document.fonts.add(await display.load());
  if (
    document.querySelector("#pause")?.getAttribute("aria-pressed") === "false"
  )
    document.querySelector("#pause").click();
  document.querySelector("#showcase-capture")?.remove();
  const canvas = document.createElement("canvas");
  canvas.id = "showcase-capture";
  canvas.width = 1080;
  canvas.height = 640;
  canvas.style.cssText =
    "position:fixed;inset:0;width:100vw;height:100vh;z-index:99999;border-radius:0;background:#000";
  document.body.append(canvas);
  const ctx = canvas.getContext("2d");
  const blank = () => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 1080, 640);
  };
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const run = (window.finaleShowcase = {
    ready: true,
    running: false,
    done: false,
    events: [],
    errors: [],
    roster: roster.map(({ id, name }) => ({ id, name })),
    async start() {
      if (this.running) return;
      this.running = true;
      this.startedAt = Date.now();
      this.events = [];
      blank();
      await sleep(750);
      for (const [index, fighter] of roster.entries()) {
        try {
          const rival = roster[(index + 17) % roster.length];
          const profile = finaleById(fighter.id);
          const state = createMatch("caracas", [
            { name: fighter.shortName, fighter: fighter.id, wins: 3 },
            { name: rival.shortName, fighter: rival.id, wins: 3 },
          ]);
          state.phase = "playing";
          state.tick = 1;
          state.players.forEach((player, slot) => {
            player.x = slot === 0 ? 435 : 625;
            player.y = 555;
            player.facing = slot === 0 ? 1 : -1;
            player.energy = slot === 0 ? 25 : 100;
            player.invincible = 0;
          });
          state.finale = {
            owner: 0,
            target: 1,
            fighter: fighter.id,
            startedTick: 1,
            tick: 0,
            duration: profile.duration,
            x: 530,
            y: 555,
            direction: 1,
            initialHp: 100,
            damage: (28 * fighter.damage + 12) * fighterById(rival.id).armor,
          };
          const input = [emptyInput(), emptyInput()];
          const event = {
            id: fighter.id,
            rival: rival.id,
            name: fighter.name,
            title: profile.title,
            startedAt: Date.now(),
            firstTick: 0,
            frames: 0,
          };
          this.events.push(event);
          await new Promise((resolve) => {
            const start = performance.now();
            const frame = (now) => {
              const elapsed = now - start;
              const target = Math.min(
                profile.duration - 1,
                Math.floor((elapsed * 60) / 1000),
              );
              while (state.finale.tick < target) stepMatch(state, input);
              renderMatch(ctx, state, assets, elapsed, false);
              ctx.fillStyle = "#10151ddd";
              ctx.fillRect(16, 16, 600, 58);
              ctx.fillStyle = "#f6d17a";
              ctx.font = "700 23px system-ui";
              ctx.fillText(fighter.name, 30, 42);
              ctx.fillStyle = "#f6f1e5";
              ctx.font = "15px system-ui";
              ctx.fillText(
                `${index + 1}/44 · ${profile.title} · vs ${rival.name}`,
                30,
                64,
              );
              event.frames++;
              if (elapsed < (profile.duration / 60) * 1000 + 100)
                requestAnimationFrame(frame);
              else {
                event.endedAt = Date.now();
                event.lastTick = state.finale.tick;
                event.targetHp = state.players[1].hp;
                resolve();
              }
            };
            requestAnimationFrame(frame);
          });
          blank();
          await sleep(350);
        } catch (error) {
          this.errors.push({ id: fighter.id, error: String(error) });
          throw error;
        }
      }
      this.done = true;
      this.running = false;
      this.endedAt = Date.now();
      return this.events.length;
    },
  });
  blank();
  return {
    ready: run.ready,
    count: roster.length,
    assets: Object.keys(assets.sprites).length,
  };
})();
