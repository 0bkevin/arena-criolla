import test from "node:test";
import assert from "node:assert/strict";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { openAIProvider } from "../server/creator/provider";

const design = {
  title: "Pana azul",
  specialName: "Paso azul",
  outfit: "Chaqueta azul con zapatos claros.",
  likeness: "Cabello corto con lentes de montura.",
  welcome: "Saludo de entrada",
  welcomeStyle: "wave" as const,
  combos: ["Uno dos", "Dos tres", "Gran final"] as [string, string, string],
};
const input = {
  name: "Pana",
  description: "Me gusta el cuatro.",
  style: "agile" as const,
  color: "#669bff",
};
async function upstream(
  handler: (req: IncomingMessage, res: ServerResponse, body: string) => void,
) {
  const folder = await mkdtemp(path.join(os.tmpdir(), "arena-provider-"));
  const photo = path.join(folder, "photo.jpg");
  await writeFile(photo, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    handler(req, res, Buffer.concat(chunks).toString());
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const keys = [
    "OPENAI_API_KEY",
    "OPENAI_BASE_URL",
    "OPENAI_IMAGE_MODEL",
    "OPENAI_DESIGN_MODEL",
    "ARENA_CREATOR_ENABLED",
  ];
  const saved = keys.map((key) => [key, process.env[key]] as const);
  process.env.OPENAI_API_KEY = "fixture-not-a-real-key";
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${address.port}/v1`;
  process.env.OPENAI_IMAGE_MODEL = "gpt-image-2";
  process.env.OPENAI_DESIGN_MODEL = "gpt-4.1-mini";
  process.env.ARENA_CREATOR_ENABLED = "true";
  const provider = openAIProvider()!;
  return {
    photo,
    provider,
    async close() {
      for (const [key, value] of saved) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      const closed = new Promise<void>((resolve) =>
        server.close(() => resolve()),
      );
      server.closeAllConnections();
      await closed;
      await rm(folder, { recursive: true, force: true });
    },
  };
}

test("production generation can be held disabled with a configured key", () => {
  const saved = process.env.ARENA_CREATOR_ENABLED;
  const key = process.env.OPENAI_API_KEY;
  try {
    process.env.OPENAI_API_KEY = "fixture-not-a-real-key";
    delete process.env.ARENA_CREATOR_ENABLED;
    assert.equal(
      openAIProvider(),
      null,
      "A configured key alone must never enable paid generation.",
    );
    process.env.ARENA_CREATOR_ENABLED = "false";
    assert.equal(openAIProvider(), null);
    process.env.ARENA_CREATOR_ENABLED = "typo";
    assert.throws(openAIProvider, /must be true or false/);
  } finally {
    if (saved === undefined) delete process.env.ARENA_CREATOR_ENABLED;
    else process.env.ARENA_CREATOR_ENABLED = saved;
    if (key === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = key;
  }
});

test(
  "installed OpenAI SDK sends schema-checked Responses and transparent image-edit requests",
  { timeout: 10_000 },
  async () => {
    const requests: { url: string | undefined; body: string }[] = [];
    const f = await upstream((req, res, body) => {
      requests.push({ url: req.url, body });
      res.setHeader("Content-Type", "application/json");
      if (req.url === "/v1/responses")
        res.end(
          JSON.stringify({
            id: "resp_fixture",
            object: "response",
            status: "completed",
            output: [
              {
                type: "message",
                role: "assistant",
                content: [
                  {
                    type: "output_text",
                    text: JSON.stringify(design),
                    annotations: [],
                  },
                ],
              },
            ],
          }),
        );
      else
        res.end(
          JSON.stringify({
            data: [
              { b64_json: Buffer.from("fixture-png-bytes").toString("base64") },
            ],
          }),
        );
    });
    try {
      assert.deepEqual(await f.provider.design(input, [f.photo]), design);
      assert.equal(
        (await f.provider.draw(input, design, [f.photo])).toString(),
        "fixture-png-bytes",
      );
      assert.equal(requests.length, 2);
      const responseRequest = JSON.parse(requests[0].body);
      assert.equal(responseRequest.text.format.strict, true);
      assert.equal(responseRequest.model, "gpt-4.1-mini");
      assert.equal(responseRequest.store, false);
      assert.match(
        responseRequest.input[0].content[1].image_url,
        /^data:image\/jpeg;base64,/,
      );
      assert.equal(requests[1].url, "/v1/images/edits");
      for (const value of ["gpt-image-2", "1536x1024", "transparent", "png"])
        assert.ok(requests[1].body.includes(value));
      assert.ok(
        !requests[1].body.includes('name="input_fidelity"'),
        "Image2 must omit unsupported input_fidelity",
      );
    } finally {
      await f.close();
    }
  },
);

test(
  "upstream 5xx is not automatically retried into extra paid requests",
  { timeout: 10_000 },
  async () => {
    let requests = 0;
    const f = await upstream((_req, res) => {
      requests++;
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: { message: "fixture unavailable", type: "server_error" },
        }),
      );
    });
    try {
      await assert.rejects(f.provider.design(input, [f.photo]));
      assert.equal(requests, 1);
    } finally {
      await f.close();
    }
  },
);

test(
  "aborting an in-flight SDK request releases the caller without retrying",
  { timeout: 10_000 },
  async () => {
    let requests = 0,
      received!: () => void;
    const started = new Promise<void>((resolve) => {
      received = resolve;
    });
    const f = await upstream((_req, _res) => {
      requests++;
      received();
    });
    const controller = new AbortController();
    try {
      const pending = f.provider.design(input, [f.photo], controller.signal);
      await started;
      const start = performance.now();
      controller.abort();
      await assert.rejects(pending);
      assert.ok(
        performance.now() - start < 1_000,
        "abort should not wait for the 240-second transport timeout",
      );
      assert.equal(requests, 1);
    } finally {
      await f.close();
    }
  },
);
