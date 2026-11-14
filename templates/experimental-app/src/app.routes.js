import ExampleRoutes from './modules/example/example.routes.js';

export default [
  {
    path: '/',
    component: 'example-module',
    import: () => import('./modules/example/example.module.ok'),
    children: ExampleRoutes,
  },
];
