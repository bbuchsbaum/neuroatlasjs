# Getting Started

This page builds a tiny atlas, asks it which region lies at a point, summarizes a
statistical map within each region, and paints the summary back onto the brain.
The rest of the guide reuses the same atlas, so the numbers stay familiar.

You need neuroatlasjs ([install](./#install)) and, for this page,
[neuroimjs](https://bbuchsbaum.github.io/neuroimjs/), which supplies the volume
and space types:

```sh
npm install neuroimjs
```

## Build an atlas

An atlas needs a label volume and a region table. Here the volume is a 4 × 3 × 1
grid of 2 mm voxels with four regions: left and right V1, a midline vermis
region, and left MT. MT appears in the table but in no voxel. Atlases often
declare regions that a particular image does not contain, and neuroatlasjs
allows it.

<<< @/snippets/visual-atlas.ts#setup

The constructor validates everything before it returns. Every nonzero label must
be a declared region ID. Fractional, negative and unknown labels are rejected
with an [`AtlasError`](./errors). Label 0 is always background.

Region IDs are the label values themselves (7, 42, 99, 120). They need not be
contiguous, and they are never positions in an array.

## Ask what is where

<<< @/snippets/getting-started.ts#lookup

`regionAtVoxel` takes grid indices. `regionAtWorld` takes millimetre coordinates
and uses the volume's affine to find the nearest voxel centre. Both return
`undefined` for background, and `regionAtWorld` also returns `undefined` for
points outside the grid.

## Summarize a map by region

`reduce` takes a volume **on the same grid as the atlas** and returns one value
per region:

<<< @/snippets/getting-started.ts#reduce

The result is a `ParcelValues`: one number for every declared region, in the
order the regions were declared. Look values up by ID or by any
[region selector](./regions). L_MT has no voxels, so its mean is `NaN`.

## Paint the summary back onto the brain

<<< @/snippets/getting-started.ts#project

`mapValues` builds a new neuroimjs volume on the atlas's own space. Each voxel
gets its region's value, and background voxels get `NaN`. Pass
`Float64NeuroVol` so values keep double precision. To get a plain
`Float64Array` instead, call `atlas.project(means)`.

## What you have now

You can build an atlas, query it, summarize a map within each parcel, and display
the result. Next:

- [Naming & Finding Regions](./regions): select regions by label and hemisphere
  without ambiguity.
- [Summarizing Data by Parcel](./reducing): other statistics, missing data, and
  4D time series.
- [Parcel Values & Projection](./parcel-values): bring your own results table.
