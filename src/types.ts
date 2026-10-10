import { AtlasError, isRecord, nonempty } from './errors.js';

export type Point3 = readonly [x: number, y: number, z: number];

/** Optional descriptors are supplied by the caller, never inferred from geometry. */
export interface AtlasMetadata {
  readonly name: string;
  readonly description?: string;
  /**
   * Name of the template or surface the atlas is defined on, e.g.
   * 'MNI152NLin2009cAsym' or 'fsaverage6'. Called `space` before 0.2, a key
   * that is now rejected.
   */
  readonly template?: string;
  readonly version?: string;
  readonly idConvention?: string;
  readonly citation?: string;
}

/** Minimal ml-matrix-compatible read interface. */
export interface AffineMatrix {
  readonly rows: number;
  readonly columns: number;
  get(row: number, column: number): number;
}

/**
 * Satisfied directly by neuroimjs NeuroSpace. Spaces must be immutable; the atlas
 * snapshots the grid and affine at construction and computes world lookups itself.
 */
export interface VolumeSpace {
  readonly dim: readonly number[];
  readonly trans: AffineMatrix;
}

/** Satisfied by dense, sparse, and clustered neuroimjs NeuroVol objects. */
export interface VolumeLike<S extends VolumeSpace = VolumeSpace> {
  readonly space: S;
  readonly length: number;
  getData(): ArrayLike<number>;
}

/** Satisfied by neuroimjs NeuroVec; volumes are consumed one frame at a time. */
export interface SeriesLike {
  readonly space: VolumeSpace;
  getVolume(frame: number): VolumeLike;
}

const OPTIONAL_METADATA = ['description', 'template', 'version', 'idConvention', 'citation'] as const;

/** @internal Copies only the declared metadata fields. */
export function metadataSnapshot(metadata: AtlasMetadata): Readonly<AtlasMetadata> {
  nonempty(metadata.name, 'Atlas name');
  // Renamed in 0.2: dropping it silently would lose the caller's template name.
  if ((metadata as { readonly space?: unknown }).space !== undefined) {
    throw new AtlasError('INVALID_METADATA', 'Atlas metadata `space` was renamed to `template`.');
  }
  const result: { -readonly [K in keyof AtlasMetadata]: AtlasMetadata[K] } = { name: metadata.name };
  for (const key of OPTIONAL_METADATA) {
    const value = metadata[key];
    if (value !== undefined) {
      nonempty(value, key);
      result[key] = value;
    }
  }
  return Object.freeze(result);
}

/** @internal */
export function optionsObject<T>(options: T, kind: string): T {
  if (!isRecord(options)) throw new AtlasError('INVALID_METADATA', `${kind} options must be an object.`);
  return options;
}
