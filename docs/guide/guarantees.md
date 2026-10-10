# Copies & Guarantees

This page states exactly what neuroatlasjs copies, what it shares with you, and
what it checks. Use it when you need to know whether changing an array later can
affect an atlas, or whether a result can be trusted after the inputs change.

## Inputs are copied once

| Input | What the atlas keeps |
| --- | --- |
| Label data (`getData()`, `left`, `right`) | A validated `Int32Array` copy. Changing your array later has no effect. |
| Region table | A frozen copy of each region's declared fields, including frozen `color` and `attributes`. Other fields are dropped. A `RegionIndex` taken from another atlas is immutable, so it is shared instead of copied. A subclass, or a table from another copy of the package, is validated and copied. |
| Atlas metadata (`name`, `template`, `version`, …) | A frozen copy of the declared fields. |
| Values passed to `values()` | Copied into a frozen `ParcelValues`. |
| The space object | **Shared by reference.** neuroatlasjs snapshots the dimensions and affine at construction and uses the snapshot for every computation. |

Spaces must not change after an atlas is built; neuroimjs `NeuroSpace` objects
never do. If the shared space has changed, `subset`, `withAffineTolerance`,
`toVolume` and `mapValues` throw `GRID_MISMATCH` instead of building outputs on
it.

## Outputs are yours

These examples use `atlas` and `contrast` from
[Getting Started](./getting-started).

<<< @/snippets/guarantees.ts#copies

| Operation | Returns |
| --- | --- |
| `labels()`, `roi().indices`, `samples()`, `project()`, `toArray()` | A new typed array on every call. |
| `toVolume()`, `mapValues()` | A new volume built from a new array, sharing `atlas.space`. |
| `subset()`, `withAffineTolerance()`, `rebind()`, `reduce()` | New, frozen objects. The original atlas and values are untouched. `withAffineTolerance()`, and a `subset()` that keeps every region, share the original region table. |
| `regions.items`, `regions.get()`, `resolve()` | The shared frozen `Region` objects. |

## What is checked

| When | Checks |
| --- | --- |
| Building an atlas | Region IDs are positive 32-bit integers and unique. Labels are nonempty strings. Colors, hemispheres and attributes are valid. Every nonzero sample is a declared ID; no fractions, negatives or overflow. The grid is 3D with a finite, invertible affine. Surface hemispheres are consistent. |
| `reduce`, `reduceSeries` | The input grid matches the atlas: equal dimensions, and affine entries within `affineTolerance`. The sample count matches. Options are valid. Non-finite samples follow the chosen policy. |
| `values`, `rebind` | Exactly one value per region (or the `missing` fill), with no unknown or duplicate IDs. Rebinding verifies its matches. |
| `project`, `mapValues` | The values belong to this atlas's region table. |
| `samples` | The same grid and length checks as `reduce`. The selected region's samples must be numeric; other samples are not read. |
| Lookups | Selectors are well-formed and unambiguous. Indices are in bounds. |

Each of these checks throws an [`AtlasError`](./errors) with a stable `code` when it fails.

## Numerical behavior

- Summaries use float64 arithmetic. Very large sums can overflow to infinity.
- Every sample counts equally. There is no weighting by voxel volume or vertex
  area.
- `regionAtWorld` rounds to the nearest voxel centre. A point exactly halfway
  between two centres belongs to the higher voxel, up to floating-point rounding
  of the inverse affine ([details](./locating#points-in-millimetres)).

## Atlas classes are final

Atlas instances are frozen at construction, so a subclass cannot declare public
instance fields: their initializers throw a `TypeError`. Wrap an atlas in your
own object instead.

## Next

- [Errors](./errors)
