import { same } from './_check.js';
import { atlas, contrast } from './visual-atlas.js';

// #region lookup
// { id: 7, label: 'V1', fullLabel: 'L_V1', … }
const leftV1 = atlas.regionAtVoxel([1, 0, 0]);

// R_V1: the nearest voxel centre is (3, 1, 0)
const nearest = atlas.regionAtWorld([2.6, -90.2, 0.4]);

// undefined: voxel (0, 0, 0) is background
const background = atlas.regionAtWorld([-3, -92, 0]);

// undefined: outside the grid
const outside = atlas.regionAtWorld([40, -92, 0]);
// #endregion lookup
same([leftV1?.id, leftV1?.label, leftV1?.fullLabel], [7, 'V1', 'L_V1']);
same(nearest?.fullLabel, 'R_V1');
same(atlas.regionAtVoxel([3, 1, 0])?.fullLabel, 'R_V1');
same([background, outside], [undefined, undefined]);

// #region reduce
const means = atlas.reduce(contrast);

means.get(7);                     // 3, the mean of 2, 4 and 3
means.get({ fullLabel: 'R_V1' }); // 2

// Float64Array [3, 2, 1, NaN], in declared region order
means.toArray();
// #endregion reduce
same(means.get(7), 3);
same(means.get({ fullLabel: 'R_V1' }), 2);
same(means.toArray(), [3, 2, 1, NaN]);

// #region project
import { Float64NeuroVol } from 'neuroimjs';

const overlay = atlas.mapValues(means, Float64NeuroVol);

overlay.space === atlas.space; // true
overlay.getData();
// Float64Array [NaN, 3, 2, NaN,
//               3,   3, 2, 2,
//               NaN, 1, 1, NaN]
// #endregion project
same(overlay.space === atlas.space, true);
same(overlay.getData(), [NaN, 3, 2, NaN, 3, 3, 2, 2, NaN, 1, 1, NaN]);
