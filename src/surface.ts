import { LabelAssignment } from './assignment.js';
import { AtlasError, assertPredicate, brand, describe, isRecord } from './errors.js';
import { ParcelAccumulator, ParcelValues, rebindValues } from './parcels.js';
import type { ParcelEntry, RebindOptions, ReductionOptions } from './parcels.js';
import { RegionIndex } from './regions.js';
import type { Region, RegionSelector } from './regions.js';
import { metadataSnapshot, optionsObject } from './types.js';
import type { AtlasMetadata } from './types.js';

export type SurfaceHemisphere = 'left' | 'right';
export interface HemispherePair<T> {
  readonly left: T;
  readonly right: T;
}

export interface SurfaceAtlasOptions extends AtlasMetadata, HemispherePair<ArrayLike<number>> {
  readonly regions: Iterable<Region>;
}

export interface SurfaceROI extends HemispherePair<Uint32Array> {
  readonly region: Region;
}

/** Categorical labels on two explicitly ordered vertex domains; no mesh dependency. */
export class SurfaceAtlas {
  static { brand(this, 'SurfaceAtlas'); }
  readonly kind = 'surface';
  readonly metadata: Readonly<AtlasMetadata>;
  readonly regions: RegionIndex;
  readonly #left: LabelAssignment;
  readonly #right: LabelAssignment;

  constructor(options: SurfaceAtlasOptions) {
    const { left, right, regions, ...metadata } = optionsObject(options, 'SurfaceAtlas');
    this.metadata = metadataSnapshot(metadata);
    this.regions = new RegionIndex(regions);
    this.#left = new LabelAssignment(left, this.regions);
    this.#right = new LabelAssignment(right, this.regions);
    for (const hemisphere of ['left', 'right'] as const) {
      const assignment = this.#side(hemisphere);
      for (let i = 0; i < assignment.size; i++) {
        const declared = this.regions.get(assignment.at(i))?.hemisphere;
        if ((declared === 'left' || declared === 'right') && declared !== hemisphere) {
          throw new AtlasError('INVALID_LABEL', `A ${declared} region occurs on the ${hemisphere} surface.`);
        }
      }
    }
    Object.freeze(this);
  }

  #side(hemisphere: SurfaceHemisphere): LabelAssignment {
    if (hemisphere === 'left') return this.#left;
    if (hemisphere === 'right') return this.#right;
    throw new AtlasError('INVALID_DATA', `Unknown surface hemisphere: ${describe(hemisphere)}.`);
  }

  get name(): string { return this.metadata.name; }
  vertexCount(hemisphere: SurfaceHemisphere): number { return this.#side(hemisphere).size; }
  labels(hemisphere: SurfaceHemisphere): Int32Array { return this.#side(hemisphere).copy(); }
  labelAt(hemisphere: SurfaceHemisphere, vertex: number): number { return this.#side(hemisphere).at(vertex); }
  regionAt(hemisphere: SurfaceHemisphere, vertex: number): Region | undefined {
    return this.regions.get(this.labelAt(hemisphere, vertex));
  }

  roi(selector: RegionSelector): SurfaceROI {
    const region = this.regions.resolve(selector);
    return { region, left: this.#left.indices(region.id), right: this.#right.indices(region.id) };
  }

  subset(predicate: (region: Region) => boolean): SurfaceAtlas {
    assertPredicate(predicate);
    const regions = this.regions.items.filter(predicate);
    const keep = new Set(regions.map(region => region.id));
    return new SurfaceAtlas({
      ...this.metadata, regions, left: this.#left.subset(keep), right: this.#right.subset(keep),
    });
  }

  values(entries: Iterable<ParcelEntry>): ParcelValues { return new ParcelValues(this.regions, entries); }

  /** Transfer values bound to another atlas (e.g. a parent or a volume atlas) to this one. */
  rebind(values: ParcelValues, options?: RebindOptions): ParcelValues {
    return rebindValues(values, this.regions, options);
  }

  /** Caller supplies values in exactly the atlas's vertex order. Mean is vertex-weighted, not area-weighted. */
  reduce(data: HemispherePair<ArrayLike<number>>, options: ReductionOptions = {}): ParcelValues {
    if (!isRecord(data)) throw new AtlasError('INVALID_DATA', 'Expected { left, right } sample arrays.');
    const accumulator = new ParcelAccumulator(this.regions, options);
    this.#left.accumulate(data.left, accumulator);
    this.#right.accumulate(data.right, accumulator);
    return accumulator.finish();
  }

  project(values: ParcelValues, background = NaN): HemispherePair<Float64Array> {
    return { left: this.#left.project(values, background), right: this.#right.project(values, background) };
  }
}
