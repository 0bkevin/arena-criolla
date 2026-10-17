// Local QA only: forward a dev server and selectively drop raw TCP bytes.
// npm exec -- tsx scripts/qa-network-proxy.ts [target=5191] [proxy=5192] [control=5193]
// GET http://127.0.0.1:5193/?mode=down|up|both|none changes the link.
import { createServer as tcpServer, connect, type Socket } from "node:net";
import { createServer as httpServer } from "node:http";

const [targetPort, proxyPort, controlPort] = process.argv.slice(2).map(Number);
let mode = "none";
let changedAt = Date.now();
const sockets = new Set<Socket>();
const proxy = tcpServer((down) => {
  const up = connect({ host: "127.0.0.1", port: targetPort || 5191 });
  sockets.add(up);
  sockets.add(down);
  up.on("data", (bytes) => {
    if (mode !== "down" && mode !== "both" && !down.destroyed)
      down.write(bytes);
  });
  down.on("data", (bytes) => {
    if (mode !== "up" && mode !== "both" && !up.destroyed) up.write(bytes);
  });
  for (const [source, other] of [
    [up, down],
    [down, up],
  ]) {
    source.on("error", () => {});
    source.on("close", () => {
      sockets.delete(source);
      // A blackhole does not deliver FIN/RST to the other side either.
      if (mode === "none") other.destroy();
    });
  }
});
const control = httpServer((req, res) => {
  const value = new URL(req.url || "/", "http://qa.local").searchParams.get(
    "mode",
  );
  if (value && ["none", "up", "down", "both"].includes(value)) {
    mode = value;
    changedAt = Date.now();
  }
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ mode, changedAt, sockets: sockets.size }));
});
proxy.listen(proxyPort || 5192, "127.0.0.1");
control.listen(controlPort || 5193, "127.0.0.1");
console.log(
  `Local TCP QA proxy ${proxyPort || 5192} → ${targetPort || 5191}; control ${controlPort || 5193}`,
);
process.on("SIGINT", () => {
  sockets.forEach((socket) => socket.destroy());
  proxy.close();
  control.close();
});
