// #region space
import { VolumeAtlas } from 'neuroatlasjs';
import type { VolumeLike, VolumeSpace } from 'neuroatlasjs';

const affine = [
  [2, 0, 0, -3],
  [0, 2, 0, -92],
  [0, 0, 2, 0],
  [0, 0, 0, 1],
];

const space: VolumeSpace = {
  dim: [4, 3, 1],
  trans: {
    rows: 4,
    columns: 4,
    get: (row, column) => affine[row]![column]!,
  },
};

// Any object with space, length and getData() is a volume.
function volume(data: ArrayLike<number>): VolumeLike {
  return { space, length: data.length, getData: () => data };
}
// #endregion space

import { same } from './_check.js';

// #region atlas
const atlas = new VolumeAtlas({
  name: 'Toy visual atlas',
  volume: volume(new Int32Array([
    0, 7, 42, 0,
    7, 7, 42, 42,
    0, 99, 99, 0,
  ])),
  regions: [
    { id: 7, label: 'V1', fullLabel: 'L_V1', hemisphere: 'left' },
    { id: 42, label: 'V1', fullLabel: 'R_V1', hemisphere: 'right' },
    { id: 99, label: 'vermis', fullLabel: 'Vermis' },
  ],
});

const means = atlas.reduce(volume([
  0.0, 2.0, 1.0, 0.0,
  4.0, 3.0, 2.0, 3.0,
  0.5, 1.5, 0.5, -0.5,
]));
means.toArray();  // Float64Array [3, 2, 1]

// Float64Array [0, 3, 2, 0, 3, 3, 2, 2, 0, 1, 1, 0]
atlas.project(means, 0);

// 'L_V1', computed from your affine
atlas.regionAtWorld([-1, -92, 0])?.fullLabel;
// #endregion atlas
same(means.toArray(), [3, 2, 1]);
same(atlas.project(means, 0), [0, 3, 2, 0, 3, 3, 2, 2, 0, 1, 1, 0]);
same(atlas.regionAtWorld([-1, -92, 0])?.fullLabel, 'L_V1');
