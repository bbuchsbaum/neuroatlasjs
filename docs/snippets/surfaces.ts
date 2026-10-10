import { same } from './_check.js';
import { errorCode } from './error-code.js';
import { atlas, contrast } from './visual-atlas.js';

// #region build
import { SurfaceAtlas } from 'neuroatlasjs';

const surface = new SurfaceAtlas({
  name: 'Toy visual surface atlas',
  template: 'fsaverage-toy',
  regions: [
    { id: 1, label: 'V1', fullLabel: 'L_V1', hemisphere: 'left' },
    { id: 2, label: 'V1', fullLabel: 'R_V1', hemisphere: 'right' },
    { id: 3, label: 'MT', fullLabel: 'L_MT', hemisphere: 'left' },
  ],
  // One label per vertex, in each hemisphere's vertex order.
  // 0 is background, here the medial wall.
  left: new Int32Array([1, 1, 3, 0, 3]),
  right: new Int32Array([2, 2, 0]),
});

surface.vertexCount('left');              // 5
surface.regionAt('left', 2)?.fullLabel;   // 'L_MT'
surface.roi({ fullLabel: 'L_MT' }).left;  // Uint32Array [2, 4]
surface.roi({ fullLabel: 'L_MT' }).right; // Uint32Array []
// #endregion build
same(surface.vertexCount('left'), 5);
same(surface.regionAt('left', 2)?.fullLabel, 'L_MT');
same(surface.roi({ fullLabel: 'L_MT' }).left, [2, 4]);
same(surface.roi({ fullLabel: 'L_MT' }).right, []);

// #region reduce
const thickness = surface.reduce({
  left: [2.5, 2.7, 3.0, 0, 3.2],
  right: [2.4, 2.6, 0],
});
// Vertex-weighted means: Float64Array [2.6, 2.5, 3.1]
thickness.toArray();
surface.project(thickness).right;  // Float64Array [2.5, 2.5, NaN]

// One region's vertex values, per hemisphere
const mt = surface.samples({ fullLabel: 'L_MT' }, {
  left: [2.5, 2.7, 3.0, 0, 3.2],
  right: [2.4, 2.6, 0],
});
mt.left;   // Float64Array [3, 3.2]
// #endregion reduce
same(mt.left, [3, 3.2]);
same(mt.right, []);
same(thickness.toArray(), [2.6, 2.5, 3.1]);
same(surface.project(thickness).right, [2.5, 2.5, NaN]);

// #region hemispheres
errorCode(() => new SurfaceAtlas({
  name: 'Swapped',
  regions: [{ id: 1, label: 'V1', hemisphere: 'left' }],
  left: [],
  right: [1],
})); // 'INVALID_LABEL': a left region on the right surface
// #endregion hemispheres
same(errorCode(() => new SurfaceAtlas({
  name: 'Swapped', regions: [{ id: 1, label: 'V1', hemisphere: 'left' }], left: [], right: [1],
})), 'INVALID_LABEL');

// #region rebind
// Keyed by the volume atlas IDs 7, 42, 99 and 120
const volumeMeans = atlas.reduce(contrast);

// 'PARCEL_MISMATCH': the surface IDs are 1, 2 and 3
errorCode(() => surface.rebind(volumeMeans));

const onSurface = surface.rebind(volumeMeans, { by: 'fullLabel' });

// L_V1, R_V1, L_MT: Float64Array [3, 2, NaN]
onSurface.toArray();

// Float64Array [3, 3, NaN, NaN, NaN]
surface.project(onSurface).left;
// #endregion rebind
same(errorCode(() => surface.rebind(volumeMeans)), 'PARCEL_MISMATCH');
same(onSurface.toArray(), [3, 2, NaN]);
same(surface.project(onSurface).left, [3, 3, NaN, NaN, NaN]);
