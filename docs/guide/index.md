# What is neuroatlasjs?

A brain atlas is two things: an image whose voxels (or surface vertices) carry
integer labels, and a table saying what each label means. neuroatlasjs keeps the
two together and checks that they agree. Every nonzero label in the image must
have an entry in the table, and the table has no duplicate IDs. The library then
answers the questions an analysis asks of an atlas:

- Which region is at this voxel, vertex or world coordinate?
- Which voxels belong to the left primary visual cortex?
- What is the mean of this statistical map within each parcel, frame by frame?
- How do I paint one value per parcel back onto the brain for display?
- How do I carry parcel results from a volume atlas to a surface atlas, or to a
  subset of regions?

## Is it the right tool?

Use neuroatlasjs when you already have label data and a region table, and you
need correct region bookkeeping in JavaScript or TypeScript: in a browser viewer,
a web worker, or a Node analysis script.

It deliberately does **not**:

- download or catalog atlases (Schaefer, Glasser, AAL, and so on);
- read files: load NIfTI labels with
  [neuroimjs](https://bbuchsbaum.github.io/neuroimjs/), and GIFTI or
  FreeSurfer annotation labels with your own reader;
- resample, register or align data to the atlas grid;
- handle probabilistic (non-categorical) atlases;
- dilate parcels, compute mesh geometry or areas, or render anything.

It is a small core (about 900 lines of TypeScript) with no runtime dependencies. neuroimjs
volumes and spaces work directly, without conversion.

## Install

neuroatlasjs is not yet published to npm. Install it from GitHub, pinned to a
commit; npm builds it during installation:

```sh
npm install github:bbuchsbaum/neuroatlasjs#<commit>
```

It needs Node 22 or later, or any modern browser bundler. The package ships an
ES module build and a CommonJS build, each with TypeScript declarations.

::: tip Status
Version 0.1.0 is pre-release. The API is small and extensively tested, but names may
still change before 1.0.
:::

## How the guide is organized

**[Getting Started](./getting-started)** builds a small atlas and takes it through
lookup, summary and projection. Most later pages continue with that same atlas,
named `atlas`, and its statistical map, `contrast`.
Each of the other pages answers one question:

| Page | Question |
| --- | --- |
| [Naming & Finding Regions](./regions) | How do I refer to a region unambiguously? |
| [Locating Regions](./locating) | Where is a region, and what is at this point? |
| [Summarizing Data by Parcel](./reducing) | How do I get one number per parcel from a map or a time series? |
| [Parcel Values & Projection](./parcel-values) | How do I bind a results table and paint it back onto the brain? |
| [Surface Atlases](./surfaces) | How do I do the same on cortical surfaces? |
| [Without neuroimjs](./plain-arrays) | Can I use plain typed arrays? |
| [Copies & Guarantees](./guarantees) | What is copied, what is shared, and what is checked? |
| [Errors](./errors) | Why did this throw, and how do I fix it? |

The [API reference](/api/) lists every exported class, method and type.
