# Surface Atlases

Cortical parcellations usually live on surfaces: one label per vertex, with
separate left and right hemispheres. `SurfaceAtlas` uses the same region table,
selectors, `ParcelValues` and errors as the volume atlas. It replaces the voxel
grid with two vertex arrays. The last section uses `atlas` and `contrast` from
[Getting Started](./getting-started).

## Building a surface atlas

<<< @/snippets/surfaces.ts#build

Each hemisphere has its own zero-based vertex indices, so methods that touch
vertices take the hemisphere first. `roi` returns indices for both hemispheres
at once. Region IDs are shared across hemispheres, so `L_V1` and `R_V1` need
different IDs.

The atlas knows nothing about the mesh. It stores labels in vertex order, and
**you** guarantee that your data uses the same vertex order: the same mesh and
resolution. Equal vertex counts and a matching `space` name do not prove that.

## Summaries and projection

`reduce` takes one array per hemisphere and returns one value per region.
`project` returns one array per hemisphere:

<<< @/snippets/surfaces.ts#reduce

Means are vertex-weighted, not area-weighted. The `nonFinite` and `statistic`
options are the same as for volumes
([Summarizing Data by Parcel](./reducing)).

## Hemisphere checks

A region declared `'left'` may only appear on the left surface, and `'right'`
only on the right. Regions marked `'bilateral'` or `'midline'`, or with no
hemisphere, may appear on both.

<<< @/snippets/surfaces.ts#hemispheres

## From a volume atlas to a surface atlas

A volume atlas and a surface atlas of the same parcellation rarely share IDs, but
they often share full labels. `rebind` by full label carries volume results onto
the surface:

<<< @/snippets/surfaces.ts#rebind

::: details The <code>errorCode</code> helper used in these examples
<<< @/snippets/error-code.ts#helper
:::

The vermis has no surface region, so its value is ignored. Matching by full label
requires each target full label to occur exactly once in the source.

## Next

- [Without neuroimjs](./plain-arrays): build atlases from plain arrays.
- [Copies & Guarantees](./guarantees)
