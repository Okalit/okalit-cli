import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import inquirer from 'inquirer';
import { main } from '../lib/cli.js';

const templates = fileURLToPath(new URL('../templates/', import.meta.url));

test('all templates ship identical Biome rules, project-wide scope and lint scripts', () => {
  const expected = JSON.parse(fs.readFileSync(path.join(templates, 'app/biome.json'), 'utf8'));
  for (const kind of ['app', 'empty', 'component', 'catalog']) {
    const actual = JSON.parse(fs.readFileSync(path.join(templates, kind, 'biome.json'), 'utf8'));
    assert.deepEqual(actual, expected, kind);
    const pkg = JSON.parse(fs.readFileSync(path.join(templates, kind, 'package.json'), 'utf8'));
    assert.equal(pkg.devDependencies['@biomejs/biome'], '2.4.11');
    assert.equal(pkg.scripts.lint, 'biome check .');
    assert.equal(pkg.scripts['lint:fix'], 'biome check --write .');
  }
  const catalog = JSON.parse(fs.readFileSync(path.join(templates, 'catalog/package.json'), 'utf8'));
  const component = JSON.parse(fs.readFileSync(path.join(templates, 'component/package.json'), 'utf8'));
  assert.deepEqual(catalog.dependencies, component.dependencies);
  assert.deepEqual(catalog.devDependencies, component.devDependencies);
});

test('catalogs have the default demo, build tooling and independent e2e in both syntaxes and styles', async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'okalit-catalog-demo-'));
  const previousCwd = process.cwd();
  const previousPrompt = inquirer.prompt;
  try {
    process.chdir(workspace);
    for (const syntax of ['ok', 'js']) {
      for (const style of ['css', 'scss']) {
        const name = `catalog-${syntax}-${style}`;
        inquirer.prompt = async questions => {
          assert.equal(questions.find(question => question.name === 'e2eTests').when, true);
          return { creationType: 'catalog', syntaxType: syntax, styleType: style, unitTests: false, e2eTests: true };
        };
        await main(['new', name]);
        const root = path.join(workspace, name);
        const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
        assert.deepEqual(pkg.okalit.testing, { unit: false, e2e: true });
        assert.ok(pkg.scripts.dev);
        assert.ok(pkg.scripts.build);
        assert.ok(pkg.scripts['test:e2e']);
        assert.equal(pkg.scripts.test, undefined);
        const demo = fs.readFileSync(path.join(root, 'demo.js'), 'utf8');
        assert.ok(demo.includes(`./components/example-button/example-button.${syntax}`));
        assert.match(demo, /import '@okalit\/demo-components'/);
        assert.match(demo, /props: \[/);
        assert.doesNotMatch(demo, /adoptedStyleSheets|deviceTheme|demo\.css/);
        const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
        assert.ok(html.includes(`${name} - Demo`));
        assert.match(html, /okalit-demo-components id="catalog"/);
        assert.doesNotMatch(html, /catalog-header|fonts\.googleapis/);
        assert.ok(fs.existsSync(path.join(root, `components/example-button/example-button.${style}`)));
        const registry = JSON.parse(fs.readFileSync(path.join(root, 'registry.json'), 'utf8'));
        assert.deepEqual(registry.components['example-button'].files, [
          `example-button.${syntax}`, `example-button.${style}`,
        ]);
        assert.ok(fs.existsSync(path.join(root, 'e2e/app.spec.js')));
        assert.ok(fs.readFileSync(path.join(root, 'rsbuild.config.mjs'), 'utf8').includes('@okalit/engine/loader'));
      }
    }
  } finally {
    process.chdir(previousCwd);
    inquirer.prompt = previousPrompt;
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
