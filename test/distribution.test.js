import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import inquirer from 'inquirer';
import { main } from '../lib/cli.js';
import { validateDistribution } from '../lib/distribution.js';

test('distribution validation rejects invalid names and application libraries', () => {
  for (const name of ['@company', '@Company/ui', '../outside', 'has spaces', 'UPPERCASE', '']) {
    assert.throws(
      () => validateDistribution({ distribution: 'npm', packageName: name }, 'component', ''),
      /Invalid npm package name/,
    );
  }
  assert.throws(
    () => validateDistribution({ distribution: 'npm' }, 'project', 'app'),
    /Projects build websites/,
  );
  assert.throws(
    () => validateDistribution({ distribution: 'invalid' }, 'component', 'card'),
    /Invalid distribution/,
  );
  assert.equal(
    validateDistribution({ distribution: 'npm', packageName: '@company/ui' }, 'catalog', 'ui').name,
    '@company/ui',
  );
});

test('components and catalogs offer opt-in npm distribution; apps retain website builds', async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'okalit-distribution-'));
  const previousCwd = process.cwd();
  const previousPrompt = inquirer.prompt;
  try {
    process.chdir(workspace);
    for (const kind of ['project', 'component', 'catalog']) {
      for (const distribution of kind === 'project' ? ['source'] : ['source', 'npm']) {
        for (const syntax of ['ok', 'js']) {
          const name = `${kind}-${distribution}-${syntax}`;
          inquirer.prompt = async (questions) => {
            const target = questions.find((question) => question.name === 'distribution');
            assert.equal(target.default, 'source');
            assert.equal(target.when({ creationType: kind }), kind !== 'project');
            const npmName = questions.find((question) => question.name === 'packageName');
            assert.equal(npmName.when({ distribution }), distribution === 'npm');
            assert.equal(npmName.validate('@company/ui'), true);
            assert.match(npmName.validate('Invalid Name'), /Invalid npm package name/);
            return {
              creationType: kind,
              syntaxType: syntax,
              styleType: 'css',
              distribution,
              packageName: `@company/${name}`,
              unitTests: false,
              e2eTests: false,
            };
          };
          await main(['new', name]);
          const root = path.join(workspace, name);
          const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
          if (distribution === 'npm') {
            assert.equal(pkg.name, `@company/${name}`);
            assert.equal(pkg.private, false);
            assert.deepEqual(pkg.files, ['dist']);
            assert.equal(pkg.exports['.'], './dist/index.js');
            assert.equal(pkg.scripts.prepack, 'npm run build');
            assert.equal(pkg.scripts['build:demo'], 'rsbuild build');
            assert.equal(pkg.peerDependencies['@okalit/engine'], undefined);
            assert.ok(pkg.devDependencies.esbuild);
            assert.ok(pkg.devDependencies['@okalit/demo-components']);
            assert.equal(pkg.dependencies, undefined);
            assert.equal(pkg.scripts.test, undefined);
            assert.ok(pkg.scripts['test:package']);
            assert.match(
              fs.readFileSync(path.join(root, 'rsbuild.config.mjs'), 'utf8'),
              /demo-dist/,
            );
            if (kind === 'catalog')
              assert.equal(pkg.exports['./components/*'], './dist/components/*.js');
            else assert.equal(pkg.okalit.library.entry, `src/${name}.${syntax}`);
          } else {
            assert.equal(pkg.private, true);
            assert.equal(pkg.scripts.build, 'rsbuild build');
            assert.equal(pkg.scripts.prepack, undefined);
            assert.equal(pkg.exports, undefined);
            assert.equal(fs.existsSync(path.join(root, 'scripts/build-library.mjs')), false);
          }
        }
      }
    }
    inquirer.prompt = async () => ({
      creationType: 'catalog',
      syntaxType: 'ok',
      distribution: 'npm',
      packageName: 'Bad Name',
    });
    await assert.rejects(main(['new', 'bad']), /Invalid npm package name/);
    assert.equal(fs.existsSync(path.join(workspace, 'bad')), false);
  } finally {
    process.chdir(previousCwd);
    inquirer.prompt = previousPrompt;
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
