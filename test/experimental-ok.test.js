import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.resolve(testDir, '../bin/okalit-cli.js');
const enginePath = path.resolve(testDir, '../../okalit-engine-main');

test('scaffolds an opt-in .ok project linked to the local engine', () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'okalit-ok-cli-'));
  const projectPath = path.join(workspace, 'my-ok-app');

  try {
    const result = spawnSync(
      process.execPath,
      [cliPath, 'new', 'my-ok-app', '--experimental-ok'],
      { cwd: workspace, encoding: 'utf8' },
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(fs.existsSync(path.join(projectPath, 'src/main-app.ok')), true);
    assert.equal(fs.existsSync(path.join(projectPath, 'src/app.routes.js')), true);
    assert.equal(fs.existsSync(path.join(projectPath, 'src/modules/example/pages/home/example-home.ok')), true);

    const packageJson = JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'), 'utf8'));
    const engineDependency = packageJson.devDependencies['@okalit/engine'];
    assert.match(engineDependency, /^file:/);
    assert.equal(
      path.resolve(projectPath, engineDependency.slice('file:'.length)),
      enginePath,
    );
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
