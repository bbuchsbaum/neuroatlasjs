# Parcel Values & Projection

Parcel results often come from somewhere else: a statistics table, a model fit,
a CSV file. This page shows how to attach such values to an atlas, paint them
onto the brain, and move them between atlases without mixing up IDs. The
examples continue with `atlas` from [Getting Started](./getting-started).

## Binding a results table

`atlas.values(entries)` binds one value per region, keyed by ID. Input order does
not matter. The result is stored in declared region order:

<<< @/snippets/parcel-values.ts#bind

`ParcelValues` is the same type that `reduce` returns. It is frozen, and
`toArray()` returns a copy.

## Every region needs a value

A binding must cover the atlas's region table exactly. This catches an off-by-one
ID column or a table from a different atlas version before anything is drawn:

<<< @/snippets/parcel-values.ts#complete

::: details The <code>errorCode</code> helper used in these examples
<<< @/snippets/error-code.ts#helper
:::

When a table reports only some regions, pass `{ missing }` to say what the
others get, as above. That keeps "no value" a visible decision. Duplicate and
unknown IDs are still errors.

## Painting values onto the brain

<<< @/snippets/parcel-values.ts#project

`project(values, background = NaN)` returns a new `Float64Array` in the atlas's
x-fastest voxel order. `mapValues(values, Constructor, background = NaN)` wraps
the same data in a volume type of your choice, built on `atlas.space`.
TypeScript rejects integer volume constructors here, because they would
truncate the values.

## Working with a subset

`subset` keeps the regions a predicate accepts. It keeps their IDs and order, and
turns every other label into background. A subset that removes no region shares
the original's region table, so existing values still apply:

<<< @/snippets/parcel-values.ts#subset

## Moving values between atlases

Values belong to the region table that created them. Passing them to an atlas
with a different table fails, even when the IDs agree. Two atlases can use the
same number for different regions, and an identity check is the only safe
default.

Atlases can share a table. Build the second atlas with the first atlas's
`regions` (a `RegionIndex`), and values bound to either work with both. For
example, a volume and a surface version of one parcellation that use the same
IDs can share it. Otherwise, transfer values deliberately with `rebind`:

<<< @/snippets/parcel-values.ts#rebind

`rebind(values, { by })` gives every target region exactly one source value:

| `by` | A target region takes the value of… |
| --- | --- |
| `'id'` (default) | The source region with the same ID. The short labels must agree, and so must full labels and hemispheres where both atlases define them. |
| `'fullLabel'` | The single source region with the same full label. |

Source regions the target does not have are ignored. A target region with no
match throws `PARCEL_MISMATCH`. To move values between a volume atlas and a
surface atlas with different IDs, rebind by full label
([Surface Atlases](./surfaces#from-a-volume-atlas-to-a-surface-atlas)).

## Next

- [Surface Atlases](./surfaces): the same operations on cortical surfaces.
- [Copies & Guarantees](./guarantees): what each operation copies, shares and
  checks.
