import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformAsync } from '@babel/core';
import engine from '@okalit/engine';
import { build } from 'esbuild';
import * as sass from 'sass';

const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const library = pkg.okalit.library;
const entries = {};

if (library.entry) {
  entries.index = path.resolve(root, library.entry);
} else {
  async function discover(directory) {
    for (const item of await fs.readdir(directory, { withFileTypes: true })) {
      const filename = path.join(directory, item.name);
      if (item.isDirectory()) await discover(filename);
      else if (
        ['.js', '.ok'].includes(path.extname(filename)) &&
        path.basename(filename, path.extname(filename)) === path.basename(directory)
      ) {
        const name = path
          .relative(path.join(root, library.directory), directory)
          .split(path.sep)
          .join('/');
        const key = `components/${name}`;
        if (entries[key])
          throw new Error(`Ambiguous component source: ${name}. Keep either .js or .ok, not both.`);
        entries[key] = filename;
      }
    }
  }
  await discover(path.join(root, library.directory));
  if (!Object.keys(entries).length)
    throw new Error('No catalog components found. Use components/name/name.ok or name.js.');
  entries.index = 'okalit:library-index';
}

const temporary = await fs.mkdtemp(path.join(root, '.okalit-library-'));
try {
  const result = await build({
    absWorkingDir: root,
    entryPoints: entries,
    outdir: temporary,
    bundle: true,
    splitting: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    packages: 'external',
    metafile: true,
    logLevel: 'silent',
    plugins: [
      {
        name: 'okalit-library',
        setup(builder) {
          builder.onResolve({ filter: /^okalit:library-index$/ }, () => ({
            path: 'index',
            namespace: 'okalit-index',
          }));
          builder.onLoad({ filter: /.*/, namespace: 'okalit-index' }, () => ({
            contents: Object.entries(entries)
              .filter(([name]) => name !== 'index')
              .map(([, filename]) => `export * from ${JSON.stringify(filename)};`)
              .join('\n'),
            loader: 'js',
            resolveDir: root,
          }));
          builder.onLoad({ filter: /\.(ok|js)$/ }, async ({ path: filename }) => {
            const original = await fs.readFile(filename, 'utf8');
            const source = filename.endsWith('.ok')
              ? engine.compileOk(original, { filename }).code
              : original;
            const result = await transformAsync(source, {
              filename,
              babelrc: false,
              configFile: false,
              plugins: [['@babel/plugin-proposal-decorators', { version: '2023-05' }]],
            });
            return { contents: result.code, loader: 'js', resolveDir: path.dirname(filename) };
          });
          builder.onResolve(
            { filter: /\.(css|scss|sass)\?inline$/ },
            ({ path: specifier, resolveDir }) => ({
              path: path.resolve(resolveDir, specifier.replace(/\?inline$/, '')),
              namespace: 'okalit-style',
            }),
          );
          builder.onLoad(
            { filter: /.*/, namespace: 'okalit-style' },
            async ({ path: filename }) => ({
              contents: filename.endsWith('.css')
                ? await fs.readFile(filename, 'utf8')
                : (await sass.compileAsync(filename)).css,
              loader: 'text',
            }),
          );
        },
      },
    ],
  });
  if (result.warnings.length)
    throw new Error(result.warnings.map((warning) => warning.text).join('\n'));
  if (!library.entry) {
    const outputs = Object.entries(result.metafile.outputs);
    const seen = new Set();
    const rootExports = outputs.find(
      ([filename]) => path.resolve(root, filename) === path.join(temporary, 'index.js'),
    )[1].exports;
    for (const [filename, output] of outputs) {
      if (!filename.includes('/components/') || !output.entryPoint) continue;
      const named = output.exports.filter((name) => name !== 'default');
      if (!named.length)
        throw new Error(`Catalog component needs a named export: ${output.entryPoint}`);
      for (const name of named) {
        if (seen.has(name) || !rootExports.includes(name))
          throw new Error(
            `Ambiguous catalog export "${name}". Give components unique exported class names.`,
          );
        seen.add(name);
      }
    }
  }
  const declared = { ...pkg.dependencies, ...pkg.peerDependencies };
  for (const file of Object.values(result.metafile.outputs)) {
    for (const imported of file.imports) {
      if (!imported.external) continue;
      const dependency = imported.path.startsWith('@')
        ? imported.path.split('/').slice(0, 2).join('/')
        : imported.path.split('/')[0];
      if (!declared[dependency])
        throw new Error(
          `Declare runtime dependency "${dependency}" in dependencies or peerDependencies.`,
        );
      if (/\.ok(?:$|\?)|\?inline/.test(imported.path))
        throw new Error(`Uncompiled import: ${imported.path}`);
    }
  }
  await fs.rm(path.join(root, 'dist'), { recursive: true, force: true });
  await fs.rename(temporary, path.join(root, 'dist'));
  console.error(
    'Built npm library: compiled ESM, bundled local imports and inline styles, external runtime dependencies.',
  );
} finally {
  await fs.rm(temporary, { recursive: true, force: true });
}
