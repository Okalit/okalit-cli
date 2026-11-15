import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import inquirer from 'inquirer';
import { main } from '../lib/cli.js';

function run(cwd, args, success = true) {
  const result = spawnSync('npm', args, { cwd, encoding: 'utf8', timeout: 180_000 });
  if (success)
    assert.equal(result.status, 0, result.error?.message || result.stdout + result.stderr);
  else assert.notEqual(result.status, 0);
  console.log(
    `${path.basename(cwd)}: npm ${args.join(' ')} ${success ? 'passed' : 'failed as expected'}`,
  );
  return result;
}

test('npm component/catalog packages build and render without loaders in both syntaxes and styles', {
  timeout: 600_000,
}, async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'okalit-npm-library-'));
  const previousCwd = process.cwd();
  const previousPrompt = inquirer.prompt;
  let dependencies;
  try {
    for (const kind of ['component', 'catalog']) {
      for (const syntax of ['ok', 'js']) {
        for (const style of ['css', 'scss']) {
          const name = `${kind}-${syntax}-${style}`;
          process.chdir(workspace);
          inquirer.prompt = async () => ({
            creationType: kind,
            syntaxType: syntax,
            styleType: style,
            distribution: 'npm',
            packageName: `@company/${name}`,
            unitTests: true,
            e2eTests: true,
          });
          await main(['new', name]);
          const root = path.join(workspace, name);
          if (!dependencies) {
            run(root, ['install', '--no-audit', '--no-fund']);
            run(root, ['run', 'test:install']);
            dependencies = path.join(root, 'node_modules');
          } else fs.symlinkSync(dependencies, path.join(root, 'node_modules'), 'dir');
          run(root, ['run', 'build']);
          assert.ok(fs.existsSync(path.join(root, 'dist/index.js')));
          if (kind === 'catalog') {
            assert.ok(fs.existsSync(path.join(root, 'dist/components/example-button.js')));
            // Conventional new components are included without editing the registry.
            const folder = path.join(root, 'components/nested/new-card');
            fs.mkdirSync(folder, { recursive: true });
            fs.writeFileSync(
              path.join(folder, 'new-card.ok'),
              `@script {
  import './inner.js';
}
@component {
  tag: 'new-card',
  styles: ['./new-card.scss']
}
@render {
  <inner-card></inner-card>
}
`,
            );
            fs.writeFileSync(
              path.join(folder, 'inner.js'),
              `import { Okalit, html, defineElement } from '@okalit/core';
import './leaf.ok';
@defineElement({ tag: 'inner-card' })
export class InnerCard extends Okalit {
  render() { return html\`<leaf-card></leaf-card>\`; }
}
`,
            );
            fs.writeFileSync(
              path.join(folder, 'leaf.ok'),
              `@component {
  tag: 'leaf-card'
}
@render {
  <p>Nested npm imports work</p>
}
`,
            );
            fs.writeFileSync(
              path.join(folder, 'new-card.scss'),
              '$color: blue; :host { color: $color; }\n',
            );
            run(root, ['run', 'build']);
            assert.ok(fs.existsSync(path.join(root, 'dist/components/nested/new-card.js')));
            const extraOutput = path.join(root, 'dist/components/nested/new-card.js');
            // Broken builds must not replace the previous working distribution.
            fs.renameSync(path.join(folder, 'leaf.ok'), path.join(folder, 'leaf.saved'));
            run(root, ['run', 'build'], false);
            assert.ok(fs.existsSync(extraOutput));
            fs.renameSync(path.join(folder, 'leaf.saved'), path.join(folder, 'leaf.ok'));
            const duplicate = path.join(root, 'components/duplicate');
            fs.mkdirSync(duplicate);
            fs.writeFileSync(
              path.join(duplicate, 'duplicate.js'),
              'export class ExampleButton {}\n',
            );
            const conflict = run(root, ['run', 'build'], false);
            assert.match(conflict.stdout + conflict.stderr, /Ambiguous catalog export/);
            fs.unlinkSync(path.join(duplicate, 'duplicate.js'));
            fs.rmdirSync(duplicate);
          }
          run(root, ['run', 'build:demo']);
          assert.ok(fs.existsSync(path.join(root, 'demo-dist/index.html')));
          assert.ok(fs.existsSync(path.join(root, 'dist/index.js')));
          run(root, ['test']);
          run(root, ['run', 'test:e2e']);
          run(root, ['run', 'test:package']);
        }
      }
    }
  } finally {
    process.chdir(previousCwd);
    inquirer.prompt = previousPrompt;
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
