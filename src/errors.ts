/** Stable error codes for data validation and atlas operations. */
export type AtlasErrorCode =
  | 'INVALID_METADATA'
  | 'INVALID_LABEL'
  | 'INVALID_SELECTOR'
  | 'UNKNOWN_REGION'
  | 'AMBIGUOUS_REGION'
  | 'OUT_OF_BOUNDS'
  | 'GRID_MISMATCH'
  | 'INVALID_DATA'
  | 'PARCEL_MISMATCH';

// Bump with any incompatible change to class internals, so other versions never match.
const BRAND = Symbol.for('neuroatlasjs.class.v0');

/**
 * @internal Makes `instanceof` agree across the ESM and CommonJS builds, which
 * otherwise define distinct copies of every class. Subclasses keep ordinary
 * prototype-chain semantics.
 */
export function brand(target: { readonly prototype: object }, name: string): void {
  Object.defineProperty(target.prototype, BRAND, { value: name });
  Object.defineProperty(target, Symbol.hasInstance, {
    value(this: unknown, value: unknown): boolean {
      if (this !== target) return Function.prototype[Symbol.hasInstance].call(this, value);
      return isRecord(value) && value !== target.prototype &&
        (value as { [BRAND]?: unknown })[BRAND] === name;
    },
  });
}

export class AtlasError extends Error {
  static { brand(this, 'AtlasError'); }
  override readonly name = 'AtlasError';

  constructor(readonly code: AtlasErrorCode, message: string) {
    super(message);
  }
}

/** @internal Objects and functions, excluding null. */
export function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return (typeof value === 'object' && value !== null) || typeof value === 'function';
}

/** @internal Objects whose prototype is Object.prototype or null. */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** @internal */
export function isArrayLike(value: unknown): value is ArrayLike<unknown> {
  return isRecord(value) && typeof value.length === 'number';
}

/** @internal A message-safe rendering of arbitrary caller input. */
export function describe(value: unknown): string {
  if (typeof value === 'number') return String(value);
  try {
    return JSON.stringify(value, (_, v: unknown) => typeof v === 'number' && !Number.isFinite(v) ? String(v) : v)
      ?? String(value);
  } catch {
    return String(value);
  }
}

/** @internal */
export function assertPredicate(value: unknown): void {
  if (typeof value !== 'function') throw new AtlasError('INVALID_DATA', 'Expected a region predicate function.');
}

/** @internal */
export function checkIndex(index: number, size: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= size) {
    throw new AtlasError('OUT_OF_BOUNDS', `Index ${describe(index)} is outside [0, ${size}).`);
  }
}

/** @internal */
export function nonempty(value: unknown, field: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AtlasError('INVALID_METADATA', `${field} must be a nonempty string.`);
  }
}
