# @okalit/cli

CLI to create and manage Okalit projects, components, and catalogs.

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
```

Prompts:
- **What do you want to create?** → Project | Component | Catalog
- **Which style format?** → SCSS | CSS *(component/catalog only)*
- **Empty Project?** → Yes | No *(project only)*

---

### `okalit add <name>`

Install a component or page from a remote catalog registry.

```bash
okalit add button-atom --registry github.com/org/catalog
okalit add settings-page --registry github.com/org/catalog --path ./src/modules/settings/pages
okalit add icon-atom --type component
```

| Flag | Description |
|------|-------------|
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

Generate resources inside an existing Okalit project. Automatically detects SCSS/CSS and global styles.

```bash
okalit -g -c ./src/components/atoms/user-card       # Component
okalit -g -p ./src/modules/profile/pages/edit       # Page
okalit -g -s ./src/services/auth                    # Service
okalit -g --gqservice ./src/services/posts          # GraphQL Service
okalit -g -m ./src/modules/community                # Module (with routes + page)
okalit -g --guard ./src/guards/auth                 # Guard
```

| Flag | Resource |
|------|----------|
| `-c, --component` | Component (tag + styles) |
| `-p, --page` | Page with `PageMixin` |
| `-s, --service` | REST service with `OkalitService` |
| `--gqservice` | GraphQL service with `OkalitGraphqlService` |
| `-m, --module` | Module with routes, page, and auto-registration in `app.routes.js` |
| `--guard` | Route guard |

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
    ├── main-app.js
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