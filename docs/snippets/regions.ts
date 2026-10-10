import { same } from './_check.js';
import { errorCode } from './error-code.js';
import { atlas } from './visual-atlas.js';

// #region table
atlas.regions.ids;     // [7, 42, 99, 120], in declared order
atlas.regions.size;    // 4
atlas.regions.get(5);  // undefined: get() never throws

// 'L_MT': declared, although no voxel carries label 120
atlas.regions.get(120)?.fullLabel;
// #endregion table
same(atlas.regions.ids, [7, 42, 99, 120]);
same(atlas.regions.size, 4);
same(atlas.regions.get(120)?.fullLabel, 'L_MT');
same(atlas.regions.get(5), undefined);

// #region resolve
const { regions } = atlas;

regions.resolve(42).fullLabel;                           // 'R_V1'
regions.resolve({ label: 'V1', hemisphere: 'left' }).id; // 7
regions.resolve({ fullLabel: 'Vermis' }).id;             // 99
regions.find('V1').map(region => region.id);             // [7, 42]
// #endregion resolve
same(atlas.regions.resolve(42).fullLabel, 'R_V1');
same(atlas.regions.resolve({ label: 'V1', hemisphere: 'left' }).id, 7);
same(atlas.regions.resolve({ fullLabel: 'Vermis' }).id, 99);
same(atlas.regions.find('V1').map(region => region.id), [7, 42]);

// #region failures
// 'AMBIGUOUS_REGION': two regions are labelled V1
errorCode(() => regions.resolve({ label: 'V1' }));

// 'UNKNOWN_REGION': matching is case-sensitive
errorCode(() => regions.resolve({ label: 'v1' }));

// 'UNKNOWN_REGION': label never matches full labels
errorCode(() => regions.resolve({ label: 'L_V1' }));

// 'UNKNOWN_REGION'
errorCode(() => regions.resolve(1000));

// 'INVALID_SELECTOR': write { label: 'V1' }
errorCode(() => regions.resolve('V1' as never));
// #endregion failures
same(errorCode(() => atlas.regions.resolve({ label: 'V1' })), 'AMBIGUOUS_REGION');
same(errorCode(() => atlas.regions.resolve({ label: 'v1' })), 'UNKNOWN_REGION');
same(errorCode(() => atlas.regions.resolve({ label: 'L_V1' })), 'UNKNOWN_REGION');
same(errorCode(() => atlas.regions.resolve(1000)), 'UNKNOWN_REGION');
same(errorCode(() => atlas.regions.resolve('V1' as never)), 'INVALID_SELECTOR');

// #region metadata
const region = regions.resolve({ fullLabel: 'L_V1' });
region.network;           // 'Visual'
region.color;             // [120, 18, 134]
Object.isFrozen(region);  // true, and so is its color

regions.items
  .filter(item => item.hemisphere === 'left')
  .map(item => item.id);  // [7, 120]
// #endregion metadata
same(region.network, 'Visual');
same(region.color, [120, 18, 134]);
same(Object.isFrozen(region) && Object.isFrozen(region.color), true);
same(atlas.regions.items.filter(item => item.hemisphere === 'left').map(item => item.id), [7, 120]);
