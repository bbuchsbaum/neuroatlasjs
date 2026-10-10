import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import { build } from 'esbuild';

test('package export resolves in Node ESM and CommonJS', async () => {
  const esm = await import('neuroatlasjs');
  const cjs = createRequire(import.meta.url)('neuroatlasjs');
  assert.equal(typeof esm.VolumeAtlas, 'function');
  assert.equal(typeof cjs.VolumeAtlas, 'function');
  assert.equal(new cjs.RegionIndex([{ id: 7, label: 'x' }]).resolve(7).label, 'x');
});

test('browser bundle contains no runtime imports and runs without Node or DOM globals', async () => {
  const result = await build({
    stdin: { contents: `
      import { SurfaceAtlas } from 'neuroatlasjs';
      const a = new SurfaceAtlas({ name: 'browser', regions: [{ id: 7, label: 'x' }], left: [7, 0], right: [7] });
      globalThis.answer = a.reduce({ left: [2, 100], right: [6] }).get(7);
    `, resolveDir: process.cwd(), sourcefile: 'browser-smoke.js' },
    bundle: true, platform: 'browser', format: 'iife', target: 'es2022', write: false, metafile: true,
  });
  assert.ok(Object.values(result.metafile.outputs).every(output => output.imports.length === 0));
  assert.ok(Object.keys(result.metafile.inputs).every(path => !path.includes('node_modules')));
  const context = vm.createContext({});
  vm.runInContext(result.outputFiles[0].text, context);
  assert.equal(context.answer, 4);
});

test('instanceof agrees across the ESM and CommonJS builds', async () => {
  const esm = await import('neuroatlasjs');
  const cjs = createRequire(import.meta.url)('neuroatlasjs');
  assert.notEqual(esm.AtlasError, cjs.AtlasError);
  let error;
  try { new cjs.RegionIndex([{ id: 0, label: 'x' }]); } catch (caught) { error = caught; }
  assert.ok(error instanceof esm.AtlasError);
  assert.ok(!(new Error('plain') instanceof esm.AtlasError));
  const atlas = new cjs.SurfaceAtlas({ name: 'x', regions: [{ id: 7, label: 'x' }], left: [7], right: [] });
  assert.ok(atlas instanceof esm.SurfaceAtlas && !(atlas instanceof esm.VolumeAtlas));
  assert.ok(atlas.regions instanceof esm.RegionIndex);
  const values = atlas.values([{ id: 7, value: 1 }]);
  assert.ok(values instanceof esm.ParcelValues);
  const target = new esm.SurfaceAtlas({ name: 'y', regions: [{ id: 7, label: 'x' }], left: [], right: [7] });
  assert.equal(target.rebind(values).get(7), 1);
});
