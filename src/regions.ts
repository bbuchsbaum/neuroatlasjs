import { AtlasError, brand, describe, isArrayLike, isPlainObject, isRecord, nonempty } from './errors.js';

export type Hemisphere = 'left' | 'right' | 'bilateral' | 'midline';
export type RGB = readonly [red: number, green: number, blue: number];

/** IDs are positive int32 labels, never positions in the region table. */
export interface Region {
  readonly id: number;
  readonly label: string;
  readonly fullLabel?: string;
  readonly hemisphere?: Hemisphere;
  readonly network?: string;
  readonly color?: RGB;
  readonly attributes?: Readonly<Record<string, string | number | boolean>>;
}

/**
 * Explicit alternatives prevent an ID and a label being supplied together.
 * `label` matches short labels only; `fullLabel` matches full labels only.
 */
export type RegionSelector =
  | number
  | { readonly label: string; readonly hemisphere?: Hemisphere; readonly fullLabel?: never }
  | { readonly fullLabel: string; readonly label?: never; readonly hemisphere?: never };

const HEMISPHERES: readonly unknown[] = ['left', 'right', 'bilateral', 'midline'];
const SELECTOR_KEYS: readonly string[] = ['label', 'fullLabel', 'hemisphere'];

/** @internal */
export function isRegionId(id: unknown): id is number {
  return Number.isInteger(id) && (id as number) > 0 && (id as number) <= 0x7fffffff;
}

function invalidSelector(selector: unknown): AtlasError {
  return new AtlasError('INVALID_SELECTOR',
    `Invalid region selector ${describe(selector)}; use an ID, { label, hemisphere? }, or { fullLabel }.`);
}

/** Copies only the declared fields, so the snapshot is fully frozen. */
function snapshot(region: Region): Region {
  if (!isRecord(region)) throw new AtlasError('INVALID_METADATA', 'Each region must be an object.');
  if (!isRegionId(region.id)) {
    throw new AtlasError('INVALID_METADATA', `Region ID ${describe(region.id)} must be a positive int32.`);
  }
  nonempty(region.label, 'Region label');
  const result: { -readonly [K in keyof Region]: Region[K] } = { id: region.id, label: region.label };
  if (region.fullLabel !== undefined) {
    nonempty(region.fullLabel, 'Full label');
    result.fullLabel = region.fullLabel;
  }
  if (region.network !== undefined) {
    nonempty(region.network, 'Network');
    result.network = region.network;
  }
  if (region.hemisphere !== undefined) {
    if (!HEMISPHERES.includes(region.hemisphere)) {
      throw new AtlasError('INVALID_METADATA', `Invalid hemisphere: ${describe(region.hemisphere)}.`);
    }
    result.hemisphere = region.hemisphere;
  }
  if (region.color !== undefined) {
    const color: unknown = region.color;
    const channels = isArrayLike(color) && color.length === 3 ? Array.from(color) : [];
    if (channels.length !== 3 || channels.some(c => !Number.isInteger(c) || (c as number) < 0 || (c as number) > 255)) {
      throw new AtlasError('INVALID_METADATA', 'RGB color must be three integers in [0, 255].');
    }
    const [red, green, blue] = channels as [number, number, number];
    result.color = Object.freeze([red, green, blue] as const);
  }
  if (region.attributes !== undefined) {
    if (!isPlainObject(region.attributes)) {
      throw new AtlasError('INVALID_METADATA', 'Region attributes must be a plain object.');
    }
    for (const [key, value] of Object.entries(region.attributes)) {
      nonempty(key, 'Attribute key');
      if (!['string', 'number', 'boolean'].includes(typeof value) ||
          (typeof value === 'number' && !Number.isFinite(value))) {
        throw new AtlasError('INVALID_METADATA', `Invalid attribute ${key}.`);
      }
    }
    result.attributes = Object.freeze({ ...region.attributes });
  }
  return Object.freeze(result);
}

/** An immutable, ordered region table. Duplicate short labels are permitted. */
export class RegionIndex implements Iterable<Region> {
  static { brand(this, 'RegionIndex'); }
  readonly #items: readonly Region[];
  readonly #positions = new Map<number, number>();

  constructor(regions: Iterable<Region>) {
    if (!isRecord(regions) || typeof (regions as Partial<Iterable<Region>>)[Symbol.iterator] !== 'function') {
      throw new AtlasError('INVALID_METADATA', 'Regions must be an iterable of region objects.');
    }
    this.#items = Object.freeze(Array.from(regions, snapshot));
    this.#items.forEach((region, position) => {
      if (this.#positions.has(region.id)) {
        throw new AtlasError('INVALID_METADATA', `Duplicate region ID ${region.id}.`);
      }
      this.#positions.set(region.id, position);
    });
    Object.freeze(this);
  }

  get size(): number { return this.#items.length; }
  get items(): readonly Region[] { return this.#items; }
  get ids(): readonly number[] { return this.#items.map(region => region.id); }
  [Symbol.iterator](): Iterator<Region> { return this.#items[Symbol.iterator](); }

  get(id: number): Region | undefined {
    const position = this.#positions.get(id);
    return position === undefined ? undefined : this.#items[position];
  }

  /** Exact, case-sensitive short-label matches; no lossy punctuation normalization. */
  find(label: string, hemisphere?: Hemisphere): readonly Region[] {
    if (typeof label !== 'string' || (hemisphere !== undefined && !HEMISPHERES.includes(hemisphere))) {
      throw invalidSelector({ label, hemisphere });
    }
    return this.#items.filter(region =>
      region.label === label && (hemisphere === undefined || region.hemisphere === hemisphere));
  }

  /** Throws for a malformed, missing, or ambiguous selector instead of taking the first match. */
  resolve(selector: RegionSelector): Region {
    const matches = this.#match(selector);
    if (matches.length === 0) {
      throw new AtlasError('UNKNOWN_REGION', `Unknown region ${describe(selector)}.`);
    }
    if (matches.length > 1) {
      throw new AtlasError('AMBIGUOUS_REGION',
        `Ambiguous region ${describe(selector)}; use an ID, full label, or hemisphere.`);
    }
    return matches[0]!;
  }

  #match(selector: unknown): readonly Region[] {
    if (typeof selector === 'number') {
      if (!isRegionId(selector)) throw invalidSelector(selector);
      const region = this.get(selector);
      return region === undefined ? [] : [region];
    }
    if (!isRecord(selector) || Object.keys(selector).some(key => !SELECTOR_KEYS.includes(key))) {
      throw invalidSelector(selector);
    }
    const { label, fullLabel, hemisphere } = selector;
    if (fullLabel !== undefined) {
      if (typeof fullLabel !== 'string' || label !== undefined || hemisphere !== undefined) {
        throw invalidSelector(selector);
      }
      return this.#items.filter(region => region.fullLabel === fullLabel);
    }
    if (typeof label !== 'string') throw invalidSelector(selector);
    if (hemisphere !== undefined && !HEMISPHERES.includes(hemisphere)) throw invalidSelector(selector);
    return this.find(label, hemisphere as Hemisphere | undefined);
  }

  /** Position in the declared region order, with validation. */
  position(id: number): number {
    const position = this.#positions.get(id);
    if (position === undefined) throw new AtlasError('UNKNOWN_REGION', `Unknown region ID ${describe(id)}.`);
    return position;
  }
}
