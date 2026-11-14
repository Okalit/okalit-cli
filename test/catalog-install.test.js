import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const cliPath = fileURLToPath(new URL('../bin/okalit-cli.js', import.meta.url));

async function runCli(args, cwd) {
  const child = spawn(process.execPath, [cliPath, ...args], { cwd });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
  child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });

  const { code } = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (exitCode) => resolve({ code: exitCode }));
  });
  return { code, stdout, stderr };
}

async function withRegistry(t, files, run) {
  const server = createServer((request, response) => {
    const file = files[request.url.slice(1)];
    if (file === undefined) {
      response.writeHead(404).end('not found');
      return;
    }

    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(typeof file === 'string' ? file : JSON.stringify(file));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const { port } = server.address();
  await run(`http://127.0.0.1:${port}`);
}

async function createProject(t) {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), 'okalit-cli-catalog-'));
  t.after(() => rm(projectDir, { recursive: true, force: true }));
  await writeFile(path.join(projectDir, 'package.json'), JSON.stringify({ type: 'module' }));
  return projectDir;
}

test('installs all catalog entries once, with dependencies before dependents', async (t) => {
  const projectDir = await createProject(t);
  const files = {
    'registry.json': {
      components: {
        'sample-button': {
          type: 'component',
          path: 'components/sample-button',
          files: ['sample-button.js'],
          dependencies: ['shared-token'],
        },
        'sample-page': {
          type: 'page',
          path: 'components/sample-page',
          files: ['sample-page.js'],
          dependencies: ['shared-token'],
        },
        'shared-token': {
          type: 'component',
          path: 'components/shared-token',
          files: ['shared-token.js'],
          dependencies: [],
        },
      },
    },
    'components/sample-button/sample-button.js': 'export const button = true;',
    'components/sample-page/sample-page.js': 'export const page = true;',
    'components/shared-token/shared-token.js': 'export const token = true;',
  };

  await withRegistry(t, files, async (registry) => {
    const result = await runCli(['add', '--all', '--registry', registry], projectDir);
    assert.equal(result.code, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Installed:/);
    assert.match(result.stdout, /sample-button/);
    assert.match(result.stdout, /sample-page/);
    assert.match(result.stdout, /shared-token/);

    const lock = JSON.parse(await readFile(path.join(projectDir, 'okalit.lock.json'), 'utf8'));
    assert.deepEqual(Object.keys(lock).sort(), ['sample-button', 'sample-page', 'shared-token']);
    assert.equal(lock['sample-page'].type, 'page');

    for (const [component, file] of [
      ['sample-button', 'sample-button.js'],
      ['sample-page', 'sample-page.js'],
      ['shared-token', 'shared-token.js'],
    ]) {
      await readFile(path.join(projectDir, 'src', component === 'sample-page' ? 'pages' : 'catalogs', component, file), 'utf8');
    }

    const repeated = await runCli(['add', '--all', '--registry', registry], projectDir);
    assert.equal(repeated.code, 0, repeated.stderr || repeated.stdout);
    assert.match(repeated.stdout, /Already installed \(skipped\)/);
  });
});

test('rejects catalog file traversal without installing partial entries', async (t) => {
  const projectDir = await createProject(t);
  await mkdir(path.join(projectDir, 'src'), { recursive: true });

  await withRegistry(t, {
    'registry.json': {
      components: {
        'unsafe-entry': {
          path: 'components/unsafe-entry',
          files: ['first.js', '../outside.js'],
          dependencies: [],
        },
      },
    },
    'components/unsafe-entry/first.js': 'export const first = true;',
  }, async (registry) => {
    const result = await runCli(['add', '--all', '--registry', registry], projectDir);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /path traversal is not allowed/);
    await assert.rejects(readFile(path.join(projectDir, 'src/catalogs/unsafe-entry/first.js')));
    await assert.rejects(readFile(path.join(projectDir, 'src/outside.js')));
  });
});
