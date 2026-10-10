import { LabelAssignment } from './assignment.js';
import { AtlasError, assertPredicate, brand, checkIndex, isArrayLike, isRecord } from './errors.js';
import { ParcelAccumulator, ParcelValues, rebindValues, reductionOptions } from './parcels.js';
import type { ParcelEntry, RebindOptions, ReductionOptions } from './parcels.js';
import { RegionIndex } from './regions.js';
import type { Region, RegionSelector } from './regions.js';
import { metadataSnapshot, optionsObject } from './types.js';
import type { AtlasMetadata, Point3, SeriesLike, VolumeLike, VolumeSpace } from './types.js';

interface Grid {
  readonly dimensions: readonly number[];
  /** Row-major 4 by 4. */
  readonly affine: readonly number[];
  readonly size: number;
  readonly frames: number;
}

function gridOf(space: unknown, rank: 3 | 4 = 3): Grid {
  if (!isRecord(space) || !isArrayLike(space.dim) || !isRecord(space.trans)) {
    throw new AtlasError('GRID_MISMATCH', 'Expected a space with dim and trans.');
  }
  const dim = Array.from(space.dim);
  if (dim.length !== rank || dim.some(d => !Number.isSafeInteger(d) || (d as number) <= 0)) {
    throw new AtlasError('GRID_MISMATCH', `Expected a positive ${rank}D grid.`);
  }
  const dimensions = (dim as number[]).slice(0, 3);
  const frames = rank === 4 ? (dim[3] as number) : 1;
  const size = dimensions.reduce((a, b) => a * b, 1);
  if (!Number.isSafeInteger(size) || size > 0xffffffff) {
    throw new AtlasError('GRID_MISMATCH', 'Grid exceeds the supported uint32 sample count.');
  }
  const matrix = space.trans as Partial<VolumeSpace['trans']>;
  if (matrix.rows !== 4 || matrix.columns !== 4 || typeof matrix.get !== 'function') {
    throw new AtlasError('GRID_MISMATCH', 'Expected a 4 by 4 spatial affine.');
  }
  const affine: number[] = [];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const value = matrix.get(row, col);
      if (!Number.isFinite(value)) throw new AtlasError('GRID_MISMATCH', 'Affine must be finite.');
      affine.push(value);
    }
  }
  if (affine[12] !== 0 || affine[13] !== 0 || affine[14] !== 0 || affine[15] !== 1) {
    throw new AtlasError('GRID_MISMATCH', 'Expected an affine homogeneous bottom row [0, 0, 0, 1].');
  }
  return { dimensions, affine, size, frames };
}

/** Dimensions must be equal; each affine entry may differ by at most `tolerance`. */
function assertGrid(expected: Grid, actual: Grid, tolerance: number): void {
  if (expected.dimensions.some((value, i) => value !== actual.dimensions[i]) ||
      expected.affine.some((value, i) => !(Math.abs(value - actual.affine[i]!) <= tolerance))) {
    throw new AtlasError('GRID_MISMATCH',
      tolerance === 0
        ? 'Dimensions and affine must match exactly; align data explicitly or set affineTolerance.'
        : `Dimensions must match and affine entries must agree within ${tolerance}; align data explicitly.`);
  }
}

/** Row-major 3 by 3 inverse of the affine's linear part, followed by its translation. */
function inverseOf(affine: readonly number[]): readonly number[] {
  const [a, b, c, tx, d, e, f, ty, g, h, k, tz] = affine as [number, number, number, number,
    number, number, number, number, number, number, number, number];
  const det = a * (e * k - f * h) - b * (d * k - f * g) + c * (d * h - e * g);
  const inverse = [
    (e * k - f * h) / det, (c * h - b * k) / det, (b * f - c * e) / det,
    (f * g - d * k) / det, (a * k - c * g) / det, (c * d - a * f) / det,
    (d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det,
    tx, ty, tz,
  ];
  if (det === 0 || !inverse.every(Number.isFinite)) {
    throw new AtlasError('GRID_MISMATCH', 'Affine must be invertible.');
  }
  return inverse;
}

function assertVolume(volume: unknown): asserts volume is VolumeLike {
  if (!isRecord(volume) || typeof volume.getData !== 'function' || typeof volume.length !== 'number') {
    throw new AtlasError('INVALID_DATA', 'Expected a volume with space, length, and getData().');
  }
}

function assertPoint(point: unknown, kind: string): asserts point is Point3 {
  if (!isArrayLike(point) || point.length !== 3) {
    throw new AtlasError('INVALID_DATA', `${kind} must contain three coordinates.`);
  }
}

function assertConstructor(value: unknown): void {
  if (typeof value !== 'function') throw new AtlasError('INVALID_DATA', 'Expected a volume constructor.');
}

export interface VolumeAtlasOptions<S extends VolumeSpace> extends AtlasMetadata {
  readonly volume: VolumeLike<S>;
  readonly regions: Iterable<Region>;
  /**
   * Largest absolute difference allowed in each affine entry when an input grid is
   * compared with the atlas grid. Default 0 (exact). Dimensions must always match.
   */
  readonly affineTolerance?: number;
}

export interface VolumeROI<S extends VolumeSpace> {
  readonly region: Region;
  readonly space: S;
  /** Zero-based, x-fastest flat voxel indices. Caller owns this array. */
  readonly indices: Uint32Array;
}

/** A categorical 3D atlas. Input labels are validated and copied once. */
export class VolumeAtlas<S extends VolumeSpace = VolumeSpace> {
  static { brand(this, 'VolumeAtlas'); }
  readonly kind = 'volume';
  readonly metadata: Readonly<AtlasMetadata>;
  readonly regions: RegionIndex;
  readonly space: S;
  readonly affineTolerance: number;
  readonly #assignment: LabelAssignment;
  /** Snapshot of the space at construction; all geometry uses it. */
  readonly #grid: Grid;
  readonly #inverse: readonly number[];

  constructor(options: VolumeAtlasOptions<S>) {
    const { volume, regions, affineTolerance = 0, ...metadata } = optionsObject(options, 'VolumeAtlas');
    this.metadata = metadataSnapshot(metadata);
    if (typeof affineTolerance !== 'number' || !(affineTolerance >= 0) || !Number.isFinite(affineTolerance)) {
      throw new AtlasError('INVALID_METADATA', 'affineTolerance must be a finite, nonnegative number.');
    }
    this.affineTolerance = affineTolerance;
    assertVolume(volume);
    this.space = volume.space;
    this.#grid = gridOf(this.space);
    this.#inverse = inverseOf(this.#grid.affine);
    this.regions = new RegionIndex(regions);
    const labels = volume.getData();
    if (volume.length !== this.#grid.size || !isArrayLike(labels) || labels.length !== this.#grid.size) {
      throw new AtlasError('GRID_MISMATCH', 'Volume data length does not match its grid.');
    }
    this.#assignment = new LabelAssignment(labels, this.regions);
    Object.freeze(this);
  }

  /** Guards operations that hand `space` to new outputs against a mutated space. */
  #assertSpaceUnchanged(): void {
    const current = gridOf(this.space);
    if (this.#grid.dimensions.some((value, i) => value !== current.dimensions[i]) ||
        this.#grid.affine.some((value, i) => value !== current.affine[i])) {
      throw new AtlasError('GRID_MISMATCH', 'The atlas space changed after construction; spaces must be immutable.');
    }
  }

  get name(): string { return this.metadata.name; }
  get size(): number { return this.#assignment.size; }

  /** Defensive copy; 0 denotes background. */
  labels(): Int32Array { return this.#assignment.copy(); }

  labelAt(index: number): number { return this.#assignment.at(index); }
  regionAt(index: number): Region | undefined { return this.regions.get(this.labelAt(index)); }

  regionAtVoxel(voxel: Point3): Region | undefined {
    assertPoint(voxel, 'Voxel');
    const [i, j, k] = voxel;
    const [nx, ny, nz] = this.#grid.dimensions;
    checkIndex(i, nx!);
    checkIndex(j, ny!);
    checkIndex(k, nz!);
    return this.regionAt(i + nx! * (j + ny! * k));
  }

  /**
   * Nearest voxel center, in this atlas's world coordinates, using the affine
   * captured at construction. Voxel i covers grid coordinates [i - 0.5, i + 0.5).
   * Outside returns undefined.
   */
  regionAtWorld(point: Point3): Region | undefined {
    assertPoint(point, 'World point');
    if (!Number.isFinite(point[0]) || !Number.isFinite(point[1]) || !Number.isFinite(point[2])) {
      throw new AtlasError('INVALID_DATA', 'World point must contain three finite coordinates.');
    }
    const m = this.#inverse;
    const x = point[0] - m[9]!;
    const y = point[1] - m[10]!;
    const z = point[2] - m[11]!;
    const i = Math.floor(m[0]! * x + m[1]! * y + m[2]! * z + 0.5);
    const j = Math.floor(m[3]! * x + m[4]! * y + m[5]! * z + 0.5);
    const k = Math.floor(m[6]! * x + m[7]! * y + m[8]! * z + 0.5);
    const [nx, ny, nz] = this.#grid.dimensions;
    if (i < 0 || i >= nx! || j < 0 || j >= ny! || k < 0 || k >= nz!) return undefined;
    return this.regionAt(i + nx! * (j + ny! * k));
  }

  roi(selector: RegionSelector): VolumeROI<S> {
    const region = this.regions.resolve(selector);
    return { region, space: this.space, indices: this.#assignment.indices(region.id) };
  }

  /** Preserves IDs, region order, and affineTolerance; removed labels become background. */
  subset(predicate: (region: Region) => boolean): VolumeAtlas<S> {
    assertPredicate(predicate);
    this.#assertSpaceUnchanged();
    const regions = this.regions.items.filter(predicate);
    const labels = this.#assignment.subset(new Set(regions.map(region => region.id)));
    return new VolumeAtlas({
      ...this.metadata, regions, affineTolerance: this.affineTolerance,
      volume: { space: this.space, length: this.size, getData: () => labels },
    });
  }

  /** Bind an exact set of ID-keyed values to this atlas. Input order is irrelevant. */
  values(entries: Iterable<ParcelEntry>): ParcelValues { return new ParcelValues(this.regions, entries); }

  /** Transfer values bound to another atlas (e.g. a parent or a surface atlas) to this one. */
  rebind(values: ParcelValues, options?: RebindOptions): ParcelValues {
    return rebindValues(values, this.regions, options);
  }

  reduce(volume: VolumeLike, options: ReductionOptions = {}): ParcelValues {
    assertVolume(volume);
    assertGrid(this.#grid, gridOf(volume.space), this.affineTolerance);
    if (volume.length !== this.size) throw new AtlasError('GRID_MISMATCH', 'Volume length differs.');
    const accumulator = new ParcelAccumulator(this.regions, options);
    this.#assignment.accumulate(volume.getData(), accumulator);
    return accumulator.finish();
  }

  /**
   * Lazy, frame-ordered summaries. The series, its 4D grid, and the options are
   * checked when called; each extracted frame is checked as it is read.
   */
  reduceSeries(series: SeriesLike, options: ReductionOptions = {}): IterableIterator<ParcelValues> {
    if (!isRecord(series) || typeof series.getVolume !== 'function') {
      throw new AtlasError('INVALID_DATA', 'Expected a series with space and getVolume(frame).');
    }
    const grid = gridOf(series.space, 4);
    assertGrid(this.#grid, grid, this.affineTolerance);
    reductionOptions(options);
    return this.#frames(series, grid.frames, options);
  }

  *#frames(series: SeriesLike, frames: number, options: ReductionOptions): IterableIterator<ParcelValues> {
    for (let frame = 0; frame < frames; frame++) yield this.reduce(series.getVolume(frame), options);
  }

  /** Project bound values to a caller-owned x-fastest buffer. */
  project(values: ParcelValues, background = NaN): Float64Array {
    return this.#assignment.project(values, background);
  }

  /** Pass neuroimjs Int32NeuroVol to obtain a real, independently mutable NeuroVol. */
  toVolume<V>(Volume: new (space: S, data: Int32Array) => V): V {
    assertConstructor(Volume);
    this.#assertSpaceUnchanged();
    return new Volume(this.space, this.labels());
  }

  /** Pass neuroimjs Float64NeuroVol to preserve double precision and NaN background. */
  mapValues<V>(values: ParcelValues, Volume: new (space: S, data: Float64Array) => V, background = NaN): V {
    assertConstructor(Volume);
    this.#assertSpaceUnchanged();
    return new Volume(this.space, this.project(values, background));
  }
}
