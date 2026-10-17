// Evaluate before walking the UI. Observes real component/network state;
// the bot only dispatches normal keyboard controls and never changes the match.
(() => {
  const q = (window.__journeyAudit = {
    steps: [],
    requests: [],
    errors: [],
    messages: [],
  });
  q.wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  q.until = async (predicate, ms = 5000) => {
    const deadline = performance.now() + ms;
    while (!predicate()) {
      if (performance.now() > deadline)
        throw new Error("Journey condition timed out");
      await q.wait(30);
    }
  };
  q.check = (step, pass, details = {}) => {
    const result = { step, pass: Boolean(pass), details };
    q.steps.push(result);
    if (!pass) throw new Error(JSON.stringify(result));
    return result;
  };
  q.input = (selector, value) => {
    const element = document.querySelector(selector);
    if (!element) throw new Error("Missing input: " + selector);
    const proto =
      element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  };
  q.key = (code, down) =>
    window.dispatchEvent(
      new KeyboardEvent(down ? "keydown" : "keyup", {
        code,
        bubbles: true,
        cancelable: true,
      }),
    );
  q.tap = (code) => {
    q.key(code, true);
    q.key(code, false);
  };
  q.fiber = () => {
    const element = document.querySelector(".game-page");
    if (!element) return null;
    let fiber =
      element[
        Object.keys(element).find((key) => key.startsWith("__reactFiber"))
      ];
    while (
      fiber &&
      !(fiber.memoizedProps?.initial?.players && fiber.memoizedProps?.onRematch)
    )
      fiber = fiber.return;
    return fiber;
  };
  q.props = () => q.fiber()?.memoizedProps;
  q.state = () => {
    for (let hook = q.fiber()?.memoizedState; hook; hook = hook.next) {
      const state = hook.memoizedState?.current;
      if (state?.players && state.phase) return state;
    }
    return null;
  };
  q.summary = () => {
    const s = q.state();
    return (
      s && {
        id: s.id,
        phase: s.phase,
        tick: s.tick,
        remaining: s.remaining,
        winner: s.winner,
        players: s.players.map((p) => ({
          name: p.config.name,
          fighter: p.config.fighter,
          wins: p.config.wins,
          x: p.x,
          y: p.y,
          hp: p.hp,
          stocks: p.stocks,
          hits: p.hits,
          energy: p.energy,
        })),
      }
    );
  };
  q.stopBot = () => {
    clearInterval(q.bot);
    ["KeyA", "KeyD", "ArrowLeft", "ArrowRight", "KeyU", "Digit0"].forEach(
      (code) => q.key(code, false),
    );
  };
  q.startBot = (players = [0]) => {
    q.stopBot();
    let n = 0;
    q.bot = setInterval(() => {
      const s = q.state();
      if (!s || s.phase === "finished") {
        q.stopBot();
        return;
      }
      if (s.phase !== "playing") return;
      n++;
      for (const index of players) {
        const p = s.players[index],
          other = s.players[1 - index];
        const second = index === 1 && q.props().mode === "local";
        const codes = second
          ? {
              left: "ArrowLeft",
              right: "ArrowRight",
              jump: "ArrowUp",
              light: "Digit1",
              heavy: "Digit2",
              special: "Digit3",
              super: "Digit5",
            }
          : {
              left: "KeyA",
              right: "KeyD",
              jump: "KeyW",
              light: "KeyJ",
              heavy: "KeyK",
              special: "KeyL",
              super: "KeyI",
            };
        q.key(codes.right, other.x - p.x > 58);
        q.key(codes.left, p.x - other.x > 58);
        if (n % 9 === 0 && (other.y < p.y - 70 || p.y > 610)) q.tap(codes.jump);
        if (!p.cooldown && !p.stun) {
          const action =
            p.config.wins >= 3 && p.energy >= 75
              ? "super"
              : p.energy >= 25 && n % 4 === 0
                ? "special"
                : n % 3 === 0
                  ? "heavy"
                  : "light";
          q.tap(codes[action]);
        }
      }
    }, 120);
  };
  const originalFetch = fetch;
  window.fetch = async (...args) => {
    try {
      const response = await originalFetch(...args);
      q.requests.push({
        path: String(args[0]),
        method: args[1]?.method || "GET",
        status: response.status,
      });
      return response;
    } catch (error) {
      q.requests.push({ path: String(args[0]), error: error.name });
      throw error;
    }
  };
  const send = WebSocket.prototype.send;
  WebSocket.prototype.send = function (raw) {
    if (this.url.endsWith("/ws") && !q.sockets?.has(this)) {
      q.sockets ??= new Set();
      q.sockets.add(this);
      if (!q.socket || q.socket.readyState !== WebSocket.OPEN) q.socket = this;
      this.addEventListener("message", (event) => {
        const message = JSON.parse(event.data);
        if (message.type === "room") q.room = message.room;
        if (message.type === "state" || message.type === "start")
          q.remote = message.state;
        if (message.type !== "state") q.messages.push(message);
      });
    }
    return send.call(this, raw);
  };
  window.addEventListener("error", (event) => q.errors.push(event.message));
  window.addEventListener("unhandledrejection", (event) =>
    q.errors.push(String(event.reason)),
  );
  return { installed: true, path: location.pathname };
})();
