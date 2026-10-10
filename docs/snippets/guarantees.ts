import { same } from './_check.js';
import { atlas, contrast } from './visual-atlas.js';

// #region copies
const labels = atlas.labels();
labels.fill(0);
atlas.labelAt(1);  // 7: labels() returned an independent copy

atlas.roi(7).indices.fill(0);
atlas.roi(7).indices;  // Uint32Array [1, 4, 5]: new on every call

const means = atlas.reduce(contrast);
means.toArray().fill(0);
means.get(7);  // 3: ParcelValues cannot change after binding

Object.isFrozen(atlas);                // true
Object.isFrozen(atlas.regions.items);  // true
// #endregion copies
same(atlas.labelAt(1), 7);
same(atlas.roi(7).indices, [1, 4, 5]);
same(means.get(7), 3);
same([Object.isFrozen(atlas), Object.isFrozen(atlas.regions.items)], [true, true]);
