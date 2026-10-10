// #region setup
import { VolumeAtlas } from 'neuroatlasjs';
import {
  Float64NeuroVol, Int32NeuroVol, NeuroSpace,
} from 'neuroimjs';

// A 4 × 3 × 1 grid of 2 mm voxels.
// Voxel (0, 0, 0) is centred at x = -3, y = -92, z = 0 mm.
const space = new NeuroSpace([4, 3, 1], [2, 2, 2], [-3, -92, 0]);

// Labels are stored x-fastest: each line is one row along x.
const labels = new Int32NeuroVol(space, new Int32Array([
  0, 7, 42, 0,
  7, 7, 42, 42,
  0, 99, 99, 0,
]));

export const atlas = new VolumeAtlas({
  name: 'Toy visual atlas',
  space: 'MNI152NLin2009cAsym',  // a name, kept in atlas.metadata
  volume: labels,
  regions: [
    {
      id: 7, label: 'V1', fullLabel: 'L_V1',
      hemisphere: 'left', network: 'Visual', color: [120, 18, 134],
    },
    {
      id: 42, label: 'V1', fullLabel: 'R_V1',
      hemisphere: 'right', network: 'Visual', color: [120, 18, 134],
    },
    {
      id: 99, label: 'vermis', fullLabel: 'Vermis',
      hemisphere: 'midline',
    },
    {
      id: 120, label: 'MT', fullLabel: 'L_MT',
      hemisphere: 'left', network: 'Visual',
    },
  ],
});

// A statistical map on the same grid, e.g. a task contrast.
export const contrast = new Float64NeuroVol(space, Float64Array.of(
  0.0, 2.0, 1.0, 0.0,
  4.0, 3.0, 2.0, 3.0,
  0.5, 1.5, 0.5, -0.5,
));
// #endregion setup
