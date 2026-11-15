# @okalit/cli

CLI to create and manage Okalit projects, components, and catalogs.

Run `okalit --help` for the command reference and quick-start examples.
The help banner uses a segmented logo with white, blue and purple gradients
matching the website; redirected output does not clear the terminal.

## Installation

```bash
npm install -g @okalit/cli
```

Or use directly with `npx`:

```bash
npx @okalit/cli <command>
```

---

## Commands

### `okalit new <name>`

Create a new project, component, or catalog interactively.

```bash
okalit new my-app
okalit new my-button
okalit new my-catalog
okalit new my-ok-app --ok
okalit new my-js-app --js
okalit new my-empty-app --ok --empty
```

Use `--ok` or `--js` to create a project without prompts. Add `--empty` for
the empty template. The previous `--experimental-ok` flag remains an alias:

```bash
okalit new my-ok-app --experimental-ok
```

Prompts:
- **What do you want to create?** → Project | Component | Catalog
- **Which component syntax?** → `.ok` (recommended, selected by default) | JavaScript (`.js`)
- **Which style format?** → SCSS | CSS *(component/catalog only)*
- **Add unit tests?** → Yes by default (Web Test Runner + Open WC)
- **Add end-to-end tests?** → No by default (Playwright; projects, component demos and catalogs)
- **Empty Project?** → Yes | No *(project only)*

The syntax prompt applies to projects, standalone components and catalogs.
Full and empty projects are available in both formats, with the same dependencies,
aliases, Babel/Sass tooling and examples. Both include the published
`@okalit/engine` dependency and its Rsbuild loader so `.ok` and `.js` imports
can coexist. Catalogs publish source files for the consuming app's loader.

Imports can alternate through nested components: `.js → .ok → .js → .ok`,
or the reverse, with the same build/test tooling. Each `.ok` module compiles
to JavaScript and retains its imports for normal module resolution; there is
no rule requiring child components to match the parent or project syntax.
Use explicit extensions and unique custom-element tags. Circular imports
still have normal JavaScript initialization constraints; mixed syntax does
not eliminate them.

When distributing a mixed catalog entry, list every required local module and
style in its `registry.json` `files`, or declare other registered entries in
`dependencies`. The installer downloads that manifest, not an automatically
discovered import graph. Relative imports must keep their directory structure.

The engine still has experimental limitations (including missing source maps);
the recommendation is a CLI default, not a claim that these limitations are solved.

---

## Optional testing

Projects, standalone components and catalogs can include unit tests and
Playwright end-to-end tests. Catalogs now include a runnable component demo,
so they offer both testing prompts. Testing dependencies and configuration
are added only when selected.

Non-interactive projects enable unit tests and disable e2e by default:

```bash
okalit new my-app --ok --unit-tests --e2e
okalit new lean-app --js --no-unit-tests --no-e2e
```

The CLI saves the selections in `package.json`:

```json
{
  "okalit": {
    "syntax": "ok",
    "testing": { "unit": true, "e2e": false }
  }
}
```

When `okalit.testing.unit` is `true`, generators create companion `.test.js`
files for components, pages, modules (including their initial page), REST and
GraphQL services, guards and interceptors. The tests import the project's
`.ok` or `.js` source. Existing projects without this preference do not start
generating tests. E2e enablement is independent and does not generate per-resource
unit tests.

```bash
npm install
npm run test:install       # Download Chromium once for enabled test runners
npm test                   # Unit tests, if enabled
npm run test:watch         # Unit tests in an interactive terminal
npm run test:e2e           # E2e, if enabled; starts the Rsbuild dev server
npm run test:e2e:ui        # Interactive Playwright UI
```

In Linux CI, install browser system dependencies with
`npx playwright install --with-deps chromium` before running tests.

`web-test-runner.config.mjs` uses a real Chromium browser and Open WC fixtures,
not a simulated DOM. `okalit-test-plugin.mjs` compiles `.ok` with the published
engine, transforms JavaScript decorators, resolves the template's `@.../`
aliases and converts CSS/SCSS `?inline` imports to string modules. Mixed
imports work in either project format. Extend its alias map when adding custom
aliases. The `.ok` engine still does not produce source maps.

Generated tests are starting points: components test rendering, catalog buttons
test click/disabled behavior, services stub and restore `fetch` and test requests,
response parsing and caching, guards test their initial allow behavior, and
interceptors test token/no-token paths while restoring storage. Add business
rules and negative cases as you implement each resource. Tests are not added
to catalog registry entries, so consuming apps do not download test tooling.

Playwright tests the running compiled application/demo and does not parse
`.ok` files. Its configuration starts a local server on port 4173, reuses one
outside CI, and preserves traces on failures.

To validate the CLI's generated testing setup itself, run `npm run test:testing`
in this package. It installs dependencies in an isolated temporary workspace
and executes real unit/e2e tests across both syntaxes and template types.
Run browser integration scripts sequentially: their generated Playwright
servers use the same default port 4173. To test different apps concurrently,
assign distinct ports/base URLs in their Playwright configurations.

`npm run test:compatibility` additionally creates JS/OK catalogs, installs them
into both app formats through a local HTTP registry, builds the resulting apps
and executes browser tests. It covers alternating nested components, CSS/SCSS,
dynamic JS-to-OK loading and a shared component imported by multiple branches.

---

## Shared Biome configuration

Full/empty apps, standalone components and catalogs all include the same
`biome.json`, in either `.ok` or `.js` mode:

- Biome `2.4.11` with recommended lint rules and import organization.
- Two-space indentation, 100-character line width, single JavaScript quotes
  and semicolons.
- Project-wide scope, including supported sources in `src/`, `components/`,
  root demo/build configuration and test files.
- Dependency folders, build/coverage output, Playwright reports/results and
  npm lockfiles are excluded.

```bash
npm run lint
npm run lint:fix
```

Biome does not parse `.ok` blocks. Both project modes use identical rules for
files Biome recognizes, and `ignoreUnknown` skips unsupported formats rather
than treating them as JavaScript. This is not direct linting or formatting of
`.ok` source; validate those components with the engine/build and browser tests.
SCSS support also depends on the pinned Biome version.

## Catalog demo

The catalog template includes `index.html`, `demo.js`, Rsbuild configuration
and `@okalit/demo-components`, using its default presentation without theme
overrides, custom fonts or injected Shadow DOM styles.

```bash
okalit new my-catalog
# Choose Catalog, .ok or JavaScript, and CSS or SCSS.
cd my-catalog
npm install
npm run dev
npm run build
```

The initial demo previews `example-button` with editable variant/disabled
props, a default slot and the `on:click` event. Add demo entries to `demo.js`
and distribution entries to `registry.json` when adding components. The CLI
selects the matching `.ok` or `.js` import automatically at creation time;
the registry continues listing component sources/styles only, not demo or
test files.

---

### `okalit add <name>`

Install a component or page from a remote catalog registry.

```bash
okalit add button-atom --registry github.com/org/catalog
okalit add settings-page --registry github.com/org/catalog --path ./src/modules/settings/pages
okalit add icon-atom --type component
```

Install every entry in a catalog with `--all`:

```bash
okalit add --all --registry github.com/org/catalog
```

The CLI installs internal dependencies before dependents, skips destinations that
already exist, and tracks successful installs in `okalit.lock.json`. `--path` and
`--type` are not available with `--all`; each registry entry controls its type and
uses the default destination.

| Flag | Description |
|------|-------------|
| `--all` | Install every component/page in the registry |
| `--registry <url>` | GitHub registry URL (or set `okalit.registry` in package.json) |
| `--path <dest>` | Custom destination path |
| `--type <type>` | Force type: `component` \| `page` |

**Default destinations:**
- Components → `src/catalogs/<name>/`
- Pages → `src/pages/<name>/`

**Dependency resolution:** If the component has dependencies declared in the registry, they are installed automatically (deduplicated).

**Registry in package.json:**

```json
{
  "okalit": {
    "registry": "github.com/org/my-catalog"
  }
}
```

**Supported registry.json formats:**

Catalog (multiple components):
```json
{
  "components": {
    "button-atom": {
      "type": "component",
      "path": "components/button-atom",
      "files": ["button-atom.js", "button-atom.scss"],
      "channels": [],
      "dependencies": []
    }
  }
}
```

Standalone component:
```json
{
  "name": "my-button",
  "tag": "my-button",
  "files": ["my-button.js", "my-button.css"],
  "channels": [],
  "dependencies": []
}
```

---

### `okalit update [name]`

Update catalog components to their latest version from the registry.

```bash
okalit update                  # Update all installed catalog components
okalit update button-atom      # Update a specific component
```

Tracks installations in `okalit.lock.json` at the project root.

---

### `okalit -g` (Generate)

Generate resources inside an existing Okalit project. Automatically detects
SCSS/CSS, global styles and the project's component syntax.

```bash
okalit -g -c ./src/components/atoms/user-card       # Component
okalit -g -p ./src/modules/profile/pages/edit       # Page
okalit -g -s ./src/services/auth                    # Service
okalit -g --gqservice ./src/services/posts          # GraphQL Service
okalit -g -m ./src/modules/community                # Module (with routes + page)
okalit -g --guard ./src/guards/auth                 # Guard
okalit -g --interceptor ./src/interceptors/auth     # JWT request interceptor
```

| Flag | Resource |
|------|----------|
| `-c, --component` | Component (tag + styles) |
| `-p, --page` | Page with `PageMixin` |
| `-s, --service` | REST service with `OkalitService` |
| `--gqservice` | GraphQL service with `OkalitGraphqlService` |
| `-m, --module` | Module with routes, page, and auto-registration in `app.routes.js` |
| `--guard` | Route guard |
| `--interceptor` | Request interceptor that adds the JWT from `app:session` to `Authorization` |

The generated interceptor can be attached to a REST or GraphQL service with
`this.configure({ interceptors: [authInterceptor] })`.

Components, pages, modules and a module's initial page follow `okalit.syntax`
in `package.json`:

```json
{
  "okalit": {
    "syntax": "ok"
  }
}
```

Use `"js"` to generate JavaScript instead. Mixed imports never change this
preference. Projects created by older CLI versions are detected from their
Rsbuild entry (`src/main-app.ok` or `src/main-app.js`); legacy JavaScript
projects remain JavaScript. Invalid syntax preferences are reported as errors.
Commands work from project subdirectories, and target paths are relative to the
project root. Nested/custom module locations are registered using their actual
paths in `app.routes.js`.

Routes, services, guards, interceptors and channels remain `.js` in either mode.
For single-word component/page names, a `-component`/`-page` suffix is added to the
custom-element tag (not the filename) to ensure it contains a hyphen.

### Mixing `.ok` and `.js`

In an `.ok` component:

```ok
@script {
  import { label } from './shared.js';
  import './legacy-component.js';
}

@component {
  tag: 'user-card',
  styles: ['./user-card.scss']
}

@render {
  <p>${label}</p>
  <legacy-component></legacy-component>
}
```

In a JavaScript file, including a route:

```js
import './user-card.ok';
const loadPage = () => import('./profile.page.ok');
```

Use explicit extensions. The engine compiles `.ok` to normal JavaScript;
the browser does not load `.ok` sources directly. `@script` holds module-level
JavaScript, `@logic` holds class members, and `@render` holds HTML/Lit expressions.
Use exactly one role block (`@component`, `@page`, `@module`, `@main`).
Close `@render` with `}` on its own line; omitting render preserves the base render.

For an existing JavaScript app, install `@okalit/engine` and merge this rule into
`tools.rspack.module.rules` in `rsbuild.config.mjs`, preserving the existing
plugins, aliases, entry and rules:

```js
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

// tools.rspack.module.rules:
[
  {
    test: /\.ok$/,
    type: 'javascript/auto',
    use: [{ loader: require.resolve('@okalit/engine/loader') }],
  },
]
```

```bash
npm install -D @okalit/engine
```

---

## Project Structure

When you create a project with `okalit new`, you get:

```
my-app/
├── biome.json
├── index.html
├── package.json
├── rsbuild.config.mjs
├── public/
└── src/
    ├── main-app.ok       ← .js when JavaScript is selected
    ├── app.routes.js
    ├── catalogs/          ← @catalogs (imported from registries)
    ├── components/        ← @components (app-specific)
    ├── channels/
    ├── guards/
    ├── layouts/
    ├── modules/
    ├── services/
    └── styles/
```

---

## Lock File

`okalit.lock.json` tracks installed catalog components:

```json
{
  "liapf-simple-button": {
    "registry": "github.com/LIAPF-Team/liapf-simple-button",
    "type": "component",
    "path": "src/catalogs/liapf-simple-button",
    "installedAt": "2026-08-07T04:27:48.646Z",
    "updatedAt": "2026-08-07T04:28:14.358Z"
  }
}
```

---

## License

MIT

## Validation

```bash
npm test
npm run test:smoke
npm run test:integration
npm pack --dry-run
```

Integration tests install published npm dependencies into temporary projects,
build full/empty apps in both syntaxes with mixed imports and nested modules,
and compile the public `.ok` documentation examples with that published engine.