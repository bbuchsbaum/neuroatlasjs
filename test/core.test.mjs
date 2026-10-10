import assert from 'node:assert/strict';
import test from 'node:test';
import { AtlasError, RegionIndex, SurfaceAtlas, VolumeAtlas } from '../dist/index.js';

const regions = [
  { id: 42, label: 'visual', fullLabel: 'R_visual', hemisphere: 'right', color: [1, 2, 3] },
  { id: 7, label: 'visual', fullLabel: 'L_visual', hemisphere: 'left', attributes: { network: 'visual' } },
  { id: 99, label: 'empty' },
];
const labels = new Int32Array([0, 7, 42, 7, 42, 7]);
function space(dim = [3, 2, 1], offset = 0) {
  return {
    dim,
    trans: { rows: 4, columns: 4, get: (i, j) => i === 0 && j === 3 ? offset : Number(i === j) },
    coordToGrid: ([x, y, z]) => [x - offset, y, z],
  };
}
function volume(data, grid = space()) { return { space: grid, length: data.length, getData: () => data }; }
function atlas() { return new VolumeAtlas({ name: 'toy', regions, volume: volume(labels) }); }
function code(expected) { return error => error instanceof AtlasError && error.code === expected; }

test('ordered metadata, noncontiguous IDs and unambiguous lookup', () => {
  const a = atlas();
  assert.deepEqual(a.regions.ids, [42, 7, 99]);
  assert.equal(a.regions.resolve({ label: 'visual', hemisphere: 'left' }).id, 7);
  assert.equal(a.regions.resolve({ fullLabel: 'R_visual' }).id, 42);
  assert.equal(a.regions.find('visual').length, 2);
  assert.throws(() => a.regions.resolve({ label: 'visual' }), code('AMBIGUOUS_REGION'));
  assert.throws(() => a.regions.resolve(123), code('UNKNOWN_REGION'));
  assert.throws(() => a.regions.resolve({ label: 'VISUAL' }), code('UNKNOWN_REGION'));
});

test('metadata validation rejects duplicate IDs, invalid labels, colors and attributes', () => {
  for (const bad of [0, -1, 1.5, NaN, Infinity, 2 ** 31]) {
    assert.throws(() => new RegionIndex([{ id: bad, label: 'x' }]), code('INVALID_METADATA'));
  }
  for (const bad of [
    [{ id: 1, label: 'x' }, { id: 1, label: 'y' }],
    [{ id: 1, label: ' ' }],
    [{ id: 1, label: 'x', fullLabel: '' }],
    [{ id: 1, label: 'x', hemisphere: 'LH' }],
    [{ id: 1, label: 'x', color: [256, 1, 1] }],
    [{ id: 1, label: 'x', color: [1, 1] }],
    [{ id: 1, label: 'x', attributes: { foo: {} } }],
  ]) assert.throws(() => new RegionIndex(bad), code('INVALID_METADATA'));
});

test('labels are validated by value before conversion, including signed and floating data', () => {
  for (const bad of [-1, 1.5, NaN, Infinity, 123, 2 ** 32 + 7]) {
    const data = new Float64Array(labels);
    data[2] = bad;
    assert.throws(() => new VolumeAtlas({ name: 'bad', regions, volume: volume(data) }), code('INVALID_LABEL'));
  }
  const signed = new Int8Array([0, 7, 42, 7, 42, 7]);
  assert.deepEqual(new VolumeAtlas({ name: 'int8', regions, volume: volume(signed) }).labels(), labels);
  const a = new VolumeAtlas({ name: 'large', regions: [{ id: 2 ** 31 - 1, label: 'max' }],
    volume: volume(new Uint32Array([2 ** 31 - 1]), space([1, 1, 1])) });
  assert.equal(a.labelAt(0), 2 ** 31 - 1);
});

test('atlas data and region metadata are isolated from caller mutations', () => {
  const data = labels.slice();
  const input = structuredClone(regions);
  const a = new VolumeAtlas({ name: 'safe', regions: input, volume: volume(data) });
  data[1] = 42;
  input[1].label = 'changed';
  input[1].attributes.network = 'changed';
  input[0].color[0] = 255;
  a.labels().fill(0);
  a.roi(7).indices.fill(0);
  assert.equal(a.labelAt(1), 7);
  assert.equal(a.regions.get(7).label, 'visual');
  assert.equal(a.regions.get(7).attributes.network, 'visual');
  assert.equal(a.regions.get(42).color[0], 1);
  assert.throws(() => { a.regions.items[0].label = 'changed'; }, TypeError);
  assert.deepEqual([...a.roi(7).indices], [1, 3, 5]);
});

test('voxel and world lookup use x-fastest indexing and explicit bounds', () => {
  const a = atlas();
  assert.equal(a.regionAt(0), undefined);
  assert.equal(a.regionAtVoxel([0, 1, 0]).id, 7);
  assert.equal(a.regionAtWorld([1.7, 0, 0]).id, 42);
  assert.equal(a.regionAtWorld([50, 0, 0]), undefined);
  assert.throws(() => a.regionAtVoxel([0.5, 0, 0]), code('OUT_OF_BOUNDS'));
  assert.throws(() => a.regionAt(-1), code('OUT_OF_BOUNDS'));
  assert.throws(() => a.regionAt(NaN), code('OUT_OF_BOUNDS'));
  assert.throws(() => a.regionAt(6), code('OUT_OF_BOUNDS'));
  assert.throws(() => a.regionAtWorld([NaN, 0, 0]), code('INVALID_DATA'));
});

test('subsets preserve label IDs and order, including an empty subset', () => {
  const a = atlas();
  const selected = a.subset(region => region.id === 42);
  assert.deepEqual(selected.regions.ids, [42]);
  assert.deepEqual([...selected.labels()], [0, 0, 42, 0, 42, 0]);
  assert.deepEqual(a.labels(), labels);
  const empty = a.subset(() => false);
  assert.equal(empty.regions.size, 0);
  assert.deepEqual([...empty.labels()], [0, 0, 0, 0, 0, 0]);
});

test('mean, sum, min and max match hand-computed parcels, retain absent regions', () => {
  const a = atlas();
  const data = volume(new Float64Array([100, 2, 10, 4, 20, 6]));
  for (const [statistic, expected] of [
    ['mean', [15, 4, NaN]], ['sum', [30, 12, 0]], ['min', [10, 2, NaN]], ['max', [20, 6, NaN]],
  ]) assert.deepEqual([...a.reduce(data, { statistic }).toArray()], expected);
});

test('nonfinite policy is explicit and background samples are excluded', () => {
  const a = atlas();
  const data = volume(new Float64Array([NaN, 2, NaN, Infinity, 20, 6]));
  assert.throws(() => a.reduce(data), code('INVALID_DATA'));
  assert.deepEqual([...a.reduce(data, { nonFinite: 'omit' }).toArray()], [20, 4, NaN]);
  assert.deepEqual([...a.reduce(data, { nonFinite: 'propagate' }).toArray()], [NaN, Infinity, NaN]);
  assert.deepEqual([...a.reduce(volume(new Float64Array(6).fill(NaN)),
    { nonFinite: 'omit', statistic: 'sum' }).toArray()], [0, 0, 0]);
  assert.throws(() => a.reduce(data, { statistic: 'median' }), code('INVALID_DATA'));
});

test('grid validation checks rank, shape, data length, finite affine and translation', () => {
  const a = atlas();
  const data = new Float64Array(6);
  for (const grid of [space([2, 3, 1]), space([3, 2, 1], 1), space([3, 2, 1], NaN),
    space([3, 2]), space([3, 2, 1, 1]), space([3, 2, 0])]) {
    assert.throws(() => a.reduce(volume(data, grid)), code('GRID_MISMATCH'));
  }
  assert.throws(() => new VolumeAtlas({ name: 'bad', regions, volume: volume(data.subarray(1)) }), code('GRID_MISMATCH'));
  assert.throws(() => a.reduce({ space: space(), length: 6, getData: () => [1] }), code('INVALID_DATA'));
});

test('parcel binding accepts reordered rows but rejects missing, duplicate and unknown IDs', () => {
  const a = atlas();
  const entries = [{ id: 7, value: 70 }, { id: 99, value: NaN }, { id: 42, value: 420 }];
  const values = a.values(entries);
  assert.deepEqual([...values.toArray()], [420, 70, NaN]);
  assert.equal(values.get({ fullLabel: 'L_visual' }), 70);
  values.toArray().fill(0);
  assert.equal(values.get(7), 70);
  assert.throws(() => a.values(entries.slice(1)), code('PARCEL_MISMATCH'));
  assert.throws(() => a.values([...entries, entries[0]]), code('PARCEL_MISMATCH'));
  assert.throws(() => a.values([...entries, { id: 123, value: 1 }]), code('UNKNOWN_REGION'));
  assert.deepEqual([...a.project(values, -1)], [-1, 70, 420, 70, 420, 70]);
  assert.throws(() => atlas().project(values), code('PARCEL_MISMATCH'));
});

test('streaming series validate every frame and preserve frame order', () => {
  const a = atlas();
  let read = 0;
  const series = {
    space: space([3, 2, 1, 2]),
    getVolume: frame => { read++; return volume(new Float64Array(6).fill(frame + 1)); },
  };
  const iter = a.reduceSeries(series);
  assert.equal(read, 0);
  assert.equal(iter.next().value.get(7), 1);
  assert.equal(read, 1);
  assert.equal(iter.next().value.get(7), 2);
  assert.equal(iter.next().done, true);
  assert.throws(() => [...a.reduceSeries({ ...series, getVolume: () => volume(labels, space([3, 2, 1], 10)) })], code('GRID_MISMATCH'));
  assert.throws(() => [...a.reduceSeries({ ...series, space: space([3, 2, 1]) })], code('GRID_MISMATCH'));
});

test('surface atlas keeps hemispheres separate, validates labels and preserves bilateral parcels', () => {
  const a = new SurfaceAtlas({ name: 'surface', regions,
    left: new Int32Array([7, 7, 0, 99]), right: new Int32Array([42, 99, 42]) });
  assert.equal(a.kind, 'surface');
  assert.equal(a.vertexCount('left'), 4);
  assert.equal(a.regionAt('right', 2).id, 42);
  assert.deepEqual([...a.roi(99).left], [3]);
  assert.deepEqual([...a.roi(99).right], [1]);
  const reduced = a.reduce({ left: [2, 6, NaN, 10], right: [10, 20, 30] });
  assert.deepEqual([...reduced.toArray()], [20, 4, 15]);
  assert.deepEqual([...a.project(reduced, 0).left], [4, 4, 0, 15]);
  assert.deepEqual([...a.subset(r => r.id === 42).labels('left')], [0, 0, 0, 0]);
  assert.throws(() => new SurfaceAtlas({ name: 'bad', regions, left: [42], right: [7] }), code('INVALID_LABEL'));
  assert.throws(() => a.regionAt('left', 4), code('OUT_OF_BOUNDS'));
  assert.throws(() => a.labels('LH'), code('INVALID_DATA'));
  assert.throws(() => a.reduce({ left: [2], right: [2] }), code('INVALID_DATA'));
});

test('parcel reduction agrees with an independent grouped-array oracle across deterministic fixtures', () => {
  let seed = 12345;
  const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed; };
  for (let fixture = 0; fixture < 20; fixture++) {
    const keys = [0, 7, 42, 99];
    const assignment = Int32Array.from({ length: 60 }, () => keys[random() % 4]);
    const values = Float64Array.from({ length: 60 }, () => (random() % 200) - 100);
    const grid = space([5, 4, 3]);
    const a = new VolumeAtlas({ name: 'oracle', regions, volume: volume(assignment, grid) });
    const actual = a.reduce(volume(values, grid));
    for (const region of regions) {
      const group = [...values].filter((_, i) => assignment[i] === region.id);
      const expected = group.length ? group.reduce((sum, value) => sum + value, 0) / group.length : NaN;
      assert.equal(actual.get(region.id), expected);
    }
  }
});

test('malformed selectors are rejected instead of matching regions without full labels', () => {
  const index = new RegionIndex([{ id: 1, label: 'a', fullLabel: 'L_a' }, { id: 2, label: 'b' }]);
  for (const bad of ['a', 'b', null, undefined, {}, { hemisphere: 'left' }, { label: 1 }, { fullLabel: 2 },
    { label: 'a', fullLabel: 'L_a' }, { fullLabel: 'L_a', hemisphere: 'left' }, { label: 'a', hemisphere: 'LH' }, 10n]) {
    assert.throws(() => index.resolve(bad), code('INVALID_SELECTOR'));
  }
  assert.throws(() => index.find(undefined), code('INVALID_SELECTOR'));
  assert.throws(() => index.find('a', 'LH'), code('INVALID_SELECTOR'));
  const a = atlas();
  assert.throws(() => a.roi('visual'), code('INVALID_SELECTOR'));
  assert.throws(() => a.values([{ id: 7, value: 1 }, { id: 42, value: 2 }, { id: 99, value: 3 }]).get('empty'),
    code('INVALID_SELECTOR'));
});

test('label selectors match short labels only; full labels need the fullLabel selector', () => {
  const index = new RegionIndex([{ id: 1, label: 'a', fullLabel: 'L_a' }, { id: 2, label: 'L_a' }]);
  assert.equal(index.resolve({ label: 'L_a' }).id, 2);
  assert.equal(index.resolve({ fullLabel: 'L_a' }).id, 1);
  assert.deepEqual(index.find('L_a').map(region => region.id), [2]);
  assert.throws(() => index.resolve({ label: 'missing' }), code('UNKNOWN_REGION'));
});

test('malformed inputs raise AtlasError codes rather than TypeError', () => {
  for (const bad of [null, 7, [null], [{ id: 1, label: 'x', color: 'red' }], [{ id: 1, label: 'x', color: null }],
    [{ id: 1, label: 'x', attributes: null }], [{ id: 1, label: 'x', attributes: [1] }]]) {
    assert.throws(() => new RegionIndex(bad), code('INVALID_METADATA'));
  }
  assert.throws(() => new VolumeAtlas(null), code('INVALID_METADATA'));
  assert.throws(() => new SurfaceAtlas(undefined), code('INVALID_METADATA'));
  assert.throws(() => new VolumeAtlas({ name: 'x', description: 42, regions, volume: volume(labels) }),
    code('INVALID_METADATA'));
  assert.throws(() => new VolumeAtlas({ name: 'x', regions, volume: null }), code('INVALID_DATA'));
  assert.throws(() => new VolumeAtlas({ name: 'x', regions, volume: { ...volume(labels), space: null } }),
    code('GRID_MISMATCH'));
  assert.throws(() => new SurfaceAtlas({ name: 'x', regions, right: [] }), code('INVALID_LABEL'));
  const a = atlas();
  for (const point of [null, 5, [0, 0]]) {
    assert.throws(() => a.regionAtVoxel(point), code('INVALID_DATA'));
    assert.throws(() => a.regionAtWorld(point), code('INVALID_DATA'));
  }
  assert.throws(() => a.reduce(null), code('INVALID_DATA'));
  assert.throws(() => a.reduce(volume(labels), null), code('INVALID_DATA'));
  assert.throws(() => a.values(null), code('INVALID_DATA'));
  assert.throws(() => a.values([null]), code('INVALID_DATA'));
  const surface = new SurfaceAtlas({ name: 's', regions, left: [7], right: [42] });
  assert.throws(() => surface.reduce(null), code('INVALID_DATA'));
  assert.throws(() => surface.reduce({ left: [1] }), code('INVALID_DATA'));
});

test('snapshots keep only declared metadata and region fields, all frozen', () => {
  const a = new VolumeAtlas({ name: 'x', junk: { mutable: true }, regions: [
    { id: 7, label: 'a', extra: { mutable: true } }, { id: 42, label: 'b' }], volume: volume(labels) });
  assert.deepEqual(a.metadata, { name: 'x' });
  assert.deepEqual(a.regions.get(7), { id: 7, label: 'a' });
  assert.ok(Object.isFrozen(a.regions.get(7)));
});

test('affineTolerance is opt-in, bounded, validated and inherited by subsets', () => {
  const shifted = volume(new Float64Array([0, 1, 2, 3, 4, 5]), space([3, 2, 1], 1e-6));
  assert.throws(() => atlas().reduce(shifted), code('GRID_MISMATCH'));
  const tolerant = new VolumeAtlas({ name: 't', regions, volume: volume(labels), affineTolerance: 1e-5 });
  assert.equal(tolerant.affineTolerance, 1e-5);
  assert.deepEqual([...tolerant.reduce(shifted).toArray()], [3, 3, NaN]);
  assert.throws(() => tolerant.reduce(volume(labels, space([3, 2, 1], 1e-4))), code('GRID_MISMATCH'));
  assert.throws(() => tolerant.reduce(volume(new Float64Array(6), space([2, 3, 1]))), code('GRID_MISMATCH'));
  assert.deepEqual([...tolerant.subset(() => true).reduce(shifted).toArray()], [3, 3, NaN]);
  for (const bad of [-1, NaN, Infinity, '0']) {
    assert.throws(() => new VolumeAtlas({ name: 't', regions, volume: volume(labels), affineTolerance: bad }),
      code('INVALID_METADATA'));
  }
});

test('reduceSeries validates the series, grid and options when called, before iteration', () => {
  const a = atlas();
  assert.throws(() => a.reduceSeries({ space: space([3, 2, 1]), getVolume: () => volume(labels) }), code('GRID_MISMATCH'));
  assert.throws(() => a.reduceSeries({ space: space([3, 2, 1, 2]) }), code('INVALID_DATA'));
  assert.throws(() => a.reduceSeries(null), code('INVALID_DATA'));
  assert.throws(() => a.reduceSeries({ space: space([3, 2, 1, 2]), getVolume: () => volume(labels) },
    { statistic: 'median' }), code('INVALID_DATA'));
});

test('rebind transfers values to subsets and across representations with verified keys', () => {
  const a = atlas();
  const values = a.values([{ id: 7, value: 70 }, { id: 42, value: 420 }, { id: 99, value: 990 }]);
  const left = a.subset(region => region.id === 7);
  assert.throws(() => left.project(values), code('PARCEL_MISMATCH'));
  const rebound = left.rebind(values);
  assert.deepEqual([...left.project(rebound, 0)], [0, 70, 0, 70, 0, 70]);
  assert.equal(a.subset(() => true).rebind(values).get(99), 990);

  const surface = new SurfaceAtlas({ name: 's', regions: [
    { id: 1, label: 'visual', fullLabel: 'L_visual', hemisphere: 'left' },
    { id: 2, label: 'visual', fullLabel: 'R_visual', hemisphere: 'right' }], left: [1, 0], right: [2] });
  const onSurface = surface.rebind(values, { by: 'fullLabel' });
  assert.deepEqual([...onSurface.toArray()], [70, 420]);
  assert.throws(() => surface.rebind(values), code('PARCEL_MISMATCH'));

  const renamed = new SurfaceAtlas({ name: 's', regions: [{ id: 7, label: 'other' }], left: [7], right: [] });
  assert.throws(() => renamed.rebind(values), code('PARCEL_MISMATCH'));
  const conflicting = new SurfaceAtlas({ name: 's', regions: [{ id: 7, label: 'visual', hemisphere: 'right' }],
    left: [], right: [7] });
  assert.throws(() => conflicting.rebind(values), code('PARCEL_MISMATCH'));
  const unlabeled = new SurfaceAtlas({ name: 's', regions: [{ id: 5, label: 'visual' }], left: [5], right: [] });
  assert.throws(() => unlabeled.rebind(values, { by: 'fullLabel' }), code('PARCEL_MISMATCH'));
  assert.throws(() => left.rebind(values, { by: 'label' }), code('INVALID_DATA'));
  assert.throws(() => left.rebind({ get: () => 1 }), code('INVALID_DATA'));
});

test('world lookup uses the affine snapshot, not the space object, and rejects singular affines', () => {
  const grid = space([3, 2, 1], 10);
  delete grid.coordToGrid;
  const a = new VolumeAtlas({ name: 'w', regions, volume: volume(labels, grid) });
  assert.equal(a.regionAtWorld([11.49, 0, 0]).id, 7);
  assert.equal(a.regionAtWorld([11.49, 1, 0]).id, 42);
  assert.equal(a.regionAtWorld([9.5, 0, 0]), undefined); // voxel 0, background
  const full = new VolumeAtlas({ name: 'f', regions, volume: volume(new Int32Array(6).fill(7), grid) });
  assert.equal(full.regionAtWorld([9.5, 0, 0]).id, 7);
  assert.equal(full.regionAtWorld([9.49, 0, 0]), undefined); // below the grid
  assert.equal(full.regionAtWorld([10, 1.5, 0]), undefined);
  assert.equal(full.regionAtWorld([10, 0, 0.5]), undefined);
  assert.equal(a.regionAtWorld([12.49, 0, 0]).id, 42);
  assert.equal(a.regionAtWorld([12.5, 0, 0]), undefined);
  const singular = { dim: [3, 2, 1], trans: { rows: 4, columns: 4, get: (i, j) => Number(i === j && i !== 2) } };
  assert.throws(() => new VolumeAtlas({ name: 's', regions, volume: volume(labels, singular) }), code('GRID_MISMATCH'));
});

test('review follow-ups: values, constructors, predicates, selectors, options and metadata shapes', () => {
  const a = atlas();
  for (const bad of [null, {}, { assertRegions() {} }]) {
    assert.throws(() => a.project(bad), code('INVALID_DATA'));
    assert.throws(() => a.mapValues(bad, Float64Array), code('INVALID_DATA'));
  }
  const values = a.values([{ id: 7, value: 1 }, { id: 42, value: 2 }, { id: 99, value: 3 }]);
  assert.throws(() => a.mapValues(values, null), code('INVALID_DATA'));
  assert.throws(() => a.toVolume(null), code('INVALID_DATA'));
  assert.throws(() => a.subset(null), code('INVALID_DATA'));
  const surface = new SurfaceAtlas({ name: 's', regions, left: [7], right: [42] });
  assert.throws(() => surface.project(null), code('INVALID_DATA'));
  assert.throws(() => surface.subset('left'), code('INVALID_DATA'));

  for (const bad of [NaN, 1.5, -1, 0, Infinity, { label: 'visual', hemisphere: 'left', junk: 1 }]) {
    assert.throws(() => a.regions.resolve(bad), code('INVALID_SELECTOR'));
  }
  assert.throws(() => a.regions.resolve(NaN), /NaN/);
  assert.throws(() => a.regionAt(NaN), /Index NaN/);
  assert.throws(() => a.regionAtWorld([0, , 0]), code('INVALID_DATA'));

  for (const options of [{ statistic: null }, { nonFinite: null }, { statistic: 'median' }]) {
    assert.throws(() => a.reduce(volume(new Float64Array(6)), options), code('INVALID_DATA'));
  }
  assert.throws(() => new RegionIndex([{ id: 1, label: 'x', attributes: new Map([['a', 1]]) }]), code('INVALID_METADATA'));
  assert.throws(() => new RegionIndex([{ id: 1, label: 'x', attributes: new Date() }]), code('INVALID_METADATA'));
  const colored = new RegionIndex([{ id: 1, label: 'x', color: Uint8Array.of(1, 2, 3), attributes: Object.create(null) }]);
  assert.deepEqual([...colored.get(1).color], [1, 2, 3]);
  assert.ok(Array.isArray(colored.get(1).color) && Object.isFrozen(colored.get(1).color));
});

test('mutating the atlas space after construction is reported as such', () => {
  const grid = space();
  const a = new VolumeAtlas({ name: 'm', regions, volume: volume(labels, grid), affineTolerance: 1 });
  grid.dim = [6, 1, 1];
  assert.throws(() => a.toVolume(Int32Array), /changed after construction/);
  assert.throws(() => a.subset(() => true), code('GRID_MISMATCH'));
});

test('instanceof branding keeps ordinary semantics for subclasses and prototypes', () => {
  class CustomError extends AtlasError {}
  const base = new AtlasError('INVALID_DATA', 'x');
  const custom = new CustomError('INVALID_DATA', 'y');
  assert.ok(base instanceof AtlasError && base instanceof Error);
  assert.ok(!(base instanceof CustomError));
  assert.ok(custom instanceof CustomError && custom instanceof AtlasError);
  assert.ok(!(AtlasError.prototype instanceof AtlasError));
  for (const primitive of [null, undefined, 1, 'AtlasError']) assert.ok(!(primitive instanceof AtlasError));
  assert.ok(!({ [Symbol.for('neuroatlasjs.class')]: 'RegionIndex' } instanceof RegionIndex));
});
