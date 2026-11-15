import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import inquirer from 'inquirer';
import { main } from '../lib/cli.js';

const cli = fileURLToPath(new URL('../bin/okalit-cli.js', import.meta.url));
const resources = [
  ['-c', 'src/components/user-card', 'src/components/user-card/user-card'],
  ['-p', 'src/pages/settings', 'src/pages/settings/settings'],
  ['-m', 'src/modules/admin', 'src/modules/admin/admin.module'],
  ['-s', 'src/services/auth', 'src/services/auth.service'],
  ['--gqservice', 'src/services/graph', 'src/services/graph.service'],
  ['--guard', 'src/guards/testing', 'src/guards/testing.guard'],
  ['--interceptor', 'src/interceptors/testing', 'src/interceptors/testing.interceptor'],
];

function run(cwd, args, succeeds = true) {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' });
  if (succeeds) assert.equal(result.status, 0, result.stderr + result.stdout);
  else assert.notEqual(result.status, 0);
  return result;
}

test('unit preferences control every generator in both syntaxes independently of e2e', () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'okalit-testing-'));
  try {
    for (const syntax of ['ok', 'js']) {
      for (const enabled of [false, true]) {
        const name = `${syntax}-${enabled}`;
        run(workspace, ['new', name, `--${syntax}`, '--empty', '--e2e', ...(enabled ? [] : ['--no-unit-tests'])]);
        const root = path.join(workspace, name);
        const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
        assert.deepEqual(pkg.okalit.testing, { unit: enabled, e2e: true });
        assert.equal(Boolean(pkg.devDependencies['@open-wc/testing']), enabled);
        assert.equal(Boolean(pkg.scripts.test), enabled);
        assert.equal(fs.existsSync(path.join(root, 'okalit-test-plugin.mjs')), enabled);
        assert.equal(fs.existsSync(path.join(root, 'playwright.config.mjs')), true);
        for (const [flag, target, file] of resources) {
          run(path.join(root, 'src'), ['-g', flag, target]);
          const testFile = path.join(root, `${file}.test.js`);
          assert.equal(fs.existsSync(testFile), enabled, file);
          if (enabled) {
            const extension = ['-c', '-p', '-m'].includes(flag) ? syntax : 'js';
            assert.ok(fs.readFileSync(testFile, 'utf8').includes(`./${path.basename(file)}.${extension}`));
          }
        }
        assert.equal(fs.existsSync(path.join(root, 'src/modules/admin/pages/admin.page.test.js')), enabled);
      }
    }
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test('legacy projects stay disabled and invalid preferences or test conflicts do not leave partial resources', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'okalit-testing-legacy-'));
  try {
    fs.writeFileSync(path.join(root, 'package.json'), '{}');
    run(root, ['-g', '-c', 'card']);
    assert.equal(fs.existsSync(path.join(root, 'card/card.test.js')), false);
    fs.writeFileSync(path.join(root, 'package.json'), '{"okalit":{"testing":{"unit":"true"}}}');
    assert.match(run(root, ['-g', '-c', 'invalid'], false).stderr, /Invalid okalit.testing.unit/);
    assert.equal(fs.existsSync(path.join(root, 'invalid')), false);
    for (const testing of [null, [], false, { unit: true, e2e: 'false' }]) {
      fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ okalit: { testing } }));
      assert.match(run(root, ['-g', '-c', 'invalid'], false).stderr, /Invalid okalit.testing/);
      assert.equal(fs.existsSync(path.join(root, 'invalid')), false);
    }
    fs.writeFileSync(path.join(root, 'package.json'), '{"okalit":{"testing":{"unit":true}}}');
    fs.writeFileSync(path.join(root, 'auth.service.test.js'), 'keep this test');
    run(root, ['-g', '-s', 'auth'], false);
    assert.equal(fs.existsSync(path.join(root, 'auth.service.js')), false);
    assert.equal(fs.readFileSync(path.join(root, 'auth.service.test.js'), 'utf8'), 'keep this test');
    for (const flags of [['--unit-tests', '--no-unit-tests'], ['--e2e', '--no-e2e']]) {
      assert.match(run(root, ['new', 'conflict', '--ok', ...flags], false).stderr, /Choose only one testing option/);
      assert.equal(fs.existsSync(path.join(root, 'conflict')), false);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('interactive templates offer English testing prompts with unit on and e2e off', async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'okalit-testing-prompts-'));
  const previousCwd = process.cwd();
  const previousPrompt = inquirer.prompt;
  try {
    process.chdir(workspace);
    for (const kind of ['project', 'component', 'catalog']) {
      inquirer.prompt = async questions => {
        const unit = questions.find(question => question.name === 'unitTests');
        const e2e = questions.find(question => question.name === 'e2eTests');
        assert.equal(unit.message, 'Add unit tests?');
        assert.equal(unit.default, true);
        assert.equal(e2e.message, 'Add end-to-end tests?');
        assert.equal(e2e.default, false);
        assert.equal(e2e.when, true);
        return { creationType: kind, syntaxType: 'ok', styleType: 'css', templateType: true, unitTests: true, e2eTests: false };
      };
      await main(['new', kind]);
      const root = path.join(workspace, kind);
      const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
      assert.deepEqual(pkg.okalit.testing, { unit: true, e2e: false });
      assert.ok(pkg.scripts.test);
      assert.equal(pkg.scripts['test:e2e'], undefined);
      if (kind === 'catalog') assert.ok(pkg.dependencies['@okalit/core']);
    }
  } finally {
    process.chdir(previousCwd);
    inquirer.prompt = previousPrompt;
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
