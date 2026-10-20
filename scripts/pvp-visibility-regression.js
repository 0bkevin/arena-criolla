// Evaluate this expression in an active online fight. It exercises the real
// Game component with a simulated controller; no physical gamepad is needed.
(async () => {
  if (!document.querySelector(".game-mode")?.textContent.includes("EN LÍNEA"))
    throw new Error("Start an online fight before running this regression.");

  const gamepads = Object.getOwnPropertyDescriptor(navigator, "getGamepads");
  const hidden = Object.getOwnPropertyDescriptor(document, "hidden");
  const originalSend = WebSocket.prototype.send;
  const inputs = [];
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const pad = {
    index: 0,
    id: "Visibility regression controller",
    connected: true,
    axes: [0, 0],
    buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: i === 4 })),
  };
  const until = async (predicate) => {
    const deadline = performance.now() + 1500;
    while (!predicate()) {
      if (performance.now() > deadline)
        throw new Error("Input update timed out.");
      await wait(20);
    }
  };
  WebSocket.prototype.send = function (raw) {
    if (this.url.endsWith("/ws")) {
      const message = JSON.parse(raw);
      if (message.type === "input") inputs.push(message.input);
    }
    return originalSend.call(this, raw);
  };
  try {
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => [pad],
    });
    await until(() => inputs.at(-1)?.block === true);
    const start = inputs.length;
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    await wait(250);
    const suspendedInputs = inputs.slice(start);
    if (!suspendedInputs.length || suspendedInputs.some((input) => input.block))
      throw new Error(
        "A hidden online tab restored its held controller guard.",
      );

    if (hidden) Object.defineProperty(document, "hidden", hidden);
    else Reflect.deleteProperty(document, "hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    await until(() => inputs.at(-1)?.block === true);
    return {
      pass: true,
      neutralUpdatesWhileHidden: suspendedInputs.length,
      resumed: true,
    };
  } finally {
    pad.buttons[4].pressed = false;
    if (hidden) Object.defineProperty(document, "hidden", hidden);
    else Reflect.deleteProperty(document, "hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    await wait(100);
    if (gamepads) Object.defineProperty(navigator, "getGamepads", gamepads);
    else Reflect.deleteProperty(navigator, "getGamepads");
    WebSocket.prototype.send = originalSend;
  }
})();
