# neuroatlasjs

A small TypeScript core for categorical brain atlases. Attach validated region
metadata to a volume or a pair of surface label arrays, query parcels, select
regions, summarize measurements, and project parcel values back to samples.

**Zero runtime dependencies.** The same API works in Node, browser bundles, and
workers. neuroimjs volumes and spaces work directly; no conversion wrapper or
second copy of neuroimjs is required.

This initial package is developed locally; it has not been published to npm.

## A volume atlas

```ts
import { VolumeAtlas } from 'neuroatlasjs';
import { NeuroSpace, Int32NeuroVol, Float64NeuroVol } from 'neuroimjs';

const space = new NeuroSpace([3, 2, 1]);
const labels = new Int32NeuroVol(space, new Int32Array([
  0, 7, 42,
  7, 42, 7,
]));

const atlas = new VolumeAtlas({
  name: 'Example atlas',
  volume: labels,
  regions: [
    { id: 7, label: 'visual', fullLabel: 'L_visual', hemisphere: 'left' },
    { id: 42, label: 'visual', fullLabel: 'R_visual', hemisphere: 'right' },
  ],
});

atlas.regionAtVoxel([1, 0, 0]); // region 7
atlas.regionAtWorld([2, 0, 0]); // region 42, using the NeuroSpace affine
atlas.roi({ label: 'visual', hemisphere: 'left' }).indices; // Uint32Array [1, 3, 5]

const signal = new Float64NeuroVol(space, new Float64Array([0, 2, 10, 4, 20, 6]));
const means = atlas.reduce(signal);
means.get(7);                  // 4
means.get(42);                 // 15
means.toArray();               // Float64Array [4, 15], in declared region order

const overlay = atlas.mapValues(means, Float64NeuroVol);
// A real neuroimjs volume: [NaN, 4, 15, 4, 15, 4], on the original space.

const left = atlas.subset(region => region.hemisphere === 'left');
const leftLabels = left.toVolume(Int32NeuroVol); // [0, 7, 0, 7, 0, 7]
```

In browser code, import the neuroimjs constructors from `neuroimjs/browser`.
The `neuroatlasjs` import stays the same. Supplying output constructors keeps
neuroimjs's Node I/O and display dependencies out of this library's import graph.

## Region identity and values

Region IDs are positive int32 values; **0 is background**. IDs need not be
contiguous and never stand for positions in an array. Input floating-point labels
must be exact integers; fractions, negative labels, unknown IDs, and overflow
are rejected before conversion. Every nonzero sample must have metadata.
Metadata may include regions absent from the current image or mesh.

`Region` supports `id`, `label`, `fullLabel`, `hemisphere`, `network`, RGB `color`
(integer channels 0–255), and scalar `attributes`. Other fields are dropped; put
extra data in `attributes`. Region order is the order you supply.

A selector is an ID, `{ label, hemisphere? }`, or `{ fullLabel }`. `label` matches
short labels only and `fullLabel` matches full labels only, exactly and
case-sensitively. Repeated short labels are allowed, but a lookup with several
matches throws `AMBIGUOUS_REGION`. Anything else, such as a bare string, throws
`INVALID_SELECTOR`.

Bind external results explicitly by ID; row order does not matter:

```ts
const values = atlas.values([
  { id: 42, value: 0.8 },
  { id: 7, value: 0.2 },
]);
const data = atlas.project(values, 0); // Float64Array with zero background
```

Missing, duplicate, and unknown IDs are errors. `ParcelValues` belongs to the
specific atlas region table that created it: passing values from another atlas
to `project` or `mapValues` fails, even when the numeric IDs agree, and even for
a subset. Transfer them explicitly with `rebind`:

```ts
const left = atlas.subset(region => region.hemisphere === 'left');
left.project(left.rebind(means));                  // by ID; short labels must agree
bilateral.rebind(means, { by: 'fullLabel' });      // by unique full label, e.g. on a
                                                   // surface atlas with L_visual/R_visual
```

Every target region must find exactly one source value; extra source regions are
ignored. Matching by ID also requires equal short labels, and equal full labels
and hemispheres where both atlases define them. The optional `idConvention`
metadata records a convention; it does not perform a crosswalk.

Atlas metadata, labels, region metadata, and bound values are defensively copied. Returned
typed arrays are independent, mutable copies. Spaces retain their original type
and identity and must be immutable, as neuroimjs `NeuroSpace` is.

## Reduction and time series

`reduce(volume, options)` supports `mean` (default), `sum`, `min`, and `max`.
Volume dimensions **and every spatial affine entry** must agree. Equal
dimensions alone are insufficient. There is no implicit resampling or transform.

By default affines must match exactly. Headers stored in float32 often differ by
about 1e-6 between tools; to accept that, opt in when constructing the atlas with
`affineTolerance`, the largest absolute difference allowed in any affine entry
(for example `1e-4`, in millimetres for translations). Subsets inherit it.

```ts
const sums = atlas.reduce(signal, { statistic: 'sum', nonFinite: 'omit' });

// A neuroimjs NeuroVec or any compatible getVolume(frame) source:
for (const frameMeans of atlas.reduceSeries(bold)) {
  consume(frameMeans);
}
```

The default `nonFinite: 'error'` rejects NaN and infinity inside parcels.
`'omit'` excludes both; `'propagate'` uses ordinary IEEE arithmetic. Background
samples are ignored. Empty parcels yield NaN for mean/min/max and zero for sum.
Reductions use ordinary float64 arithmetic; extreme finite sums can overflow.
They are unweighted voxel or vertex summaries, with no implicit physical-volume
or surface-area weighting.

Series reduction is lazy and returns one `ParcelValues` per frame, in time order.
The series, its 4D grid, and the options are checked when `reduceSeries` is
called; each extracted frame is checked as it is read.
The atlas owns a dense int32 label snapshot; reduction uses memory proportional
to region count plus whatever one input volume's `getData()` materializes.

## Surface atlases

```ts
import { SurfaceAtlas } from 'neuroatlasjs';

const surface = new SurfaceAtlas({
  name: 'Surface example',
  space: 'fsaverage6',
  regions: [
    { id: 7, label: 'visual', hemisphere: 'left' },
    { id: 42, label: 'visual', hemisphere: 'right' },
  ],
  left: new Int32Array([0, 7, 7]),
  right: new Int32Array([42, 42, 0]),
});

surface.regionAt('right', 1); // region 42
surface.roi(7).left;          // Uint32Array [1, 2]
const means = surface.reduce({ left: [0, 2, 4], right: [10, 20, 0] });
surface.project(means);      // { left: Float64Array, right: Float64Array }
```

Surface inputs are vertex-aligned arrays, with independent left/right indices
and globally unique parcel IDs. A region declared `left` cannot occur on the
right surface, or vice versa. A bilateral, midline, or unspecified region may
span both arrays. Empty hemispheres and empty subsets are supported.

You are responsible for the correspondence of input vertices to the atlas.
Array lengths and declared hemispheres are checked; equal vertex counts or a
shared space name do not establish mesh correspondence. The core does not load,
resample, or infer meshes.

## API boundaries

| Type | Responsibility |
| --- | --- |
| `RegionIndex` | Immutable ordered metadata; lookup by ID, label, or full label |
| `VolumeAtlas<S>` | 3D label snapshot, ROI indices, world/grid queries, reduction, projection |
| `SurfaceAtlas` | Left/right label snapshots, ROI indices, reduction, projection |
| `ParcelValues` | Complete ID-keyed values bound to one region table; move with `rebind` |
| `Atlas` | `kind: 'volume' \| 'surface'` discriminated union |
| `AtlasError` | Stable error `code` plus an explanatory message |

Voxel and vertex indices are zero-based; volumes use neuroimjs's x-fastest
layout. Out-of-range index queries throw. World lookup uses nearest voxel
centers (voxel *i* covers grid coordinates [*i* − 0.5, *i* + 0.5)) and the affine
captured at construction; background and points outside the grid return
`undefined`. Spaces must not change after construction: `subset`, `toVolume`,
and `mapValues` throw `GRID_MISMATCH` if the space no longer matches.

Atlas classes are final: they freeze their instances, so subclasses cannot add
fields. Wrap them instead.

The package ships an ESM build and a bundled CommonJS build. `instanceof` checks
on `AtlasError` and the atlas classes work across the two, so an error thrown by
code that `require`s the package is still an `AtlasError` to code that `import`s
it. Values and atlases from both builds can also be mixed. Branching on
`error.code` remains the most robust check.

The core intentionally excludes atlas catalogs/downloads, NIfTI/GIFTI readers,
caches, probabilistic maps, registration, dilation, mesh geometry, and rendering.
Load labels with neuroimjs or your own I/O, and supply their region table here.

## Development

```sh
npm ci
npm run check
```

Checks cover strict TypeScript and negative type fixtures, hand-computed and
grouped-array reduction oracles, real neuroimjs 0.5.0 dense/clustered/sparse
volumes and time series, a browser-target bundle evaluated without Node/DOM
globals, and a packed-package consumer using ESM, CommonJS, and declarations
under TypeScript `node16` and `nodenext` module resolution.
The browser smoke is a bundle/runtime-isolation check, not a browser-engine test.

To test the adjacent neuroimjs build as well:

```sh
NEUROIMJS_ENTRY=../neuroimjs/dist/esm/index.js node --test test/neuroimjs.test.mjs
```

The design is distilled from R `neuroatlas` region metadata, subsetting and parcel
binding, and Scala `scalafim/modules/atlas` typed volume/surface models. It retains
those core distinctions without porting their catalogs or platform services.

## License

MIT. See [LICENSE](LICENSE).
