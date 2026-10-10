import assert from 'node:assert/strict';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { VolumeAtlas } from '../dist/index.js';

// Optional checkout entry point lets the same tests qualify the sibling build.
const source = process.env.NEUROIMJS_ENTRY;
const { NeuroSpace, Int32NeuroVol, Float64NeuroVol, Float32NeuroVec,
  LogicalNeuroVol, ClusteredNeuroVol, SparseNeuroVol } = await import(
  source ? pathToFileURL(resolve(source)).href : 'neuroimjs');

const regions = [{ id: 7, label: 'left', hemisphere: 'left' }, { id: 42, label: 'right', hemisphere: 'right' }];
const affine = [[0, -3, 0, 10], [2, 0, 0, -20], [0, 0, 4, 30], [0, 0, 0, 1]];
const space = new NeuroSpace([3, 2, 1], undefined, undefined, undefined, affine);

test('real NeuroSpace and Int32NeuroVol support rotated anisotropic world lookup and roundtrip', () => {
  const source = new Int32NeuroVol(space, new Int32Array([0, 7, 42, 7, 42, 7]));
  const atlas = new VolumeAtlas({ name: 'native', volume: source, regions });
  assert.equal(atlas.space, space);
  assert.equal(atlas.regionAtWorld(space.gridToCoord([2, 1, 0])).id, 7);
  assert.equal(atlas.regionAtWorld([10, -18, 30]).id, 7);
  const copy = atlas.toVolume(Int32NeuroVol);
  assert.ok(copy instanceof Int32NeuroVol);
  assert.deepEqual(copy.getData(), source.getData());
  copy.setAt(1, 0, 0, 42);
  assert.equal(atlas.labelAt(1), 7);
  const projected = atlas.mapValues(atlas.values([{ id: 42, value: 4.2 }, { id: 7, value: 0.7 }]), Float64NeuroVol);
  assert.ok(projected instanceof Float64NeuroVol);
  assert.equal(projected.space, space);
  assert.deepEqual([...projected.getData()], [NaN, 0.7, 4.2, 0.7, 4.2, 0.7]);
});

test('real ClusteredNeuroVol is consumed through its dense materialization', () => {
  const mask = new LogicalNeuroVol(space, undefined, [1, 2, 3, 4, 5]);
  const source = new ClusteredNeuroVol(mask, new Int32Array([7, 42, 7, 42, 7]), { left: 7, right: 42 });
  const atlas = new VolumeAtlas({ name: 'clustered', volume: source, regions });
  assert.deepEqual([...atlas.roi(7).indices], [1, 3, 5]);
  assert.deepEqual([...atlas.labels()], [0, 7, 42, 7, 42, 7]);
  assert.deepEqual([...atlas.reduce(source).toArray()], [7, 42]);
});

test('real NeuroVec reduces one frame at a time on the native grid', () => {
  const atlas = new VolumeAtlas({ name: 'native', volume: new Int32NeuroVol(space,
    new Int32Array([0, 7, 42, 7, 42, 7])), regions });
  const series = new Float32NeuroVec(new NeuroSpace([3, 2, 1, 2], undefined, undefined, undefined, affine),
    new Float32Array([0, 2, 10, 4, 20, 6, 0, 4, 20, 8, 40, 12]));
  assert.deepEqual([...atlas.reduceSeries(series)].map(row => [...row.toArray()]), [[4, 15], [8, 30]]);
  const shifted = new Float64NeuroVol(new NeuroSpace([3, 2, 1]));
  assert.throws(() => atlas.reduce(shifted), { code: 'GRID_MISMATCH' });
});

test('real sparse label and signal volumes retain background and noncontiguous IDs', () => {
  const source = new SparseNeuroVol(space, 'int32', 0, [1, 2, 5], [7, 42, 7]);
  const atlas = new VolumeAtlas({ name: 'sparse', volume: source, regions });
  const signal = new SparseNeuroVol(space, 'float64', 0, [1, 2, 5], [2, 10, 6]);
  assert.deepEqual([...atlas.labels()], [0, 7, 42, 0, 0, 7]);
  assert.deepEqual([...atlas.reduce(signal).toArray()], [4, 10]);
});

test('world lookup agrees with NeuroSpace.coordToGrid on oblique, anisotropic affines', () => {
  let seed = 7;
  const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 2 ** 32; };
  const dim = [7, 6, 5];
  const labels = Int32Array.from({ length: 7 * 6 * 5 }, (_, i) => (i % 2 ? 7 : 42));
  for (let trial = 0; trial < 25; trial++) {
    const oblique = [0, 1, 2].map(() => [0, 1, 2].map(() => random() * 4 - 2).concat(random() * 200 - 100));
    oblique.push([0, 0, 0, 1]);
    const native = new NeuroSpace(dim, undefined, undefined, undefined, oblique);
    const atlas = new VolumeAtlas({ name: 'oblique', volume: new Int32NeuroVol(native, labels), regions });
    for (let sample = 0; sample < 40; sample++) {
      // Interior points away from half-voxel boundaries, where rounding is well defined.
      const voxel = dim.map(n => Math.floor(random() * n) + (random() * 0.8 - 0.4));
      const world = native.gridToCoord(voxel);
      const [i, j, k] = native.coordToGrid(world).map(Math.round);
      assert.equal(atlas.regionAtWorld(world)?.id, atlas.regionAtVoxel([i, j, k])?.id);
    }
  }
});
