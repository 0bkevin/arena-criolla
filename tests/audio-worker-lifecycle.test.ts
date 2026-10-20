import test from "node:test";
import assert from "node:assert/strict";
import type { FinaleState } from "../shared/finales";
import type { ScoreRequest } from "../src/game/music-preparation";
import { VICTORY_DURATION_MS } from "../src/game/victory-types";

test("late scores cannot resurrect stopped/muted scenes and resume at the current clock", async () => {
  class Param {
    value = 0;
    setTargetAtTime(value: number) {
      this.value = value;
    }
  }
  class Node {
    gain = new Param();
    threshold = new Param();
    knee = new Param();
    ratio = new Param();
    attack = new Param();
    release = new Param();
    buffer: unknown;
    loop = false;
    offset = 0;
    stopped = false;
    connect() {}
    disconnect() {}
    stop() {
      this.stopped = true;
    }
    start(_when = 0, offset = 0) {
      this.offset = offset;
    }
  }
  const sources: Node[] = [];
  class Context {
    sampleRate = 8000;
    currentTime = 0;
    state = "running";
    destination = new Node();
    createDynamicsCompressor() {
      return new Node();
    }
    createGain() {
      return new Node();
    }
    createBuffer(_channels: number, length: number) {
      const data = [new Float32Array(length), new Float32Array(length)];
      return { getChannelData: (index: number) => data[index] };
    }
    createBufferSource() {
      const node = new Node();
      sources.push(node);
      return node;
    }
  }
  let worker: FakeWorker;
  class FakeWorker {
    onmessage?: (event: { data: unknown }) => void;
    jobs: { id: number; input: ScoreRequest }[] = [];
    constructor() {
      worker = this;
    }
    postMessage(job: { id: number; input: ScoreRequest }) {
      this.jobs.push(job);
    }
    terminate() {}
    finish() {
      for (const job of this.jobs.splice(0))
        this.onmessage!({
          data: {
            id: job.id,
            result: {
              left: new Float32Array(job.input.length),
              right: new Float32Array(job.input.length),
            },
          },
        });
    }
  }
  const old = ["AudioContext", "Worker"].map(
    (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
  );
  Object.defineProperty(globalThis, "AudioContext", {
    configurable: true,
    value: Context,
  });
  Object.defineProperty(globalThis, "Worker", {
    configurable: true,
    value: FakeWorker,
  });
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  const scene: FinaleState = {
    fighter: "capriles",
    owner: 0,
    target: 1,
    startedTick: 200,
    tick: 30,
    duration: 360,
    x: 300,
    y: 500,
    direction: 1,
    damage: 20,
    initialHp: 100,
  };
  try {
    const audio = await import("../src/audio");
    audio.startAmbience("caracas");
    audio.stopAmbience();
    worker!.finish();
    await settle();
    assert.equal(
      sources.length,
      0,
      "late background cannot restart after leaving",
    );
    audio.startAmbience("merida");
    assert.equal(sources.length, 1);
    audio.startAmbience("merida");
    assert.equal(sources.length, 1);
    audio.stopAmbience();
    audio.syncFinaleMusic(scene, false);
    audio.setSound(false);
    worker!.finish();
    await settle();
    assert.equal(sources.length, 1, "preparation never plays a cue by itself");
    audio.setSound(true);
    audio.syncFinaleMusic({ ...scene, tick: 90 }, true);
    assert.equal(sources.length, 1, "paused cue stays silent");
    audio.syncFinaleMusic({ ...scene, tick: 120 }, false);
    assert.equal(sources.at(-1)!.offset, 2);
    audio.syncFinaleMusic(undefined, false);
    assert.equal(sources.at(-1)!.stopped, true);
    audio.syncVictoryMusic("zavarce", 0, false);
    audio.syncVictoryMusic("zavarce", VICTORY_DURATION_MS, false);
    worker!.finish();
    await settle();
    assert.equal(sources.length, 2, "finished victory cannot start late");
    audio.syncVictoryMusic("zavarce", 1400, false);
    assert.equal(sources.at(-1)!.offset, 1.4);
    audio.stopVictoryMusic();
    const ready = audio.prepareMatchAudio(["nacho", "zavarce"]);
    worker!.finish();
    await ready;
    audio.syncFinaleMusic(
      { ...scene, fighter: "nacho", tick: 150, duration: 360 },
      false,
    );
    assert.equal(sources.at(-1)!.offset, 2.5);
    assert.equal(
      worker!.jobs.length,
      0,
      "selected finale uses the prepared buffer",
    );
    audio.stopFinaleMusic();
  } finally {
    worker!?.finish();
    await settle();
    for (const [key, descriptor] of old) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
