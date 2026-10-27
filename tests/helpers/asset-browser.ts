import atlas from "../../shared/sprite-geometry.json";

/** Node-only image request fixture; never substitutes for device rendering tests. */
export function browserFixture(
  fail: (url: string, attempt: number) => boolean = () => false,
) {
  const originals = new Map(
    ["Image", "document"].map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ]),
  );
  const geometry = new Map<string, { width: number; height: number }>(
    atlas.sprites.flatMap((entry) =>
      entry.files
        .filter((file) => file.passed)
        .map(
          (file) => [`/${file.file.replace(/^public\//, "")}`, file] as const,
        ),
    ),
  );
  const requests = new Map<string, number>();
  class FixtureImage {
    width = 8;
    height = 4;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    private url = "";
    get src() {
      return this.url;
    }
    set src(url: string) {
      this.url = url;
      url = url.split("?")[0];
      const attempt = (requests.get(url) ?? 0) + 1;
      requests.set(url, attempt);
      const checked = geometry.get(url);
      if (checked) {
        this.width = checked.width;
        this.height = checked.height;
      }
      queueMicrotask(() =>
        fail(url, attempt) ? this.onerror?.() : this.onload?.(),
      );
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
          ) => ({
            data: new Uint8ClampedArray(width * height * 4),
          }),
        }),
      }),
    },
  });
  return {
    requests,
    count: (url: string) => requests.get(url) ?? 0,
    restore() {
      for (const [name, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
      }
    },
  };
}
