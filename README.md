# Okalit

**A progressive Web Components framework with reactive signals, routing, injectable services, and communication channels.**

Okalit is built on top of the browser's standard `HTMLElement` class, enhanced with **signal**-based reactivity (via [uhtml](https://github.com/WebReflection/uhtml)), modern TC39 decorators, and a modular system inspired by enterprise architectures.

---

## Getting Started

```bash
npx @okalit/cli new app-name
cd app-name
npm install
npm run dev
```

The CLI generates a ready-to-develop project with all conventions pre-configured.

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server (Rsbuild) |
| `npm run build` | Production build |
| `npm run build:analyze` | Build with bundle analysis |
| `npm run lint` | Lint with Biome |
| `npm run lint:fix` | Auto-fix lint issues |

---

## Folder Structure

```
src/
├── main-app.js                  # Root application component
├── app.routes.js                # Main routes
├── channels/                    # Reactive communication channels
│   └── example.channel.js
├── components/                  # Reusable components
│   └── lazy-widget.js
├── guards/                      # Navigation guards
│   └── auth.guard.js
├── interceptors/                # Route interceptors
│   └── navlog.interceptor.js
├── layouts/                     # Application layouts
│   └── app-layout.js
├── modules/                     # Feature modules
│   └── example/
│       ├── example.module.js    # Module definition
│       ├── example.routes.js    # Module routes
│       └── pages/               # Module pages
│           ├── home/
│           ├── detail
├── services/                    # Injectable services (REST / GraphQL)
│   ├── user.service.js
│   └── rickandmorty.service.js
└── styles/                      # Global styles
    ├── global.scss
    └── index.css
```

---

## Base Class: `Okalit`

Every component in Okalit extends the `Okalit` class, which in turn extends `HTMLElement` with Shadow DOM enabled.

```js
import { Okalit, html, defineElement } from '@okalit';

@defineElement({ tag: 'my-component' })
export class MyComponent extends Okalit {
  render() {
    return html`<p>Hello Okalit!</p>`;
  }
}
```

### The `@defineElement` Decorator

Registers the custom element in the browser and configures styles, props, and params:

```js
@defineElement({
  tag: 'my-component',
  styles: [css],            // CSSStyleSheet strings (adoptedStyleSheets)
  props: [                  // Reactive properties
    { count: { type: Number, value: 0 } },
    { name: { type: String, value: '' } },
  ],
  params: [                 // Initial values from URL query params
    { page: { type: Number, value: 1 } },
  ],
})
```

- **`tag`** — custom element name (must contain a hyphen).
- **`styles`** — array of CSS strings applied via `adoptedStyleSheets`.
- **`props`** — observed reactive properties. Created as signals and synced with HTML attributes (kebab-case).
- **`params`** — same as props, but their initial value is read from the URL query string (`?page=3`).

---

## Reactivity: Signals

Okalit uses uhtml's signal system. Declared props are automatically converted into reactive signals:

```js
@defineElement({
  tag: 'my-counter',
  props: [{ count: { type: Number, value: 0 } }],
})
export class MyCounter extends Okalit {
  render() {
    return html`
      <p>Count: ${this.count.value}</p>
      <button @click=${() => this.count.value++}>+1</button>
    `;
  }
}
```

You can also create local signals:

```js
import { signal, computed, effect, batch } from '@okalit';

logs = signal([]);
total = computed(() => this.logs.value.length);
```

| API | Description |
|-----|-------------|
| `signal(value)` | Creates a reactive value. Read/write with `.value` |
| `computed(fn)` | Derived value that recalculates automatically |
| `effect(fn)` | Runs side-effects when read signals change |
| `batch(fn)` | Groups multiple changes into a single re-render |

---

## Lifecycle

Okalit components have clear lifecycle hooks:

| Hook | When it runs |
|------|-------------|
| `onInit()` | Once when the component is first connected to the DOM |
| `onChange(changes)` | When a declared prop value changes |
| `onBeforeRender()` | Before each reactive render |
| `onAfterRender()` | After each reactive render |
| `onDestroy()` | When the component is disconnected from the DOM |

```js
@defineElement({
  tag: 'example-lifecycle',
  props: [{ name: { type: String, value: 'World' } }],
})
export class ExampleLifecycle extends PageMixin(Okalit) {
  onInit() {
    console.log('Component initialized');
  }

  onChange(changes) {
    // changes = { name: { previous: 'World', current: 'Ada' } }
    for (const [prop, { previous, current }] of Object.entries(changes)) {
      console.log(`${prop}: "${previous}" → "${current}"`);
    }
  }

  onDestroy() {
    console.log('Component destroyed');
  }
}
```

---

## Mixins

Mixins extend the base class for different roles in the architecture:

### `AppMixin`

For the **root application component**. Initializes the router, i18n, and defines the layout:

```js
@defineElement({ tag: 'main-app' })
export class MainApp extends AppMixin(Okalit) {
  static config = {
    routes,
    template: (slot) => html`<app-layout>${slot}</app-layout>`,
    i18n: {
      default: 'en',
      locales: ['es', 'en'],
    },
  };
}
```

### `ModuleMixin`

For **feature modules** that group pages and provide a nested `<okalit-router>`:

```js
@defineElement({ tag: 'example-module', styles: [global] })
export class ExampleModule extends ModuleMixin(Okalit) {}
```

### `PageMixin`

For **individual pages**. Provides router access, route params, and navigation:

```js
@defineElement({ tag: 'my-page' })
export class MyPage extends PageMixin(Okalit) {
  render() {
    const id = this.routeParams.id;       // Route params (:id)
    const q = this.queryParams.search;    // Query params (?search=...)
    return html`<p>Item ${id}</p>`;
  }
}
```

**Helpers available in PageMixin and ModuleMixin:**

| Property / Method | Description |
|--------------------|-------------|
| `this.router` | Router instance |
| `this.routeParams` | Object with route params (`:id`) |
| `this.queryParams` | Object with query params (`?key=val`) |
| `this.navigate(path)` | Navigate programmatically |

---

## Routing

Okalit includes a SPA router based on `history.pushState` with support for:

- Nested routes (module → page)
- Lazy loading of modules and pages via `import()`
- Dynamic parameters (`:id`)
- Per-route guards and interceptors
- Automatic channel cleanup by scope

### Route Definition

```js
// app.routes.js
export default [
  {
    path: '/',
    component: 'example-module',
    import: () => import('./modules/example/example.module.js'),
    interceptors: [navLogInterceptor],
    children: ExampleModuleRoutes,
  },
];
```

```js
// example.routes.js
export default [
  {
    path: '/',
    component: 'example-home',
    import: () => import('./pages/home/example-home.js'),
  },
  {
    path: '/detail/:id',
    component: 'example-detail',
    import: () => import('./pages/detail/example-detail.js'),
    guards: [authGuard],
  },
];
```

### Route Properties

| Property | Description |
|----------|-------------|
| `path` | URL pattern. Supports dynamic segments with `:param` |
| `component` | Tag of the custom element to render |
| `import` | Function returning `import()` for lazy loading |
| `guards` | Array of guard functions that run **before** loading the route |
| `interceptors` | Array of interceptor functions that run **after** guards |
| `children` | Nested child routes |

### The `<okalit-router>` Component

This is the outlet where routes are rendered. It supports automatic nesting: the router calculates the depth of each `<okalit-router>` in the Shadow DOM tree to render the correct level in the route chain.

### Navigation

```js
// From a component with PageMixin or ModuleMixin
this.navigate('/detail/42');

// From anywhere
import { navigate } from '@okalit';
navigate('/services');
```

---

## Guards

Guards protect routes. They run **before** loading the module/page (before `import()`). They can:

- Return `true` → allow navigation.
- Return `false` → block navigation.
- Return a `string` → redirect to that route.

```js
// guards/auth.guard.js
import { getChannel } from '@okalit';

export function authGuard() {
  const channel = getChannel('app:counter');
  const count = channel ? channel.value : 0;
  return count <= 2 ? '/' : true;  // Redirects to "/" if counter <= 2
}
```

```js
// Usage in routes
{
  path: '/detail/:id',
  component: 'example-detail',
  import: () => import('./pages/detail/example-detail.js'),
  guards: [authGuard],
}
```

---

## Interceptors

Interceptors run **after** guards and before rendering the route. They are ideal for logging, analytics, or transformations. They share the same return API as guards (`true`, `false`, or `string`):

```js
// interceptors/navlog.interceptor.js
import { getChannel } from '@okalit';

export function navLogInterceptor({ path }) {
  const channel = getChannel('app:navlog');
  if (channel) {
    const entry = `[${new Date().toLocaleTimeString()}] → ${path}`;
    channel.set([...channel.value, entry]);
  }
  return true; // Allow navigation to continue
}
```

---

## Channels

Channels are the reactive communication system between components, regardless of their position in the DOM tree.

### Defining a Channel

```js
// channels/example.channel.js
import { defineChannel } from '@okalit';

export const CounterChannel = defineChannel('app:counter', {
  initialValue: 0,
  persist: 'local',     // 'memory' | 'local' | 'session'
  scope: 'app',         // 'app' | 'module' | 'page'
});

export const NavLogChannel = defineChannel('app:navlog', {
  initialValue: [],
  persist: 'memory',
  scope: 'app',
});
```

### Channel Options

| Option | Values | Description |
|--------|--------|-------------|
| `initialValue` | any | Default value of the channel |
| `persist` | `'memory'`, `'local'`, `'session'` | Where the state is stored |
| `ephemeral` | `boolean` | If `true`, acts as an event bus (no stored state) |
| `scope` | `'app'`, `'module'`, `'page'` | When it's automatically cleared on navigation |

### Using a Channel in a Component

```js
import { CounterChannel } from '@channels/example.channel.js';

@defineElement({ tag: 'my-page' })
export class MyPage extends PageMixin(Okalit) {
  static channels = {
    counter: CounterChannel(),
  };

  render() {
    return html`
      <p>Value: ${this.counter.value}</p>
      <button @click=${() => this.counter.set(this.counter.value + 1)}>+1</button>
    `;
  }
}
```

### Reading a Channel Outside a Component

```js
import { getChannel } from '@okalit';

const channel = getChannel('app:counter');
console.log(channel.value);
```

### Subscribing to Changes with a Method

```js
static channels = {
  counter: CounterChannel('onCounterChange'),
};

onCounterChange(value) {
  console.log('Counter changed to:', value);
}
```

---

## Service Injection

Okalit uses a singleton pattern for services. They are registered with the `@service` decorator and injected with `inject()`.

### REST Service: `OkalitService`

```js
import { OkalitService, service } from '@okalit';

@service('user')
export class UserService extends OkalitService {
  constructor() {
    super();
    this.configure({
      baseUrl: 'https://jsonplaceholder.typicode.com',
      cache: true,
      cacheTTL: 60_000,  // 60 seconds
    });
  }

  getUsers() {
    return this.get('/users');
  }

  getUserById(id) {
    return this.get(`/users/${id}`);
  }

  createUser(data) {
    return this.post('/users', data);
  }

  updateUser(id, data) {
    return this.put(`/users/${id}`, data);
  }

  deleteUser(id) {
    return this.delete(`/users/${id}`);
  }
}
```

**Available HTTP Methods:**

| Method | Description |
|--------|-------------|
| `this.get(path, params?)` | GET with optional query params (cacheable) |
| `this.post(path, body)` | POST |
| `this.put(path, body)` | PUT |
| `this.delete(path)` | DELETE |
| `this.clearCache(path?)` | Clear cache (all or by path) |

### GraphQL Service: `OkalitGraphqlService`

```js
import { OkalitGraphqlService, service } from '@okalit';

@service('rickandmorty')
export class RickAndMortyService extends OkalitGraphqlService {
  constructor() {
    super();
    this.configure({
      endpoint: 'https://rickandmortyapi.com/graphql',
      cache: true,
      cacheTTL: 120_000,
    });
  }

  getCharacters() {
    return this.query(`{
      characters(page: 2, filter: { name: "rick" }) {
        results { name }
      }
    }`);
  }
}
```

**GraphQL Methods:**

| Method | Description |
|--------|-------------|
| `this.query(queryString, variables?)` | Execute a GraphQL query |
| `this.mutate(mutationString, variables?)` | Execute a GraphQL mutation |
| `this.clearCache(queryString?)` | Clear cache |

### `RequestControl` — Declarative Request Handling

All HTTP and GraphQL methods return a `RequestControl`, which offers two ways to use it:

**1. Declarative with `fire()`:**

```js
onInit() {
  this.userApi.getUsers().fire({
    onLoading: (v) => (this.loading.value = v),
    onSuccess: (data) => (this.users.value = data),
    onError: (err) => console.error(err),
    onFinish: () => console.log('Done'),
  });
}
```

**2. With `await`:**

```js
async onInit() {
  const users = await this.userApi.getUsers();
  this.users.value = users;
}
```

### Injecting a Service

```js
import { inject } from '@okalit';
import '@services/user.service.js'; // Import to register the singleton

const userApi = inject('user');
```

---

## Internationalization (i18n)

Okalit includes a reactive i18n system that automatically re-renders templates when the locale changes.

### Configuration

Configured in `AppMixin`:

```js
static config = {
  routes,
  i18n: {
    default: 'en',
    locales: ['es', 'en'],
  },
};
```

### Translation Files

Place JSON files in `public/i18n/`:

```json
// public/i18n/en.json
{
  "APP": {
    "TITLE": "Okalit Starter",
    "SUBTITLE": "A modern web component framework"
  },
  "HOME": {
    "HEADING": "Dashboard"
  }
}
```

### Usage in Templates

```js
import { t } from '@okalit';

render() {
  return html`
    <h1>${t('APP.TITLE')}</h1>
    <p>${t('HOME.GO_DETAIL', { id: '42' })}</p>
  `;
}
```

- Supports **nested keys** with dots: `t('SECTION.KEY')`
- Supports **interpolation**: `t('HELLO', { name: 'World' })` → `"Hello, World"`
- Is **reactive**: when the locale changes, templates update automatically.

### Switching Locale

```js
import { getI18n } from '@okalit';

// From a component with AppMixin
this.switchLocale('es');

// From anywhere
getI18n()?.setLocale('es');
```

---

## Performance Directives

Okalit provides three custom elements to control when heavy components are loaded, optimizing initial performance:

### `<o-idle>` — Load on Idle

Runs the loader when the browser is idle (`requestIdleCallback`):

```html
<o-idle .loader=${() => import('./components/lazy-widget.js')}>
  <lazy-widget></lazy-widget>
  <p slot="fallback">⏳ Loading...</p>
</o-idle>
```

### `<o-when>` — Conditional Load

Runs the loader when a condition is met:

```html
<o-when .condition=${this.showWidget.value} .loader=${() => import('./components/lazy-widget.js')}>
  <lazy-widget></lazy-widget>
  <p slot="fallback">⏳ Waiting for condition...</p>
</o-when>
```

### `<o-viewport>` — Load on Viewport Entry

Runs the loader when the element becomes visible (via `IntersectionObserver` with `rootMargin: 200px`):

```html
<o-viewport .loader=${() => import('./components/lazy-widget.js')}>
  <lazy-widget></lazy-widget>
  <p slot="fallback">⏳ Waiting for scroll...</p>
</o-viewport>
```

### Common Behavior

- All accept `.loader` as a function or array of functions (`Promise.all`).
- Use the **`fallback` slot** to display a placeholder while loading.
- Once loaded, the `loaded` attribute is added and the default slot content is shown.
- On failure, they emit the `o-error` event with the error detail.

---

## Custom Events (`output`)

Any component can emit events that cross Shadow DOM boundaries:

```js
// Emit
this.output('item-selected', { id: 42 });

// Listen from the parent template
html`<my-list @item-selected=${(e) => console.log(e.detail)}></my-list>`
```

---

## Exports Summary

```js
import {
  // Base class and template
  Okalit, html, signal, computed, effect, batch,

  // Decorators
  defineElement,

  // Mixins
  AppMixin, ModuleMixin, PageMixin,

  // Router
  Router, navigate,

  // Channels
  defineChannel, getChannel,

  // Services
  OkalitService, OkalitGraphqlService, RequestControl, service, inject,

  // i18n
  t, getI18n,

  // Performance
  OIdle, OWhen, OViewport,
} from '@okalit';
```

---

## License

MIT
