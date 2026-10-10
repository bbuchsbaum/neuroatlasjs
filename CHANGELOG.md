# Changelog

## 0.2.0

### Breaking

- Atlas metadata `space` is renamed to `template`, so it is no longer confused
  with `atlas.space`, the grid object. Passing `space` now throws
  `INVALID_METADATA` instead of being silently dropped. Replace
  `{ space: 'fsaverage6' }` with `{ template: 'fsaverage6' }`.
- `ParcelValues` can no longer be constructed directly with a `RegionIndex`
  from another copy of the package, a subclass, or a branded lookalike; such
  inputs throw `INVALID_DATA`. Bind values through an atlas's `values()`.

### Added

- `VolumeAtlas.samples(selector, volume)` and
  `SurfaceAtlas.samples(selector, { left, right })` return one region's values
  as float64, after the same grid checks as `reduce`.
- `values(entries, { missing })` fills regions the entries do not mention.
- `VolumeAtlas.withAffineTolerance(tolerance)` derives a copy with another
  grid tolerance.
- Region-table sharing: an atlas built with another atlas's `regions` shares
  that table, and `ParcelValues` work with both. `withAffineTolerance()` and a
  `subset()` that keeps every region share their source's table.
- `isAtlasError(error, code?)`, a type guard that narrows `error.code`.

## 0.1.0

- Initial release: `VolumeAtlas`, `SurfaceAtlas`, `RegionIndex`,
  `ParcelValues`, parcel reduction and projection, `rebind`, and `AtlasError`.
