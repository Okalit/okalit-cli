import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const templateDir = fileURLToPath(new URL('../templates/testing/', import.meta.url));

export function readTestingOptions(root) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const testing = pkg.okalit?.testing === undefined ? {} : pkg.okalit.testing;
  if (testing === null || typeof testing !== 'object' || Array.isArray(testing)) {
    throw new Error('Invalid okalit.testing: expected an object.');
  }
  for (const key of ['unit', 'e2e']) {
    if (testing[key] !== undefined && typeof testing[key] !== 'boolean') {
      throw new Error(`Invalid okalit.testing.${key}: expected a boolean.`);
    }
  }
  return { unit: testing.unit === true, e2e: testing.e2e === true };
}

export function configureTesting(root, options, kind) {
  const unit = options.unitTests === true;
  const e2e = options.e2eTests === true;
  const pkgFile = path.join(root, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
  pkg.okalit.testing = { unit, e2e };
  pkg.scripts ||= {};
  pkg.devDependencies ||= {};
  if (unit) {
    Object.assign(pkg.devDependencies, {
      '@web/test-runner': '^0.20.2',
      '@web/test-runner-playwright': '^0.11.1',
      '@open-wc/testing': '^4.0.0',
      '@babel/core': '^7.29.0',
      '@babel/plugin-proposal-decorators': '^7.29.0',
      '@okalit/engine': '^0.0.1',
      sass: '^1.97.3',
      playwright: '1.58.2',
    });
    pkg.scripts.test = 'web-test-runner --config web-test-runner.config.mjs';
    pkg.scripts['test:watch'] = 'npm test -- --watch';
    for (const file of ['web-test-runner.config.mjs', 'okalit-test-plugin.mjs']) {
      fs.copyFileSync(path.join(templateDir, file), path.join(root, file));
    }
  }
  if (e2e) {
    Object.assign(pkg.devDependencies, { '@playwright/test': '1.58.2' });
    pkg.scripts['test:e2e'] = 'playwright test';
    pkg.scripts['test:e2e:ui'] = 'playwright test --ui';
    fs.copyFileSync(path.join(templateDir, 'playwright.config.mjs'), path.join(root, 'playwright.config.mjs'));
    fs.mkdirSync(path.join(root, 'e2e'), { recursive: true });
    const spec = fs.readFileSync(path.join(templateDir, `${kind}.spec.js`), 'utf8')
      .replaceAll('__COMPONENT_TAG__', options.componentTag || '');
    fs.writeFileSync(path.join(root, 'e2e/app.spec.js'), spec);
  }
  if (unit || e2e) {
    pkg.scripts['test:install'] = 'playwright install chromium';
    const ignoreFile = path.join(root, '.gitignore');
    const existing = fs.existsSync(ignoreFile) ? fs.readFileSync(ignoreFile, 'utf8') : '';
    const entries = ['node_modules/', 'coverage/', 'test-results/', 'playwright-report/']
      .filter(entry => !existing.split('\n').includes(entry));
    fs.writeFileSync(ignoreFile, existing + (existing && !existing.endsWith('\n') ? '\n' : '') + entries.join('\n') + '\n');
  }
  fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + '\n');
  if (unit || e2e) {
    console.log('Testing configured. After npm install, run npm run test:install to install Chromium.');
  }
}

export function writeElementTest(root, sourceFile, tag, { slot = false, heading = false, button = false } = {}) {
  if (!readTestingOptions(root).unit) return;
  const name = path.basename(sourceFile).replace(/\.(ok|js)$/, '');
  const file = path.join(path.dirname(sourceFile), `${name}.test.js`);
  if (fs.existsSync(file)) throw new Error(`Test already exists: ${file}`);
  const assertion = heading
    ? "    expect(element.shadowRoot.querySelector('h1')).to.exist;"
    : button
      ? "    expect(element.shadowRoot.querySelector('button')).to.exist;"
      : slot
        ? "    expect(element.shadowRoot.querySelector('slot')).to.exist;"
        : "    expect(element.shadowRoot).to.exist;";
  fs.writeFileSync(file, `import { expect, fixture, fixtureCleanup, html } from '@open-wc/testing';
import './${path.basename(sourceFile)}';

describe('${tag}', () => {
  afterEach(() => fixtureCleanup());

  it('connects and renders', async () => {
    const element = await fixture(html\`<${tag}></${tag}>\`);
    await element.updateComplete;
    expect(element.isConnected).to.equal(true);
${assertion}
  });
${button ? `
  it('emits on:click and respects disabled', async () => {
    const element = await fixture(html\`<${tag}></${tag}>\`);
    let clicks = 0;
    element.addEventListener('on:click', () => { clicks++; });
    element.shadowRoot.querySelector('button').click();
    expect(clicks).to.equal(1);
    element.disabled.value = true;
    await element.updateComplete;
    element.shadowRoot.querySelector('button').click();
    expect(clicks).to.equal(1);
  });
` : ''}
});
`);
  console.log(`Test created: ${path.relative(root, file)}`);
}

export function writePlainTest(root, sourceFile, kind, exported, coreAlias) {
  if (!readTestingOptions(root).unit) return;
  const file = sourceFile.replace(/\.js$/, '.test.js');
  if (fs.existsSync(file)) throw new Error(`Test already exists: ${file}`);
  let source;
  if (kind === 'guard') {
    source = `import { expect } from '@open-wc/testing';
import { ${exported} } from './${path.basename(sourceFile)}';

describe('${exported}', () => {
  it('allows navigation by default', async () => {
    expect(await ${exported}()).to.equal(true);
  });
});
`;
  } else if (kind === 'interceptor') {
    source = `import { expect } from '@open-wc/testing';
import { ${exported} } from './${path.basename(sourceFile)}';

describe('${exported}', () => {
  let previousSession;
  const storageKey = 'okalit:channel:app:session';

  beforeEach(() => {
    previousSession = localStorage.getItem(storageKey);
  });

  afterEach(() => {
    if (previousSession === null) localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, previousSession);
  });

  it('preserves the request when no token exists', () => {
    localStorage.removeItem(storageKey);
    const request = { url: '/example', options: { headers: { Accept: 'application/json' } } };
    expect(${exported}(request)).to.deep.equal(request);
    expect(request.options.headers).not.to.have.property('Authorization');
  });

  it('adds the session token and preserves existing headers', () => {
    localStorage.setItem(storageKey, JSON.stringify({ token: 'unit-test-token' }));
    const request = { url: '/example', options: { headers: { Accept: 'application/json' } } };
    const result = ${exported}(request);
    expect(result.url).to.equal('/example');
    expect(result.options.headers).to.deep.equal({
      Accept: 'application/json',
      Authorization: 'Bearer unit-test-token',
    });
  });
});
`;
  } else {
    source = `import { expect } from '@open-wc/testing';
import { ${kind === 'gqservice' ? 'OkalitGraphqlService' : 'OkalitService'} } from '${coreAlias}';
import { ${exported} } from './${path.basename(sourceFile)}';

describe('${exported}', () => {
  let originalFetch;
  let requests;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    requests = [];
    globalThis.fetch = async (url, options) => {
      requests.push({ url, options });
      return new Response(JSON.stringify(${kind === 'gqservice' ? '{ data: { item: { id: 1 } } }' : '{ id: 1 }'}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('creates the service without making a network request', () => {
    const instance = new ${exported}();
    expect(instance).to.be.instanceOf(${kind === 'gqservice' ? 'OkalitGraphqlService' : 'OkalitService'});
    expect(instance.${kind === 'gqservice' ? 'query' : 'get'}).to.be.a('function');
    expect(requests).to.have.length(0);
  });

  it('builds the request, parses the response and caches repeated reads', async () => {
    const instance = new ${exported}();
    instance.configure({ ${kind === 'gqservice' ? "endpoint: '/unit-test/graphql'" : "baseUrl: '/unit-test'"} });
${kind === 'gqservice' ? `    const query = 'query Item($id: Int!) { item(id: $id) { id } }';
    const data = await instance.query(query, { id: 1 });
    expect(data).to.deep.equal({ item: { id: 1 } });
    expect(await instance.query(query, { id: 1 })).to.deep.equal(data);
    expect(requests[0].url).to.equal('/unit-test/graphql');
    expect(requests[0].options.method).to.equal('POST');
    expect(JSON.parse(requests[0].options.body)).to.deep.equal({ query, variables: { id: 1 } });`
    : `    const data = await instance.get('/items/1');
    expect(data).to.deep.equal({ id: 1 });
    expect(await instance.get('/items/1')).to.deep.equal(data);
    expect(requests[0].url).to.equal('/unit-test/items/1');
    expect(requests[0].options.method).to.equal('GET');`}
    expect(requests).to.have.length(1);
  });
});
`;
  }
  fs.writeFileSync(file, source);
  console.log(`Test created: ${path.relative(root, file)}`);
}
