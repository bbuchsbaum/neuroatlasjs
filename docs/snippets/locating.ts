import { same } from './_check.js';
import { errorCode } from './error-code.js';
import { atlas, contrast } from './visual-atlas.js';

// #region roi
const roi = atlas.roi({ fullLabel: 'L_V1' });

roi.region.id;              // 7
roi.indices;                // Uint32Array [1, 4, 5], flat indices
roi.space === atlas.space;  // true

// Uint32Array []: declared, but absent from the image
atlas.roi(120).indices;
// #endregion roi
same(roi.region.id, 7);
same(roi.indices, [1, 4, 5]);
same(roi.space === atlas.space, true);
same(atlas.roi(120).indices, []);

// #region samples
// L_V1's samples from the contrast map, in voxel order:
// Float64Array [2, 4, 3]
atlas.samples({ fullLabel: 'L_V1' }, contrast);
// #endregion samples
const samples = atlas.samples({ fullLabel: 'L_V1' }, contrast);
same(samples, [2, 4, 3]);
same(samples instanceof Float64Array, true);

// #region indices
atlas.size;         // 12 voxels
atlas.labelAt(4);   // 7: flat index 4 is voxel (0, 1, 0)
atlas.regionAt(0);  // undefined: background

// 42: voxel (3, 1, 0) is flat index 3 + 4 × 1 = 7
atlas.regionAtVoxel([3, 1, 0])?.id;

// A copy: Int32Array [0, 7, 42, 0, 7, 7, 42, 42, 0, 99, 99, 0]
atlas.labels();
// #endregion indices
same(atlas.size, 12);
same(atlas.labelAt(4), 7);
same(atlas.regionAt(0), undefined);
same(atlas.regionAtVoxel([3, 1, 0])?.id, 42);
same(atlas.labels(), [0, 7, 42, 0, 7, 7, 42, 42, 0, 99, 99, 0]);

// #region bounds
// 'OUT_OF_BOUNDS': x runs from 0 to 3
errorCode(() => atlas.regionAtVoxel([4, 0, 0]));

// 'OUT_OF_BOUNDS': indices are integers
errorCode(() => atlas.labelAt(1.5));

// undefined: a world point outside the grid does not throw
atlas.regionAtWorld([100, 0, 0]);
// #endregion bounds
same(errorCode(() => atlas.regionAtVoxel([4, 0, 0])), 'OUT_OF_BOUNDS');
same(errorCode(() => atlas.labelAt(1.5)), 'OUT_OF_BOUNDS');
same(atlas.regionAtWorld([100, 0, 0]), undefined);

// #region edges
// Voxel (1, 0, 0) is centred at x = -1 mm and covers -2 ≤ x < 0.
// 7: the lower edge belongs to the voxel
atlas.regionAtWorld([-2, -92, 0])?.id;
atlas.regionAtWorld([-0.01, -92, 0])?.id;  // 7

// 42: the upper edge belongs to the next voxel, (2, 0, 0)
atlas.regionAtWorld([0, -92, 0])?.id;
// #endregion edges
same(atlas.regionAtWorld([-2, -92, 0])?.id, 7);
same(atlas.regionAtWorld([-0.01, -92, 0])?.id, 7);
same(atlas.regionAtWorld([0, -92, 0])?.id, 42);
