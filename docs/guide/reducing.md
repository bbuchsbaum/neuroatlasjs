# Summarizing Data by Parcel

`reduce` collapses a map to one value per region. `reduceSeries` does the same
for every frame of a 4D series. This page covers the choice of statistic,
missing data, time series, and the grid check that guards all of them. The
examples continue with `atlas` and `contrast` from
[Getting Started](./getting-started).

## Choosing a statistic

<<< @/snippets/reducing.ts#statistics

Results follow the declared region order. Region 120 (L_MT) has no voxels. An
empty region yields `NaN` for mean, min and max, and `0` for sum.

Background voxels (label 0) are never included. Every voxel counts equally:
the summaries are not weighted by physical volume. Sums use ordinary float64
arithmetic.

## Missing and non-finite samples

By default, a `NaN` or infinite sample inside a parcel is an error, because a
silent `NaN` in a summary is easy to miss. Choose a policy explicitly:

<<< @/snippets/reducing.ts#nonfinite

::: details The <code>errorCode</code> helper used in these examples
<<< @/snippets/error-code.ts#helper
:::

| `nonFinite` | Behavior |
| --- | --- |
| `'error'` (default) | Throws `INVALID_DATA` at the first non-finite sample in a parcel. |
| `'omit'` | Skips non-finite samples. A parcel left with no samples behaves as empty. |
| `'propagate'` | Uses IEEE arithmetic: `NaN` spreads, and infinities saturate min and max. |

Non-finite values in background voxels are ignored under every policy.

## Time series

`reduceSeries` returns a lazy iterator with one `ParcelValues` per frame, in
time order. It asks the series for one frame at a time with `getVolume`:

<<< @/snippets/reducing.ts#series

The series, its 4D grid and the options are checked as soon as you call
`reduceSeries`. Each frame's own grid is checked as it is read. neuroatlasjs
holds one frame's samples at a time plus a few numbers per region. Total memory
depends on your series (the example above holds every frame already), and on
whether you keep each frame's result, as `[...]` does.

## Data must be on the atlas grid

`reduce` never resamples. The input volume must have the atlas's dimensions
**and** the same affine, entry by entry. Equal dimensions alone are not enough:
two images with the same shape but different origins describe different
anatomy.

Tools that write affines in single precision can introduce tiny differences
between grids that are meant to be identical. To accept those, opt in with
`affineTolerance` when you build the atlas:

<<< @/snippets/reducing.ts#grid

`affineTolerance` is the largest absolute difference allowed in any affine
entry: millimetres for translations, and mm per voxel for the linear part. The
bottom row must always be exactly `[0, 0, 0, 1]`. The tolerance defaults to 0,
meaning exact, and dimensions must always match exactly. Subsets inherit the
tolerance. Keep it small. A tolerance large enough to hide
a real shift would silently mix regions.

If your data really is on a different grid, resample it to the atlas grid first,
for example with neuroimjs.

## Next

- [Parcel Values & Projection](./parcel-values): work with the `ParcelValues`
  these methods return.
