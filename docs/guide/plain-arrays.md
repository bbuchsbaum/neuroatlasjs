# Without neuroimjs

neuroatlasjs does not depend on neuroimjs. It defines two small interfaces, and
anything that satisfies them works, including neuroimjs objects:

- a **space**: `dim` (three grid dimensions, or four for a series) and `trans`,
  a 4 × 4 affine with `rows`, `columns` and `get(row, column)`;
- a **volume**: `space`, `length` and `getData()`, which returns any array-like
  of numbers in x-fastest order.

## A volume atlas from typed arrays

This page builds a cut-down version of the [Getting Started](./getting-started)
atlas, with three regions and no colors, from plain arrays, as you might after
decoding labels with your own NIfTI reader:

<<< @/snippets/plain-arrays.ts#space

<<< @/snippets/plain-arrays.ts#atlas

The affine's bottom row must be `[0, 0, 0, 1]`, and the affine must be
invertible. World lookups use the affine snapshot taken at construction.

A summary with `reduce` takes a volume, not a bare array, so that its grid can be
checked against the atlas. A one-line wrapper like `volume()` above is enough.
Data you wrap this way is trusted to be on the atlas grid: the wrapper reuses the
atlas's own space.

A series is any object with a 4D `space` and `getVolume(frame)`. Each frame
that `getVolume` returns is an ordinary volume, so its own `space` must be 3D
and match the atlas grid. Reusing the series' 4D space for a frame throws
`GRID_MISMATCH`.

## Surfaces

`SurfaceAtlas` takes plain arrays directly: `left` and `right` label arrays, and
`{ left, right }` data arrays for `reduce`. It needs no space objects.

## In the browser

The package has no Node-specific code. Bundle it as usual. If you use neuroimjs
in a browser, import its constructors from `neuroimjs/browser`. The
`neuroatlasjs` import is the same everywhere.

## Next

- [Copies & Guarantees](./guarantees)
