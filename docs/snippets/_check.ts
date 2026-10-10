// Assertion helper for executed documentation examples. Never shown on the site.

function normalize(value: unknown): string {
  return JSON.stringify(value, (_, item: unknown) => {
    if (ArrayBuffer.isView(item) && !(item instanceof DataView)) return Array.from(item as unknown as ArrayLike<number>);
    if (typeof item === 'number' && !Number.isFinite(item)) return String(item);
    if (typeof item === 'number' && Object.is(item, -0)) return 0;
    return item;
  }) ?? String(value);
}

/** Throws unless `actual` matches `expected` structurally; typed arrays compare as arrays, NaN equals NaN. */
export function same(actual: unknown, expected: unknown): void {
  const a = normalize(actual);
  const e = normalize(expected);
  if (a !== e) throw new Error(`Documentation example drifted: expected ${e}, received ${a}`);
}

/** Like `same`, for floating-point results. */
export function close(actual: number, expected: number, tolerance = 1e-12): void {
  if (!(Math.abs(actual - expected) <= tolerance)) {
    throw new Error(`Documentation example drifted: expected ${expected}, received ${actual}`);
  }
}
