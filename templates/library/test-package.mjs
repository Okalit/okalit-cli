import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'okalit-library-consumer-'));

function run(cwd, command, args) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 180_000 });
  assert.equal(result.status, 0, result.error?.message || result.stdout + result.stderr);
  return result.stdout;
}

try {
  const packed = JSON.parse(
    run(root, 'npm', ['pack', '--json', '--pack-destination', workspace]),
  )[0];
  assert.ok(packed.files.some((file) => file.path === 'dist/index.js'));
  assert.equal(
    packed.files.some((file) => file.path.endsWith('.ok')),
    false,
  );
  const subpaths = pkg.okalit.library.directory
    ? packed.files
        .filter((file) => /^dist\/components\/.*\.js$/.test(file.path))
        .map((file) => `${pkg.name}/${file.path.replace(/^dist\//, '').replace(/\.js$/, '')}`)
    : [];
  const consumer = path.join(workspace, 'consumer');
  fs.mkdirSync(consumer);
  fs.writeFileSync(
    path.join(consumer, 'package.json'),
    JSON.stringify({
      name: 'okalit-library-consumer',
      private: true,
      type: 'module',
      dependencies: {
        ...pkg.peerDependencies,
        [pkg.name]: `file:${path.join(workspace, packed.filename)}`,
      },
      devDependencies: Object.fromEntries(
        ['@web/test-runner', '@web/test-runner-playwright', '@open-wc/testing', 'playwright'].map(
          (name) => [name, pkg.devDependencies[name]],
        ),
      ),
    }),
  );
  run(consumer, 'npm', ['install', '--no-audit', '--no-fund']);
  fs.writeFileSync(
    path.join(consumer, 'web-test-runner.config.mjs'),
    `import { playwrightLauncher } from '@web/test-runner-playwright';
export default { files: ['package.test.js'], nodeResolve: true, browsers: [playwrightLauncher({ product: 'chromium' })] };
`,
  );
  fs.writeFileSync(
    path.join(consumer, 'package.test.js'),
    `import { expect, fixture, fixtureCleanup } from '@open-wc/testing';
import * as library from ${JSON.stringify(pkg.name)};
describe('packed npm library', () => {
  afterEach(() => fixtureCleanup());
  it('exports and renders registered components without custom loaders', async () => {
    const components = Object.values(library).filter(value => typeof value === 'function' && value.prototype instanceof HTMLElement);
    expect(components.length).to.be.greaterThan(0);
    for (const Component of components) {
      const element = await fixture(new Component());
      await element.updateComplete;
      expect(element.isConnected).to.equal(true);
      expect(element.shadowRoot).to.exist;
      expect(element.shadowRoot.adoptedStyleSheets.length).to.be.greaterThan(0);
    }
  });
  it('individual catalog entries share the root module instances', async () => {
    for (const load of [${subpaths.map((specifier) => `() => import(${JSON.stringify(specifier)})`).join(', ')}]) {
      const entry = await load();
      for (const [name, value] of Object.entries(entry)) {
        if (name !== 'default') expect(value).to.equal(library[name]);
      }
    }
  });
});
`,
  );
  run(consumer, 'npx', ['playwright', 'install', 'chromium']);
  console.log(run(consumer, 'npx', ['web-test-runner', '--config', 'web-test-runner.config.mjs']));
  console.log('Packed npm library passed in a clean browser consumer without an Okalit loader.');
} finally {
  fs.rmSync(workspace, { recursive: true, force: true });
}
