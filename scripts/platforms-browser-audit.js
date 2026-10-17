// Evaluate after journey-browser-probe.js on journey-qa-server.ts.
// Run __platformAudit.start('merida') from the arena lobby and inspect .job.
// Set .holdForReview=true to pause on the first platform; call .continue() to resume.
// Only UI controls change the fight; engine state is observed, never edited.
(async () => {
  const q = window.__journeyAudit;
  if (!q) throw new Error("Install journey-browser-probe.js first.");
  const { stages, world } = await (await fetch("/api/qa/stages")).json();
  const audit = (window.__platformAudit = {
    records: window.__platformAudit?.records ?? [],
    stages,
    world,
  });
  const release = () =>
    ["KeyA", "KeyD", "ArrowLeft", "ArrowRight", "KeyS"].forEach((code) =>
      q.key(code, false),
    );
  const snapshot = () => {
    const s = q.state();
    return {
      tick: s.tick,
      players: s.players.map((p) => ({
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        grounded: p.grounded,
        support: p.supportPlatform,
        jumps: p.jumps,
        stocks: p.stocks,
      })),
    };
  };
  const platform = (stage, index) => {
    const p = { ...stage.platforms[index] };
    if (p.motion) {
      const { axis, range, period, phase = 0 } = p.motion;
      p[axis] +=
        Math.round(
          Math.sin(((q.state().tick + phase) * Math.PI * 2) / period) *
            range *
            1000,
        ) / 1000;
    }
    return p;
  };
  const ticks = async (count) => {
    audit.action = `wait ${count} ticks`;
    const end = q.state().tick + count;
    await q.until(() => q.state().tick >= end, 6000);
  };
  const steer = (index, target, air = false) => {
    const p = q.state().players[index];
    const error = target - (p.x + p.vx * (air ? 7 : 2));
    q.key(index ? "ArrowLeft" : "KeyA", error < -7);
    q.key(index ? "ArrowRight" : "KeyD", error > 7);
  };
  const open = async (stage, mode = "local") => {
    audit.action = `open ${stage.id}`;
    if (q.state() || document.querySelector(".ready-room"))
      throw new Error("Start outside a fight or room.");
    document.querySelector("#mode-" + mode).click();
    await q.wait(40);
    q.input("#player-name", "Plataformas P1");
    if (mode === "local") q.input("#second-name", "Plataformas P2");
    document
      .querySelector('[aria-label="Elegir escenario ' + stage.name + '"]')
      .click();
    await q.wait(40);
    document.querySelector(".arcade-start").click();
    await q.until(() => q.state());
    await q.until(() => !document.querySelector(".loading-overlay"));
    document.querySelector('[aria-label="Saltar presentaciones"]')?.click();
    await q.until(() => q.state().phase === "playing", 10000);
  };
  const exit = async () => {
    release();
    if (!q.state()) return;
    if (!document.querySelector(".pause-card")) {
      q.tap("Escape");
      await q.wait(50);
    }
    [...document.querySelectorAll(".pause-card button")]
      .find((e) => e.textContent.includes("Salir"))
      .click();
    await q.until(() => !q.state());
  };
  const jumpOnto = async (stage, index) => {
    audit.action = `approach ${stage.id}:${index}`;
    let start = q.state().tick;
    while (true) {
      const p = platform(stage, index),
        center = p.x + p.width / 2;
      steer(0, center);
      steer(1, Math.min(1020, center + 300));
      if (Math.abs(q.state().players[0].x - center) < 14) break;
      if (q.state().tick - start > 240)
        throw new Error(
          "Cannot approach platform " +
            index +
            ": " +
            JSON.stringify(snapshot()),
        );
      await q.wait(25);
    }
    release();
    await ticks(10);
    q.tap("KeyW");
    audit.action = `double jump ${stage.id}:${index}`;
    const firstJump = q.state().tick;
    while (q.state().tick - firstJump < 14) {
      const p = platform(stage, index);
      steer(0, p.x + p.width / 2, true);
      await q.wait(20);
    }
    q.tap("KeyW");
    audit.action = `land ${stage.id}:${index}`;
    if (q.props().mode === "practice") q.key("KeyU", true);
    start = q.state().tick;
    while (!(
      q.state().players[0].grounded &&
      q.state().players[0].supportPlatform === index
    )) {
      const p = platform(stage, index);
      steer(0, p.x + p.width / 2, true);
      if (q.state().tick - start > 180)
        throw new Error(
          "Cannot land on platform " +
            index +
            ": " +
            JSON.stringify(snapshot()),
        );
      await q.wait(20);
    }
    release();
    await ticks(24);
  };
  audit.run = async (stageId, indices) => {
    const stage = stages.find((s) => s.id === stageId);
    if (!stage) throw new Error("Unknown stage");
    const results = [];
    try {
      await open(stage);
      if (!stage.platforms.length) {
        q.key("KeyS", true);
        await ticks(12);
        q.key("KeyS", false);
        q.check(
          stageId + ": bajar no atraviesa el suelo principal",
          q.state().players[0].grounded &&
            q.state().players[0].y === world.floor,
        );
        q.tap("KeyW");
        await ticks(14);
        q.tap("KeyW");
        await q.until(() => q.state().players[0].grounded, 6000);
        q.check(
          stageId + ": doble salto vuelve al suelo",
          q.state().players[0].y === world.floor &&
            q.state().players[0].jumps === 0,
        );
        const initialStocks = q.state().players[0].stocks;
        const start = q.state().tick;
        q.key("KeyA", true);
        while (q.state().players[0].stocks === initialStocks) {
          steer(1, 550);
          if (q.state().tick - start > 240)
            throw new Error("Floor edge did not release fighter");
          await q.wait(25);
        }
        release();
        results.push(
          q.check(
            stageId + ": caminar fuera del suelo cae y reaparece",
            q.state().players[0].stocks === initialStocks - 1,
            { state: snapshot() },
          ),
        );
      }
      for (const index of indices ?? stage.platforms.map((_, i) => i)) {
        await jumpOnto(stage, index);
        const before = snapshot(),
          surface = platform(stage, index);
        await ticks(36);
        const after = snapshot(),
          moved = platform(stage, index);
        q.check(
          stageId + ": aterrizar y viajar en plataforma " + index,
          after.players[0].support === index &&
            Math.abs(after.players[0].y - moved.y) < 0.002 &&
            Math.abs(
              after.players[0].x - before.players[0].x - (moved.x - surface.x),
            ) < 0.1,
          {
            index,
            motion: stage.platforms[index].motion ?? null,
            before,
            after,
            surface: moved,
          },
        );
        if (audit.holdForReview && index === (indices?.[0] ?? 0)) {
          q.tap("Escape");
          await q.wait(80);
          audit.checkpoint = { stage: stageId, index, state: snapshot() };
          await new Promise((resolve) => {
            audit.continue = () => {
              audit.checkpoint = null;
              q.tap("Escape");
              resolve();
            };
          });
        }
        const jumpStart = q.state().tick;
        q.tap("KeyW");
        await q.until(() => !q.state().players[0].grounded);
        q.check(
          stageId + ": saltar libera soporte " + index,
          q.state().players[0].supportPlatform === null,
        );
        while (!(
          q.state().players[0].grounded &&
          q.state().players[0].supportPlatform === index
        )) {
          const p = platform(stage, index);
          steer(0, p.x + p.width / 2, true);
          if (q.state().tick - jumpStart > 180)
            throw new Error("Jump did not return to surface");
          await q.wait(20);
        }
        release();
        await ticks(16);
        q.key("KeyS", true);
        await ticks(3);
        q.key("KeyS", false);
        q.check(
          stageId + ": bajar libera soporte " + index,
          !q.state().players[0].grounded,
        );
        await q.until(() => q.state().players[0].supportPlatform === -1, 6000);
        results.push(
          q.check(
            stageId + ": descenso completo " + index,
            q.state().players[0].y === world.floor &&
              q.state().players[0].stocks === 2,
            { index, state: snapshot() },
          ),
        );
      }
      audit.records.push({ stage: stageId, pass: true, results });
      return {
        stage: stageId,
        pass: true,
        platforms: stage.platforms.length,
        results,
      };
    } finally {
      await exit();
    }
  };
  audit.practice = async (stageId, index = 0) => {
    const stage = stages.find((s) => s.id === stageId);
    if (!stage?.platforms[index])
      throw new Error("Choose an elevated platform.");
    try {
      await open(stage, "practice");
      await jumpOnto(stage, index);
      q.key("KeyU", true);
      await q.until(
        () => q.state().players[1].supportPlatform === index,
        10000,
      );
      q.check(stageId + ": CPU alcanza al jugador en la plataforma", true, {
        state: snapshot(),
      });
      q.key("KeyU", false);
      q.key("KeyS", true);
      await ticks(3);
      q.key("KeyS", false);
      await q.until(() => q.state().players[1].dropThrough > 0, 6000);
      q.check(
        stageId + ": CPU solicita bajar de la plataforma",
        !q.state().players[1].grounded,
        { state: snapshot() },
      );
      await q.until(
        () => q.state().players.every((p) => p.supportPlatform === -1),
        6000,
      );
      const result = q.check(
        stageId + ": CPU desciende para perseguir al jugador",
        q.state().players[1].stocks === 2,
        { state: snapshot() },
      );
      audit.records.push({
        stage: stageId,
        mode: "practice",
        pass: true,
        results: [result],
      });
      return result;
    } finally {
      q.key("KeyU", false);
      await exit();
    }
  };
  const startJob = (stageId, run) => {
    if (audit.job?.status === "running")
      throw new Error("An audit is already running.");
    const job = (audit.job = { stage: stageId, status: "running" });
    void run()
      .then((result) => {
        job.status = "passed";
        job.result = result;
      })
      .catch((error) => {
        job.status = "failed";
        job.error = error.stack ?? String(error);
        job.action = audit.action;
      });
    return { started: stageId };
  };
  audit.start = (stageId, indices) =>
    startJob(stageId, () => audit.run(stageId, indices));
  audit.startPractice = (stageId, index = 0) =>
    startJob(stageId, () => audit.practice(stageId, index));
  audit.startBoard = (stageId, index) =>
    startJob(stageId, async () => {
      const stage = stages.find((s) => s.id === stageId);
      if (!q.state() || q.state().stage !== stageId)
        throw new Error("Start the matching fight first.");
      await jumpOnto(stage, index);
      return q.check(
        stageId + ": subir a plataforma en combate activo",
        q.state().players[0].supportPlatform === index,
        { state: snapshot() },
      );
    });
  return {
    installed: true,
    stages: stages.map((s) => ({ id: s.id, platforms: s.platforms.length })),
  };
})();
