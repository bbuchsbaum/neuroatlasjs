---
layout: home
title: neuroatlasjs
titleTemplate: Typed brain atlases for JavaScript

hero:
  name: neuroatlasjs
  text: Typed brain atlases for JavaScript
  tagline: Attach a validated region table to a label volume or a pair of surfaces, summarize data by parcel, and map the results back onto the brain.
  image:
    src: /logo.svg
    alt: neuroatlasjs
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: What is it?
      link: /guide/
    - theme: alt
      text: API Reference
      link: /api/

features:
  - title: Regions you can name safely
    details: IDs are labels, never array positions. Short labels may repeat across hemispheres; an ambiguous lookup throws instead of guessing.
    link: /guide/regions
    linkText: Naming regions
  - title: Parcel summaries
    details: Mean, sum, min or max per parcel, with an explicit policy for NaN and infinity, and lazy frame-by-frame reduction of 4D series.
    link: /guide/reducing
    linkText: Summarizing data
  - title: Results back on the brain
    details: Bind a results table by region ID, then project it to a voxel buffer or a neuroimjs volume on the atlas grid.
    link: /guide/parcel-values
    linkText: Parcel values
  - title: Volumes and surfaces
    details: The same region model on a 3D label volume or on left and right vertex arrays, with hemisphere checks and full-label transfer between the two.
    link: /guide/surfaces
    linkText: Surface atlases
  - title: Grids must agree
    details: Data is summarized only on the atlas grid. Dimensions and every affine entry are compared; nothing is resampled behind your back.
    link: /guide/reducing#data-must-be-on-the-atlas-grid
    linkText: Grid matching
  - title: Zero runtime dependencies
    details: Works in Node, browsers and workers. neuroimjs volumes plug in directly, and so does any object with a space, a length and getData().
    link: /guide/plain-arrays
    linkText: Without neuroimjs
---
