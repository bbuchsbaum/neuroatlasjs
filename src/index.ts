export { AtlasError, isAtlasError } from './errors.js';
export type { AtlasErrorCode } from './errors.js';
export { RegionIndex } from './regions.js';
export type { Hemisphere, RGB, Region, RegionSelector } from './regions.js';
export { ParcelValues } from './parcels.js';
export type { BindOptions, ParcelEntry, RebindOptions, Reduction, ReductionOptions } from './parcels.js';
export { VolumeAtlas } from './volume.js';
export type { VolumeAtlasOptions, VolumeROI } from './volume.js';
export { SurfaceAtlas } from './surface.js';
export type { HemispherePair, SurfaceAtlasOptions, SurfaceHemisphere, SurfaceROI } from './surface.js';
export type { AffineMatrix, AtlasMetadata, Point3, SeriesLike, VolumeLike, VolumeSpace } from './types.js';

/** Discriminated union for consumers supporting both spatial representations. */
export type Atlas = import('./volume.js').VolumeAtlas | import('./surface.js').SurfaceAtlas;
