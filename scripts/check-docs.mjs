// Executes every documentation snippet against the built package. Each snippet
// asserts the values its displayed comments claim, so the guide cannot drift.
import { execFileSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { build } from 'esbuild';

const directory = 'docs/snippets';
const files = (await readdir(directory)).filter(file => file.endsWith('.ts')).sort();
// Wider lines scroll sideways in the guide's content column at 1024 to 1280 px.
const maxDisplayedWidth = 68;
let failed = 0;

// VitePress includes the whole file when a `<<< …#region` name is missing, which
// would publish the hidden assertions. Every include must name a real region.
async function markdownFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return ['api', '.vitepress', 'snippets'].includes(entry.name) ? [] : markdownFiles(path);
    return entry.name.endsWith('.md') ? [path] : [];
  }));
  return nested.flat();
}
for (const page of await markdownFiles('docs')) {
  const text = await readFile(page, 'utf8');
  for (const [, file, region] of text.matchAll(/^<<< @\/snippets\/([^#\s{]+)(?:#([\w-]+))?/gm)) {
    let source;
    try { source = await readFile(join(directory, file), 'utf8'); } catch { source = undefined; }
    const where = `${relative('.', page)} includes snippets/${file}${region ? `#${region}` : ''}`;
    if (source === undefined) { failed++; console.error(`FAIL ${where}: no such file.`); continue; }
    if (!region) { failed++; console.error(`FAIL ${where}: name a region, or hidden assertions are published.`); continue; }
    if (!source.includes(`// #region ${region}\n`) || !source.includes(`// #endregion ${region}\n`)) {
      failed++;
      console.error(`FAIL ${where}: region not found.`);
    }
  }
}

for (const file of files) {
  let displayed = false;
  (await readFile(join(directory, file), 'utf8')).split('\n').forEach((line, index) => {
    if (/\/\/ #region\b/.test(line)) displayed = true;
    else if (/\/\/ #endregion\b/.test(line)) displayed = false;
    else if (displayed && [...line].length > maxDisplayedWidth) {
      failed++;
      console.error(`FAIL ${file}:${index + 1} is ${[...line].length} characters; the limit is ${maxDisplayedWidth}.`);
    }
  });
}

for (const file of files) {
  // Bundle local helpers; leave packages as imports, so `neuroatlasjs` resolves to the
  // built package through its own exports map and `neuroimjs` to node_modules.
  const { outputFiles } = await build({
    entryPoints: [join(directory, file)],
    bundle: true,
    packages: 'external',
    platform: 'node',
    format: 'esm',
    target: 'es2022',
    write: false,
  });
  try {
    execFileSync(process.execPath, ['--input-type=module'], {
      input: outputFiles[0].text,
      stdio: ['pipe', 'inherit', 'pipe'],
    });
    console.log(`ok ${file}`);
  } catch (error) {
    failed++;
    console.error(`FAIL ${file}\n${error.stderr?.toString() ?? error}`);
  }
}

if (failed > 0) {
  console.error(`${failed} of ${files.length} documentation snippets failed.`);
  process.exit(1);
}
console.log(`All ${files.length} documentation snippets ran and matched their stated results.`);
