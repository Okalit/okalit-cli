import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import inquirer from 'inquirer';
import { main } from '../lib/cli.js';
import { writeElementTest } from '../lib/testing.js';

const cli = fileURLToPath(new URL('../bin/okalit-cli.js', import.meta.url));

function run(cwd, command, args) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 180_000 });
  assert.equal(result.status, 0, result.error?.message || `${result.stdout}\n${result.stderr}`);
  console.log(`${path.basename(cwd)}: ${command} ${args.join(' ')} passed`);
}

test('generated testing works in Chromium for apps, components, catalogs and mixed imports', { timeout: 600_000 }, async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'okalit-browser-testing-'));
  const previousCwd = process.cwd();
  const previousPrompt = inquirer.prompt;
  let dependencies;
  try {
    for (const syntax of ['ok', 'js']) {
      for (const style of ['scss', 'css']) {
        for (const kind of ['component', 'catalog']) {
          const name = `${kind}-${syntax}-${style}`;
          process.chdir(workspace);
          inquirer.prompt = async () => ({
            creationType: kind, syntaxType: syntax, styleType: style,
            unitTests: true, e2eTests: true,
          });
          await main(['new', name]);
          const root = path.join(workspace, name);
          if (!dependencies) {
            run(root, 'npm', ['install', '--no-audit', '--no-fund']);
            run(root, 'npm', ['run', 'test:install']);
            dependencies = path.join(root, 'node_modules');
          } else fs.symlinkSync(dependencies, path.join(root, 'node_modules'), 'dir');
          run(root, 'npm', ['test']);
          run(root, 'npm', ['run', 'test:e2e']);
          if (kind === 'catalog') run(root, 'npm', ['run', 'build']);
          verifyBiome(root);
        }
      }
      for (const empty of [false, true]) {
        const name = `app-${syntax}-${empty ? 'empty' : 'full'}`;
        run(workspace, process.execPath, [cli, 'new', name, `--${syntax}`, '--e2e', ...(empty ? ['--empty'] : [])]);
        const root = path.join(workspace, name);
        fs.symlinkSync(dependencies, path.join(root, 'node_modules'), 'dir');
        for (const [flag, target] of [
          ['-c', 'src/components/user-card'], ['-p', 'src/pages/settings'],
          ['-m', 'src/modules/admin/billing'], ['-m', 'reports'],
          ['-s', 'src/services/auth'], ['--gqservice', 'src/services/graph'],
          ['--guard', 'src/guards/testing'], ['--interceptor', 'src/interceptors/testing'],
        ]) run(root, process.execPath, [cli, '-g', flag, target]);
        fs.writeFileSync(path.join(root, 'src/mixed.css'), '.mixed { color: rgb(0, 0, 255); }\n');
        fs.writeFileSync(path.join(root, 'src/mixed.scss'), '$background: rgb(255, 0, 0); .mixed { background-color: $background; }\n');
        fs.writeFileSync(path.join(root, 'src/shared.js'), "export const label = 'Mixed formats';\n");
        fs.writeFileSync(path.join(root, 'src/mixed.ok'), `@script {
  import { label } from './shared.js';
}
@component {
  tag: 'mixed-card',
  styles: ['./mixed.css', './mixed.scss']
}
@render {
  <p class="mixed">\${label}</p>
}
`);
        fs.writeFileSync(path.join(root, 'src/mixed.js'), `import { Okalit, html, defineElement } from '@okalit/core';
import './mixed.ok';
@defineElement({ tag: 'mixed-js-card' })
export class MixedJsCard extends Okalit {
  render() { return html\`<mixed-card></mixed-card>\`; }
}
`);
        writeElementTest(root, path.join(root, 'src/mixed.js'), 'mixed-js-card');
        fs.writeFileSync(path.join(root, 'src/mixed-style.test.js'), `import { expect, fixture, html, fixtureCleanup } from '@open-wc/testing';
import './mixed.ok';
describe('mixed formats and inline styles', () => {
  afterEach(() => fixtureCleanup());
  it('renders imported JavaScript and applies CSS', async () => {
    const element = await fixture(html\`<mixed-card></mixed-card>\`);
    const paragraph = element.shadowRoot.querySelector('p');
    expect(paragraph.textContent).to.equal('Mixed formats');
    expect(getComputedStyle(paragraph).color).to.equal('rgb(0, 0, 255)');
    expect(getComputedStyle(paragraph).backgroundColor).to.equal('rgb(255, 0, 0)');
  });
});
`);
        run(root, 'npm', ['test']);
        run(root, 'npm', ['run', 'test:e2e']);
        verifyBiome(root);
      }
    }
  } finally {
    process.chdir(previousCwd);
    inquirer.prompt = previousPrompt;
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

function verifyBiome(root) {
  const probe = path.join(root, 'biome-probe.js');
  fs.writeFileSync(probe, 'debugger;\n');
  try {
    const result = spawnSync('npm', ['run', 'lint', '--', '--only=lint/suspicious/noDebugger'], {
      cwd: root, encoding: 'utf8', timeout: 30_000,
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stdout + result.stderr, /biome-probe\.js/);
    assert.match(result.stdout + result.stderr, /noDebugger/);
    console.log(`${path.basename(root)}: Biome catches recommended rules in root files`);
  } finally {
    fs.unlinkSync(probe);
  }
}
