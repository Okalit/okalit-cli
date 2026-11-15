import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import inquirer from 'inquirer';
import { main } from '../lib/cli.js';

const cli = fileURLToPath(new URL('../bin/okalit-cli.js', import.meta.url));

async function run(cwd, command, args) {
  const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  const timer = setTimeout(() => child.kill(), 180_000);
  try {
    const status = await new Promise((resolve, reject) => {
      child.on('error', reject);
      child.on('close', resolve);
    });
    assert.equal(status, 0, output);
    console.log(`${path.basename(cwd)}: ${args.join(' ')} passed`);
  } finally {
    clearTimeout(timer);
  }
}

test('real catalog installs and alternating nested imports build and render in both app syntaxes', { timeout: 600_000 }, async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'okalit-nested-catalogs-'));
  const previousCwd = process.cwd();
  const previousPrompt = inquirer.prompt;
  const server = http.createServer((request, response) => {
    const file = path.resolve(workspace, `.${decodeURIComponent(new URL(request.url, 'http://localhost').pathname)}`);
    if (!file.startsWith(workspace + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200).end(fs.readFileSync(file));
  });
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const registryBase = `http://127.0.0.1:${server.address().port}`;
    for (const syntax of ['js', 'ok']) {
      process.chdir(workspace);
      inquirer.prompt = async () => ({
        creationType: 'catalog', syntaxType: syntax, styleType: 'scss',
        unitTests: true, e2eTests: true,
      });
      await main(['new', `catalog-${syntax}`]);
    }

    // All four alternating component modules are distributed by a JS catalog.
    // Keep its generated example and registry entry unchanged.
    const catalog = path.join(workspace, 'catalog-js');
    const chain = path.join(catalog, 'components/alternating-chain');
    fs.mkdirSync(chain);
    const sources = {
      'outer.js': `import { Okalit, html, defineElement } from '@okalit/core';
import './middle.ok';
import './leaf.ok';
import styles from './chain.scss?inline';
@defineElement({ tag: 'chain-outer', styles: [styles] })
export class ChainOuter extends Okalit {
  render() { return html\`<chain-middle></chain-middle>\`; }
}
`,
      'middle.ok': `@script {
  import './inner.js';
}
@component {
  tag: 'chain-middle'
}
@render {
  <chain-inner></chain-inner>
}
`,
      'inner.js': `import { Okalit, html, defineElement } from '@okalit/core';
import './leaf.ok';
@defineElement({ tag: 'chain-inner' })
export class ChainInner extends Okalit {
  render() { return html\`<chain-leaf></chain-leaf>\`; }
}
`,
      'leaf.ok': `@script {
  import { label } from './shared.js';
}
@component {
  tag: 'chain-leaf',
  styles: ['./leaf.css']
}
@logic {
  async loadLabel() {
    const { suffix } = await import('./lazy.js');
    this.output('chain:ready', label + suffix);
  }
}
@render {
  <button @click=\${this.loadLabel}>\${label}</button>
}
`,
      'shared.js': "export const label = 'Nested formats';\n",
      'lazy.js': "export { suffix } from './lazy.ok';\n",
      'lazy.ok': `@script {
  export const suffix = ' work';
}
@component {
  tag: 'chain-lazy'
}
`,
      'chain.scss': '$color: rgb(0, 128, 0); :host { display: block; color: $color; }\n',
      'leaf.css': 'button { color: rgb(0, 0, 255); }\n',
      'reverse.ok': `@script {
  import './outer.js';
}
@component {
  tag: 'chain-reverse'
}
@render {
  <chain-outer></chain-outer>
}
`,
    };
    for (const [file, source] of Object.entries(sources)) fs.writeFileSync(path.join(chain, file), source);
    const registryFile = path.join(catalog, 'registry.json');
    const registry = JSON.parse(fs.readFileSync(registryFile, 'utf8'));
    registry.components['alternating-chain'] = {
      type: 'component', path: 'components/alternating-chain',
      files: Object.keys(sources), dependencies: [],
    };
    fs.writeFileSync(registryFile, JSON.stringify(registry, null, 2));

    await run(catalog, 'npm', ['install', '--no-audit', '--no-fund']);
    await run(catalog, 'npm', ['run', 'test:install']);
    const dependencies = path.join(catalog, 'node_modules');

    for (const appSyntax of ['js', 'ok']) {
      for (const catalogSyntax of ['js', 'ok']) {
        const name = `app-${appSyntax}-catalog-${catalogSyntax}`;
        await run(workspace, process.execPath, [cli, 'new', name, `--${appSyntax}`, '--empty', '--e2e']);
        const root = path.join(workspace, name);
        fs.symlinkSync(dependencies, path.join(root, 'node_modules'), 'dir');
        await run(root, process.execPath, [cli, 'add', '--all', '--registry', `${registryBase}/catalog-${catalogSyntax}`]);
        const installed = path.join(root, 'src/catalogs/example-button');
        assert.ok(fs.existsSync(path.join(installed, `example-button.${catalogSyntax}`)));
        assert.ok(fs.existsSync(path.join(installed, 'example-button.scss')));
        assert.equal(fs.existsSync(path.join(installed, 'example-button.test.js')), false);
        assert.ok(fs.existsSync(path.join(root, 'okalit.lock.json')));

        // The reverse entry adds .ok -> .js -> .ok -> .js -> .ok nesting.
        const nested = catalogSyntax === 'js';
        const imports = `import '@catalogs/example-button/example-button.${catalogSyntax}';\n`
          + (nested ? "import '@catalogs/alternating-chain/reverse.ok';\n" : '');
        const home = path.join(root, `src/modules/example/pages/home/example-home.${appSyntax}`);
        const content = fs.readFileSync(home, 'utf8');
        const markup = '<example-button>Catalog button</example-button>'
          + (nested ? '<chain-reverse></chain-reverse>' : '');
        fs.writeFileSync(home, appSyntax === 'ok'
          ? `@script {\n${imports}}\n\n${content.replace('@render {', `@render {\n  ${markup}`)}`
          : `${imports}${content.replace('return html`', `return html\`${markup}`)}`);

        fs.writeFileSync(path.join(root, 'e2e/catalog.spec.js'), `import { expect, test } from '@playwright/test';
test('installed catalog renders${nested ? ' and nested modules load/react across every shadow root' : ''}', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const catalogButton = page.locator('example-button').getByRole('button', { name: 'Catalog button' });
  await expect(catalogButton).toBeVisible();
  await catalogButton.click();
${nested ? `  const leaf = page.locator('chain-reverse chain-outer chain-middle chain-inner chain-leaf');
  const button = leaf.getByRole('button', { name: 'Nested formats' });
  await expect(button).toBeVisible();
  await expect(button).toHaveCSS('color', 'rgb(0, 0, 255)');
  await expect(page.locator('chain-outer')).toHaveCSS('color', 'rgb(0, 128, 0)');
  await leaf.evaluate(element => {
    element.addEventListener('chain:ready', event => {
      element.dataset.result = event.detail;
    });
  });
  await button.click();
  await expect(leaf).toHaveAttribute('data-result', 'Nested formats work');` : ''}
  expect(errors).toEqual([]);
});
`);
        if (nested) {
          fs.writeFileSync(path.join(root, 'src/nested-catalog.test.js'), `import { expect, fixture, fixtureCleanup, html, oneEvent } from '@open-wc/testing';
import '@catalogs/alternating-chain/reverse.ok';
describe('alternating installed catalog modules', () => {
  afterEach(() => fixtureCleanup());
  it('renders each nested component and loads a dynamic JS import from .ok', async () => {
    const reverse = await fixture(html\`<chain-reverse></chain-reverse>\`);
    let element = reverse;
    for (const tag of ['chain-outer', 'chain-middle', 'chain-inner', 'chain-leaf']) {
      await element.updateComplete;
      element = element.shadowRoot.querySelector(tag);
      expect(element, tag).to.exist;
    }
    await element.updateComplete;
    const button = element.shadowRoot.querySelector('button');
    expect(button.textContent).to.equal('Nested formats');
    expect(getComputedStyle(button).color).to.equal('rgb(0, 0, 255)');
    const ready = oneEvent(element, 'chain:ready');
    button.click();
    expect((await ready).detail).to.equal('Nested formats work');
  });
});
`);
        }
        await run(root, 'npm', ['test']);
        await run(root, 'npm', ['run', 'build']);
        await run(root, 'npm', ['run', 'test:e2e']);
      }
    }
  } finally {
    process.chdir(previousCwd);
    inquirer.prompt = previousPrompt;
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
