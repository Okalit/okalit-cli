import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformAsync } from '@babel/core';
import engine from '@okalit/engine';
import * as sass from 'sass';

const root = path.dirname(fileURLToPath(import.meta.url));
const aliases = Object.fromEntries([
  'catalogs', 'components', 'modules', 'styles', 'guards',
  'interceptors', 'layouts', 'channels', 'services',
].map(name => [`@${name}/`, `/src/${name}/`]));

function projectFile(context) {
  const file = path.resolve(root, `.${decodeURIComponent(context.path)}`);
  const relative = path.relative(root, file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Test import must stay inside the project: ${context.path}`);
  }
  return file;
}

export function okalitTestPlugin() {
  return {
    name: 'okalit-test-transform',
    resolveImport({ source }) {
      for (const [alias, target] of Object.entries(aliases)) {
        if (source.startsWith(alias)) return target + source.slice(alias.length);
      }
    },
    async serve(context) {
      if (!context.URL.searchParams.has('inline') || !/\.(css|scss|sass)$/.test(context.path)) return;
      const file = projectFile(context);
      const css = context.path.endsWith('.css')
        ? await fs.readFile(file, 'utf8')
        : (await sass.compileAsync(file)).css;
      return { body: `export default ${JSON.stringify(css)};`, type: 'js' };
    },
    resolveMimeType(context) {
      if (context.path.endsWith('.ok')) return 'js';
    },
    async transform(context) {
      if (context.path.includes('/node_modules/') || context.URL.searchParams.has('inline')) return;
      if (!/\.(ok|js)$/.test(context.path)) return;
      const filename = projectFile(context);
      const source = context.path.endsWith('.ok')
        ? engine.compileOk(context.body, { filename }).code
        : context.body;
      const result = await transformAsync(source, {
        filename,
        babelrc: false,
        configFile: false,
        sourceMaps: 'inline',
        plugins: [['@babel/plugin-proposal-decorators', { version: '2023-05' }]],
      });
      return { body: result.code };
    },
  };
}
