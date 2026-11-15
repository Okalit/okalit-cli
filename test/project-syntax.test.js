import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import inquirer from 'inquirer';
import { main } from '../lib/cli.js';

const cliPath = fileURLToPath(new URL('../bin/okalit-cli.js', import.meta.url));

function run(cwd, ...args) {
  const result = spawnSync(process.execPath, [cliPath, ...args], { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function read(root, file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

for (const empty of [false, true]) {
  test(`both syntaxes share dependencies and support generators (${empty ? 'empty' : 'full'})`, () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'okalit-syntax-'));
    try {
      const packages = [];
      for (const syntax of ['ok', 'js']) {
        run(workspace, 'new', syntax, `--${syntax}`, ...(empty ? ['--empty'] : []));
        const project = path.join(workspace, syntax);
        const pkg = JSON.parse(read(project, 'package.json'));
        packages.push(pkg);
        assert.equal(pkg.okalit.syntax, syntax);
        assert.equal(pkg.devDependencies['@okalit/engine'], '^0.0.1');
        assert.match(read(project, 'rsbuild.config.mjs'), /@okalit\/engine\/loader/);
        assert.match(read(project, 'rsbuild.config.mjs'), new RegExp(`main-app\\.${syntax}`));
        assert.match(read(project, 'src/app.routes.js'), new RegExp(`example\\.module\\.${syntax}`));
        assert.match(read(project, 'src/modules/example/example.routes.js'), new RegExp(`example-home\\.${syntax}`));
        assert.equal(fs.existsSync(path.join(project, `src/main-app.${syntax === 'ok' ? 'js' : 'ok'}`)), false);

        // A mixed import must not change the project's generation preference.
        fs.writeFileSync(path.join(project, `src/mixed.${syntax === 'ok' ? 'js' : 'ok'}`), '');
        const nestedCwd = path.join(project, 'src/modules/example');
        run(nestedCwd, '-g', '-c', 'src/components/user-card');
        run(project, '-g', '-p', 'src/pages/settings');
        run(project, '-g', '-m', 'src/modules/admin/billing');
        run(project, '-g', '-m', 'reports');
        run(project, '-g', '-s', 'src/services/auth');
        for (const file of [
          `src/components/user-card/user-card.${syntax}`,
          `src/pages/settings/settings.${syntax}`,
          `src/modules/admin/billing/billing.module.${syntax}`,
          `src/modules/admin/billing/pages/billing.page.${syntax}`,
          `reports/reports.module.${syntax}`,
          'src/services/auth.service.js',
        ]) assert.equal(fs.existsSync(path.join(project, file)), true, file);
        assert.match(read(project, 'src/app.routes.js'), new RegExp(`./modules/admin/billing/billing.module\\.${syntax}`));
        assert.match(read(project, 'src/app.routes.js'), new RegExp(`../reports/reports.module\\.${syntax}`));
        assert.match(read(project, 'src/modules/admin/billing/billing.routes.js'), new RegExp(`billing.page\\.${syntax}`));
        assert.match(read(project, `src/components/user-card/user-card.${syntax}`), /@styles\/global.scss/);
        if (syntax === 'ok') {
          assert.match(read(project, 'src/components/user-card/user-card.ok'), /@component/);
          assert.match(read(project, 'src/pages/settings/settings.ok'), /@page/);
          assert.match(read(project, 'src/modules/admin/billing/billing.module.ok'), /@module/);
          assert.match(read(project, 'src/modules/admin/billing/pages/billing.page.ok'), /import \{ t \}/);
        }
      }
      assert.deepEqual(packages[0].dependencies, packages[1].dependencies);
      assert.deepEqual(packages[0].devDependencies, packages[1].devDependencies);
      assert.deepEqual(packages[0].scripts, packages[1].scripts);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });
}

test('detects legacy entry syntax, ignores mixed files, detects CSS and reports invalid preferences', () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'okalit-legacy-'));
  try {
    fs.writeFileSync(path.join(workspace, 'package.json'), JSON.stringify({ devDependencies: { '@okalit/engine': '^0.0.1' } }));
    fs.writeFileSync(path.join(workspace, 'rsbuild.config.mjs'), "export default { source: { entry: { index: './src/main-app.ok' } } };");
    run(workspace, '-g', '-c', 'card');
    assert.match(read(workspace, 'card/card.ok'), /\.\/card.css/);
    assert.match(read(workspace, 'card/card.ok'), /tag: "card-component"/);
    assert.equal(fs.existsSync(path.join(workspace, 'card/card.css')), true);
    fs.writeFileSync(path.join(workspace, 'rsbuild.config.mjs'), "export default { source: { entry: { index: './src/main-app.js' } } };");
    run(workspace, '-g', '-p', 'settings');
    assert.equal(fs.existsSync(path.join(workspace, 'settings/settings.js')), true);
    assert.match(read(workspace, 'settings/settings.js'), /tag: "settings-page"/);
    fs.writeFileSync(path.join(workspace, 'package.json'), '{"okalit":{"syntax":"invalid"}}');
    const result = spawnSync(process.execPath, [cliPath, '-g', '-c', 'invalid'], { cwd: workspace, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Invalid okalit.syntax/);
    assert.equal(fs.existsSync(path.join(workspace, 'invalid')), false);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test('interactive creation recommends .ok for projects, components and catalogs', async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'okalit-prompts-'));
  const originalCwd = process.cwd();
  const originalPrompt = inquirer.prompt;
  try {
    process.chdir(workspace);
    for (const creationType of ['project', 'component', 'catalog']) {
      inquirer.prompt = async (questions) => {
        const syntax = questions.find((question) => question.name === 'syntaxType');
        assert.equal(syntax.default, 'ok');
        assert.equal(syntax.choices[0].value, 'ok');
        assert.equal(syntax.when, undefined);
        const empty = questions.find((question) => question.name === 'templateType');
        assert.equal(empty.when({ creationType: 'project', syntaxType: 'ok' }), true);
        return { creationType, syntaxType: 'ok', styleType: 'css', templateType: true };
      };
      await main(['new', creationType]);
      const project = path.join(workspace, creationType);
      assert.equal(JSON.parse(read(project, 'package.json')).okalit.syntax, 'ok');
      if (creationType === 'component') {
        assert.match(read(project, 'src/component.ok'), /\.\/component.css/);
        assert.match(read(project, 'demo.js'), /\.\/src\/component.ok/);
        assert.match(read(project, 'src/component.ok'), /tag: 'component-component'/);
        assert.deepEqual(JSON.parse(read(project, 'registry.json')).files, ['component.ok', 'component.css']);
      }
      if (creationType === 'catalog') {
        assert.match(read(project, 'components/example-button/example-button.ok'), /\.\/example-button.css/);
        assert.match(read(project, 'registry.json'), /example-button.ok/);
      }
    }
  } finally {
    process.chdir(originalCwd);
    inquirer.prompt = originalPrompt;
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
