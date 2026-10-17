import test from "node:test";
import assert from "node:assert/strict";
import { getPreference, setPreference } from "../src/storage";

function browserStorage() {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  return {
    values,
    restore() {
      if (previous) Object.defineProperty(globalThis, "localStorage", previous);
      else Reflect.deleteProperty(globalThis, "localStorage");
    },
  };
}

test("corrupt saved names and sound settings recover to their typed defaults", () => {
  const storage = browserStorage();
  try {
    for (const value of [null, false, 42, {}, [], ["Pana"]]) {
      storage.values.set("arena-name", JSON.stringify(value));
      assert.equal(getPreference("name", ""), "");
    }
    for (const value of [null, "false", 0, {}, []]) {
      storage.values.set("arena-sound", JSON.stringify(value));
      assert.equal(getPreference("sound", true), true);
    }
    storage.values.set("arena-name", "{broken");
    assert.equal(getPreference("name", ""), "");
  } finally {
    storage.restore();
  }
});

test("valid preferences round-trip including muted sound and an empty name", () => {
  const storage = browserStorage();
  try {
    setPreference("name", "Pana Ñ");
    assert.equal(getPreference("name", ""), "Pana Ñ");
    setPreference("name", "");
    assert.equal(getPreference("name", "Fallback"), "");
    for (const sound of [false, true]) {
      setPreference("sound", sound);
      assert.equal(getPreference("sound", !sound), sound);
    }
  } finally {
    storage.restore();
  }
});
