import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const cliPath = fileURLToPath(new URL('../bin/okalit-cli.js', import.meta.url));

test('generates a JWT request interceptor', async (t) => {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), 'okalit-cli-interceptor-'));
  t.after(() => rm(projectDir, { recursive: true, force: true }));

  await writeFile(path.join(projectDir, 'package.json'), JSON.stringify({ type: 'module' }));
  await mkdir(path.join(projectDir, 'src'), { recursive: true });

  const result = spawnSync(process.execPath, [
    cliPath,
    '-g',
    '--interceptor',
    './src/interceptors/auth',
  ], { cwd: projectDir, encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const generatedPath = path.join(projectDir, 'src/interceptors/auth.interceptor.js');
  const generated = await readFile(generatedPath, 'utf8');

  assert.match(generated, /import \{ getChannelValueStorage \} from "@okalit\/core";/);
  assert.match(generated, /export function authInterceptor\(\{ url, options \}\)/);
  assert.match(generated, /getChannelValueStorage\('app:session'\)/);
  assert.match(generated, /Authorization: `Bearer \$\{token\}`/);
  assert.match(generated, /return \{ url, options \};/);

  const syntaxCheck = spawnSync(process.execPath, ['--check', generatedPath], {
    cwd: projectDir,
    encoding: 'utf8',
  });
  assert.equal(syntaxCheck.status, 0, syntaxCheck.stderr || syntaxCheck.stdout);
});
