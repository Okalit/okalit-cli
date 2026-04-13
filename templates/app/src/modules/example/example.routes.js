import { authGuard } from '@guards/auth.guard.js';

export default [
  {
    path: '/',
    component: 'example-home',
    import: () => import('./pages/home/example-home.js'),
  },
  {
    path: '/lifecycle',
    component: 'example-lifecycle',
    import: () => import('./pages/lifecycle/example-lifecycle.js'),
  },
  {
    path: '/services',
    component: 'example-services',
    import: () => import('./pages/services/example-services.js'),
  },
  {
    path: '/performance',
    component: 'example-performance',
    import: () => import('./pages/performance/example-performance.js'),
  },
  {
    path: '/detail/:id',
    component: 'example-detail',
    import: () => import('./pages/detail/example-detail.js'),
    guards: [authGuard],
  },
];
