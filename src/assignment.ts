import { AtlasError, checkIndex, describe, isArrayLike } from './errors.js';
import { isRegionId } from './regions.js';
import type { RegionIndex } from './regions.js';
import { ParcelValues } from './parcels.js';
import type { ParcelAccumulator } from './parcels.js';

/** @internal Owns a validated snapshot. Zero is always background. */
export class LabelAssignment {
  readonly #labels: Int32Array;
  /** Region-table position per sample, or -1 for background; avoids per-sample ID lookups. */
  readonly #positions: Int32Array;

  constructor(labels: ArrayLike<number>, readonly regions: RegionIndex) {
    if (!isArrayLike(labels) || !Number.isSafeInteger(labels.length) || labels.length < 0 ||
        labels.length > 0xffffffff) {
      throw new AtlasError('INVALID_LABEL', 'Labels must be an array-like of numeric labels.');
    }
    this.#labels = new Int32Array(labels.length);
    this.#positions = new Int32Array(labels.length);
    for (let i = 0; i < labels.length; i++) {
      const label = labels[i]!;
      if (label === 0) {
        this.#positions[i] = -1;
        continue;
      }
      // Validate before casting, so fractions and unsigned overflow cannot be hidden.
      if (!isRegionId(label) || regions.get(label) === undefined) {
        throw new AtlasError('INVALID_LABEL', `Unknown or invalid label ${describe(label)} at sample ${i}.`);
      }
      this.#labels[i] = label;
      this.#positions[i] = regions.position(label);
    }
  }

  get size(): number { return this.#labels.length; }
  at(index: number): number {
    checkIndex(index, this.size);
    return this.#labels[index]!;
  }
  copy(): Int32Array { return this.#labels.slice(); }

  indices(id: number): Uint32Array {
    const position = this.regions.position(id);
    let count = 0;
    for (const p of this.#positions) if (p === position) count++;
    const indices = new Uint32Array(count);
    let next = 0;
    for (let i = 0; i < this.size; i++) if (this.#positions[i] === position) indices[next++] = i;
    return indices;
  }

  subset(keep: ReadonlySet<number>): Int32Array {
    return this.#labels.map(id => keep.has(id) ? id : 0);
  }

  project(values: ParcelValues, background: number): Float64Array {
    if (!(values instanceof ParcelValues)) throw new AtlasError('INVALID_DATA', 'Expected ParcelValues.');
    values.assertRegions(this.regions);
    if (typeof background !== 'number') throw new AtlasError('INVALID_DATA', 'Background must be numeric.');
    const table = values.toArray();
    const output = new Float64Array(this.size);
    for (let i = 0; i < output.length; i++) {
      const position = this.#positions[i]!;
      output[i] = position < 0 ? background : table[position]!;
    }
    return output;
  }

  accumulate(data: ArrayLike<number>, accumulator: ParcelAccumulator): void {
    if (!isArrayLike(data)) throw new AtlasError('INVALID_DATA', 'Samples must be an array-like of numbers.');
    if (data.length !== this.size) {
      throw new AtlasError('INVALID_DATA', `Expected ${this.size} samples, received ${data.length}.`);
    }
    accumulator.addPositions(this.#positions, data);
  }
}
