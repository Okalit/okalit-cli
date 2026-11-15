import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import inquirer from 'inquirer';
import { main } from '../lib/cli.js';

const cliPath = fileURLToPath(new URL('../bin/okalit-cli.js', import.meta.url));

function run(cwd, command, args) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 180000 });
  assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout);
  return result.stdout;
}

test('published dependencies build full and empty apps with mixed imports, nested routes and SCSS', { timeout: 600000 }, async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'okalit-mixed-build-'));
  try {
    for (const syntax of ['ok', 'js']) {
      const project = path.join(workspace, syntax);
      run(workspace, process.execPath, [cliPath, 'new', syntax, `--${syntax}`]);
      run(project, 'npm', ['install', '--no-audit', '--no-fund']);
      run(project, process.execPath, [cliPath, '-g', '-m', 'src/modules/admin/profile']);
      run(project, process.execPath, [cliPath, '-g', '-m', 'reports']);
      run(project, process.execPath, [cliPath, '-g', '-c', 'src/components/generated-card']);
      run(project, process.execPath, [cliPath, '-g', '-p', 'src/pages/generated-page']);
      run(project, process.execPath, [cliPath, '-g', '-c', 'src/components/card']);
      run(project, process.execPath, [cliPath, '-g', '-p', 'src/pages/settings']);

      fs.writeFileSync(path.join(project, 'src/shared.js'), "export const label = 'Mixed imports work';\n");
      fs.writeFileSync(path.join(project, 'src/mixed.scss'), '.mixed { color: green; }\n');
      fs.writeFileSync(path.join(project, 'src/mixed.css'), '.mixed-css { color: blue; }\n');
      fs.writeFileSync(path.join(project, 'src/mixed.ok'), `@script {
  import { label } from './shared.js';
}
@component {
  tag: 'mixed-card',
  styles: ['./mixed.scss', './mixed.css']
}
@render {
  <p class="mixed mixed-css">\${label}</p>
}
`);
      fs.writeFileSync(path.join(project, 'src/mixed.js'), `import { Okalit, html, defineElement } from '@okalit/core';
import './mixed.ok';
@defineElement({ tag: 'mixed-js-card' })
export class MixedJsCard extends Okalit {
  render() { return html\`<mixed-card></mixed-card>\`; }
}
`);
      const entry = path.join(project, `src/main-app.${syntax}`);
      let source = fs.readFileSync(entry, 'utf8');
      const imports = [
        "import './mixed.js';",
        `import './components/generated-card/generated-card.${syntax}';`,
        `import './pages/generated-page/generated-page.${syntax}';`,
        `import './components/card/card.${syntax}';`,
        `import './pages/settings/settings.${syntax}';`,
      ].join('\n');
      source = syntax === 'ok' ? source.replace('@script {', `@script {\n${imports}`) : `${imports}\n${source}`;
      fs.writeFileSync(entry, source);
      run(project, 'npm', ['run', 'build']);
      assert.equal(fs.existsSync(path.join(project, 'dist/index.html')), true);

      // Compile every public .ok example with the same published engine used
      // by the generated app, not a local sibling-package substitution.
      if (syntax === 'ok') {
        const require = createRequire(path.join(project, 'package.json'));
        const { compileOk } = require('@okalit/engine');
        const window = { location: { search: '' }, dispatchEvent() {} };
        const context = {
          window, URLSearchParams, URL,
          document: { querySelectorAll: () => [], querySelector: () => null },
          CustomEvent: class {},
        };
        vm.runInNewContext(fs.readFileSync(new URL('../../public_html/syntax-switcher.js', import.meta.url), 'utf8'), context);
        for (const [name, code] of Object.entries({
          ...window.okalitSyntax.playground, ...window.okalitSyntax.docExamples,
        })) assert.doesNotThrow(() => compileOk(code, { filename: `${name}.ok` }), name);
        const homepage = fs.readFileSync(new URL('../../public_html/index.html', import.meta.url), 'utf8');
        const hero = homepage.match(/<section id="hero-section"[\s\S]*?<\/section>/)?.[0];
        const counter = hero?.match(/<pre[^>]*>([\s\S]*?)<\/pre>/)?.[1]
          .replace(/<[^>]*>/g, '')
          .replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&').trim();
        assert.ok(counter, 'Homepage must show the .ok counter');
        assert.equal(counter, window.okalitSyntax.docExamples['my-counter.js']);
        assert.doesNotThrow(() => compileOk(counter, { filename: 'my-counter.ok' }));
        function compileTemplates(directory) {
          for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const file = path.join(directory, entry.name);
            if (entry.isDirectory()) compileTemplates(file);
            else if (file.endsWith('.ok')) {
              assert.doesNotThrow(() => compileOk(fs.readFileSync(file, 'utf8'), { filename: file }), file);
            }
          }
        }
        compileTemplates(fileURLToPath(new URL('../templates/', import.meta.url)));
      }

      // Empty projects share the toolchain, but still exercise their own entry,
      // routes, aliases and styles instead of only compiling individual files.
      const emptyProject = path.join(workspace, `${syntax}-empty`);
      run(workspace, process.execPath, [cliPath, 'new', `${syntax}-empty`, `--${syntax}`, '--empty']);
      fs.symlinkSync(path.join(project, 'node_modules'), path.join(emptyProject, 'node_modules'), 'dir');
      run(emptyProject, process.execPath, [cliPath, '-g', '-m', 'src/modules/settings']);
      run(emptyProject, 'npm', ['run', 'build']);
      assert.equal(fs.existsSync(path.join(emptyProject, 'dist/index.html')), true);

      const originalPrompt = inquirer.prompt;
      const originalCwd = process.cwd();
      const componentName = `${syntax}-button`;
      try {
        process.chdir(workspace);
        inquirer.prompt = async () => ({
          creationType: 'component', syntaxType: syntax, styleType: syntax === 'ok' ? 'css' : 'scss',
        });
        await main(['new', componentName]);
      } finally {
        inquirer.prompt = originalPrompt;
        process.chdir(originalCwd);
      }
      const component = path.join(workspace, componentName);
      run(component, 'npm', ['install', '--no-audit', '--no-fund']);
      run(component, 'npm', ['run', 'build']);
      assert.equal(fs.existsSync(path.join(component, 'dist/index.html')), true);
    }
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
