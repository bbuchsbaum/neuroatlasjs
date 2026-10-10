import { same } from './_check.js';
import { errorCode } from './error-code.js';
import { atlas } from './visual-atlas.js';

// #region bind
// Effect sizes from a statistics table, keyed by ID, in any order.
const effects = atlas.values([
  { id: 120, value: 0.1 },
  { id: 7, value: 0.8 },
  { id: 99, value: -0.2 },
  { id: 42, value: 0.5 },
]);

// Float64Array [0.8, 0.5, -0.2, 0.1], in declared region order
effects.toArray();
effects.get({ fullLabel: 'L_MT' });  // 0.1
[...effects][0];                     // { id: 7, value: 0.8 }
// #endregion bind
same(effects.toArray(), [0.8, 0.5, -0.2, 0.1]);
same(effects.get({ fullLabel: 'L_MT' }), 0.1);
same([...effects][0], { id: 7, value: 0.8 });

// #region complete
// 'PARCEL_MISMATCH': 42, 99 and 120 are missing
errorCode(() => atlas.values([{ id: 7, value: 0.8 }]));

// 'PARCEL_MISMATCH': duplicate ID
const twice = [{ id: 7, value: 1 }, { id: 7, value: 2 }];
errorCode(() => atlas.values(twice));

// 'UNKNOWN_REGION'
errorCode(() => atlas.values([{ id: 8, value: 1 }]));

// A partial table must say what the other regions get, here NaN.
const reported = new Map([[7, 0.8], [42, 0.5]]);
const partial = atlas.values(atlas.regions.ids.map(id => ({
  id,
  value: reported.get(id) ?? NaN,
})));
partial.toArray();  // Float64Array [0.8, 0.5, NaN, NaN]
// #endregion complete
same(errorCode(() => atlas.values([{ id: 7, value: 0.8 }])), 'PARCEL_MISMATCH');
try { atlas.values([{ id: 7, value: 0.8 }]); } catch (error) {
  same((error as Error).message.includes('42, 99, 120'), true);
}
same(errorCode(() => atlas.values([{ id: 7, value: 1 }, { id: 7, value: 2 }])), 'PARCEL_MISMATCH');
same(errorCode(() => atlas.values([{ id: 8, value: 1 }])), 'UNKNOWN_REGION');
same(partial.toArray(), [0.8, 0.5, NaN, NaN]);

// #region project
import { Float64NeuroVol } from 'neuroimjs';

atlas.project(effects, 0);
// Float64Array [0,   0.8,  0.5, 0,
//               0.8, 0.8,  0.5, 0.5,
//               0,  -0.2, -0.2, 0]

// A NeuroVol on atlas.space, with NaN background
const effectMap = atlas.mapValues(effects, Float64NeuroVol);
effectMap.getData()[0];  // NaN
// #endregion project
same(atlas.project(effects, 0), [0, 0.8, 0.5, 0, 0.8, 0.8, 0.5, 0.5, 0, -0.2, -0.2, 0]);
same(effectMap.getData()[0], NaN);
same(effectMap.space === atlas.space, true);

// #region subset
const visual = atlas.subset(region => region.network === 'Visual');

visual.regions.ids;  // [7, 42, 120]

// The vermis is now background:
// Int32Array [0, 7, 42, 0, 7, 7, 42, 42, 0, 0, 0, 0]
visual.labels();

atlas.labels()[9];   // 99: the original atlas is unchanged
// #endregion subset
same(visual.regions.ids, [7, 42, 120]);
same(visual.labels(), [0, 7, 42, 0, 7, 7, 42, 42, 0, 0, 0, 0]);
same(atlas.labels()[9], 99);

// #region rebind
// 'PARCEL_MISMATCH': effects are bound to `atlas`
errorCode(() => visual.project(effects));

// Matched by ID; the labels must agree.
const visualEffects = visual.rebind(effects);

// Float64Array [0.8, 0.5, 0.1]: the vermis value is dropped
visualEffects.toArray();
visual.project(visualEffects, 0);
// Float64Array [0,   0.8, 0.5, 0,
//               0.8, 0.8, 0.5, 0.5,
//               0,   0,   0,   0]
// #endregion rebind
same(errorCode(() => visual.project(effects)), 'PARCEL_MISMATCH');
same(visualEffects.toArray(), [0.8, 0.5, 0.1]);
same(visual.project(visualEffects, 0), [0, 0.8, 0.5, 0, 0.8, 0.8, 0.5, 0.5, 0, 0, 0, 0]);
