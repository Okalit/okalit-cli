# Okalit npm library

Develop components in `.ok` or `.js`; publish compiled JavaScript to a public
or private npm registry. No `.ok` loader is needed to import this package.
Consumers install the runtime peer dependencies `@okalit/core` and `lit`.

```bash
npm install
npm run dev
npm run build:demo
npm run build
npm run test:install
npm run test:package
npm pack --dry-run
```

`build` generates the ESM library in `dist/`. `build:demo` writes the website
to `demo-dist/`, independently. `prepack` builds automatically before packing
or publishing. Local .ok/JS imports and inline CSS/SCSS are compiled/bundled;
package imports remain external and must be declared as runtime dependencies
or peers. Catalogs discover `components/name/name.ok` or `name.js` (also nested),
export named classes from the root and expose individual entries at
`PACKAGE_NAME/components/name`. Shared chunks avoid duplicate modules.
Use unique class names for root exports and unique custom-element tags.
Catalog component entry files must export their component classes by name,
as the CLI-generated templates do.
Components without that filename convention need an entry added in the build.

The registry remains available for source distribution. Update it when adding
source entries; npm libraries discover conventional component files at build
time. The demo list in `demo.js` is maintained separately.

`test:package` packs and installs a temporary consumer and runs browser tests
without an .ok or decorator plugin. It is independent of optional source tests.
Run integration tests sequentially if their servers share ports.

Before publishing, review the package name/version in `package.json`. For a
scoped public package:

```bash
npm publish --access public
```

For a company's private registry, configure authentication using your existing
npm tooling (never commit tokens), then publish explicitly:

```bash
npm publish --registry https://npm.company.example
```

The CLI does not publish, select public access, store credentials or configure
a registry automatically. Applications are not npm libraries: their normal
build generates a website for server deployment.
