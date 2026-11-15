import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const cliPath = fileURLToPath(new URL('../bin/okalit-cli.js', import.meta.url));

test('help shows the refreshed identity and commands without clearing piped output', () => {
  for (const args of [[], ['--help'], ['-h']]) {
    const result = spawnSync(process.execPath, [cliPath, ...args], {
      encoding: 'utf8',
      env: { ...process.env, FORCE_COLOR: '0' },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /O K A L I T/);
    assert.match(result.stdout, /Engineered for complexity/);
    for (const command of ['--ok', '--js', '--experimental-ok', '--component', '--page', '--module', '--interceptor']) {
      assert.ok(result.stdout.includes(command), command);
    }
    assert.match(result.stdout, /https:\/\/okalit.com\/doc.html/);
    assert.ok(!result.stdout.includes('\x1b[2J'));
    assert.ok(!result.stdout.includes('\x1b[H'));
  }
});
