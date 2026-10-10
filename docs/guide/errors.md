# Errors

Every invalid input or mismatch that neuroatlasjs detects throws an
`AtlasError` with a stable `code` and a message naming the offending value.
Branch on `code`; messages may be reworded. Errors thrown by your own code pass
through unchanged, for example from a `subset` predicate or from the
constructor you pass to `toVolume`.

`isAtlasError(error, code?)` tests for an `AtlasError`, optionally with a
specific code, and narrows the type of `error.code`. This example uses `atlas`
from [Getting Started](./getting-started).

<<< @/snippets/errors.ts#catch

Other guide pages use a small helper that returns the code instead:

<<< @/snippets/error-code.ts#helper

## Error codes

| Code | Usual cause | Fix |
| --- | --- | --- |
| `INVALID_METADATA` | A region has a bad ID (zero, negative, fractional, above 2³¹ − 1) or a duplicate ID; a label is empty; a color, hemisphere or attribute is invalid; or atlas options are malformed, such as a negative `affineTolerance` or the pre-0.2 `space` metadata key (now `template`). | Correct the region table or options. |
| `INVALID_LABEL` | The image contains a label with no region entry, a fractional or negative label, or a hemisphere-specific region on the wrong surface. | Add the missing regions to the table, or check that you loaded the right label file. |
| `INVALID_SELECTOR` | A selector is malformed: a bare string, an object with unknown keys, both `label` and `fullLabel`, or an ID that cannot be valid. | Use `42`, `{ label, hemisphere? }` or `{ fullLabel }` ([selectors](./regions#selecting-one-region)). |
| `UNKNOWN_REGION` | A well-formed selector matched nothing, or a values entry used an undeclared ID. | Check spelling and case; `label` never matches full labels. |
| `AMBIGUOUS_REGION` | A selector matched several regions, typically a short label shared across hemispheres. | Add `hemisphere`, or use `fullLabel` or the ID. |
| `OUT_OF_BOUNDS` | A voxel or vertex index is outside the grid, or is not an integer. | Check the index and the hemisphere. |
| `GRID_MISMATCH` | Input data is on a different grid: other dimensions, or an affine that differs. When building an atlas: a grid that is not 3D, a non-finite or non-invertible affine, a bottom row other than `[0, 0, 0, 1]`, or label data whose length differs from the grid. Also thrown when the atlas's space changed after construction. | Resample the data to the atlas grid, or set a small `affineTolerance` for rounding-level differences ([grid matching](./reducing#data-must-be-on-the-atlas-grid)). |
| `INVALID_DATA` | A non-finite sample under the default `nonFinite: 'error'`; wrong sample count; invalid reduction or rebind options; a non-numeric value; or an argument of the wrong kind. | Choose a `nonFinite` policy, or pass data of the atlas's size. |
| `PARCEL_MISMATCH` | Values are missing or duplicated for some region, were bound to a different region table, or `rebind` could not match a region. | Bind a complete table or pass `{ missing }`, share a region table, or move values with `rebind` ([values](./parcel-values#moving-values-between-atlases)). |

## ESM and CommonJS together

The package contains an ES module build and a CommonJS build. If one program
loads both, for example an ES module app with a CommonJS dependency that also
uses neuroatlasjs, `instanceof` still works across the two copies. An error
thrown by one copy is an `AtlasError` to the other, and `isAtlasError` accepts
it too.
