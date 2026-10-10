import { AtlasError, brand, describe, isRecord } from './errors.js';
import { RegionIndex } from './regions.js';
import type { Region, RegionSelector } from './regions.js';

export interface ParcelEntry {
  readonly id: number;
  readonly value: number;
}

/** Values bound to one atlas's region table, in that table's declared order. */
export class ParcelValues implements Iterable<ParcelEntry> {
  static { brand(this, 'ParcelValues'); }
  readonly #data: Float64Array;

  constructor(readonly regions: RegionIndex, entries: Iterable<ParcelEntry>) {
    if (!(regions instanceof RegionIndex)) throw new AtlasError('INVALID_DATA', 'Expected a RegionIndex.');
    if (!isRecord(entries) || typeof (entries as Partial<Iterable<ParcelEntry>>)[Symbol.iterator] !== 'function') {
      throw new AtlasError('INVALID_DATA', 'Parcel values must be an iterable of { id, value } entries.');
    }
    this.#data = new Float64Array(regions.size);
    const seen = new Set<number>();
    for (const entry of entries) {
      if (!isRecord(entry)) throw new AtlasError('INVALID_DATA', `Invalid parcel entry ${describe(entry)}.`);
      const { id, value } = entry;
      if (seen.has(id)) throw new AtlasError('PARCEL_MISMATCH', `Duplicate value for ID ${id}.`);
      if (typeof value !== 'number') throw new AtlasError('INVALID_DATA', `Value for ID ${id} is not numeric.`);
      this.#data[regions.position(id)] = value;
      seen.add(id);
    }
    if (seen.size !== regions.size) {
      const missing = regions.ids.filter(id => !seen.has(id));
      throw new AtlasError('PARCEL_MISMATCH', `Missing values for region IDs: ${missing.join(', ')}.`);
    }
    Object.freeze(this);
  }

  get(selector: RegionSelector): number {
    return this.#data[this.regions.position(this.regions.resolve(selector).id)]!;
  }

  /** Defensive copy, ordered by regions.items. */
  toArray(): Float64Array { return this.#data.slice(); }

  *[Symbol.iterator](): IterableIterator<ParcelEntry> {
    for (const region of this.regions) yield { id: region.id, value: this.get(region.id) };
  }

  /** @internal */
  assertRegions(regions: RegionIndex): void {
    if (regions !== this.regions) {
      throw new AtlasError('PARCEL_MISMATCH',
        'Values belong to a different atlas. Use rebind() to transfer them by ID or full label.');
    }
  }
}

export interface RebindOptions {
  /**
   * How target regions find their source values. Default 'id': the same ID, whose
   * short label must agree (and full label and hemisphere, where both define them).
   * 'fullLabel': the unique source region with the same full label.
   */
  readonly by?: 'id' | 'fullLabel';
}

/** @internal Every target region must find exactly one source value; extra source regions are ignored. */
export function rebindValues(values: ParcelValues, target: RegionIndex, options: RebindOptions = {}): ParcelValues {
  if (!(values instanceof ParcelValues)) throw new AtlasError('INVALID_DATA', 'Expected ParcelValues.');
  const by = isRecord(options) ? options.by ?? 'id' : undefined;
  if (by !== 'id' && by !== 'fullLabel') {
    throw new AtlasError('INVALID_DATA', `Invalid rebind options ${describe(options)}.`);
  }
  const source = values.regions;
  const matchFor = (region: Region): Region => {
    if (by === 'fullLabel') {
      if (region.fullLabel === undefined) {
        throw new AtlasError('PARCEL_MISMATCH', `Target region ${region.id} has no full label.`);
      }
      const found = source.items.filter(candidate => candidate.fullLabel === region.fullLabel);
      if (found.length !== 1) {
        throw new AtlasError('PARCEL_MISMATCH',
          `${found.length === 0 ? 'No' : 'Several'} source regions with full label ${describe(region.fullLabel)}.`);
      }
      return found[0]!;
    }
    const match = source.get(region.id);
    if (match === undefined) throw new AtlasError('PARCEL_MISMATCH', `No source value for region ID ${region.id}.`);
    const differs = (key: 'fullLabel' | 'hemisphere') =>
      match[key] !== undefined && region[key] !== undefined && match[key] !== region[key];
    if (match.label !== region.label || differs('fullLabel') || differs('hemisphere')) {
      throw new AtlasError('PARCEL_MISMATCH', `Region ID ${region.id} describes different regions in the two atlases.`);
    }
    return match;
  };
  return new ParcelValues(target, target.items.map(region => ({ id: region.id, value: values.get(matchFor(region).id) })));
}

export type Reduction = 'mean' | 'sum' | 'min' | 'max';
export interface ReductionOptions {
  readonly statistic?: Reduction;
  /** Default: error. Omit excludes NaN and infinities; propagate uses IEEE arithmetic. */
  readonly nonFinite?: 'error' | 'omit' | 'propagate';
}

/** @internal Resolves defaults; only undefined (or absent) fields take them. */
export function reductionOptions(options: ReductionOptions): Required<ReductionOptions> {
  if (!isRecord(options as unknown)) throw new AtlasError('INVALID_DATA', 'Invalid reduction options.');
  const statistic = options.statistic === undefined ? 'mean' : options.statistic;
  const nonFinite = options.nonFinite === undefined ? 'error' : options.nonFinite;
  if (!['mean', 'sum', 'min', 'max'].includes(statistic) || !['error', 'omit', 'propagate'].includes(nonFinite)) {
    throw new AtlasError('INVALID_DATA', `Invalid reduction options ${describe(options)}.`);
  }
  return { statistic, nonFinite };
}

/** @internal Shared streaming accumulator; memory is proportional to parcel count. */
export class ParcelAccumulator {
  readonly #values: Float64Array;
  readonly #counts: Float64Array;
  readonly #statistic: Reduction;
  readonly #nonFinite: NonNullable<ReductionOptions['nonFinite']>;

  constructor(readonly regions: RegionIndex, options: ReductionOptions) {
    ({ statistic: this.#statistic, nonFinite: this.#nonFinite } = reductionOptions(options));
    this.#values = new Float64Array(regions.size);
    this.#counts = new Float64Array(regions.size);
    if (this.#statistic === 'min') this.#values.fill(Infinity);
    if (this.#statistic === 'max') this.#values.fill(-Infinity);
  }

  /** Adds `data[i]` to region-table position `positions[i]`; negative positions are background. */
  addPositions(positions: Int32Array, data: ArrayLike<number>): void {
    const values = this.#values;
    const counts = this.#counts;
    const statistic = this.#statistic;
    const nonFinite = this.#nonFinite;
    for (let i = 0; i < positions.length; i++) {
      const position = positions[i]!;
      if (position < 0) continue;
      const value = data[i]!;
      if (typeof value !== 'number') throw new AtlasError('INVALID_DATA', 'Samples must be numeric.');
      if (!Number.isFinite(value) && nonFinite !== 'propagate') {
        if (nonFinite === 'omit') continue;
        throw new AtlasError('INVALID_DATA', `Non-finite sample in region ${this.regions.items[position]!.id}.`);
      }
      counts[position]!++;
      values[position] = statistic === 'min' ? Math.min(values[position]!, value)
        : statistic === 'max' ? Math.max(values[position]!, value) : values[position]! + value;
    }
  }

  finish(): ParcelValues {
    return new ParcelValues(this.regions, this.regions.items.map((region, position) => {
      const count = this.#counts[position]!;
      const value = this.#values[position]!;
      return {
        id: region.id,
        value: count === 0 ? (this.#statistic === 'sum' ? 0 : NaN)
          : this.#statistic === 'mean' ? value / count : value,
      };
    }));
  }
}
