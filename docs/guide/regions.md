# Naming & Finding Regions

Atlases reuse short names. The left and right primary visual cortex are both
"V1", and a lookup by name alone cannot say which you mean. neuroatlasjs never
picks the first match: a region **selector** either identifies exactly one
region or throws. This page shows how to write selectors that always succeed.

The examples continue with `atlas` from [Getting Started](./getting-started).

## The region table

`atlas.regions` is a `RegionIndex`, an immutable table in the order you declared
it:

<<< @/snippets/regions.ts#table

Each entry is a `Region`:

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | The label value in the image: a positive 32-bit integer. |
| `label` | yes | Short name. May repeat, for example `V1` in both hemispheres. |
| `fullLabel` | no | Unique-by-convention name such as `L_V1`. |
| `hemisphere` | no | `'left'`, `'right'`, `'bilateral'` or `'midline'`. |
| `network` | no | Network or system name, such as `'Visual'`. |
| `color` | no | RGB as three integers from 0 to 255. |
| `attributes` | no | Extra scalar fields: strings, finite numbers or booleans. |

Any other field on an input region is dropped. Put extra data in `attributes`.

## Selecting one region

Anything that accepts a region (`resolve`, `roi`, `ParcelValues.get`) takes a
**selector** in one of three forms:

| Selector | Matches |
| --- | --- |
| `42` | The region with that ID. |
| `{ label: 'V1', hemisphere?: 'left' }` | Short labels only, optionally narrowed by hemisphere. |
| `{ fullLabel: 'L_V1' }` | Full labels only. |

<<< @/snippets/regions.ts#resolve

`find(label, hemisphere?)` returns every match instead of insisting on one.

## When a lookup fails

<<< @/snippets/regions.ts#failures

::: details The <code>errorCode</code> helper used in these examples
It returns the `AtlasError` code that an operation throws:

<<< @/snippets/error-code.ts#helper
:::

Matching is exact and case-sensitive. Punctuation is never normalized, so
`L-V1` and `L_V1` are different names. A bare string is not a selector, because
it would not say whether it is a short or a full label.

## Metadata and grouping

Region metadata is frozen when the atlas is built. To group regions, filter the
table:

<<< @/snippets/regions.ts#metadata

To make a smaller atlas from such a filter, use `subset`
([Parcel Values & Projection](./parcel-values#working-with-a-subset)).

## Next

- [Locating Regions](./locating): find a region's voxels and resolve points.
- [Errors](./errors): every error code and its usual fix.
