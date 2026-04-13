import { navLogInterceptor } from '@interceptors/navlog.interceptor.js';
import ExampleModuleRoutes from './modules/example/example.routes.js';

export default [
  {
    path: '/',
    component: 'example-module',
    import: () => import('./modules/example/example.module.js'),
    interceptors: [navLogInterceptor],
    children: ExampleModuleRoutes,
  },
];
