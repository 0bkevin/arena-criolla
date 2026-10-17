// Evaluate after journey-browser-probe.js on the isolated journey QA server.
// Start __characterPhysics.start(index) and poll .job; browser calls time out at 15s.
// UI selection and keyboard input are the only ways this script changes a match.
(async () => {
  const q = window.__journeyAudit;
  if (!q) throw new Error("Install journey-browser-probe.js first.");
  const { stages, world } = await (await fetch("/api/qa/stages")).json();
  const roster = {
    gomez: "Juan Vicente Gómez",
    tioconejo: "Tío Conejo",
    capriles: "Capriles Radonski",
    norkys: "Norkys Batista",
    mcm: "María Corina Machado",
    oscar: "Óscar D’León",
    nacho: "Nacho",
    sayona: "La Sayona",
    chiqui: "Chiquinquirá Delgado",
    momoy: "El Momoy",
    sarcos: "Daniel Sarcos",
    reynaldo: "Reynaldo Armas",
  };
  const audit = (window.__characterPhysics = {
    records: window.__characterPhysics?.records ?? [],
    attempts: window.__characterPhysics?.attempts ?? [],
    contacts: window.__characterPhysics?.contacts ?? [],
    edgePushes: window.__characterPhysics?.edgePushes ?? [],
    matrix: [
      { stage: "caracas", fighters: ["gomez", "tioconejo"], platform: 0 },
      { stage: "guaira", fighters: ["capriles", "norkys"], platform: 0 },
      { stage: "valencia", fighters: ["mcm", "oscar"], platform: 1 },
      { stage: "canaima", fighters: ["nacho", "sayona"], platform: 2 },
      { stage: "maracaibo", fighters: ["chiqui", "momoy"], platform: 2 },
      { stage: "merida", fighters: ["tioconejo", "gomez"], platform: 2 },
      { stage: "coro", fighters: ["norkys", "capriles"], platform: 1 },
      { stage: "roques", fighters: ["sarcos", "reynaldo"], platform: 2 },
      { stage: "poliedro", fighters: ["mcm", "nacho"], platform: null },
    ],
  });
  const keys = [
    {
      left: "KeyA",
      right: "KeyD",
      down: "KeyS",
      jump: "KeyW",
      special: "KeyL",
      heavy: "KeyK",
      dash: "ShiftLeft",
      block: "KeyU",
    },
    {
      left: "ArrowLeft",
      right: "ArrowRight",
      down: "ArrowDown",
      jump: "ArrowUp",
      special: "Digit3",
      heavy: "Digit2",
      dash: "Enter",
      block: "Digit0",
    },
  ];
  const release = () =>
    Object.values(keys).forEach((set) =>
      Object.values(set).forEach((code) => q.key(code, false)),
    );
  const pose = (s = q.state()) => {
    return {
      tick: s.tick,
      phase: s.phase,
      players: s.players.map((p) => ({
        fighter: p.config.fighter,
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        grounded: p.grounded,
        support: p.supportPlatform,
        jumps: p.jumps,
        stocks: p.stocks,
        hp: p.hp,
        energy: p.energy,
        attack: p.attack,
        attackTick: p.attackTick,
        stun: p.stun,
        facing: p.facing,
        rootTicks: p.rootTicks,
        slowTicks: p.slowTicks,
        dropThrough: p.dropThrough,
      })),
      projectiles: s.projectiles.map((p) => ({
        kind: p.kind,
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        owner: p.owner,
      })),
    };
  };
  const check = (name, pass, details = {}) => {
    const result = q.check(audit.case + ": " + name, pass, details);
    audit.current.checks.push(result);
    return result;
  };
  const tick = async (n) => {
    const target = q.state().tick + n;
    await q.until(() => q.state().tick >= target, 6000);
  };
  const surface = (stage, index, atTick = q.state().tick) => {
    const p = { ...stage.platforms[index] };
    if (p.motion) {
      const { axis, range, period, phase = 0 } = p.motion;
      p[axis] +=
        Math.round(
          Math.sin(((atTick + phase) * Math.PI * 2) / period) * range * 1000,
        ) / 1000;
    }
    return p;
  };
  const steer = (i, target, air = false) => {
    const p = q.state().players[i];
    const error = target - (p.x + p.vx * (air ? 7 : 2));
    q.key(keys[i].left, error < -6);
    q.key(keys[i].right, error > 6);
  };
  const select = async (i, id) => {
    document
      .querySelector(`[aria-label="Elegir luchador para P${i + 1}"]`)
      .click();
    await q.wait(30);
    if (
      !document
        .querySelector('[aria-label="Buscar luchador"]')
        ?.matches("input")
    )
      document.querySelector(".roster-search-toggle").click();
    await q.wait(30);
    q.input('input[aria-label="Buscar luchador"]', roster[id]);
    await q.until(() =>
      document.querySelector(`[aria-label="Elegir a ${roster[id]}"]`),
    );
    document.querySelector(`[aria-label="Elegir a ${roster[id]}"]`).click();
    await q.wait(50);
    document.querySelector(".roster-search-toggle").click();
    await q.wait(40);
  };
  const open = async (entry, stage) => {
    audit.action = "select actual fighters and stage";
    if (q.state()) throw new Error("Return to lobby first");
    document.querySelector("#mode-local").click();
    await q.wait(50);
    q.input("#player-name", "Adversarial P1");
    q.input("#second-name", "Adversarial P2");
    await select(0, entry.fighters[0]);
    await select(1, entry.fighters[1]);
    document
      .querySelector(`[aria-label="Elegir escenario ${stage.name}"]`)
      .click();
    await q.wait(50);
    document.querySelector(".arcade-start").click();
    await q.until(() => q.state());
    await q.until(() => !document.querySelector(".loading-overlay"), 10000);
    document.querySelector('[aria-label="Saltar presentaciones"]')?.click();
    await q.until(() => q.state().phase === "playing", 10000);
    check(
      "selection is reflected in actual match",
      q.state().stage === stage.id &&
        q
          .state()
          .players.every((p, i) => p.config.fighter === entry.fighters[i]),
      { expected: entry, state: pose() },
    );
  };
  const exit = async () => {
    release();
    if (!q.state()) return;
    if (!document.querySelector(".pause-card")) {
      q.tap("Escape");
      await q.wait(60);
    }
    [...document.querySelectorAll(".pause-card button")]
      .find((e) => e.textContent.includes("Salir"))
      ?.click();
    await q.until(() => !q.state());
  };
  const approach = async (i, target, park = true) => {
    const start = q.state().tick;
    const otherSide =
      Math.sign(q.state().players[1 - i].x - q.state().players[i].x) || 1;
    while (true) {
      const x = typeof target === "function" ? target() : target;
      steer(i, x, !q.state().players[i].grounded);
      if (park) {
        const actorX = q.state().players[i].x;
        const parkX =
          otherSide > 0
            ? Math.max(x + 300, actorX + 100)
            : Math.min(x - 300, actorX - 100);
        steer(1 - i, Math.max(70, Math.min(1010, parkX)));
      }
      if (Math.abs(q.state().players[i].x - x) < 12) break;
      if (q.state().tick - start > 320)
        throw new Error("Cannot approach: " + JSON.stringify(pose()));
      await q.wait(20);
    }
    release();
    await tick(10);
  };
  const board = async (stage, index, i, offset = 0, park = true) => {
    audit.action = `P${i + 1} approach/board ${index}`;
    await approach(
      i,
      () => {
        const p = surface(stage, index);
        return p.x + p.width / 2 + offset;
      },
      park,
    );
    q.tap(keys[i].jump);
    const start = q.state().tick;
    while (q.state().tick - start < 14) {
      const p = surface(stage, index);
      steer(i, p.x + p.width / 2 + offset, true);
      await q.wait(20);
    }
    q.tap(keys[i].jump);
    const second = pose();
    await tick(2);
    check(
      `P${i + 1} second jump registers`,
      q.state().players[i].jumps === 2 && q.state().players[i].vy < 0,
      { afterSecondJump: pose(), inputAt: second.tick },
    );
    const deadline = q.state().tick + 180;
    while (!(
      q.state().players[i].grounded &&
      q.state().players[i].supportPlatform === index
    )) {
      const p = surface(stage, index);
      steer(i, p.x + p.width / 2 + offset, true);
      if (q.state().tick > deadline)
        throw new Error("Cannot board: " + JSON.stringify(pose()));
      await q.wait(20);
    }
    release();
    await tick(18);
  };
  const elevated = async (entry, stage, i) => {
    const index = entry.platform;
    await board(stage, index, i);
    const before = pose(),
      a = surface(stage, index);
    await tick(stage.platforms[index].motion ? 95 : 22);
    const after = pose(),
      b = surface(stage, index);
    check(
      `P${i + 1} lands, resets jumps and rides neutral surface`,
      after.players[i].support === index &&
        after.players[i].jumps === 0 &&
        Math.abs(after.players[i].y - b.y) < 0.002 &&
        Math.abs(after.players[i].x - before.players[i].x - (b.x - a.x)) < 0.2,
      { before, after, beforeSurface: a, afterSurface: b },
    );
    q.tap(keys[i].jump);
    await tick(3);
    check(
      `P${i + 1} jump detaches`,
      !q.state().players[i].grounded &&
        q.state().players[i].supportPlatform === null &&
        q.state().players[i].vy < 0,
      { state: pose() },
    );
    const deadline = q.state().tick + 140;
    while (!(
      q.state().players[i].grounded &&
      q.state().players[i].supportPlatform === index
    )) {
      const p = surface(stage, index);
      steer(i, p.x + p.width / 2, true);
      if (q.state().tick > deadline)
        throw new Error("Cannot reland: " + JSON.stringify(pose()));
      await q.wait(20);
    }
    release();
    await tick(10);
    check(`P${i + 1} relands`, q.state().players[i].jumps === 0, {
      state: pose(),
    });
    // Observe the real special from a platform, including blink/lift/backstep.
    const specialBefore = pose();
    const samples = [];
    q.key(keys[1 - i].block, true);
    q.tap(keys[i].special);
    for (let n = 0; n < 14; n++) {
      await tick(4);
      samples.push(pose());
    }
    check(
      `P${i + 1} special consumes energy and remains finite`,
      samples.some((s) => s.players[i].attack === "special") &&
        samples.some(
          (s) => s.players[i].energy < specialBefore.players[i].energy - 20,
        ) &&
        samples.every((s) =>
          s.players.every((p) => [p.x, p.y, p.vx, p.vy].every(Number.isFinite)),
        ) &&
        q.state().players[i].stocks === specialBefore.players[i].stocks,
      { before: specialBefore, samples },
    );
    const fighter = entry.fighters[i];
    const lifts = ["tioconejo", "norkys", "mcm", "oscar", "nacho"];
    check(
      `P${i + 1} special respects surface support and character movement`,
      samples.every((s) =>
        s.players.every((p) => {
          if (!p.grounded) return p.support === null;
          const support =
            p.support === -1
              ? {
                  x: world.left,
                  y: world.floor,
                  width: world.right - world.left,
                }
              : surface(stage, p.support, s.tick);
          return (
            support &&
            Math.abs(p.y - support.y) < 0.002 &&
            p.x >= support.x - 5.001 &&
            p.x <= support.x + support.width + 5.001
          );
        }),
      ) &&
        (!lifts.includes(fighter) ||
          samples.some(
            (s) => !s.players[i].grounded && s.players[i].vy < -0.5,
          )) &&
        (!["capriles", "chiqui", "sayona"].includes(fighter) ||
          samples.some(
            (s) => Math.abs(s.players[i].x - specialBefore.players[i].x) > 60,
          )),
      {
        fighter,
        samples: samples.map((s) => ({ tick: s.tick, actor: s.players[i] })),
      },
    );
    // Keep the unattended rival guarded until long-lived projectiles expire.
    await tick(80);
    q.key(keys[1 - i].block, false);
    audit.action = `P${i + 1} S/drop after special`;
    q.key(keys[i].down, true);
    await q.until(() => q.state().players[i].supportPlatform === -1, 7000);
    q.key(keys[i].down, false);
    check(
      `P${i + 1} descends through elevated surfaces to floor`,
      q.state().players[i].y === world.floor &&
        q.state().players[i].stocks === 2,
      { state: pose() },
    );
  };
  const floor = async (i) => {
    audit.action = `P${i + 1} floor dash and edge recovery`;
    const leftSide = q.state().players[i].x < q.state().players[1 - i].x;
    await approach(i, leftSide ? 400 : 680);
    q.key(keys[i].right, true);
    await tick(3);
    q.key(keys[i].right, false);
    await tick(2);
    const before = pose();
    q.tap(keys[i].dash);
    await tick(4);
    check(
      `P${i + 1} floor dash responds`,
      q.state().players[i].dash > 0 &&
        Math.abs(q.state().players[i].x - before.players[i].x) > 35,
      { before, after: pose() },
    );
    await tick(32);
    await approach(i, leftSide ? 70 : 1010);
    steer(1 - i, leftSide ? 430 : 650);
    await tick(8);
    release();
    const outward = leftSide ? keys[i].left : keys[i].right;
    const inward = leftSide ? keys[i].right : keys[i].left;
    q.key(outward, true);
    await q.until(
      () =>
        leftSide
          ? q.state().players[i].x < world.left - 6
          : q.state().players[i].x > world.right + 6,
      4000,
    );
    q.key(outward, false);
    const outside = pose();
    check(
      `P${i + 1} floor edge releases`,
      !q.state().players[i].grounded &&
        q.state().players[i].supportPlatform === null,
      { state: outside },
    );
    q.key(inward, true);
    q.tap(keys[i].jump);
    await tick(14);
    q.tap(keys[i].jump);
    await q.until(
      () =>
        leftSide ? q.state().players[i].x > 100 : q.state().players[i].x < 980,
      4000,
    );
    release();
    await q.until(() => q.state().players[i].grounded, 6000);
    check(
      `P${i + 1} recovers from edge with jumps`,
      q.state().players[i].stocks === 2 && q.state().players[i].jumps === 0,
      { state: pose(), outsideTick: outside.tick },
    );
    if (audit.current.platform === null) {
      const specialBefore = pose();
      const samples = [];
      q.tap(keys[i].special);
      for (let n = 0; n < 14; n++) {
        await tick(4);
        samples.push(pose());
      }
      check(
        `P${i + 1} floor special completes`,
        q.state().players[i].stocks === 2 &&
          !q.state().players[i].attack &&
          samples.some(
            (s) => s.players[i].energy < specialBefore.players[i].energy - 20,
          ) &&
          samples.some((s) => !s.players[i].grounded && s.players[i].vy < 0) &&
          samples.some(
            (s) => Math.abs(s.players[i].x - specialBefore.players[i].x) > 60,
          ),
        { before: specialBefore, samples, state: pose() },
      );
    }
  };
  audit.run = async (matrixIndex) => {
    const entry = audit.matrix[matrixIndex];
    if (!entry) throw new Error("Unknown matrix index");
    const stage = stages.find((s) => s.id === entry.stage);
    audit.case = entry.stage;
    const record = (audit.current = {
      ...entry,
      pass: false,
      checks: [],
      startedAt: new Date().toISOString(),
    });
    audit.attempts.push(record);
    try {
      await open(entry, stage);
      record.matchId = q.state().id;
      for (const i of [0, 1]) {
        if (entry.platform !== null) await elevated(entry, stage, i);
        await floor(i);
      }
      record.final = pose();
      check(
        "both fighters preserve stocks through traversal",
        q.state().players.every((p) => p.stocks === 2),
      );
      record.pass = true;
      record.finishedAt = new Date().toISOString();
      audit.records.push(record);
      return {
        stage: entry.stage,
        fighters: entry.fighters,
        pass: true,
        checks: record.checks.length,
      };
    } catch (error) {
      record.failure = {
        error: error.stack ?? String(error),
        action: audit.action,
        state: q.state() && pose(),
      };
      throw error;
    } finally {
      await exit();
    }
  };
  audit.start = (matrixIndex) => {
    if (audit.job?.status === "running") throw new Error("A run is active");
    const job = (audit.job = { matrixIndex, status: "running" });
    void audit
      .run(matrixIndex)
      .then((result) => {
        job.status = "passed";
        job.result = result;
      })
      .catch((error) => {
        job.status = "failed";
        job.error = error.stack ?? String(error);
        job.action = audit.action;
      });
    return { started: matrixIndex, entry: audit.matrix[matrixIndex] };
  };
  audit.pose = pose;
  audit.contactRun = async (
    matrixIndex,
    kind = "heavy",
    attackers = [0, 1],
  ) => {
    const entry = audit.matrix[matrixIndex];
    const stage = stages.find((s) => s.id === entry.stage);
    if (entry.platform === null) throw new Error("Choose an elevated surface");
    audit.case = entry.stage + ": " + kind + " contact";
    const record = (audit.current = {
      ...entry,
      kind,
      pass: false,
      checks: [],
      startedAt: new Date().toISOString(),
    });
    audit.attempts.push(record);
    try {
      await open(entry, stage);
      record.matchId = q.state().id;
      for (const i of attackers) {
        audit.action = `board both fighters for P${i + 1} ${kind}`;
        await board(stage, entry.platform, 0, -36);
        await board(stage, entry.platform, 1, 36, false);
        await tick(12);
        check(
          `P${i + 1} contact starts with both fighters supported`,
          q.state().players.every((p) => p.supportPlatform === entry.platform),
          { state: pose() },
        );
        const before = pose();
        const samples = [];
        q.tap(keys[i][kind]);
        for (let n = 0; n < (kind === "special" ? 12 : 15); n++) {
          await tick(2);
          samples.push(pose());
          if (
            kind === "special" &&
            entry.fighters[i] === "momoy" &&
            q.state().players[1 - i].rootTicks > 0 &&
            q.state().players[1 - i].stun === 0
          )
            break;
        }
        const target = 1 - i;
        if (kind === "heavy") {
          check(
            `P${i + 1} heavy detaches victim and preserves attacker support`,
            samples.some(
              (s) =>
                s.players[target].hp < before.players[target].hp &&
                !s.players[target].grounded &&
                s.players[target].support === null &&
                s.players[target].vy < 0,
            ) && samples.every((s) => s.players[i].support === entry.platform),
            { before, samples },
          );
        } else if (entry.fighters[i] === "momoy") {
          const rooted = samples.filter((s) => s.players[target].rootTicks > 0);
          check(
            "Momoy roots the actual victim on the moving surface",
            rooted.length > 0 &&
              rooted.every(
                (s) =>
                  s.players[target].grounded &&
                  s.players[target].support === entry.platform &&
                  Math.abs(
                    s.players[target].y -
                      surface(stage, entry.platform, s.tick).y,
                  ) < 0.002 &&
                  s.players[target].vx === 0,
              ),
            { before, samples },
          );
          await q.until(() => q.state().players[target].stun === 0, 4000);
          const beforeEscape = pose();
          check(
            "root remains active immediately before escape input",
            q.state().players[target].rootTicks > 0,
            { state: beforeEscape },
          );
          q.tap(keys[target].jump);
          await tick(2);
          check(
            "fresh jump breaks roots after hit recovery",
            q.state().players[target].rootTicks === 0 &&
              !q.state().players[target].grounded &&
              q.state().players[target].vy < 0,
            { state: pose() },
          );
        } else {
          check(
            `P${i + 1} special contacts victim`,
            samples.some(
              (s) => s.players[target].hp < before.players[target].hp,
            ) &&
              (entry.fighters[i] !== "reynaldo" ||
                samples.some(
                  (s) =>
                    s.players[target].hp < before.players[target].hp &&
                    s.players[target].vx *
                      Math.sign(
                        before.players[i].x - before.players[target].x,
                      ) >
                      0 &&
                    !s.players[target].grounded &&
                    s.players[target].support === null &&
                    s.players[target].slowTicks > 0,
                )),
            { before, samples },
          );
        }
        q.key(keys[target].down, true);
        await tick(8);
        await q.until(
          () => q.state().players[target].supportPlatform === -1,
          7000,
        );
        q.key(keys[target].down, false);
        await tick(20);
      }
      record.pass = true;
      record.final = pose();
      audit.contacts.push(record);
      return {
        stage: entry.stage,
        kind,
        attackers,
        pass: true,
        checks: record.checks.length,
      };
    } catch (error) {
      record.failure = {
        error: error.stack ?? String(error),
        action: audit.action,
        state: q.state() && pose(),
      };
      throw error;
    } finally {
      await exit();
    }
  };
  audit.startContact = (matrixIndex, kind = "heavy", attackers = [0, 1]) => {
    if (audit.job?.status === "running") throw new Error("A run is active");
    const job = (audit.job = { matrixIndex, kind, status: "running" });
    void audit
      .contactRun(matrixIndex, kind, attackers)
      .then((result) => {
        job.status = "passed";
        job.result = result;
      })
      .catch((error) => {
        job.status = "failed";
        job.error = error.stack ?? String(error);
        job.action = audit.action;
      });
    return { started: matrixIndex, kind, attackers };
  };
  audit.edgePush = async () => {
    const entry = audit.matrix[8];
    const stage = stages.find((s) => s.id === entry.stage);
    audit.case = "poliedro: body push over floor edge";
    const record = (audit.current = {
      ...entry,
      kind: "edge-push",
      pass: false,
      checks: [],
      startedAt: new Date().toISOString(),
      samples: [],
      violations: [],
    });
    audit.attempts.push(record);
    audit.edgePushes.push(record);
    let restoreObservation = () => {};
    const originalClone = window.structuredClone;
    let liveState;
    // Game creates its mutable local simulation with the first match clone.
    // Return every clone unchanged; retain that first object's identity only.
    window.structuredClone = function (...args) {
      const result = Reflect.apply(originalClone, this, args);
      if (
        !liveState &&
        result?.players &&
        result.phase === "intro" &&
        result.tick === 0
      )
        liveState = result;
      return result;
    };
    try {
      await open(entry, stage);
      window.structuredClone = originalClone;
      if (
        !liveState ||
        liveState.id !== q.state().id ||
        liveState.phase !== "playing"
      )
        throw new Error("Live simulation observation was not installed");
      record.matchId = q.state().id;
      audit.action = "park P2 near right ledge using keyboard";
      await approach(1, 1020);
      release();
      await tick(20);
      record.before = pose();
      check(
        "P2 initially rests inside floor support",
        q.state().players[1].grounded &&
          q.state().players[1].stocks === 2 &&
          q.state().players[1].x <= world.right + 5,
        { state: pose() },
      );
      audit.action = "P1 walks into idle P2 at the edge";
      // Game's UI clone updates about every 100ms and misses single-step errors.
      // Observe the live projectile-array assignment after body separation,
      // preserving the exact array and descriptor. No fighter value is changed.
      const observed = liveState;
      const descriptor = Object.getOwnPropertyDescriptor(
        observed,
        "projectiles",
      );
      let shots = observed.projectiles;
      record.captureMode = "each physical step, after body separation";
      Object.defineProperty(observed, "projectiles", {
        configurable: true,
        enumerable: descriptor.enumerable,
        get: () => shots,
        set: (value) => {
          shots = value;
          const s = pose(observed);
          const p = s.players[1];
          if (p.x > world.right - 20) record.samples.push(s);
          if (
            p.grounded &&
            p.support === -1 &&
            p.x > world.right + 5 + 0.000001
          )
            record.violations.push(s);
        },
      });
      restoreObservation = () =>
        Object.defineProperty(observed, "projectiles", {
          ...descriptor,
          value: shots,
        });
      q.key(keys[0].right, true);
      const deadline = q.state().tick + 180;
      while (
        q.state().tick < deadline &&
        q.state().players[1].x < world.right + 50
      ) {
        await q.wait(3);
      }
      release();
      check(
        "body push immediately releases unsupported feet",
        record.violations.length === 0 &&
          record.samples.some(
            (s) => !s.players[1].grounded && s.players[1].x > world.right + 5,
          ),
        {
          violations: record.violations.slice(0, 3),
          sampleCount: record.samples.length,
          firstSample: record.samples[0],
          finalSample: record.samples.at(-1),
        },
      );
      record.pass = true;
      return { pass: true, sampleCount: record.samples.length, violations: 0 };
    } catch (error) {
      record.failure = {
        error: error.stack ?? String(error),
        action: audit.action,
        state: q.state() && pose(),
      };
      throw error;
    } finally {
      window.structuredClone = originalClone;
      restoreObservation();
      await exit();
    }
  };
  audit.startEdgePush = () => {
    if (audit.job?.status === "running") throw new Error("A run is active");
    const job = (audit.job = { kind: "edge-push", status: "running" });
    void audit
      .edgePush()
      .then((result) => {
        job.status = "passed";
        job.result = result;
      })
      .catch((error) => {
        job.status = "failed";
        job.error = error.stack ?? String(error);
        job.action = audit.action;
      });
    return { started: "edge-push" };
  };
  audit.startBatch = (indices) => {
    if (audit.job?.status === "running") throw new Error("A run is active");
    const job = (audit.job = { indices, status: "running", completed: [] });
    void (async () => {
      for (const index of indices) {
        job.matrixIndex = index;
        job.completed.push(await audit.run(index));
      }
      job.status = "passed";
    })().catch((error) => {
      job.status = "failed";
      job.error = error.stack ?? String(error);
      job.action = audit.action;
    });
    return { started: indices };
  };
  return { installed: true, matrix: audit.matrix };
})();
