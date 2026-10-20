/* Paste this file through the native browser's preview_evaluate after the FINAL
 * portable HTML has loaded. No imports, fetches, source files or build server. */
(() => {
  if (globalThis.arenaPortableGuideVerification) throw Error("The portable verifier is already installed; reload before another verification run.");
  const MOVES = ["light", "heavy", "combo1", "combo2", "special", "final"];
  const FORMS = { conde: { id: "conde-bond", ticks: 360, multiplier: 1.2 }, emilio: { id: "el-chunior", ticks: 360, multiplier: 1.2 } };
  const epsilon = 1e-7, close = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= epsilon;
  const check = (condition, message, failures) => { if (!condition) failures.push(message); };
  const sequenceFor = move => move === "combo1" ? ["light", "heavy"] : move === "combo2" ? ["light", "light", "heavy"] : [move === "final" ? "super" : move];

  /** Pure mechanical checks, also available for focused fixtures and debugging. */
  function analyzeSnapshots({ fighter, move, snapshots, text = {}, baselines = {} }) {
    const failures = [], contactChecks = [], first = snapshots[0], last = snapshots.at(-1);
    const contact = (condition, message) => { contactChecks.push(!!condition); check(condition, message, failures); };
    if (!first || snapshots.length < 2 || !Array.isArray(first.players) || first.players.length !== 2) return { fighter, move, passed: false, failures: ["Missing complete two-player timeline"], frames: snapshots.length };
    const initial = first.players[1], rival = initial.config.fighter;
    const attackStarts = [], hitEvents = [], damageEvents = [], stockEvents = [], reflections = [], transformations = [];
    const seenHits = new Set(), projectileOwners = new Map(), projectileKinds = new Set();
    let minHp = initial.hp, minStocks = initial.stocks, slow = 0, root = 0, countered = false, sawCapture = false, clockAdvancedInForm = false, lastCapturedFrame = -1, capturedClockPaused = true;
    let activeSequence = [], opponentHeavy = false, opponentSpecial = false;
    const expectedSequence = sequenceFor(move);
    for (let frame = 0; frame < snapshots.length; frame++) {
      const state = snapshots[frame], player = state.players?.[0], target = state.players?.[1], previous = snapshots[frame - 1];
      if (!player || !target || player.config.fighter !== fighter || target.config.fighter !== rival) { failures.push(`Fighter state mismatch at frame ${frame}`); break; }
      if ([player.x, player.y, target.x, target.y, target.hp, target.stocks, player.energy].some(value => !Number.isFinite(value))) failures.push(`Non-finite combat state at frame ${frame}`);
      minHp = Math.min(minHp, target.hp); minStocks = Math.min(minStocks, target.stocks);
      slow = Math.max(slow, target.slowTicks ?? 0); root = Math.max(root, target.rootTicks ?? 0); countered ||= !!player.countered;
      opponentHeavy ||= target.attack === "heavy"; opponentSpecial ||= target.attack === "special";
      if (player.attack && (!previous || previous.players[0].attack !== player.attack || player.attackTick < previous.players[0].attackTick)) attackStarts.push({ frame, kind: player.attack });
      const history = (player.history ?? []).map(entry => entry.action);
      if (expectedSequence.every((action, index) => history.slice(-expectedSequence.length)[index] === action)) activeSequence = history.slice(-expectedSequence.length);
      for (const effect of state.effects ?? []) if (effect.kind === "hit" && effect.owner === 0 && !seenHits.has(effect.id)) { seenHits.add(effect.id); hitEvents.push({ frame, kind: effect.impact ?? player.attack, id: effect.id }); }
      if (previous) {
        const before = previous.players[1], lostStock = Math.max(0, before.stocks - target.stocks), damage = before.stocks === target.stocks ? Math.max(0, before.hp - target.hp) : target.hp === 0 ? Math.max(0, before.hp) : 0;
        if (lostStock) stockEvents.push({ frame, lost: lostStock, hpBefore: before.hp, hpAfter: target.hp });
        if (damage > epsilon) {
          const hit = hitEvents.findLast(event => event.frame === frame), impact = hit?.kind ?? null;
          damageEvents.push({ frame, kind: impact, hitId: hit?.id ?? null, attackStartFrame: attackStarts.findLast(start => start.kind === impact)?.frame ?? null, damage, transformed: !!player.transformation, multiplier: player.transformation?.damageMultiplier ?? 1, history: history.join(","), attackTick: player.attackTick });
        }
      }
      if (state.finale) {
        sawCapture = true; lastCapturedFrame = frame;
        if (state.finale.owner !== 0 || state.finale.target !== 1 || state.finale.fighter !== fighter) failures.push(`Capture belongs to the wrong actor at frame ${frame}`);
      }
      if (previous?.finale && previous.remaining !== state.remaining) capturedClockPaused = false;
      if (player.transformation) {
        transformations.push({ frame, gameTick: state.tick, ...player.transformation });
        if (previous?.players[0].transformation && state.tick > previous.tick && state.remaining < previous.remaining) clockAdvancedInForm = true;
      }
      for (const projectile of state.projectiles ?? []) {
        projectileKinds.add(projectile.kind);
        const owner = projectileOwners.get(projectile.id);
        if (owner === 1 && projectile.owner === 0) reflections.push({ frame, id: projectile.id, kind: projectile.kind });
        projectileOwners.set(projectile.id, projectile.owner);
      }
    }
    const observedActions = attackStarts.map(start => start.kind);
    const actualSequence = observedActions.some((_, at) => expectedSequence.every((action, offset) => observedActions[at + offset] === action));
    const active = activeSequence.length === expectedSequence.length && actualSequence;
    check(active, `Required action sequence did not activate: ${expectedSequence.join(" → ")}`, failures);
    const activation = attackStarts[0], cost = move === "special" ? 25 : move === "final" ? 75 : 0;
    check(activation && close(snapshots[activation.frame].players[0].energy, first.players[0].energy - cost), "The actual activation energy cost is incorrect", failures);
    contact(minHp < initial.hp - epsilon || minStocks < initial.stocks, "Demonstration never damaged the rival or removed a stock");
    const contacts = kind => damageEvents.filter(event => event.kind === kind && event.hitId !== null && event.attackStartFrame !== null);
    if (move === "light" || move === "heavy" || move === "special") contact(contacts(move).length > 0 || move === "special" && minStocks < initial.stocks, `${move} never connected`);
    if (move === "combo1" || move === "combo2") {
      contact(new Set(contacts("light").map(event => event.attackStartFrame)).size >= (move === "combo2" ? 2 : 1), "A required distinct light hit in the combo did not connect");
      contact(contacts("heavy").length >= 1, "The heavy combo finisher did not connect");
      check(snapshots.some(state => state.players[0].combo === text.title), "The selected combo name never appeared in combat state", failures);
    }
    if (move === "special") {
      if (opponentHeavy || /contraataque/i.test(text.effect ?? "")) check(countered, "The demonstrated counter did not trigger", failures);
      if (opponentSpecial || /devolver proyectiles|refleja(?:r)? (?:los )?proyectiles/i.test(text.effect ?? "")) check(reflections.length > 0, "The demonstrated projectile reflection did not occur", failures);
      if (/ralentiza/i.test(text.effect ?? "")) check(slow > 0, "The described slow effect never applied", failures);
      if (/inmoviliza/i.test(text.effect ?? "")) check(root > 0, "The described root effect never applied", failures);
    }
    let form = null;
    if (move === "final") {
      check(snapshots.some(state => state.players[0].attack === "super"), "The real super input never activated", failures);
      check(!last.finale && !last.players[0].transformation && last.players[0].attack !== "super", "The final timeline ends before control/form release", failures);
      check(last.players.every(player => (player.knockoutDelay ?? 0) <= 0), "The final timeline ends with a pending knockout flight", failures);
      check((last.players[1].rootTicks ?? 0) === 0 && (last.players[1].slowTicks ?? 0) === 0, "The rival is still forcibly rooted/slowed at the end", failures);
      if (last.players[1].stocks > 0) check(last.players[1].hp > 0 && Number.isFinite(last.players[1].x) && Number.isFinite(last.players[1].y), "A surviving rival was not restored to a valid combat state", failures);
      if (sawCapture) {
        check(capturedClockPaused, "The round clock advanced inside a captured definitive", failures);
        check(lastCapturedFrame < snapshots.length - 1, "The capture never released", failures);
        const declared = /en (\d+) impactos?/i.exec(text.effect ?? "");
        if (declared) contact(hitEvents.filter(event => event.kind === "super").length >= Number(declared[1]), "A described definitive impact is missing");
      }
      if (FORMS[fighter] || transformations.length) {
        check(transformations.length > 0, "The required temporary transformation never appeared", failures);
        check(!sawCapture, "A temporary self-buff incorrectly captured the rival", failures);
        check(clockAdvancedInForm, "Combat did not continue during the transformation", failures);
        const expected = FORMS[fighter], firstForm = transformations[0];
        if (expected && firstForm) {
          check(firstForm.id === expected.id && firstForm.ticks === expected.ticks && close(firstForm.damageMultiplier, expected.multiplier), "Wrong temporary form, duration or damage multiplier", failures);
        }
        let expiry = null;
        for (let frame = 1; frame < snapshots.length; frame++) {
          const previous = snapshots[frame - 1], state = snapshots[frame], before = previous.players[0].transformation, after = state.players[0].transformation;
          if (!before) continue;
          const advance = state.tick - previous.tick, remaining = before.ticks - advance;
          check(advance === 0 || advance === 1, "Invalid gameplay tick transition during transformation", failures);
          check(remaining > 0 ? after && after.ticks === remaining && after.id === before.id && close(after.damageMultiplier, before.damageMultiplier) : !after, "The transformation duration/multiplier changed or expired before its active ticks elapsed", failures);
          if (!after && !expiry) expiry = { frame, gameTick: state.tick };
        }
        if (firstForm && expected) check(expiry && expiry.gameTick - firstForm.gameTick === expected.ticks, "The temporary form did not last exactly 360 active gameplay ticks", failures);
        const followups = damageEvents.filter(event => event.transformed && event.hitId !== null && event.attackStartFrame !== null && (event.kind === "light" || event.kind === "heavy"));
        contact(followups.some(event => event.kind === "light") && followups.some(event => event.kind === "heavy"), "Both real light and heavy follow-ups must connect during the form");
        check(damageEvents.every(event => event.kind === "light" || event.kind === "heavy"), "The self-buff dealt automatic damage outside its real follow-up attacks", failures);
        const comparisons = followups.map(event => {
          const baselineMove = event.kind === "light" ? "light" : /light,light,heavy$/.test(event.history) ? "combo2" : /light,heavy$/.test(event.history) ? "combo1" : "heavy";
          const baseline = baselines[`${fighter}/${baselineMove}`];
          const base = baseline?.damageEvents.findLast(hit => hit.kind === event.kind && !hit.transformed);
          const multiplier = expected?.multiplier ?? event.multiplier;
          const correct = baseline?.rival === rival && base && close(event.damage, base.damage * multiplier);
          check(correct, `Powered ${event.kind} damage did not match its real ${baselineMove} baseline`, failures);
          return { frame: event.frame, kind: event.kind, baselineMove, baselineDamage: base?.damage ?? null, poweredDamage: event.damage, expectedMultiplier: multiplier, passed: !!correct };
        });
        check(comparisons.some(hit => hit.kind === "heavy" && hit.baselineMove === "combo1" && hit.passed), "The powered bonused combo1 heavy follow-up was not verified", failures);
        form = { id: firstForm?.id ?? null, firstFrame: firstForm?.frame ?? null, lastFrame: transformations.at(-1)?.frame ?? null, activeTicks: expiry && firstForm ? expiry.gameTick - firstForm.gameTick : null, expired: !last.players[0].transformation, clockAdvanced: clockAdvancedInForm, comparisons };
      } else if (!sawCapture) {
        check(snapshots.some(state => (state.projectiles ?? []).some(projectile => projectile.owner === 0 && projectile.impact === "super")), "A noncapturing definitive created no super projectile", failures);
        contact(hitEvents.some(event => event.kind === "super"), "The ranged definitive did not produce a real super impact");
        check(last.remaining < first.remaining, "The ranged definitive stopped the round clock", failures);
        check(!(last.projectiles ?? []).some(projectile => projectile.owner === 0 && projectile.impact === "super"), "The final timeline ends before its super projectile expires", failures);
      }
    }
    return { fighter, move, rival, title: text.title ?? "", frames: snapshots.length, passed: failures.length === 0, failures: [...new Set(failures)], active, connected: contactChecks.every(Boolean), damagedOrRingout: minHp < initial.hp - epsilon || minStocks < initial.stocks, initialHp: initial.hp, minHp, finalHp: last.players[1].hp, initialStocks: initial.stocks, minStocks, finalStocks: last.players[1].stocks, attackStarts, damageEvents, stockEvents, hitEvents, projectiles: [...projectileKinds], reflections, countered, slow, root, captured: sawCapture, form, terminalReleased: !last.finale && !last.players[0].transformation && last.players[0].attack !== "super" && last.players.every(player => (player.knockoutDelay ?? 0) <= 0) };
  }

  let started = false, busy = false, guide, pairs = [], rows = [], current = null, index = 0, originalUrl, artifact = null, frameDraws = null;
  const fatalErrors = new Set(), pendingImages = new Set(), loadedImages = new Set(), networkAttempts = [];
  const fail = message => { const safe = String(message).slice(0, 500); fatalErrors.add(safe); return Error(safe); };
  const textOf = id => document.getElementById(id)?.textContent?.trim() ?? "";
  const localResource = url => /^(data:|blob:)/i.test(String(url));
  const noteNetwork = (url, type) => { if (!localResource(url)) { networkAttempts.push({ type, url: String(url).slice(0, 250) }); throw fail(`Unexpected network dependency: ${type}`); } };
  function scanResources(entries = performance.getEntriesByType("resource")) {
    for (const entry of entries) if (!localResource(entry.name) && !networkAttempts.some(row => row.url === entry.name.slice(0, 250) && row.type === entry.initiatorType)) { networkAttempts.push({ type: entry.initiatorType, url: entry.name.slice(0, 250) }); fail("The portable page made an external resource request"); }
  }
  const status = () => ({ started, complete: started && index === pairs.length && !current, demos: rows.length, total: pairs.length, failedDemos: rows.filter(row => !row.passed).length, frames: rows.reduce((sum, row) => sum + row.renderedFrames, 0) + (current?.renderedFrames ?? 0), current: current ? `${current.fighter}/${current.move}:${current.renderedFrames}/${current.frames}` : null, fatalErrors: [...fatalErrors] });
  const digest = async value => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))].map(value => value.toString(16).padStart(2, "0")).join("");
  function installObservers(imageMap) {
    const byUrl = new Map();
    for (const [id, url] of Object.entries(imageMap)) byUrl.set(url, [...(byUrl.get(url) ?? []), id]);
    const identify = image => (byUrl.get(image.currentSrc || image.src) ?? ["unmapped embedded image"]).join(",");
    const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
    Object.defineProperty(HTMLImageElement.prototype, "src", { ...descriptor, set(value) {
      noteNetwork(value, "image"); pendingImages.add(this);
      this.addEventListener("load", () => { pendingImages.delete(this); loadedImages.add(identify(this)); }, { once: true });
      this.addEventListener("error", () => { pendingImages.delete(this); fail(`Image decode/load failed: ${identify(this)}`); }, { once: true });
      return descriptor.set.call(this, value);
    } });
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function(image, ...args) {
      try {
        if (image instanceof HTMLImageElement && (!image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0)) throw Error(`Invalid decoded image: ${identify(image)}`);
        if (frameDraws) { frameDraws.total++; if (image instanceof HTMLImageElement) frameDraws.images++; if (this.canvas === document.getElementById("arena")) frameDraws.guideCopies++; }
        return draw.call(this, image, ...args); // Includes the production placeholder guard.
      } catch (error) { throw fail(`Canvas render failed: ${error instanceof Error ? error.message : String(error)}`); }
    };
    addEventListener("error", event => fail(event.message ? `Browser error: ${event.message}` : "Browser resource error"), true);
    addEventListener("unhandledrejection", event => fail(`Unhandled rejection: ${String(event.reason)}`));
    const error = console.error; console.error = (...args) => { fail(`Console error: ${args.map(value => value instanceof Error ? value.message : String(value)).join(" ")}`); return error.apply(console, args); };
    const fetch = globalThis.fetch; globalThis.fetch = (input, ...args) => { noteNetwork(input?.url ?? input, "fetch"); return fetch.call(globalThis, input, ...args); };
    const open = XMLHttpRequest.prototype.open; XMLHttpRequest.prototype.open = function(method, url, ...args) { noteNetwork(url, "XHR"); return open.call(this, method, url, ...args); };
    for (const name of ["WebSocket", "EventSource"]) if (typeof globalThis[name] === "function") globalThis[name] = new Proxy(globalThis[name], { construct(target, args, receiver) { noteNetwork(args[0], name); return Reflect.construct(target, args, receiver); } });
    performance.setResourceTimingBufferSize(10000);
    new PerformanceObserver(list => scanResources(list.getEntries())).observe({ type: "resource", buffered: true });
  }
  function assertPage(fighter, move, frame, snapshots) {
    if (globalThis.arenaMoveGuide !== guide || location.href !== originalUrl) throw fail("The verified page or guide object changed during the run");
    if (!guide.ready || guide.selected !== fighter || guide.mode !== move || guide.state !== snapshots[frame]) throw fail(`Selected source state mismatch: ${fighter}/${move}/${frame}`);
    if (textOf("load-status") !== "Vista real del juego · reproducción sin audio" || document.getElementById("retry").hidden !== true) throw fail(`Guide load status failed: ${textOf("load-status")}`);
    const state = snapshots[frame], target = state.players[1];
    if (document.getElementById("timeline").value !== String(frame) || Number(document.getElementById("timeline").max) !== snapshots.length - 1 || document.getElementById("timeline").disabled) throw fail(`Timeline UI mismatch: ${fighter}/${move}/${frame}`);
    if (!close(Number(document.getElementById("rival-hp").value), Math.max(0, target.hp)) || textOf("hp-value") !== `${Math.round(Math.max(0, target.hp))} / 100`) throw fail(`HP UI mismatch: ${fighter}/${move}/${frame}`);
    if (textOf("stocks-value") !== `${target.stocks} ${target.stocks === 1 ? "vida" : "vidas"}`) throw fail(`Stock UI mismatch: ${fighter}/${move}/${frame}`);
    if (textOf("time") !== `${(frame / 60).toFixed(1)} / ${((snapshots.length - 1) / 60).toFixed(1)} s`) throw fail(`Timeline time display mismatch: ${fighter}/${move}/${frame}`);
    const player = state.players[0], form = player.transformation;
    const combat = form ? `${textOf("move-title")} · ${(form.ticks / 60).toFixed(1)} s · +${Math.round((form.damageMultiplier - 1) * 100)} % de daño` : target.rootTicks > 0 ? "Rival inmovilizado" : target.slowTicks > 0 ? "Rival ralentizado" : player.countered ? "Contraataque conectado" : "";
    if (textOf("combat-status") !== combat) throw fail(`Combat status/countdown mismatch: ${fighter}/${move}/${frame}`);
    if (!document.getElementById("poster").hidden || document.getElementById("play").disabled || document.getElementById("restart").disabled) throw fail("Demo playback controls are not ready");
    if (fatalErrors.size) throw Error([...fatalErrors].join("; "));
  }
  const api = {
    version: 1, analyzeSnapshots,
    async start({ expectedFighters = 52, label = "Final portable guide" } = {}) {
      if (started) throw Error("Verification already started; reload to start over");
      guide = globalThis.arenaMoveGuide;
      if (!guide?.ready) throw Error("Wait until arenaMoveGuide.ready before starting verification");
      if (!Array.isArray(guide.fighters) || guide.fighters.length !== expectedFighters || new Set(guide.fighters).size !== expectedFighters || JSON.stringify(guide.moves) !== JSON.stringify(MOVES)) throw Error("Unexpected guide roster or move list");
      const images = globalThis.__arenaGuideImages;
      if (!images || !Object.keys(images).length || Object.values(images).some(value => typeof value !== "string" || !/^data:image\/webp;base64,[a-z0-9+/]+=*$/i.test(value))) throw Error("This page is not the fully embedded portable guide");
      if ([...document.images].some(image => !localResource(image.currentSrc || image.src)) || document.querySelector("script[src],link[rel='stylesheet'][href]")) throw Error("Portable page has external image/script/stylesheet dependencies");
      originalUrl = location.href; guide.pause(); installObservers(images);
      scanResources();
      const roster = [...document.querySelectorAll("#roster-body tr")];
      if (roster.length !== expectedFighters) throw fail("The explanatory roster is incomplete");
      const names = Object.fromEntries(guide.fighters.map((id, at) => [id, roster[at].cells[0].textContent.trim()]));
      pairs = guide.fighters.flatMap((fighter, at) => MOVES.map(move => ({ fighter, move, name: names[fighter], names, title: move === "light" ? "Golpe ligero" : move === "heavy" ? "Golpe fuerte" : roster[at].cells[{ combo1: 1, combo2: 2, special: 3, final: 4 }[move]].textContent.trim() })));
      artifact = { label, url: /^(data:|blob:)/.test(originalUrl) ? "[embedded document]" : originalUrl, fighters: [...guide.fighters], moves: [...guide.moves], embeddedImageIds: Object.keys(images).length, uniqueImagePayloads: new Set(Object.values(images)).size, embeddedScriptsSha256: await digest([...document.scripts].map(script => script.textContent).join("\n")), imageMapSha256: await digest(JSON.stringify(images)), fontsLoaded: document.fonts.check('800 22px "Barlow Condensed"') && document.fonts.check('700 13px "DM Sans"') };
      if (!artifact.fontsLoaded) throw fail("Embedded guide fonts are not loaded");
      started = true; return status();
    },
    async runBatch(frameBudget = 300) {
      if (busy) throw Error("Another verification batch is running");
      if (!Number.isInteger(frameBudget) || frameBudget < 1 || frameBudget > 2000) throw Error("Frame budget must be 1..2000");
      busy = true;
      try {
        if (!started) await api.start();
        for (let rendered = 0; rendered < frameBudget && index < pairs.length;) {
          if (!current) {
            const pair = pairs[index];
            await guide.selectFighter(pair.fighter); await guide.selectMove(pair.move); guide.pause();
            const snapshots = guide.snapshots, text = { title: textOf("move-title"), effect: textOf("effect"), visual: textOf("visual"), requirement: textOf("requirement"), keys: textOf("keys") };
            const row = analyzeSnapshots({ ...pair, snapshots, text, baselines: Object.fromEntries(rows.map(row => [`${row.fighter}/${row.move}`, row])) });
            const missingText = Object.values(text).some(value => !value || /\b(undefined|null|TODO)\b/.test(value));
            check(!missingText, "An explanation/control field is empty or unresolved", row.failures);
            check(text.keys === { light: "J", heavy: "K", combo1: "J → K", combo2: "J → J → K", special: "L", final: "I" }[pair.move], "The displayed control keys are incorrect", row.failures);
            if (pair.move === "special") check(/25 de energía/.test(text.requirement), "The displayed special energy cost is incorrect", row.failures);
            if (pair.move === "final") {
              check(/3 victorias/.test(text.requirement) && /75 de energía/.test(text.requirement), "The displayed definitive unlock/cost is incorrect", row.failures);
              const seconds = /([\d.,]+) segundos/.exec(text.requirement);
              check(seconds && close(Number(seconds[1].replace(",", ".")), (snapshots.length - 100) / 60), "The displayed definitive duration disagrees with the timeline", row.failures);
              if (FORMS[pair.fighter]) check(/Durante 6 segundos/.test(text.effect) && /20\s*%/.test(text.effect), "The transformation explanation has an incorrect duration/damage bonus", row.failures);
              check(document.getElementById("alias").hidden === false && textOf("alias").includes(`«${snapshots.find(state => state.players[0].attack === "super")?.players[0].combo}»`), "The definitive combo alias is missing or incorrect", row.failures);
            } else check(document.getElementById("alias").hidden === true, "The definitive alias remained visible on another move", row.failures);
            check(text.title === pair.title && textOf("character-name") === pair.name && document.getElementById("fighter").value === pair.fighter, "Selected title/character does not match the explanatory roster", row.failures);
            check(textOf("rival") === pair.names[snapshots[0].players[1].config.fighter], "Displayed rival does not match the actual opponent", row.failures);
            const pressed = [...document.querySelectorAll("[data-move][aria-pressed='true']")];
            check(pressed.length === 1 && pressed[0].dataset.move === pair.move, "The selected move control is incorrect", row.failures);
            const summary = guide.summary;
            check(summary.selected === pair.fighter && summary.mode === pair.move && summary.frames === snapshots.length && close(summary.minHp, row.minHp) && close(summary.hp, row.finalHp) && summary.stocks === row.finalStocks, "Guide summary loses HP/stock/timeline information", row.failures);
            check((summary.props ?? []).every(id => id in globalThis.__arenaGuideImages), "A declared prop has no embedded image", row.failures);
            row.text = text; row.missingText = missingText; row.passed = row.failures.length === 0;
            current = { ...row, snapshots, renderedFrames: 0, firstRenderedFrame: 0, lastRenderedFrame: -1, contiguous: true };
          }
          const frame = current.renderedFrames;
          frameDraws = { total: 0, images: 0, guideCopies: 0 };
          try {
            guide.seek(frame); assertPage(current.fighter, current.move, frame, current.snapshots);
            if (frameDraws.images < 1 || frameDraws.guideCopies < 1) throw fail(`No fresh source render/guide copy occurred: ${current.fighter}/${current.move}/${frame}`);
          } finally { frameDraws = null; }
          current.contiguous &&= frame === current.lastRenderedFrame + 1;
          current.lastRenderedFrame = frame; current.renderedFrames++; rendered++;
          if (current.renderedFrames === current.frames) {
            const { snapshots, ...row } = current; rows.push(row); current = null; index++;
          }
        }
        return status();
      } catch (error) { throw fail(error instanceof Error ? error.message : String(error)); }
      finally { busy = false; }
    },
    get status() { return status(); },
    report({ allowIncomplete = false } = {}) {
      if (started) scanResources();
      const progress = status();
      if (!allowIncomplete && (!progress.complete || busy)) throw Error("Verification has not rendered every frame of every demo");
      return { schema: 1, kind: "Portable compressed-media end-to-end verification; not the raw draw/pruning audit", artifact, complete: progress.complete && !busy, passed: progress.complete && !busy && !progress.failedDemos && !fatalErrors.size && !pendingImages.size && !networkAttempts.length, summary: { ...progress, pendingImages: pendingImages.size, newlyDecodedImageGroups: loadedImages.size, networkAttempts: networkAttempts.length, allMovesActivated: progress.complete && rows.every(row => row.active), allDemonstrationsConnect: progress.complete && rows.every(row => row.connected), allMovesHaveExplanation: progress.complete && rows.every(row => !row.missingText), everyTimelineFrameRendered: progress.complete && rows.every(row => row.renderedFrames === row.frames && row.contiguous && row.firstRenderedFrame === 0 && row.lastRenderedFrame === row.frames - 1) }, errors: [...fatalErrors], networkAttempts, rows };
    },
    finish() {
      const report = api.report();
      if (!report.passed) throw Error(`Portable verification failed: ${report.summary.failedDemos} demos, ${report.errors.length} fatal errors, ${report.summary.networkAttempts} network requests`);
      return report;
    },
    download(file = "portable-verification.json") {
      const report = api.report({ allowIncomplete: true }), json = JSON.stringify(report, null, 2) + "\n", link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([json], { type: "application/json" })); link.download = file; link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      return { passed: report.passed, complete: report.complete, demos: report.rows.length, bytes: new Blob([json]).size };
    },
  };
  globalThis.arenaPortableGuideVerification = api;
})();
