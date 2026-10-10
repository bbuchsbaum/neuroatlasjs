import { same } from './_check.js';
import { errorCode } from './error-code.js';
import { atlas, contrast } from './visual-atlas.js';

// #region statistics
import type { Reduction } from 'neuroatlasjs';

const summary = (statistic: Reduction) =>
  atlas.reduce(contrast, { statistic }).toArray();

summary('mean');  // [3, 2, 1, NaN]   (the default statistic)
summary('sum');   // [9, 6, 2, 0]
summary('min');   // [2, 1, 0.5, NaN]
summary('max');   // [4, 3, 1.5, NaN]
// #endregion statistics
same(atlas.reduce(contrast).toArray(), [3, 2, 1, NaN]);
same(atlas.reduce(contrast, { statistic: 'sum' }).toArray(), [9, 6, 2, 0]);
same(atlas.reduce(contrast, { statistic: 'min' }).toArray(), [2, 1, 0.5, NaN]);
same(atlas.reduce(contrast, { statistic: 'max' }).toArray(), [4, 3, 1.5, NaN]);

// #region nonfinite
import { Float64NeuroVol } from 'neuroimjs';

const samples = Float64Array.from(contrast.getData());
samples[4] = NaN;  // a dropout voxel inside L_V1
const withDropout = new Float64NeuroVol(contrast.space, samples);

// 'INVALID_DATA': the default is nonFinite: 'error'
errorCode(() => atlas.reduce(withDropout));

// 2.5, the mean of 2 and 3
atlas.reduce(withDropout, { nonFinite: 'omit' }).get(7);

// NaN
atlas.reduce(withDropout, { nonFinite: 'propagate' }).get(7);
// #endregion nonfinite
same(errorCode(() => atlas.reduce(withDropout)), 'INVALID_DATA');
same(atlas.reduce(withDropout, { nonFinite: 'omit' }).get(7), 2.5);
same(atlas.reduce(withDropout, { nonFinite: 'propagate' }).get(7), NaN);

// #region series
import { Float32NeuroVec, NeuroSpace } from 'neuroimjs';

// Two frames: frame 0 is the contrast, frame 1 doubles it.
const frame = Float32Array.from(contrast.getData());
const bold = new Float32NeuroVec(
  new NeuroSpace([4, 3, 1, 2], [2, 2, 2], [-3, -92, 0]),
  Float32Array.from([...frame, ...frame.map(value => value * 2)]),
);

const timecourse = [...atlas.reduceSeries(bold)]
  .map(frameMeans => frameMeans.get(7));  // [3, 6]
// #endregion series
same(timecourse, [3, 6]);

// #region grid
import { VolumeAtlas } from 'neuroatlasjs';
import { Int32NeuroVol } from 'neuroimjs';

// The same grid, but another tool wrote its y origin
// with a 0.00001 mm numerical error.
const origin = [-3, -91.99999, 0];
const resaved = new Float64NeuroVol(
  new NeuroSpace([4, 3, 1], [2, 2, 2], origin),
  Float64Array.from(contrast.getData()),
);

// 'GRID_MISMATCH': by default, affines must match exactly
errorCode(() => atlas.reduce(resaved));

const tolerant = new VolumeAtlas({
  ...atlas.metadata,
  volume: atlas.toVolume(Int32NeuroVol),
  regions: atlas.regions,
  // Largest absolute difference allowed in any affine entry.
  affineTolerance: 1e-4,
});
tolerant.reduce(resaved).get(7);  // 3
// #endregion grid
same(errorCode(() => atlas.reduce(resaved)), 'GRID_MISMATCH');
same(tolerant.reduce(resaved).get(7), 3);
same(tolerant.metadata, atlas.metadata);
