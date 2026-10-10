# Locating Regions

This page answers two opposite questions: which voxels belong to a region, and
which region contains a given voxel or coordinate. The examples continue with
`atlas` and `contrast` from [Getting Started](./getting-started).

## A region's voxels

`roi` returns the flat indices of every voxel carrying a region's label:

<<< @/snippets/locating.ts#roi

The array is a new copy on every call, and you own it. Use the indices to pull
a region's samples out of any data on the same grid:

<<< @/snippets/locating.ts#samples

::: warning Map indices into a float array
`roi.indices.map(...)` returns another `Uint32Array`, which silently truncates
the samples to unsigned integers. Use `Float64Array.from(roi.indices, …)` or
`Array.from(roi.indices, …)` as above.
:::

## Flat indices and voxel coordinates

neuroatlasjs uses the neuroimjs layout: zero-based and **x-fastest**. The flat
index of voxel `(i, j, k)` in an `nx × ny × nz` grid is
`i + nx × (j + ny × k)`.

<<< @/snippets/locating.ts#indices

`labelAt` returns the raw label, with 0 for background. `regionAt` returns the
`Region`, or `undefined` for background. `labels()` copies the whole label array.

## Points in millimetres

`regionAtWorld` converts a world coordinate to the nearest voxel centre, using
the affine captured when the atlas was built. Voxel `i` covers grid coordinates
from `i − 0.5` up to, but not including, `i + 0.5`. A point exactly on a boundary
belongs to the higher voxel:

<<< @/snippets/locating.ts#edges

This holds exactly when the voxel size is exactly representable in binary, as
for 1, 2 or 3 mm voxels. For sizes such as 1.1 mm, a point on a boundary, to
within floating-point rounding, can fall to either neighbour.

The coordinates are in the atlas's own world space. If your point comes from a
different space (another template, or native space), transform it first.
neuroatlasjs does no registration.

## Out-of-range queries

Grid queries and world queries handle out-of-range input differently, on
purpose:

<<< @/snippets/locating.ts#bounds

::: details The <code>errorCode</code> helper used in these examples
<<< @/snippets/error-code.ts#helper
:::

An out-of-range index is almost always a bug, so it throws. A world point
outside the field of view is ordinary (a click beyond the brain, say), so it
returns `undefined`.

## Next

- [Summarizing Data by Parcel](./reducing): collapse a map to one value per
  region.
