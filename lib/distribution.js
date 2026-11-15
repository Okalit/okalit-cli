import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const template = fileURLToPath(new URL('../templates/library/', import.meta.url));

export function validateDistribution(options, kind, fallbackName) {
  const distribution = options.distribution || 'source';
  if (!['source', 'npm'].includes(distribution)) {
    throw new Error('Invalid distribution target: choose source or npm.');
  }
  if (distribution === 'npm' && kind === 'project') {
    throw new Error(
      'Projects build websites for deployment; npm libraries are available for components and catalogs.',
    );
  }
  const name = options.packageName || fallbackName;
  if (
    distribution === 'npm' &&
    (!/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(name) ||
      name.length > 214 ||
      ['node_modules', 'favicon.ico'].includes(name))
  ) {
    throw new Error(
      'Invalid npm package name. Use lowercase names such as my-button or @company/ui.',
    );
  }
  return { distribution, name };
}

export function configureDistribution(root, options, kind, entry) {
  const { distribution, name } = validateDistribution(options, kind, path.basename(root));
  const file = path.join(root, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
  pkg.okalit.distribution = distribution;
  if (distribution === 'npm') {
    pkg.name = name;
    pkg.private = false;
    pkg.main = './dist/index.js';
    pkg.exports = { '.': './dist/index.js' };
    if (kind === 'catalog') pkg.exports['./components/*'] = './dist/components/*.js';
    pkg.files = ['dist'];
    pkg.okalit.library =
      kind === 'catalog'
        ? { directory: 'components' }
        : { entry: path.relative(root, entry).split(path.sep).join('/') };
    pkg.scripts['build:demo'] = pkg.scripts.build;
    pkg.scripts.build = 'node scripts/build-library.mjs';
    pkg.scripts.prepack = 'npm run build';
    pkg.scripts['test:package'] = 'node scripts/test-package.mjs';
    pkg.peerDependencies = {
      '@okalit/core': pkg.dependencies['@okalit/core'],
      lit: pkg.dependencies.lit,
    };
    for (const [dependency, version] of Object.entries(pkg.dependencies)) {
      pkg.devDependencies[dependency] = version;
    }
    delete pkg.dependencies;
    Object.assign(pkg.devDependencies, {
      esbuild: '^0.28.2',
      sass: '^1.97.3',
      '@web/test-runner': '^0.20.2',
      '@web/test-runner-playwright': '^0.11.1',
      '@open-wc/testing': '^4.0.0',
      playwright: '1.58.2',
    });
    pkg.scripts['test:install'] ||= 'playwright install chromium';
    fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
    for (const script of ['build-library.mjs', 'test-package.mjs']) {
      fs.copyFileSync(path.join(template, script), path.join(root, 'scripts', script));
    }
    const rsbuild = path.join(root, 'rsbuild.config.mjs');
    const source = fs.readFileSync(rsbuild, 'utf8');
    fs.writeFileSync(
      rsbuild,
      source.replace(
        'export default defineConfig({',
        "export default defineConfig({\n  output: { distPath: { root: 'demo-dist' } },",
      ),
    );
    fs.copyFileSync(path.join(template, 'README.md'), path.join(root, 'README.md'));
    const ignore = path.join(root, '.gitignore');
    fs.appendFileSync(ignore, '\ndist/\ndemo-dist/\n.okalit-library-*/\n*.tgz\n');
    console.log(
      'npm library configured. Run npm run test:install and npm run test:package before publishing.',
    );
  }
  fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
}
