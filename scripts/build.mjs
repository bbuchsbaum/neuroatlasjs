import { execFileSync } from 'node:child_process';
import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { build } from 'esbuild';

// Start clean so stale outputs from earlier layouts are never packed.
await rm('dist', { recursive: true, force: true });
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], { stdio: 'inherit' });

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/cjs/index.js',
  bundle: true,
  platform: 'neutral',
  format: 'cjs',
  target: 'es2022',
  sourcemap: true,
  // src/ ships alongside, so the map need not embed it.
  sourcesContent: false,
});

// A nested CommonJS scope makes TypeScript read these declarations as CommonJS,
// so `require` consumers type-check under module node16 as well as nodenext.
await writeFile('dist/cjs/package.json', `${JSON.stringify({ type: 'commonjs' })}\n`);
for (const file of await readdir('dist')) {
  if (!file.endsWith('.d.ts')) continue;
  const text = await readFile(join('dist', file), 'utf8');
  await writeFile(join('dist/cjs', file), text.replace('//# sourceMappingURL=', '//# sourceMappingURL=../'));
}
