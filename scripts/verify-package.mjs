import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = process.cwd();
const temporary = await mkdtemp(join(tmpdir(), 'neuroatlasjs-package-'));
function run(command, args, cwd = temporary) {
  return execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

try {
  const [packed] = JSON.parse(run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', temporary], root));
  await writeFile(join(temporary, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  run('npm', ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', join(temporary, packed.filename)]);
  run(process.execPath, ['--input-type=module', '-e', `
    import { SurfaceAtlas } from 'neuroatlasjs';
    const atlas = new SurfaceAtlas({ name: 'consumer', regions: [{ id: 7, label: 'x' }], left: [7], right: [] });
    if (atlas.regionAt('left', 0).id !== 7) throw new Error('ESM package failed');
  `]);
  run(process.execPath, ['--input-type=commonjs', '-e', `
    const { RegionIndex } = require('neuroatlasjs');
    if (new RegionIndex([{ id: 7, label: 'x' }]).size !== 1) throw new Error('CJS package failed');
  `]);
  const consumer = `
    import { SurfaceAtlas, type Atlas } from 'neuroatlasjs';
    const atlas: Atlas = new SurfaceAtlas({ name: 'types', regions: [{ id: 7, label: 'x' }], left: [7], right: [] });
    const id: number | undefined = atlas.regionAt('left', 0)?.id;
    void id;
  `;
  await writeFile(join(temporary, 'consumer.mts'), consumer);
  await writeFile(join(temporary, 'consumer.cts'), consumer);
  // node16 does not model require(esm), so it proves the CommonJS declarations are genuinely CommonJS.
  for (const mode of ['node16', 'nodenext']) {
    run(process.execPath, [resolve(root, 'node_modules/typescript/bin/tsc'), '--strict', '--noEmit',
      '--module', mode, '--moduleResolution', mode, '--target', 'ES2022', '--lib', 'ES2022',
      'consumer.mts', 'consumer.cts']);
  }
  console.log(`Packed consumer checks passed (ESM, CommonJS, node16/nodenext declarations; ${packed.size} bytes compressed).`);
} catch (error) {
  if (error.stdout) process.stderr.write(error.stdout);
  if (error.stderr) process.stderr.write(error.stderr);
  throw error;
} finally {
  await rm(temporary, { recursive: true, force: true });
}
