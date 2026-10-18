import test from "node:test";
import assert from "node:assert/strict";
import atlas from "../docs/character-sprite-qa.json";
import entrances from "../shared/entrance-assets.json";
import { loadSprite } from "../src/game/assets";
import { makeArenaServer } from "../server/index";
import { WebSocket } from "ws";
import type { ServerMessage } from "../shared/protocol";

// Exercise the real atlas loader without downloading or decoding images in Node.
test("static portraits load only their atlas; cinematic requests still load the complete entrance", async () => {
  const checked = atlas.sprites
    .find((entry) => entry.id === "renny")!
    .files.find((entry) => entry.file.endsWith(".webp"))!;
  const requests: string[] = [];
  const descriptors = new Map(
    ["Image", "document"].map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ]),
  );
  class FixtureImage {
    width = checked.width;
    height = checked.height;
    onload: (() => void) | null = null;
    set src(value: string) {
      requests.push(value);
      queueMicrotask(() => this.onload?.());
    }
  }
  Object.defineProperty(globalThis, "Image", {
    configurable: true,
    value: FixtureImage,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({
          drawImage() {},
          putImageData() {},
          getImageData: (
            _x: number,
            _y: number,
            width: number,
            height: number,
          ) => ({ data: new Uint8ClampedArray(width * height * 4) }),
        }),
      }),
    },
  });
  try {
    const portrait = await loadSprite("renny", { entrance: false });
    assert.equal(portrait.frames.length, 8);
    assert.equal(portrait.entrance, undefined);
    assert.equal(
      requests.length,
      1,
      "a static portrait must not fetch an unused entrance",
    );
    const cinematic = await loadSprite("renny");
    assert.ok(cinematic.entrance);
    assert.equal(
      cinematic.image,
      portrait.image,
      "both paths reuse the exact same full-quality atlas",
    );
    assert.deepEqual(cinematic.frames, portrait.frames);
    assert.equal(requests.length, 2);
    assert.equal(requests[1], `/assets/${entrances.renny.file}.webp`);
    assert.equal(await loadSprite("renny"), cinematic);
  } finally {
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
});

