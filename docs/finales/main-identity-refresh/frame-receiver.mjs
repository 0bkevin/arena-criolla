// Loopback-only capture harness. Game modules still come from Vite on 5184.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
const base = path.resolve("docs/finales/main-identity-refresh/frames");
await fs.mkdir(base, { recursive: true });
http.createServer(async (req, res) => {
  const match = req.url.match(/^\/__frames\/([a-z-]+)$/);
  if (req.method === "POST" && match) {
    try {
      const chunks = []; let total = 0;
      for await (const chunk of req) {
        total += chunk.length;
        if (total > 40_000_000) throw Error("Capture batch too large");
        chunks.push(chunk);
      }
      const data = Buffer.concat(chunks), size = data.readUInt32LE(0);
      const lengths = JSON.parse(data.subarray(4, 4 + size).toString());
      if (lengths.length !== 36) throw Error("Expected 36 frames");
      await fs.mkdir(path.join(base, match[1]), { recursive: true });
      let offset = 4 + size;
      for (const [index, length] of lengths.entries()) {
        if (!Number.isInteger(length) || length < 1 || offset + length > data.length) throw Error("Invalid frame length");
        await fs.writeFile(path.join(base, match[1], `${String(index).padStart(3, "0")}.webp`), data.subarray(offset, offset + length));
        offset += length;
      }
      if (offset !== data.length) throw Error("Trailing capture bytes");
      res.writeHead(204); res.end();
    } catch (error) { res.writeHead(400); res.end(String(error)); }
    return;
  }
  if (req.url === "/") {
    res.setHeader("content-type", "text/html");
    res.end('<!doctype html><html><body style="margin:0"><p id="status">Finale identity review</p></body></html>');
    return;
  }
  const upstream = http.request({ hostname: "127.0.0.1", port: 5184, path: req.url, method: req.method, headers: { ...req.headers, host: "localhost:5184" } }, response => {
    res.writeHead(response.statusCode, response.headers); response.pipe(res);
  });
  upstream.on("error", error => { res.writeHead(502); res.end(String(error)); });
  req.pipe(upstream);
}).listen(5191, "127.0.0.1", () => process.stdout.write("Identity frame receiver ready on 5191\n"));
