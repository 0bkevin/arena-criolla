/** Remove neighboring pose pixels when connected silhouettes overlap atlas rectangles. */
export function isolateFramePixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
) {
  const count = width * height,
    labels = new Int32Array(count),
    queue = new Int32Array(count);
  let label = 0,
    biggest = 0,
    biggestCount = 0;
  for (let start = 0; start < count; start++) {
    if (labels[start] || data[start * 4 + 3] < 40) continue;
    const current = ++label;
    labels[start] = current;
    queue[0] = start;
    let head = 0,
      tail = 1;
    while (head < tail) {
      const p = queue[head++],
        x = p % width,
        y = Math.floor(p / width);
      for (const n of [
        x > 0 ? p - 1 : -1,
        x < width - 1 ? p + 1 : -1,
        y > 0 ? p - width : -1,
        y < height - 1 ? p + width : -1,
      ]) {
        if (n >= 0 && !labels[n] && data[n * 4 + 3] >= 40) {
          labels[n] = current;
          queue[tail++] = n;
        }
      }
    }
    if (tail > biggestCount) {
      biggestCount = tail;
      biggest = current;
    }
  }
  const output = new Uint8ClampedArray(data);
  for (let p = 0; p < count; p++) {
    if (labels[p] === biggest) continue;
    let own = false;
    // Keep the main silhouette's soft edge, never a fully opaque foreign component.
    if (data[p * 4 + 3] < 40) {
      const x = p % width,
        y = Math.floor(p / width);
      for (let dy = -2; dy <= 2 && !own; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx,
            yy = y + dy;
          if (
            xx >= 0 &&
            xx < width &&
            yy >= 0 &&
            yy < height &&
            labels[yy * width + xx] === biggest
          ) {
            own = true;
            break;
          }
        }
    }
    if (!own) output[p * 4 + 3] = 0;
  }
  return output;
}
